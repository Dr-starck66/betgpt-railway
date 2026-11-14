#!/usr/bin/env node
/**
 * Capture actual MatchInput objects returned by BetGPT original live.ts
 * fetchLeague/parseEvents, not recreations from a standalone predictor.
 * Never treats a collection timestamp on an estimated field as observation.
 */
import {createHash} from "node:crypto";
import {writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {astraReadOnlyEspnMatchInputs} from "../src/engine/live.ts";

const hash = x=>createHash("sha256").update(x).digest("hex");
const frBooks = /^(Betclic|NetBet|PMU|Unibet|Winamax|Bwin|Parions Sport|ZEbet|Vbet)$/i;
const dataPointFields=["restHome","restAway","travelAwayKm","congestionHome","congestionAway",
 "absencesHome","absencesAway","importance"];
const allowedDns=/^(?:site\.web\.api|sports\.core\.api)\.espn\.com$/;

export function auditOriginalMatchInputs(runtime,sourceReads,{at=new Date().toISOString(),maxMatches=12}={}){
 const t=Date.parse(at),st=Date.parse(runtime?.capturedAt??"");
 if(!Number.isFinite(t)||!Number.isFinite(st)||Math.abs(t-st)>30_000||
   runtime?.source!=="BETGPT_LIVE_FETCHLEAGUE_ORIGINAL"||
   !Array.isArray(runtime?.matches)||!Array.isArray(sourceReads)||
   !Number.isInteger(maxMatches)||maxMatches<1||maxMatches>50)
   throw Error("ORIGINAL_MATCHINPUT_CAPTURE_INVALID");
 const sources=sourceReads.filter(s=>s.httpStatus===200);
 const verifiedStandings=sources.some(s=>/\/standings\?/.test(s.url));
 const verifiedScoreboard=sources.some(s=>/\/scoreboard\?/.test(s.url));
 if(!verifiedStandings||!verifiedScoreboard)throw Error("ESPN_PRIMARY_SOURCE_NOT_VERIFIED");
 const original=runtime.matches.filter(m=>{
  const ko=Date.parse(m.kickoff);
  return m.status==="scheduled"&&Number.isFinite(ko)&&ko>t+3600000&&
    String(m.id??"").startsWith("espn-")&&m.home?.id&&m.away?.id&&m.home?.id!==m.away?.id;
 }).sort((a,b)=>a.kickoff.localeCompare(b.kickoff)).slice(0,maxMatches);
 const seen=new Set(),matches=[];
 for(const m of original){
  if(seen.has(m.id))throw Error("DUPLICATE_MATCHINPUT");
  seen.add(m.id);
  const diagnostics=dataPointFields.map(field=>{
    const dp=m[field],src=String(dp?.source??"");
    const observed=typeof dp?.timestamp==="string"&&Number.isFinite(Date.parse(dp.timestamp));
    // The source explicitly declares these context fields as fallback,
    // computed or unavailable. Its ingestion timestamp is NOT provenance.
    const estimated=/non observ|estimation|non branch|indisponible|synth|contexte ligue|classement live/i.test(src)||
      ["absencesHome","absencesAway","travelAwayKm","restHome","restAway","congestionHome","congestionAway","importance"].includes(field);
    return {field,source:src||"UNSPECIFIED",value:dp?.value??null,
      ingestionTimestamp:observed?dp.timestamp:null,
      provenance:estimated?"MODEL_ESTIMATE_OR_MISSING":"UNVERIFIED",
      confidence:dp?.confidence??null};
  });
  // Real BetGPT TeamProfile is an internal blend of static style overrides,
  // scores and standings; xG, PPDA, etc. are NOT direct ESPN observations.
  const profileProvenance={
    home:"MODEL_ESTIMATE_BETGPT_PROFILEFROM",
    away:"MODEL_ESTIMATE_BETGPT_PROFILEFROM",
    xg:"MODEL_ESTIMATE_NO_PROVIDER_XG",
    ppda:"MODEL_ESTIMATE_NO_PROVIDER_PPDA",
    absences:"UNKNOWN_NOT_CONFIRMED",
  };
  const quotes=[],rejectedQuotes=[];
  for(const b of m.current??[]){
    const q=Date.parse(String(b.observedAt??""));
    const validClock=Number.isFinite(q)&&q<=t+60_000&&t-q<=300_000&&q<Date.parse(m.kickoff);
    const validOdds=[b.home,b.draw,b.away].every(o=>typeof o==="number"&&Number.isFinite(o)&&o>=1.05&&o<=100);
    const validBook=frBooks.test(String(b.book??""));
    const audit={book:b.book??"UNKNOWN",observedAt:b.observedAt??null};
    if(validClock&&validOdds&&validBook){
      quotes.push({book:b.book,observedAt:b.observedAt,home:b.home,draw:b.draw,away:b.away,
        provenance:"PROVIDER_OBSERVED_QUOTE_TIMESTAMPED"});
    } else {
      rejectedQuotes.push({...audit,reason:!validClock?"MISSING_OR_STALE_PROVIDER_TIMESTAMP":
        !validOdds?"INVALID_1X2_ODDS":"NON_APPROVED_PROVIDER"});
    }
  }
  const cleanModelInput={...m,current:quotes,opening:{
    book:"NO_VERIFIED_OPENING_PRICE",home:0,draw:0,away:0,over15:0,over25:0,
    over35:0,under25:0,bttsYes:0,bttsNo:0,
  }};
  // Original untouched bytes preserved; the sanitized copy is explicitly
  // only for research calculations and NEVER used to claim original live quotes.
  const originalJson=JSON.stringify(m);
  matches.push({id:m.id,home:m.home.name,away:m.away.name,kickoff:m.kickoff,originalInputSha256:hash(originalJson),
    rawMatchInput:m,strictModelInput:cleanModelInput,
    fields:diagnostics,teamProfileProvenance:profileProvenance,
    quotes,quotesRejected:rejectedQuotes,fullyObserved:false,
    commercialSignalEligibility:"BLOCKED_MISSING_VERIFIED_MODEL_FIELDS",
  });
 }
 return {
   schema:"astra-betgpt-original-matchinput-audit/v1",
   capturedAt:at,sourceOriginal:"src/engine/live.ts::fetchLeague::parseEvents",
   engineSource:"BETGPT_LIVE_FETCHLEAGUE_ORIGINAL",league:runtime.league,
   sourceRequests:sourceReads,sourceRequests200:sources.length,
   verifiedStandings,verifiedScoreboard,
   originalRuntimeMatches:runtime.matches.length,
   futureOriginalMatchInputs:matches.length,
   verifiedTimestampedQuotes:matches.reduce((s,m)=>s+m.quotes.length,0),
   rejectedUntimestampedQuotes:matches.reduce((s,m)=>s+m.quotesRejected.length,0),
   allModelsFullyObserved:false,
   status:matches.length?"PARTIAL_ORIGINAL_MATCHINPUT_FROZEN":"FAIL_NO_FUTURE_MATCHINPUT",
   policy:"READ_ONLY_NO_DEPLOY_NO_BET_NO_ESTIMATE_PROMOTION",
   matches,
 };
}
export async function fetchOriginalInputs({league="PL"}={}){
 const originalFetch=globalThis.fetch;
 const requests=[];
 // Every remote request made by original fetchLeague is observed and
 // content-hashed without changing the original Response consumed by BetGPT.
 globalThis.fetch=async (resource,init={})=>{
  const url=String(resource instanceof Request?resource.url:resource);
  const u=new URL(url);
  if(u.protocol!=="https:"||!allowedDns.test(u.hostname))
    throw Error("RESEARCH_EGRESS_NOT_ALLOWED");
  const startedAt=new Date().toISOString();
  const res=await originalFetch(resource,init);
  const body=await res.clone().arrayBuffer();
  if(body.byteLength>4_000_000)throw Error("SOURCE_RESPONSE_SIZE_EXCESS");
  requests.push({
    url,startedAt,finishedAt:new Date().toISOString(),
    httpStatus:res.status,sha256:hash(Buffer.from(body)),bytes:body.byteLength,
    provider:"ESPN_PUBLIC",
  });
  return res;
 };
 try{
  const runtime=await astraReadOnlyEspnMatchInputs(league);
  return auditOriginalMatchInputs(runtime,requests);
 }finally{globalThis.fetch=originalFetch;}
}
async function main(){
 const a=process.argv.slice(2),idx=a.indexOf("--out");
 if(idx<0||!a[idx+1])throw Error("usage: ... --out /tmp/matchinput.json [--league PL]");
 const lidx=a.indexOf("--league"),league=lidx>=0?a[lidx+1]:"PL";
 const r=await fetchOriginalInputs({league});
 writeFileSync(a[idx+1],JSON.stringify(r,null,2)+"\n");
 console.log(JSON.stringify({
  status:r.status,capturedAt:r.capturedAt,sourceRequests200:r.sourceRequests200,
  originalRuntimeMatches:r.originalRuntimeMatches,
  futureOriginalMatchInputs:r.futureOriginalMatchInputs,
  verifiedTimestampedQuotes:r.verifiedTimestampedQuotes,
  rejectedUntimestampedQuotes:r.rejectedUntimestampedQuotes,
  sample:r.matches.slice(0,10).map(x=>({id:x.id,home:x.home,away:x.away,kickoff:x.kickoff,
    matchInputSha256:x.originalInputSha256,quoted:x.quotes.length})),
 },null,2));
 if(r.futureOriginalMatchInputs===0)process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)
 main().catch(e=>{console.error("BETGPT_ORIGINAL_MATCHINPUT_FAIL",e.message);process.exitCode=1});
