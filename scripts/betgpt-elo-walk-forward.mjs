#!/usr/bin/env node
/**
 * BetGPT walk-forward probabilities (frozen Elo-Poisson core from backtest.ts).
 * Crucial: prediction receives only date, home-team, away-team and pre-date Elo.
 * Outcomes and bookmaker CLOSING odds enter the scorer only AFTER the date batch.
 * Not a reconstruction/validation of the full six-model live BetGPT stack.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { clamp, goalMatrix } from "../src/engine/math.ts";
import { parseCsv } from "./audit-pinnacle-historical.mjs";

export const SEASONS = Object.freeze({
  "2324": "https://www.football-data.co.uk/mmz4281/2324/E0.csv",
  "2425": "https://www.football-data.co.uk/mmz4281/2425/E0.csv",
  "2526": "https://www.football-data.co.uk/mmz4281/2526/E0.csv",
});
const PRESEASON_CUTOFF = "2024-07-01"; // fixed BEFORE holdout
const TRAIN_SINCE = "2023-07-01";
const SEASON_THRU = "2026-07-01";
const DEFAULT_ELO = 1700, K = 16, HOME_ELO = 55;
const round = n => n === null || !Number.isFinite(n) ? null : Number(n.toFixed(6));
const triple = [1, 1, 1];
const outcomes = ["H", "D", "A"];

function dateYmd(raw) {
  const m = String(raw ?? "").match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length===2?2000+Number(m[3]):Number(m[3]);
  const d=Number(m[1]), mo=Number(m[2]);
  const v=new Date(Date.UTC(y,mo-1,d));
  if(v.getUTCFullYear()!==y||v.getUTCMonth()!==mo-1||v.getUTCDate()!==d) return null;
  return v.toISOString().slice(0,10);
}

export function loadFixtures(csvBySeason) {
  const rows=[], hashes={}, counts={};
  let rejected=0;
  for (const season of Object.keys(SEASONS)) {
    const csv=csvBySeason?.[season];
    if(typeof csv!=="string" || csv.length<100) throw Error("MISSING_OR_SHORT_SEASON_"+season);
    hashes[season]=createHash("sha256").update(csv,"utf8").digest("hex");
    const parsed=parseCsv(csv);
    counts[season]={sourceRows:parsed.length, validRows:0};
    const seen=new Set();
    for(const r of parsed){
      const date=dateYmd(r.Date);
      const home=r.HomeTeam?.trim(),away=r.AwayTeam?.trim();
      const gh=Number(r.FTHG),ga=Number(r.FTAG);
      const result=gh>ga?"H":gh===ga?"D":"A";
      const dateAllowed=date && date >= season.slice(0,2).replace(/^/, "20")+"-07-01" &&
        date < String(2000+Number(season.slice(2)))+"-07-01";
      const key=[date,home?.toLowerCase(),away?.toLowerCase()].join("|");
      if(!dateAllowed || !home || !away || home===away || !Number.isInteger(gh) ||
         !Number.isInteger(ga) || gh<0 || ga<0 || gh>20 || ga>20 ||
         !outcomes.includes(r.FTR) || r.FTR!==result || seen.has(key)){
        rejected++; continue;
      }
      seen.add(key);counts[season].validRows++;
      rows.push({season,date,home,away,gh,ga,result,
        // Post hoc only. A literal separate scorer will read this after prediction.
        b365Close:[r.B365CH,r.B365CD,r.B365CA].map(x=>x?.trim()!==""?Number(x):NaN)
      });
    }
  }
  const sorted=rows.sort((a,b)=>a.date.localeCompare(b.date)||
    a.home.localeCompare(b.home)||a.away.localeCompare(b.away));
  if(sorted.length<900 || counts["2324"].validRows<300 || counts["2425"].validRows<300) throw Error("HISTORY_COVERAGE_INSUFFICIENT");
  return {rows:sorted,hashes,counts,rejected};
}

function noVig3(odds) {
  if(!Array.isArray(odds) || odds.length!==3 ||
     !odds.every(x=>Number.isFinite(x)&&x>=1.05&&x<=100))return null;
  const v=odds.map(o=>1/o),sum=v.reduce((a,b)=>a+b,0);
  if(sum<0.95||sum>1.3)return null;
  return v.map(x=>x/sum);
}
function brier(p,y){return p.reduce((sum,x,i)=>sum+(x-(i===y?1:0))**2,0)}
function loss(p,y){return -Math.log(Math.max(1e-10,p[y]))}
function avg(items,key){return items.length?items.reduce((s,r)=>s+r[key],0)/items.length:null}
function bootstrapPaired(rows,field,seed=20261113){
  // Match-day cluster resampling: every fixture on a calendar day moves together.
  // Still exploratory because consecutive days and repeated clubs are correlated.
  if(rows.length<100) return null;
  const buckets=new Map();
  for(const r of rows){
    const arr=buckets.get(r.date)??[];
    arr.push(r);buckets.set(r.date,arr);
  }
  const groups=[...buckets.values()];
  if(groups.length<50)return null;
  let state=seed>>>0;
  const rnd=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
  const vals=new Array(2000);
  for(let b=0;b<vals.length;b++){
    let sum=0,count=0;
    for(let i=0;i<groups.length;i++){
      const g=groups[Math.floor(rnd()*groups.length)];
      for(const row of g){sum+=row[field];count++;}
    }
    vals[b]=sum/count;
  }
  vals.sort((a,b)=>a-b);
  return [round(vals[49]),round(vals[1950])];
}
function metricRows(rows){
  const n=rows.length;
  if(!n)return {n:0,brier:null,logLoss:null,meanBaselineBrier:null,meanBaselineLogLoss:null,
    pairedDeltaBrier:null,pairedDeltaLogLoss:null,pairedDeltaBrierDateClusterBootstrap95:null,pairedDeltaLogLossDateClusterBootstrap95:null,
    topClassCalibrationEce:null,marketCloseComparator:null};
  const eceBins=Array.from({length:10},()=>({n:0,p:0,y:0}));
  for(const r of rows){
    const j=r.prob.indexOf(Math.max(...r.prob));
    const c=eceBins[Math.min(9,Math.floor(r.prob[j]*10))];
    c.n++;c.p+=r.prob[j];c.y+=(j===r.y?1:0);
  }
  const marketRows=rows.filter(r=>r.marketBrier!==null);
  const classCalibration=outcomes.map((name,i)=>({
    outcome:name,meanPredicted:round(rows.reduce((sum,r)=>sum+r.prob[i],0)/n),
    observedFrequency:round(rows.filter(r=>r.y===i).length/n),
  }));
  const modelTop1Accuracy=rows.filter(r=>r.prob.indexOf(Math.max(...r.prob))===r.y).length/n;
  return {n,modelTop1Accuracy:round(modelTop1Accuracy),classCalibration,brier:round(avg(rows,"modelBrier")),logLoss:round(avg(rows,"modelLogLoss")),
    meanBaselineBrier:round(avg(rows,"baselineBrier")),
    meanBaselineLogLoss:round(avg(rows,"baselineLogLoss")),
    pairedDeltaBrier:round(avg(rows,"deltaBrier")),
    pairedDeltaLogLoss:round(avg(rows,"deltaLogLoss")),
    pairedDeltaBrierDateClusterBootstrap95:bootstrapPaired(rows,"deltaBrier"),
    pairedDeltaLogLossDateClusterBootstrap95:bootstrapPaired(rows,"deltaLogLoss",20261114),
    topClassCalibrationEce:round(eceBins.reduce((s,b)=>s+(b.n/n)*Math.abs(b.p/Math.max(1,b.n)-b.y/Math.max(1,b.n)),0)),
    marketCloseComparator:{
      n:marketRows.length,
      brier:round(avg(marketRows,"marketBrier")),
      logLoss:round(avg(marketRows,"marketLogLoss")),
      usedForPrediction:false, retrospectiveOnly:true,
      pairedModelMinusMarketCloseBrier:round(marketRows.length?
        marketRows.reduce((sum,r)=>sum+r.modelBrier-r.marketBrier,0)/marketRows.length:null),
      pairedModelMinusMarketCloseLogLoss:round(marketRows.length?
        marketRows.reduce((sum,r)=>sum+r.modelLogLoss-r.marketLogLoss,0)/marketRows.length:null),
    },
  };
}
export function predictEloPoisson(eloH,eloA){
  // EXACT coefficients from src/engine/backtest.ts:
  // d=(eloH-eloA+55)/900
  // lh=clamp(1.18*10**(d*0.55),0.55,2.7)
  // la=clamp(1.08*10**(-d*0.55),0.5,2.5)
  // goalMatrix(lh,la,-0.1)
  const d=(eloH-eloA+HOME_ELO)/900;
  const lh=clamp(1.18*Math.pow(10,d*0.55),0.55,2.7);
  const la=clamp(1.08*Math.pow(10,-d*0.55),0.5,2.5);
  const g=goalMatrix(lh,la,-0.1);
  return [g.home,g.draw,g.away];
}
export function walkForward(fixtures){
  if(!Array.isArray(fixtures) || !fixtures.length)throw Error("MISSING_FIXTURES");
  const byDate=new Map(),unique=new Set();
  for(const m of fixtures){
    if(!m || !m.date || !m.home || !m.away || !outcomes.includes(m.result) ||
       !Number.isInteger(m.gh) || !Number.isInteger(m.ga) || m.gh<0 || m.ga<0 ||
       (m.gh>m.ga?"H":m.gh===m.ga?"D":"A")!==m.result)throw Error("INVALID_FIXTURE");
    const key=[m.date,m.home,m.away].join("|");
    if(unique.has(key))throw Error("DUPLICATE_FIXTURE");
    unique.add(key);
    const row=byDate.get(m.date)??[];row.push(m);byDate.set(m.date,row);
  }
  const rating=new Map(),teamMatches=new Map(),occ=[1,1,1], out=[];
  const trainingPredictions=[];
  const predictionStream=[];
  let trainingMatches=0;
  for(const date of [...byDate.keys()].sort()){
    const batch=byDate.get(date).sort((a,b)=>a.home.localeCompare(b.home)||a.away.localeCompare(b.away));
    const teamsOfDay=new Set();
    for(const m of batch){
      if(teamsOfDay.has(m.home)||teamsOfDay.has(m.away))throw Error("SAME_DAY_TEAM_CONFLICT");
      teamsOfDay.add(m.home);teamsOfDay.add(m.away);
    }
    // Predictions are all frozen before ANY result on the same calendar day is used.
    const prepared=batch.map(m=>{
      const h=rating.get(m.home)??DEFAULT_ELO,a=rating.get(m.away)??DEFAULT_ELO;
      const p=predictEloPoisson(h,a);
      const baseline=occ.map(n=>n/occ.reduce((s,x)=>s+x,0));
      const isEval=date>=PRESEASON_CUTOFF&&date<SEASON_THRU;
      return {m,h,a,p,baseline,isEval,homePast:teamMatches.get(m.home)??0,
        awayPast:teamMatches.get(m.away)??0};
    });
    for(const x of prepared){
      const {m,p,baseline,isEval}=x;
      if(isEval){
        const y=outcomes.indexOf(m.result);
        const close=noVig3(m.b365Close); // ONLY AFTER a frozen prediction has been constructed
        const row={
          season:m.season,date,home:m.home,away:m.away,y,prob:p,baseline,
          homePast:x.homePast,awayPast:x.awayPast,
          modelBrier:brier(p,y),modelLogLoss:loss(p,y),
          baselineBrier:brier(baseline,y),baselineLogLoss:loss(baseline,y),
          marketBrier:close?brier(close,y):null,
          marketLogLoss:close?loss(close,y):null,
        };
        row.deltaBrier=row.modelBrier-row.baselineBrier;
        row.deltaLogLoss=row.modelLogLoss-row.baselineLogLoss;
        out.push(row);
        predictionStream.push([date,m.home,m.away,...p.map(round)]);
      }else {
        trainingMatches++;
        // Frozen prediction was computed before any score for this match/day.
        // Outcome is exposed only to the offline calibration training stage.
        trainingPredictions.push({season:m.season,date,p:[...p],y:outcomes.indexOf(m.result)});
      }
    }
    // Update AFTER all fixtures of the day were predicted and scored.
    for(const {m,h,a} of prepared){
      const score=m.gh>m.ga?1:m.gh===m.ga?0.5:0;
      const expected=1/(1+Math.pow(10,(a-(h+HOME_ELO))/400));
      rating.set(m.home,clamp(h+K*(score-expected),1350,2300));
      rating.set(m.away,clamp(a+K*((1-score)-(1-expected)),1350,2300));
      occ[outcomes.indexOf(m.result)]++;
      teamMatches.set(m.home,(teamMatches.get(m.home)??0)+1);
      teamMatches.set(m.away,(teamMatches.get(m.away)??0)+1);
    }
  }
  const subsets={};
  for(const season of ["2425","2526"]){
    subsets[season]=metricRows(out.filter(r=>r.season===season));
  }
  const total=metricRows(out);
  const deltaCI=total.pairedDeltaBrierDateClusterBootstrap95;
  return {
    schema:"astra-betgpt-walk-forward-elo-poisson/v1",
    engine:"EXISTING_BACKTEST_ELO_POISSON_CORE_REPRODUCTION",
    fullLiveSixModelStackValidated:false,
    predictionFields:["date","home_team","away_team","prior_elo","prior_league_outcome_counts"],
    excludedFromPrediction:["FTR","FTHG","FTAG","PSCH","PSCD","PSCA","B365CH","B365CD","B365CA","all closing odds","future fixture outcomes"],
    sameDayPolicy:"PREDICT_ALL_THEN_UPDATE_ONLY_AFTER_MATCH_DAY",
    coldStartElo:DEFAULT_ELO,kFactor:K,homeElo:HOME_ELO,dixonColesRho:-0.1,
    trainingCutoff:PRESEASON_CUTOFF,trainingMatches,
    scoredHoldout:total,bySeason:subsets,
    holdoutPredictionStreamSha256:createHash("sha256").update(JSON.stringify(predictionStream)).digest("hex"),
    calibratedAgainstEmpiricalBaseline:deltaCI&&deltaCI[1]<0?"EXPLORATORY_DAY_CLUSTER_CI_BELOW_ZERO":
      deltaCI&&deltaCI[0]>0?"EXPLORATORY_DAY_CLUSTER_CI_ABOVE_ZERO":"NO_CLEAR_IMPROVEMENT",
    warnings:[
      "Validation ONLY of BetGPT historical backtest Elo-Poisson core; full live six-model MatchInput is not replayable from this CSV.",
      "Uniformly frozen model coefficients; Elo and league baseline updated chronologically AFTER each day's games.",
      "The first held-out season (2024/25) starts after a 2023/24 training-only warmup; 2025/26 is a second later prequential holdout.",
      "Closing Bet365 prices are retrospective post-hoc diagnostics, NOT pre-kickoff tradable prices or predictive features.",
      "A paired match-day cluster bootstrap partially addresses shared-date correlation but not repeat-team or serial dependence; exploratory only.",
      "No provider-observed pre-match bet odds, EV, ROI, CLV, live odds, or true six-model calibration proven.",
    ],
    _predictions:out, // caller removes from console audit; useful for adversarial tests
    _trainingPredictions:trainingPredictions, // prior-season calibration, not emitted in the public report
  };
}
async function download(season) {
  const response=await fetch(SEASONS[season],{signal:AbortSignal.timeout(12000),
    headers:{"user-agent":"ASTRA-BetGPT-Research/1.0"}});
  if(!response.ok)throw Error("SOURCE_HTTP_"+response.status+"_"+season);
  const text=await response.text();
  if(text.length<1000||text.length>5_000_000)throw Error("SOURCE_SIZE_INVALID_"+season);
  return text;
}
async function main(args){
  const files={};
  for(const s of Object.keys(SEASONS)){
    if(args.includes("--dir")){
      files[s]=await readFile(args[args.indexOf("--dir")+1]+"/"+s+"_E0.csv","utf8");
    } else files[s]=await download(s);
  }
  const {rows,hashes,counts,rejected}=loadFixtures(files);
  const { _predictions, _trainingPredictions, ...evaluation }=walkForward(rows);
  console.log(JSON.stringify({
    ...evaluation,sourceFiles:SEASONS,csvSha256:hashes,sourceRows:counts,rejectedRows:rejected,
  },null,2));
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  main(process.argv.slice(2)).catch(e=>{console.error("ASTRA_WALK_FORWARD_FAIL",e.message);process.exitCode=1});
}
