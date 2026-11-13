#!/usr/bin/env node
/**
 * ASTRA BetGPT prospective evidence capture. Real ESPN fixtures / standings,
 * unchanged src/engine/models.ts six-model stack, explicit proxy provenance.
 * This is NOT evidence of six independently observed data feeds, live prices,
 * commercial value bets, ROI or out-of-sample calibration.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runStatisticalStack } from "../src/engine/models.ts";

export const LEAGUE = "eng.1";
export const STANDINGS_URL = "https://site.web.api.espn.com/apis/v2/sports/soccer/" + LEAGUE + "/standings?lang=en&region=us";
export const boardUrl = ymd => "https://site.web.api.espn.com/apis/site/v2/sports/soccer/" + LEAGUE + "/scoreboard?dates=" + ymd + "&limit=100";
const MODEL_IDS = ["poisson","dixonColes","elo","xg","glm","market"];
const shortHash = str => createHash("sha256").update(str).digest("hex");
const round = n => Number(n.toFixed(8));
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
const REQUIRED_STATS = ["gamesPlayed","pointsFor","pointsAgainst","rank","points","wins","losses","ties"];

function positiveNum(n) { return typeof n === "number" && Number.isFinite(n) && n >= 0; }
function teamName(t) { return String(t?.displayName ?? t?.shortDisplayName ?? "").trim(); }
function statsMap(row) {
  const out={};
  for(const stat of row?.stats??[]) if (stat?.name && Number.isFinite(stat.value)) out[stat.name]=stat.value;
  return out;
}
function parseStandings(body) {
  const entries=body?.children?.[0]?.standings?.entries;
  if(!Array.isArray(entries)||entries.length<16)throw Error("STANDINGS_SOURCE_INVALID");
  const byId=new Map();
  for(const e of entries) {
    const id=String(e.team?.id??"");
    const name=teamName(e.team);
    const s=statsMap(e);
    if(!id||!name||REQUIRED_STATS.some(k=>!positiveNum(s[k]))||
       !(s.gamesPlayed>0) || !(s.rank>=1 && s.rank<=24) ||
       s.pointsFor>300 || s.pointsAgainst>300 || byId.has(id)) continue;
    byId.set(id,{id,name,stats:s});
  }
  if(byId.size<16)throw Error("STANDINGS_COVERAGE_LOW");
  return byId;
}

/**
 * Deliberate observable vs proxy split. This adapter is close to the
 * standings fallback in live.ts profileFrom, but cannot recreate static style
 * overrides or absent historical xG/PPDA/lineups; mark it as a research proxy.
 */
function derivedTeam(e) {
  const {id,name,stats:s}=e, gp=s.gamesPlayed, gf=s.pointsFor/gp,ga=s.pointsAgainst/gp, rank=s.rank;
  return {
    id,name,short:name.slice(0,3).toUpperCase(),league:"PL",
    attack:clamp(0.9+gf*0.42,.65,2.25),
    defense:clamp(0.7+ga*0.28,.52,1.55),
    elo:clamp(2080-(rank-1)*16+s.points*4,1600,2150),
    xgFor:clamp(gf*1.06,.6,2.6), xgAgainst:clamp(ga*.98,.55,2.2),
    possession:clamp(62-rank*.7,42,68),ppda:clamp(8.2+rank*.18,7.5,14),
    fieldTilt:clamp(70-rank*1.1,40,74),progressivePasses:clamp(58-rank*1.1,28,64),
    highTurnovers:clamp(9.2-rank*.12,5,10.5),recoveries:48,
    compactness:clamp(.82-rank*.012,.45,.9),setPieceXg:.22,duelWin:clamp(56-rank*.25,46,60),
    cardsPerGame:1.9,flexibility:.6,pressLine:clamp(.85-rank*.02,.35,.88),
    buildup:clamp(.9-rank*.02,.35,.92),depth:clamp(.88-rank*.02,.4,.94),
    formation:"UNOBSERVED",color:"#8fad7a",
  };
}
const observed=(value,source,timestamp,confidence)=>({value,source,timestamp,confidence,freshnessHours:0});
function toMatch(event,home,away,capturedAt){
  const kickoff=event.date;
  const zero={
    book:"UNAVAILABLE_NO_MARKET_QUOTE",home:0,draw:0,away:0,
    over15:0,over25:0,over35:0,under25:0,bttsYes:0,bttsNo:0,
  };
  return {
    id:"espn-"+String(event.id),league:"PL",competition:"Premier League",kickoff,
    venue:"UNOBSERVED",
    home:derivedTeam(home),away:derivedTeam(away),
    restHome:observed(6,"MODEL_ESTIMATE_REST_UNKNOWN",capturedAt,0),
    restAway:observed(6,"MODEL_ESTIMATE_REST_UNKNOWN",capturedAt,0),
    travelAwayKm:observed(250,"MODEL_ESTIMATE_DISTANCE_UNKNOWN",capturedAt,0),
    congestionHome:observed(.25,"MODEL_ESTIMATE_CONGESTION_UNKNOWN",capturedAt,0),
    congestionAway:observed(.25,"MODEL_ESTIMATE_CONGESTION_UNKNOWN",capturedAt,0),
    absencesHome:observed([],"MISSING_ABSENCES_NOT_CONFIRMED_EMPTY",capturedAt,0),
    absencesAway:observed([],"MISSING_ABSENCES_NOT_CONFIRMED_EMPTY",capturedAt,0),
    importance:observed(.6,"MODEL_ESTIMATE_IMPORTANCE_UNKNOWN",capturedAt,0),
    opening:zero,current:[],notes:["RESEARCH_ONLY","NO_AUTHORISED_MARKET_QUOTES"],
    status:"scheduled",oddsSource:"NONE",
  };
}
function prob3(o){
  const p=[o.home,o.draw,o.away];
  if(!p.every(x=>Number.isFinite(x)&&x>0&&x<1)||Math.abs(p.reduce((s,x)=>s+x,0)-1)>1e-5)
    throw Error("INVALID_MODEL_PROBABILITY_SIMPLEX");
  return p.map(round);
}
function normalizedInputStamp(e) {
  const t=Date.parse(e?.date);
  return Number.isFinite(t) ? t : null;
}
export function freezePrematch({
  standings,boards,capturedAt,sourceHashes={},sourceFetchedAt={},sourceGitSha=null,
  predictor=runStatisticalStack, maxEvents=20,
}){
  const at=Date.parse(capturedAt);
  if(!Number.isFinite(at)||!Array.isArray(boards)||boards.length===0||
     boards.length>5||!standings||typeof standings!=="object"||
     !Number.isInteger(maxEvents)||maxEvents<1||maxEvents>100) throw Error("INVALID_PREMATCH_CAPTURE_INPUT");
  if(!sourceHashes.standings||Object.keys(sourceHashes).filter(k=>k!=="standings").length!==boards.length)
    throw Error("SOURCE_HASHES_REQUIRED");
  const teams=parseStandings(standings);
  const seen=new Set(),forecast=[],rejections=[];
  const sources=Object.entries(sourceHashes).map(([name,sha256])=>({
    name,sha256,fetchedAt:sourceFetchedAt[name]??null,
  }));
  for(const board of boards) {
    if(!Array.isArray(board?.events))throw Error("INVALID_BOARD_SCHEMA");
    for(const e of board.events) {
      const ko=normalizedInputStamp(e);
      const id=String(e?.id??"");
      const comp=e?.competitions?.[0];
      const st=comp?.status?.type??e.status?.type;
      const h=comp?.competitors?.find(z=>z.homeAway==="home");
      const a=comp?.competitors?.find(z=>z.homeAway==="away");
      const hId=String(h?.team?.id??""),aId=String(a?.team?.id??"");
      if(seen.has(id)){rejections.push({id,reason:"DUPLICATE_EVENT"});continue;}
      seen.add(id);
      if(!id||!ko||ko-at<3600_000||st?.state!=="pre"||st?.completed!==false||
         !hId||!aId||hId===aId) {
        rejections.push({id,reason:"NOT_SAFELY_FUTURE_SCHEDULED"});continue;
      }
      const home=teams.get(hId),away=teams.get(aId);
      if(!home||!away) {
        rejections.push({id,reason:"MISSING_OBSERVED_STANDINGS"});continue;
      }
      const input=toMatch(e,home,away,capturedAt);
      // No final score/market odds ever enters the prediction function.
      const result=predictor(input,-0.1);
      if(!result||!Array.isArray(result.models)||result.models.length!==6||
        MODEL_IDS.some(n=>!result.models.some(m=>m.model===n)))throw Error("MODEL_STACK_NOT_EXECUTED");
      const models=result.models.map(m=>({
        model:m.model,version:m.version,probabilities:prob3(m),
        inputType:m.model==="market"?"POISSON_FALLBACK_NO_QUOTE":"STANDINGS_DERIVED_PROXIES",
      }));
      const probabilities=prob3(result.ensemble);
      const fixedInput={
        home:{id:home.id,name:home.name,stats:home.stats,profile:input.home},
        away:{id:away.id,name:away.name,stats:away.stats,profile:input.away},
        restHome:input.restHome,restAway:input.restAway,travelAwayKm:input.travelAwayKm,
        congestionHome:input.congestionHome,congestionAway:input.congestionAway,
        importance:input.importance,absencesHome:input.absencesHome,absencesAway:input.absencesAway,
        opening:input.opening,current:input.current,
      };
      forecast.push({
        fixtureId:input.id,league:input.league,home:home.name,away:away.name,
        kickoff:input.kickoff,frozenAt:capturedAt,leadMinutes:Math.floor((ko-at)/60000),
        inputSha256:shortHash(JSON.stringify(fixedInput)),
        inputSnapshot:fixedInput,
        models,ensemble:{
          probabilities,weights:result.ensemble.weights,disagreement:round(result.ensemble.disagreement),
        },
        independence:{sixModelCodeExecuted:true,marketQuoteObserved:false,
          marketModelIndependent:false,xgObserved:false,ppdaObserved:false,absencesObserved:false,
          productionProfileEquivalent:false},
        signalEligibility:"BLOCKED_NO_MARKET_AND_INPUT_PROVENANCE",
        outcome:null,settlementStatus:"AWAITING_REAL_FUTURE_RESULT",
      });
      if(forecast.length>=maxEvents)break;
    }
    if(forecast.length>=maxEvents)break;
  }
  const fingerprint=forecast.map(f=>[f.fixtureId,f.kickoff,f.ensemble.probabilities,f.inputSha256]);
  return {
    schema:"astra-betgpt-prospective-six-model-shadow/v1",
    createdAt:capturedAt,sourceGitSha,fixtureSource:"ESPN_PUBLIC_LIVE_AT_CAPTURE",
    sourceData:sources,bookmakerFeed:"NONE",marketQuotesUsed:0,
    sixModelMathExecuted:true, sixIndependentModelFeeds:false,
    liveProductionInputEquivalent:false,
    predictionsFrozenBeforeKickoff:forecast.length,
    evaluatedMatches:0,
    status:forecast.length?"PARTIAL_PREMATCH_SHADOW_FROZEN":"FAIL_NO_ELIGIBLE_FIXTURES",
    rules:{
      validFutureMinMinutes:60,scoreAndOddsInput:"FORBIDDEN",
      model:"EXISTING_SRC_ENGINE_MODELS_RUNSTATISTICALSTACK",
      rho:-0.1,restAndAbsences:"UNVERIFIED_PROXIES",
      modelMarket:"FALLBACK_TO_POISSON_IF_NO_BOOKMAKER_QUOTES",
      noTrading:"TRUE",noAutoSettlement:"TRUE",
    },
    contentPredictionSha256:shortHash(JSON.stringify(fingerprint)),
    forecasts:forecast,rejections,
  };
}
async function getJson(url) {
  const reqAt=new Date().toISOString();
  const res=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:"application/json"}});
  if(!res.ok)throw Error("ESPN_SOURCE_HTTP_"+res.status);
  const raw=await res.text();
  if(raw.length<50||raw.length>5_000_000)throw Error("ESPN_SOURCE_BAD_SIZE");
  const finishedAt=new Date().toISOString();
  return {body:JSON.parse(raw),hash:shortHash(raw),fetchedAt:{startedAt:reqAt,finishedAt,httpDate:res.headers.get("date")},url};
}
export async function captureFromEspn({dates,sourceGitSha}){
  if(!Array.isArray(dates)||!dates.length||dates.length>4||
     dates.some(d=>!/^20[2-9][0-9](0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/.test(d)))
    throw Error("DATES_NOT_ALLOWED");
  const s=await getJson(STANDINGS_URL);
  const b=await Promise.all(dates.map(d=>getJson(boardUrl(d))));
  const sourceHashes={standings:s.hash},sourceFetchedAt={standings:{url:s.url,...s.fetchedAt}};
  for(let i=0;i<b.length;i++){
    sourceHashes[dates[i]]=b[i].hash;
    sourceFetchedAt[dates[i]]={url:b[i].url,...b[i].fetchedAt};
  }
  return freezePrematch({standings:s.body,boards:b.map(x=>x.body),
    capturedAt:new Date().toISOString(),sourceHashes,sourceFetchedAt,sourceGitSha});
}
async function main(){
  const args=process.argv.slice(2), dIndex=args.indexOf("--dates"),outIndex=args.indexOf("--out");
  if(dIndex<0||outIndex<0||!args[dIndex+1]||!args[outIndex+1])
    throw Error("usage: node ... --dates YYYYMMDD,YYYYMMDD --out /path/report.json [--source-sha commit]");
  const shaIndex=args.indexOf("--source-sha");
  const snapshot=await captureFromEspn({dates:args[dIndex+1].split(","),
    sourceGitSha:shaIndex<0?null:args[shaIndex+1]});
  if(!snapshot.forecasts.length)throw Error("NO_ELIGIBLE_REAL_FUTURE_FIXTURES");
  writeFileSync(args[outIndex+1],JSON.stringify(snapshot,null,2)+"\n");
  console.log(JSON.stringify({status:snapshot.status,createdAt:snapshot.createdAt,
    sourceGitSha:snapshot.sourceGitSha,fixtures:snapshot.forecasts.map(f=>({
      id:f.fixtureId,home:f.home,away:f.away,kickoff:f.kickoff,
      ensemble:f.ensemble.probabilities,leadMinutes:f.leadMinutes,
    })),
    predictionsFrozen:snapshot.predictionsFrozenBeforeKickoff,modelFeedsIndependent:false,
    sourceHashes:snapshot.sourceData.map(s=>({name:s.name,sha256:s.sha256})),
    fingerprint:snapshot.contentPredictionSha256,rejections:snapshot.rejections},null,2));
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url)
  main().catch(e=>{console.error("BETGPT_PREMATCH_CAPTURE_FAIL",e.message);process.exitCode=1});
