#!/usr/bin/env node
/**
 * BetGPT research: causal draw-odds intercept correction.
 * Train once on prior complete season(s); freeze before subsequent season.
 * DOES NOT change production predictions or invent market odds.
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { loadFixtures, walkForward, SEASONS } from "./betgpt-elo-walk-forward.mjs";

const round = x => Number(x.toFixed(8));
const Y = ["H","D","A"];
const RIDGE = 25; // fixed, predetermined; shrinkage on single draw-bias parameter
const LIMIT = 0.8;
const MIN_TRAINING = 200;
function valid(p) {
  return Array.isArray(p) && p.length===3 && p.every(x=>typeof x==="number"&&Number.isFinite(x)&&x>0&&x<1)
    && Math.abs(p.reduce((s,x)=>s+x,0)-1)<1e-5;
}
const sigmoid = x=> x>=0 ? 1/(1+Math.exp(-x)) : Math.exp(x)/(1+Math.exp(x));
const logit = p=>Math.log(p/(1-p));
export function applyDrawBias(p,bias){
  if(!valid(p)||!Number.isFinite(bias)||Math.abs(bias)>LIMIT+1e-9)throw Error("CALIBRATOR_BAD_INPUT");
  const pd=sigmoid(logit(p[1])+bias);
  const scale=(1-pd)/(1-p[1]);
  const result=[p[0]*scale,pd,p[2]*scale];
  if(!valid(result))throw Error("CALIBRATOR_BAD_OUTPUT");
  return result;
}
export function fitDrawBias(rows, opts={}){
  const ridge=opts.ridge??RIDGE;
  if(!Array.isArray(rows) || rows.length<MIN_TRAINING || !Number.isFinite(ridge)||ridge<0||ridge>1000)
     throw Error("CALIBRATOR_INSUFFICIENT_TRAINING");
  for(const r of rows) {
    if(!valid(r.p)||!Number.isInteger(r.y)||r.y<0||r.y>2||typeof r.date!=="string")
      throw Error("CALIBRATOR_INVALID_TRAINING_ROW");
  }
  // Convex penalized logistic intercept fit on draw/not-draw. No odds or test labels.
  const gradient = bias => rows.reduce((acc,r)=>acc+sigmoid(logit(r.p[1])+bias)-(r.y===1?1:0),ridge*bias);
  let lo=-LIMIT,hi=LIMIT;
  if(gradient(lo)>=0)return {bias:lo,n:rows.length,limited:true,method:"PAST_SEASON_RIDGE_DRAW_LOGIT"};
  if(gradient(hi)<=0)return {bias:hi,n:rows.length,limited:true,method:"PAST_SEASON_RIDGE_DRAW_LOGIT"};
  for(let i=0;i<64;i++){
    const m=(lo+hi)/2;
    if(gradient(m)>0)hi=m;else lo=m;
  }
  return {bias:(lo+hi)/2,n:rows.length,limited:false,method:"PAST_SEASON_RIDGE_DRAW_LOGIT"};
}
const brier=(p,y)=>p.reduce((s,x,i)=>s+(x-(i===y?1:0))**2,0);
const loss=(p,y)=>-Math.log(p[y]);
const metric=(rows,attr)=>({
 n:rows.length,
 brier:round(rows.reduce((s,r)=>s+brier(r[attr],r.y),0)/rows.length),
 logLoss:round(rows.reduce((s,r)=>s+loss(r[attr],r.y),0)/rows.length),
 top1Accuracy:round(rows.filter(r=>r[attr].indexOf(Math.max(...r[attr]))===r.y).length/rows.length),
 drawMean:round(rows.reduce((s,r)=>s+r[attr][1],0)/rows.length),
 drawObserved:round(rows.filter(r=>r.y===1).length/rows.length),
 awayMean:round(rows.reduce((s,r)=>s+r[attr][2],0)/rows.length),
 awayObserved:round(rows.filter(r=>r.y===2).length/rows.length),
});
export function evaluateCausalCalibration(wf){
 if(!wf || !Array.isArray(wf._trainingPredictions) || !Array.isArray(wf._predictions))
  throw Error("CALIBRATOR_WALK_FORWARD_REQUIRED");
 const train2324=wf._trainingPredictions.filter(r=>r.season==="2324" && r.date < "2024-07-01");
 const eval2425=wf._predictions.filter(r=>r.season==="2425"&&r.date>="2024-07-01"&&r.date<"2025-07-01");
 const eval2526=wf._predictions.filter(r=>r.season==="2526"&&r.date>="2025-07-01"&&r.date<"2026-07-01");
 if(train2324.length<MIN_TRAINING||eval2425.length<300||eval2526.length<300)
  throw Error("CALIBRATOR_SEASONS_INSUFFICIENT");
 // Frozen before 2024/25 starts.
 const fit2425=fitDrawBias(train2324);
 // In 2025/26, the previously evaluated season is now legally historical.
 const trainBefore2526=[
   ...train2324,...eval2425.map(r=>({season:r.season,date:r.date,p:r.prob,y:r.y})),
 ];
 const fit2526=fitDrawBias(trainBefore2526);
 const scoreGroup=(rows,fit,season)=>{
   const scored=rows.map(r=>({
      date:r.date,y:r.y,raw:r.prob,calibrated:applyDrawBias(r.prob,fit.bias)
   }));
   const orig=metric(scored,"raw"), cal=metric(scored,"calibrated");
   return {season,trainingN:fit.n,drawLogitBias:round(fit.bias),truncated:fit.limited,
     raw:orig,calibrated:cal,
     deltaBrier:round(cal.brier-orig.brier),
     deltaLogLoss:round(cal.logLoss-orig.logLoss),
     top1AccuracyGain:round(cal.top1Accuracy-orig.top1Accuracy),
     predictionsSha256:createHash("sha256").update(JSON.stringify(scored.map(r=>[
       r.date,...r.calibrated.map(round)]))).digest("hex"),
     // returned privately for proper pooled metrics
     _scored:scored,
   };
 };
 const a=scoreGroup(eval2425,fit2425,"2425");
 const b=scoreGroup(eval2526,fit2526,"2526");
 const all=[...a._scored,...b._scored];
 const raw=metric(all,"raw"),calibrated=metric(all,"calibrated");
 const status=calibrated.brier<raw.brier && calibrated.logLoss<raw.logLoss
   ? "EXPLORATORY_IMPROVEMENT_BOTH_SCORES" : "NO_VALIDATED_IMPROVEMENT";
 const publicA=Object.fromEntries(Object.entries(a).filter(([k])=>k!=="_scored"));
 const publicB=Object.fromEntries(Object.entries(b).filter(([k])=>k!=="_scored"));
 return {
  schema:"astra-betgpt-draw-calibration-walk-forward/v1",
  fittedBeforeEachSeason:true,trainedOn:["2023/24 pre-2024/25","2023/24 + 2024/25 pre-2025/26"],
  noMarketOddsUsed:true,onlyExistingEloPoissonBacktestCore:true,
  ridgePenalty:RIDGE,maxAbsDrawLogitBias:LIMIT,minTrainN:MIN_TRAINING,
  bySeason:{2425:publicA,2526:publicB},
  overall:{n:all.length,raw,calibrated,deltaBrier:round(calibrated.brier-raw.brier),
    deltaLogLoss:round(calibrated.logLoss-raw.logLoss),
    top1AccuracyGain:round(calibrated.top1Accuracy-raw.top1Accuracy)},
  status,
  marketBaselineNotUsedForFit:true,
  productionActivated:false,
  tradingSignalsEnabled:false,
  warnings:[
   "Only the historical Elo-Poisson research core is evaluated, not the six-model production stack.",
   "Parameters and shrinkage fixed in code; no hyperparameter search on holdout results.",
   "2024/25 calibration trained on 2023/24 only; 2025/26 calibration fitted on 2023/24 and 2024/25 only.",
   "No bookmaker opening or closing odds used as calibration features.",
   "This observational backtest does not justify trading, expected value or forward ROI claims.",
  ],
 };
}
async function main(){
 const csv={};for(const [s,u] of Object.entries(SEASONS)){
  const r=await fetch(u,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error("SOURCE_HTTP_"+r.status+"_"+s);
  csv[s]=await r.text();
 }
 const data=loadFixtures(csv),wf=walkForward(data.rows);
 const report=evaluateCausalCalibration(wf);
 console.log(JSON.stringify({...report,sourcesSha256:data.hashes},null,2));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)
 main().catch(e=>{console.error("BETGPT_DRAW_CALIBRATION_FAIL",e.message);process.exitCode=1});
