#!/usr/bin/env node
/**
 * BetGPT prospective scoring, WITHOUT modifying frozen inputs or predictions.
 * ESPN official final scores only; same IDs, kickoff and teams required.
 * This is research evaluation, NOT bet settlement or a live-money strategy.
 */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {pathToFileURL} from "node:url";
const sha = x=>createHash("sha256").update(x).digest("hex");
const round=n=>Number(n.toFixed(8));
function validProb(p){return Array.isArray(p)&&p.length===3&&p.every(v=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<1)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-5;}
function sumMetrics(rows) {
 if(!rows.length)return null;
 const n=rows.length;
 return {n,brier:round(rows.reduce((s,x)=>s+x.brier,0)/n),
   logLoss:round(rows.reduce((s,x)=>s+x.logLoss,0)/n),
   top1HitRate:round(rows.reduce((s,x)=>s+(x.correctTop1?1:0),0)/n)};
}
export function verifyFrozen(frozen){
 if(!frozen||frozen.schema!=="astra-betgpt-prospective-six-model-shadow/v1"||
   frozen.sixIndependentModelFeeds!==false||frozen.marketQuotesUsed!==0||
   frozen.evaluatedMatches!==0||!Array.isArray(frozen.forecasts)||!frozen.forecasts.length)
   throw Error("FROZEN_SCHEMA_OR_GATES_INVALID");
 const keys=new Set();
 for(const r of frozen.forecasts){
  const ko=Date.parse(r.kickoff),at=Date.parse(r.frozenAt);
  if(!r.fixtureId?.startsWith("espn-")||!Number.isFinite(ko)||!Number.isFinite(at)||
    ko-at<3600000||r.outcome!==null||r.settlementStatus!=="AWAITING_REAL_FUTURE_RESULT"||
    !validProb(r.ensemble?.probabilities)||!Array.isArray(r.models)||r.models.length!==6||
    !r.models.every(m=>validProb(m.probabilities))||
    r.independence?.marketQuoteObserved!==false ||
    r.signalEligibility!=="BLOCKED_NO_MARKET_AND_INPUT_PROVENANCE" || keys.has(r.fixtureId))
     throw Error("FROZEN_FORECAST_TAMPER_OR_INCOMPLETE");
  keys.add(r.fixtureId);
 }
 const fingerprint=frozen.forecasts.map(f=>[f.fixtureId,f.kickoff,f.ensemble.probabilities,f.inputSha256]);
 if(sha(JSON.stringify(fingerprint))!==frozen.contentPredictionSha256)
   throw Error("FROZEN_PROBABILITIES_TAMPERED");
 return true;
}
export function scoreFrozen(frozen,boards,{observedAt,sourceHashes={}}){
 verifyFrozen(frozen);
 const asOf=Date.parse(observedAt);
 if(!Number.isFinite(asOf)||!Array.isArray(boards)||boards.some(b=>!Array.isArray(b?.events)))
   throw Error("INVALID_SETTLEMENT_SOURCES");
 const byId=new Map();
 for(const b of boards)for(const e of b.events??[]){
   const id="espn-"+String(e?.id??"");
   if(byId.has(id))throw Error("DUPLICATE_OFFICIAL_MATCH_ID");
   byId.set(id,e);
 }
 const settled=[],pending=[],voids=[],rejected=[];
 for(const f of frozen.forecasts){
   const event=byId.get(f.fixtureId);
   if(!event){pending.push({fixtureId:f.fixtureId,reason:"NO_RESULT_IN_LIVE_SOURCE"});continue;}
   const comp=event.competitions?.[0], type=comp?.status?.type??event.status?.type;
   const ko=Date.parse(f.kickoff);
   const endMin=ko+90*60000;
   if(asOf<endMin){pending.push({fixtureId:f.fixtureId,reason:"MATCH_NOT_OLD_ENOUGH"});continue;}
   const h=comp?.competitors?.find(t=>t.homeAway==="home"),a=comp?.competitors?.find(t=>t.homeAway==="away");
   const matchesTeams=String(h?.team?.id??"")===f.inputSnapshot.home.id &&
     String(a?.team?.id??"")===f.inputSnapshot.away.id &&
     Date.parse(event.date)===ko;
   if(!matchesTeams){rejected.push({fixtureId:f.fixtureId,reason:"MISMATCHED_OFFICIAL_FIXTURE"});continue;}
   if(type?.state==="pre"||type?.state==="in"||type?.completed!==true){
     pending.push({fixtureId:f.fixtureId,reason:"NO_OFFICIAL_FINAL"});continue;
   }
   if(type?.state!=="post"){
     rejected.push({fixtureId:f.fixtureId,reason:"OFFICIAL_STATUS_UNKNOWN"});continue;
   }
   const home=Number(h?.score),away=Number(a?.score);
   if(!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||home>30||away>30){
     rejected.push({fixtureId:f.fixtureId,reason:"NO_VALID_FINAL_SCORE"});continue;
   }
   const outcome=home>away?0:home===away?1:2;
   const p=f.ensemble.probabilities;
   const brier=p.reduce((s,v,i)=>s+(v-(i===outcome?1:0))**2,0);
   settled.push({fixtureId:f.fixtureId,kickoff:f.kickoff,observedAt,
     result:[home,away],outcome:["H","D","A"][outcome],
     brier:round(brier),logLoss:round(-Math.log(p[outcome])),
     correctTop1:p.indexOf(Math.max(...p))===outcome,
     source:"ESPN_OFFICIAL_SCORE",frozenInputSha256:f.inputSha256,
     originalPredictionSha256:frozen.contentPredictionSha256,
     signalEligibility:"RESEARCH_ONLY_NO_BET",
   });
 }
 return {
   schema:"astra-betgpt-prospective-official-evaluation/v1",
   observedAt,forecastCapturedAt:frozen.createdAt,
   originalPredictionSha256:frozen.contentPredictionSha256,
   officialSourceHashes:sourceHashes,
   frozenForecastCount:frozen.forecasts.length,
   settledCount:settled.length,pendingCount:pending.length,
   rejectedCount:rejected.length,voidCount:voids.length,
   metrics:sumMetrics(settled),
   evidenceStatus:settled.length>=60 && rejected.length===0?
     "PARTIAL_MODEL_CALIBRATION_SAMPLE_ONLY" :
     settled.length>0?"INSUFFICIENT_FORWARD_SAMPLE":
     "AWAITING_OFFICIAL_RESULTS",
   fullSixModelIndependentFeeds:false,validatedValueBets:false,
   settled,pending,rejected,voids,
 };
}
export function readFrozenB64(file) {
 const b64=readFileSync(file,"utf8").trim();
 if(!/^[A-Za-z0-9+/=]+$/.test(b64))throw Error("INVALID_ARCHIVE_BASE64");
 const raw=gunzipSync(Buffer.from(b64,"base64"));
 if(raw.length>3e6||raw.length<100)throw Error("INVALID_ARCHIVE_SIZE");
 const o=JSON.parse(raw.toString("utf8"));
 verifyFrozen(o);
 return {snapshot:o,rawSha256:sha(raw)};
}
async function getBoard(day) {
 const url="https://site.web.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates="+day+"&limit=100";
 const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("ESPN_POSTMATCH_HTTP_"+r.status);
 const raw=await r.text();
 if(raw.length<50||raw.length>3e6)throw Error("BAD_ESPN_POSTMATCH_PAYLOAD");
 return {body:JSON.parse(raw),sha256:sha(raw)};
}
async function main() {
 const a=process.argv.slice(2),file=a[a.indexOf("--archive")+1],dates=a[a.indexOf("--dates")+1],out=a[a.indexOf("--out")+1];
 if(!file||!dates||!out||!dates.split(",").every(d=>/^20[2-9][0-9][01][0-9][0-3][0-9]$/.test(d)))
   throw Error("usage: --archive frozen.json.gz.b64 --dates YYYYMMDD,YYYYMMDD --out report.json");
 const {snapshot,rawSha256}=readFrozenB64(file);
 const sources=await Promise.all(dates.split(",").map(getBoard));
 const observedAt=new Date().toISOString();
 const data=scoreFrozen(snapshot,sources.map(s=>s.body),{
   observedAt,sourceHashes:Object.fromEntries(sources.map((s,i)=>[dates.split(",")[i],s.sha256]))});
 data.frozenArchiveRawSha256=rawSha256;
 writeFileSync(out,JSON.stringify(data,null,2)+"\n");
 console.log(JSON.stringify({status:data.evidenceStatus,frozenRawSha256:rawSha256,
   pending:data.pendingCount,settled:data.settledCount,rejected:data.rejectedCount,
   brier:data.metrics?.brier??null,hash:data.originalPredictionSha256}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)
 main().catch(e=>{console.error("BETGPT_PROSPECTIVE_EVALUATION_FAIL",e.message);process.exitCode=1});
