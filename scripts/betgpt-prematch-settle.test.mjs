import test from "node:test";
import assert from "node:assert/strict";
import {freezePrematch} from "./betgpt-prematch-freeze.mjs";
import {verifyFrozen,scoreFrozen} from "./betgpt-prematch-settle.mjs";

const AT="2026-11-14T00:00:00.000Z",KO="2026-11-21T15:00:00.000Z";
const stat = i=>[
  ["gamesPlayed",10],["pointsFor",10+i],["pointsAgainst",10],["rank",i+1],
  ["points",30-i],["wins",8],["losses",1],["ties",1]].map(([name,value])=>({name,value}));
const standings={children:[{standings:{entries:Array.from({length:20},(_,i)=>({
  team:{id:String(i+1),displayName:"Club "+(i+1)},stats:stat(i),
}))}}]};
const game=(state="pre",completed=false,scoreH="0",scoreA="0")=>({
 id:"222",date:KO,competitions:[{status:{type:{state,completed}},competitors:[
  {homeAway:"home",team:{id:"1"},score:scoreH},
  {homeAway:"away",team:{id:"2"},score:scoreA}
 ]}],
});
const snap=()=>freezePrematch({
  standings,boards:[{events:[game()]}],capturedAt:AT,
  sourceHashes:{standings:"a".repeat(64),"20261121":"b".repeat(64)},
});
test("unchanged frozen archive passes integrity gate",()=>{
 assert.equal(verifyFrozen(snap()),true);
});
test("official not-finished game cannot be scored at any late timestamp",()=>{
 const x=scoreFrozen(snap(),[{events:[game("pre",false,"0","0")]}],{observedAt:"2026-11-23T00:00:00Z"});
 assert.equal(x.settledCount,0);assert.equal(x.pendingCount,1);
 assert.equal(x.evidenceStatus,"AWAITING_OFFICIAL_RESULTS");
});
test("official completed post-match score produces independent Brier and no ROI",()=>{
 const x=scoreFrozen(snap(),[{events:[game("post",true,"2","0")]}],{observedAt:"2026-11-22T12:00:00Z"});
 assert.equal(x.settledCount,1);assert.equal(x.pendingCount,0);
 assert.ok(x.metrics.brier>0&&x.metrics.brier<2);
 assert.equal(x.evidenceStatus,"INSUFFICIENT_FORWARD_SAMPLE");
 assert.equal(x.validatedValueBets,false);
 assert.equal("roi" in x.metrics,false);
});
test("even apparently final result is withheld before plausible full time",()=>{
 const x=scoreFrozen(snap(),[{events:[game("post",true,"2","0")]}],{observedAt:"2026-11-21T15:30:00Z"});
 assert.equal(x.settledCount,0);assert.equal(x.pending[0].reason,"MATCH_NOT_OLD_ENOUGH");
});
test("mismatched ESPN team IDs are rejected",()=>{
 const f=game("post",true,"1","0");f.competitions[0].competitors[1].team.id="99";
 const x=scoreFrozen(snap(),[{events:[f]}],{observedAt:"2026-11-22T12:00:00Z"});
 assert.equal(x.settledCount,0);assert.equal(x.rejectedCount,1);
});
test("mutating frozen forecast probabilities invalidates its content hash",()=>{
 const x=snap();x.forecasts[0].ensemble.probabilities=[.2,.3,.5];
 assert.throws(()=>verifyFrozen(x),/FROZEN_PROBABILITIES_TAMPERED/);
});
test("forged price evidence invalidates archived provenance",()=>{
 const x=snap();x.marketQuotesUsed=1;
 assert.throws(()=>verifyFrozen(x),/FROZEN_SCHEMA_OR_GATES_INVALID/);
});
test("duplicate ESPN final event rejected, no silent double counting",()=>{
 const x=snap();const f=game("post",true,"1","0");
 assert.throws(()=>scoreFrozen(x,[{events:[f,f]}],{observedAt:"2026-11-22T12:00:00Z"}),/DUPLICATE_OFFICIAL_MATCH_ID/);
});
test("outcome may never be baked back into the frozen prediction",()=>{
 const x=snap();x.forecasts[0].outcome="H";
 assert.throws(()=>verifyFrozen(x),/FROZEN_FORECAST_TAMPER_OR_INCOMPLETE/);
});
test("missing official match remains pending rather than losing",()=>{
 const x=scoreFrozen(snap(),[{events:[]}],{observedAt:"2026-11-22T12:00:00Z"});
 assert.equal(x.pending[0].reason,"NO_RESULT_IN_LIVE_SOURCE");
 assert.equal(x.metrics,null);
});
test("malformed official score is not resolved as a win",()=>{
 const f=game("post",true,"a","2");
 const x=scoreFrozen(snap(),[{events:[f]}],{observedAt:"2026-11-22T12:00:00Z"});
 assert.equal(x.settledCount,0);assert.equal(x.rejected[0].reason,"NO_VALID_FINAL_SCORE");
});
