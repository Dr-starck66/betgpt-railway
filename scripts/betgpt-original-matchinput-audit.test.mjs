import test from "node:test";
import assert from "node:assert/strict";
import {auditOriginalMatchInputs} from "./betgpt-original-matchinput-audit.mjs";

const AT="2026-11-14T00:00:00.000Z", KO="2026-11-21T15:00:00.000Z";
const source=(url)=>({
 url,startedAt:"2026-11-13T23:59:55.000Z",
 finishedAt:"2026-11-13T23:59:56.000Z",httpStatus:200,
 sha256:"a".repeat(64),bytes:1000,provider:"ESPN_PUBLIC",
});
const sources=[
 source("https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings?lang=en"),
 source("https://site.web.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=20261121"),
];
const dp=(value,src)=>({value,source:src,timestamp:AT,confidence:.3,freshnessHours:0});
const odds=(observedAt)=>({book:"Unibet",home:2.2,draw:3.3,away:3.1,observedAt});
const m=(opts={})=>({
 id:"espn-401879233",status:"scheduled",kickoff:KO,home:{id:"1",name:"Club A",xgFor:1.4,ppda:9},
 away:{id:"2",name:"Club B",xgFor:1.1,ppda:11},
 restHome:dp(6,"non observé sur le calendrier live"),
 restAway:dp(6,"non observé sur le calendrier live"),
 travelAwayKm:dp(250,"estimation"),
 congestionHome:dp(.25,"non observé"),
 congestionAway:dp(.25,"non observé"),
 absencesHome:dp([],"feuille d'effectif non branchée"),
 absencesAway:dp([],"feuille d'effectif non branchée"),
 importance:dp(.6,"classement live"),current:[odds(undefined)],...opts,
});
const runtime=(matches=[m()])=>({
 source:"BETGPT_LIVE_FETCHLEAGUE_ORIGINAL",league:"PL",capturedAt:AT,matches,
});
const audit=(xs,s=sources)=>auditOriginalMatchInputs(runtime(xs),s,{at:AT});
test("genuine MatchInput structure is frozen with source fingerprints",()=>{
 const a=audit([m()]);
 assert.equal(a.futureOriginalMatchInputs,1);
 assert.equal(a.verifiedStandings,true);assert.equal(a.verifiedScoreboard,true);
 assert.equal(a.matches[0].rawMatchInput.id,"espn-401879233");
 assert.equal(a.matches[0].rawMatchInput.home.xgFor,1.4);
 assert.equal(a.matches[0].fields.find(x=>x.field==="absencesHome").provenance,"MODEL_ESTIMATE_OR_MISSING");
 assert.equal(a.matches[0].teamProfileProvenance.xg,"MODEL_ESTIMATE_NO_PROVIDER_XG");
 assert.equal(a.matches[0].commercialSignalEligibility,"BLOCKED_MISSING_VERIFIED_MODEL_FIELDS");
});
test("quoted bookmaker without provider timestamp is explicitly rejected",()=>{
 const a=audit([m()]);
 assert.equal(a.verifiedTimestampedQuotes,0);
 assert.equal(a.rejectedUntimestampedQuotes,1);
 assert.equal(a.matches[0].strictModelInput.current.length,0);
 assert.equal(a.matches[0].quotesRejected[0].reason,"MISSING_OR_STALE_PROVIDER_TIMESTAMP");
});
test("plausibly timestamped quote without linked provider response ALSO rejected",()=>{
 const a=audit([m({current:[odds("2026-11-13T23:59:30Z")]})]);
 assert.equal(a.verifiedTimestampedQuotes,0);
 assert.equal(a.matches[0].quotesRejected[0].reason,"NO_LINKED_AUTHENTICATED_BOOKMAKER_PAYLOAD");
});
test("already completed fixtures are excluded",()=>{
 const a=audit([m({status:"finished"})]); assert.equal(a.futureOriginalMatchInputs,0);
 assert.equal(a.status,"FAIL_NO_FUTURE_MATCHINPUT");
});
test("past fixture or first hour excluded",()=>{
 const a=audit([m({kickoff:AT}),m({id:"espn-xyz",kickoff:"2026-11-14T00:30:00Z"})]);
 assert.equal(a.futureOriginalMatchInputs,0);
});
test("standing payload not seen means abort",()=>{
 assert.throws(()=>audit([m()],sources.filter(s=>!s.url.includes("standings"))),/ESPN_PRIMARY_SOURCE_NOT_VERIFIED/);
});
test("forge invalid DNS or unverified hash means abort",()=>{
 assert.throws(()=>audit([m()],[{...sources[0],sha256:"short"},sources[1]]),/ESPN_SOURCE_PROVENANCE_INVALID/);
 assert.throws(()=>audit([m()],[{...sources[0],url:"https://evil.example/standings?x"},sources[1]]),/ESPN_SOURCE_PROVENANCE_INVALID/);
});
test("duplicate real fixture ID aborts, never double-counts",()=>{
 assert.throws(()=>audit([m(),m()]),/DUPLICATE_MATCHINPUT/);
});
test("snapshot time cannot be changed to future while keeping source timestamp",()=>{
 assert.throws(()=>auditOriginalMatchInputs(runtime(),sources,{at:"2026-12-04T00:00:00Z"}),/ORIGINAL_MATCHINPUT_CAPTURE_INVALID/);
});
test("raw bookmaker offers never appear as certified strict prices",()=>{
 const a=audit([m({current:[odds(undefined),{...odds(AT),book:"Unapproved"}]})]);
 assert.equal(a.matches[0].strictModelInput.current.length,0);
 assert.equal(a.matches[0].strictModelInput.opening.home,0);
});
