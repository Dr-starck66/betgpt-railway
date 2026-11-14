#!/usr/bin/env node
/**
 * Strict commercial gating of BetGPT's already-frozen REAL MatchInput archive.
 * Never calculates bookmaker odds, never fills missing data or modifies inputs.
 * Retains explicit per-fixture negative proof, not just an empty ticket list.
 */
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {pathToFileURL} from "node:url";

const sha256=x=>createHash("sha256").update(x).digest("hex");
const SHA_RE=/^[a-f0-9]{64}$/;
const REQUIRED_DP=["restHome","restAway","congestionHome","congestionAway",
                    "travelAwayKm","importance","absencesHome","absencesAway"];
const PROVIDER_PROVENANCE="PROVIDER_OBSERVED";
const BOOK_PRICE_FIELDS=["home","draw","away"];

export function readOriginalArchive(file,{expectedSha256}={}){
  const raw64=readFileSync(file,"utf8").trim();
  if(!/^[a-zA-Z0-9+/=]+$/.test(raw64)||raw64.length>1_000_000)throw Error("ARCHIVE_INVALID_BASE64");
  const data=gunzipSync(Buffer.from(raw64,"base64"),{maxOutputLength:3_000_000});
  const digest=sha256(data);
  if(expectedSha256 && digest!==expectedSha256)throw Error("ARCHIVE_HASH_MISMATCH");
  const audit=JSON.parse(data.toString("utf8"));
  if(audit?.schema!=="astra-betgpt-original-matchinput-audit/v1"||
     !Array.isArray(audit.matches)||!SHA_RE.test(digest))throw Error("ARCHIVE_WRONG_SCHEMA");
  return {audit,sha256:digest,bytes:data.length};
}

function isFreshQuote(q,at,ko){
  const observed=Date.parse(q?.observedAt);
  return Number.isFinite(observed)&&observed<=at&&at-observed<=300000&&observed<ko&&
    BOOK_PRICE_FIELDS.every(k=>Number.isFinite(q[k])&&q[k]>=1.05&&q[k]<=100);
}
function hasLinkedAuthenticatedQuoteEvidence(q,requests){
  // Crucial: ESPN requests are NEVER evidence of bookmaker price origin.
  // Strictly require a separate authenticated response receipt with the same
  // bookmaker, same event, same quote timestamp and SHA-256 of raw response.
  return requests.some(s=>s.provider==="AUTHENTICATED_BOOKMAKER" &&
    s.authenticationVerified===true && s.usageRightsVerified===true &&
    s.book===q.book && s.eventId===q.eventId &&
    s.quoteObservedAt===q.observedAt && SHA_RE.test(s.sha256) &&
    Number.isFinite(Date.parse(s.finishedAt)) &&
    Date.parse(s.finishedAt)>=Date.parse(q.observedAt));
}
export function gateOriginalMatchInputs(audit){
 if(audit?.schema!=="astra-betgpt-original-matchinput-audit/v1"||
    !Number.isFinite(Date.parse(audit.capturedAt))||
    !Array.isArray(audit.matches)||!Array.isArray(audit.sourceRequests)||
    audit.sourceOriginal!=="src/engine/live.ts::fetchLeague::parseEvents")
   throw Error("MATCHINPUT_AUDIT_UNTRUSTED");
 const now=Date.parse(audit.capturedAt);
 const decisions=[];
 const ids=new Set();
 for(const row of audit.matches){
   const reasons=[];
   const ko=Date.parse(row.kickoff);
   if(!row.id?.startsWith("espn-")||ids.has(row.id)||!Number.isFinite(ko)||ko-now<=3600000)
     reasons.push("NOT_VERIFIED_FUTURE_FIXTURE");
   ids.add(row.id);
   // Freshness of capture is NOT the freshness of each inferred sport feature.
   if(!SHA_RE.test(row.originalInputSha256)||
      sha256(JSON.stringify(row.rawMatchInput))!==row.originalInputSha256||
      row.rawMatchInput.id!==row.id||row.strictModelInput?.id!==row.id)
      reasons.push("RAW_MATCHINPUT_HASH_OR_ID_MISMATCH");
   const quotes=row.quotes??[];
   const approved=quotes.filter(q=>isFreshQuote(q,now,ko)&&
        hasLinkedAuthenticatedQuoteEvidence(q,audit.sourceRequests));
   if(!approved.length)reasons.push("NO_LINKED_AUTHENTICATED_TIMESTAMPED_1X2_QUOTE");
   const fields=Array.isArray(row.fields)?row.fields:[];
   const unobserved=REQUIRED_DP.filter(key=>!fields.some(f=>
     f.field===key&&f.provenance===PROVIDER_PROVENANCE &&
     Number.isFinite(Date.parse(f.providerObservedAt)) &&
     Date.parse(f.providerObservedAt)<ko &&
     f.sourceReceiptSha256 && SHA_RE.test(f.sourceReceiptSha256)));
   if(unobserved.length)reasons.push("MISSING_OBSERVED_CONTEXT:"+unobserved.join(","));
   const profile=row.teamProfileProvenance??{};
   if(profile.home!==PROVIDER_PROVENANCE||profile.away!==PROVIDER_PROVENANCE||
      profile.xg!==PROVIDER_PROVENANCE||profile.ppda!==PROVIDER_PROVENANCE)
      reasons.push("MISSING_PROVIDER_OBSERVED_TEAM_PROFILES");
   if(row.fullyObserved!==true)reasons.push("FULLY_OBSERVED_NOT_VERIFIED");
   if(row.commercialSignalEligibility!=="ELIGIBLE_VERIFIED")
      reasons.push("COMMERCIAL_READINESS_NOT_VERIFIED");
   decisions.push({id:row.id,kickoff:row.kickoff,accepted:reasons.length===0,
     reasons,rawSha256:row.originalInputSha256,validQuotesLinked:approved.length,
     discardedQuotes:Math.max(0,quotes.length-approved.length)});
 }
 return {
   schema:"astra-betgpt-matchinput-strict-commercial-gate/v1",
   at:audit.capturedAt,checked:decisions.length,
   accepted:decisions.filter(d=>d.accepted).length,
   rejected:decisions.filter(d=>!d.accepted).length,
   status:decisions.some(d=>d.accepted)?"PARTIAL_REQUIRES_PROSPECTIVE_VALIDATION":
         "BLOCKED_NO_VERIFIED_MATCHINPUT",
   noBet:true,noCommercialExport:true,noFallbackEstimates:true,
   decisions,
 };
}
function main(argv){
 const inFile=argv[argv.indexOf("--archive")+1],out=argv[argv.indexOf("--out")+1];
 if(!inFile||!out)throw Error("usage: ... --archive SNAPSHOT.json.gz.b64 --out audit.json");
 const {audit,sha256:archivedSha256,bytes}=readOriginalArchive(inFile);
 const result=gateOriginalMatchInputs(audit);
 const report={...result,archive:{sha256:archivedSha256,bytes}};
 writeFileSync(out,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({
   status:report.status,archivedSha256,checked:report.checked,
   accepted:report.accepted,rejected:report.rejected,
   reasonsCount:report.decisions.reduce((a,d)=>{
     for(const r of d.reasons){const key=r.split(":")[0];a[key]=(a[key]??0)+1;}return a;
   },{}),
 },null,2));
 if(report.accepted!==0)process.exitCode=2; // Research-only audit: fail if a promotion sneaks in.
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{main(process.argv.slice(2))}catch(e){console.error("BETGPT_STRICT_GATE_FAIL",e.message);process.exitCode=1}
}
