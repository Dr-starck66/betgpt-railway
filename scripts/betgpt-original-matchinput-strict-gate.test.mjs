import test from "node:test";
import assert from "node:assert/strict";
import {readOriginalArchive,gateOriginalMatchInputs} from "./betgpt-original-matchinput-strict-gate.mjs";

const ARCHIVE="REPORTS/BETGPT-ORIGINAL-MATCHINPUT-20261114.json.gz.b64";
const HASH="067356381def92c21896a4b13adf6d1fbfa44e694e6981dfcad65b8dd4a92ea4";
const original=()=>readOriginalArchive(ARCHIVE,{expectedSha256:HASH}).audit;

test("real GitHub-committed 12-match archive hash and source schema pass integrity",()=>{
 const {audit,sha256,bytes}=readOriginalArchive(ARCHIVE,{expectedSha256:HASH});
 assert.equal(sha256,HASH);
 assert.equal(bytes,146754);
 assert.equal(audit.matches.length,12);
});
test("real 12 future MatchInput require hard rejection, zero approved commercial entries",()=>{
 const a=gateOriginalMatchInputs(original());
 assert.equal(a.checked,12);assert.equal(a.accepted,0);assert.equal(a.rejected,12);
 assert.equal(a.status,"BLOCKED_NO_VERIFIED_MATCHINPUT");
 assert.equal(a.noBet,true);assert.equal(a.noFallbackEstimates,true);
 assert.ok(a.decisions.every(x=>x.reasons.includes("NO_LINKED_AUTHENTICATED_TIMESTAMPED_1X2_QUOTE")));
 assert.ok(a.decisions.every(x=>x.reasons.includes("MISSING_PROVIDER_OBSERVED_TEAM_PROFILES")));
});
test("reject a forged public quote even with 1X2 prices, valid timestamp and branded label",()=>{
 const a=original();
 const r=a.matches[0],when=new Date(Date.parse(a.capturedAt)-1000).toISOString();
 r.quotes=[{book:"Unibet",eventId:r.id,home:1.9,draw:3.5,away:4,observedAt:when}];
 r.commercialSignalEligibility="ELIGIBLE_VERIFIED";r.fullyObserved=true;
 const check=gateOriginalMatchInputs(a);
 assert.equal(check.accepted,0);
 assert.ok(check.decisions[0].reasons.includes("NO_LINKED_AUTHENTICATED_TIMESTAMPED_1X2_QUOTE"));
});
test("stale or missing quote timestamp always rejects",()=>{
 const a=original();a.matches[0].quotes=[{book:"Unibet",home:2,draw:3,away:3,observedAt:"2026-01-01T00:00:00Z"}];
 const result=gateOriginalMatchInputs(a);
 assert.equal(result.accepted,0);
 assert.equal(result.decisions[0].validQuotesLinked,0);
});
test("declaring fake PROFILE_OBSERVED is still insufficient for all critical input fields",()=>{
 const a=original();
 a.matches[0].teamProfileProvenance={
   home:"PROVIDER_OBSERVED",away:"PROVIDER_OBSERVED",xg:"PROVIDER_OBSERVED",ppda:"PROVIDER_OBSERVED"
 };
 const d=gateOriginalMatchInputs(a).decisions[0];
 assert.ok(d.reasons.some(x=>x.startsWith("MISSING_OBSERVED_CONTEXT")));
});
test("modifying rawMatchInput while preserving stored sha is detected",()=>{
 const a=original();a.matches[0].rawMatchInput.home.xgFor=100;
 const d=gateOriginalMatchInputs(a).decisions[0];
 assert.ok(d.reasons.includes("RAW_MATCHINPUT_HASH_OR_ID_MISMATCH"));
});
test("cannot re-label all observations as true without linked bookmaker payload",()=>{
 const a=original(),r=a.matches[0];
 const observed=new Date(Date.parse(a.capturedAt)-1000).toISOString();
 for(const f of r.fields){f.provenance="PROVIDER_OBSERVED";f.providerObservedAt=observed;f.sourceReceiptSha256="a".repeat(64)}
 r.teamProfileProvenance={home:"PROVIDER_OBSERVED",away:"PROVIDER_OBSERVED",xg:"PROVIDER_OBSERVED",ppda:"PROVIDER_OBSERVED"};
 r.fullyObserved=true;r.commercialSignalEligibility="ELIGIBLE_VERIFIED";
 r.quotes=[{book:"Unibet",eventId:r.id,home:2,draw:3,away:4,observedAt:observed}];
 assert.equal(gateOriginalMatchInputs(a).decisions[0].accepted,false);
});
test("archive hash mismatch refuses evidence",()=>{
 assert.throws(()=>readOriginalArchive(ARCHIVE,{expectedSha256:"0".repeat(64)}),/ARCHIVE_HASH_MISMATCH/);
});
test("invalid audit provenance cannot be treated as commercial proof",()=>{
 const a=original();delete a.sourceOriginal;
 assert.throws(()=>gateOriginalMatchInputs(a),/MATCHINPUT_AUDIT_UNTRUSTED/);
});
