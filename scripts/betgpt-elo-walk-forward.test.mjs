import test from "node:test";
import assert from "node:assert/strict";
import { goalMatrix, clamp } from "../src/engine/math.ts";
import { predictEloPoisson, walkForward, loadFixtures } from "./betgpt-elo-walk-forward.mjs";
const f=(date,home,away,gh,ga,extras={})=>({
 season:"2425",date,home,away,gh,ga,result:gh>ga?"H":gh===ga?"D":"A",
 b365Close:[2.2,3.3,3.5],...extras,
});
test("probabilities match BetGPT backtest Elo-Poisson coefficients exactly",()=>{
 const h=1720,a=1630,d=(h-a+55)/900;
 const expected=goalMatrix(clamp(1.18*Math.pow(10,d*.55),.55,2.7),
   clamp(1.08*Math.pow(10,-d*.55),.5,2.5),-.1);
 const p=predictEloPoisson(h,a);
 assert.deepEqual(p,[expected.home,expected.draw,expected.away]);
 assert.ok(Math.abs(p.reduce((s,x)=>s+x,0)-1)<1e-10);
});
test("stronger home team increases home chance",()=>{
 assert.ok(predictEloPoisson(1900,1600)[0]>predictEloPoisson(1600,1900)[0]);
});
test("2023/24 training never included in measured heldout rows",()=>{
 const r=walkForward([
 f("2023-08-01","A","B",2,0,{season:"2324"}),
 f("2024-08-01","A","B",1,0),
 ]);
 assert.equal(r.trainingMatches,1);
 assert.equal(r.scoredHoldout.n,1);
 assert.equal(r.bySeason["2425"].n,1);
 assert.equal(r.bySeason["2526"].n,0);
});
test("closing odds are forbidden as prediction features",()=>{
 const match=[
 f("2023-08-01","A","B",1,0,{season:"2324"}),
 f("2024-08-01","A","B",1,1),
 ];
 const a=walkForward(match);
 const b=walkForward(match.map(x=>({...x,b365Close:[1.05,98,98]})));
 assert.equal(a.holdoutPredictionStreamSha256,b.holdoutPredictionStreamSha256);
 assert.deepEqual(a._predictions.map(x=>x.prob),b._predictions.map(x=>x.prob));
 assert.notDeepEqual(a.scoredHoldout.marketCloseComparator,b.scoredHoldout.marketCloseComparator);
});
test("same-day predictions remain fixed when future same-day outcomes change",()=>{
 const original=[
 f("2023-08-01","A","B",1,0,{season:"2324"}),
 f("2024-08-01","A","B",1,0),
 f("2024-08-01","C","D",2,0),
 ];
 const changed=original.map((x,i)=>i===1?{...x,gh:0,ga:2,result:"A"}:x);
 const a=walkForward(original),b=walkForward(changed);
 assert.equal(a.holdoutPredictionStreamSha256,b.holdoutPredictionStreamSha256);
 assert.notEqual(a.scoredHoldout.brier,b.scoredHoldout.brier);
});
test("outcome of prior day may inform later predictions (causal adaptation)",()=>{
 const original=[
 f("2023-08-01","A","B",1,0,{season:"2324"}),
 f("2024-08-01","A","B",1,0),
 f("2024-08-02","A","B",0,0),
 ];
 const changed=original.map((x,i)=>i===1?{...x,gh:0,ga:2,result:"A"}:x);
 assert.notEqual(walkForward(original).holdoutPredictionStreamSha256,
   walkForward(changed).holdoutPredictionStreamSha256);
});
test("scores must be an outcome-consistent 1X2",()=>{
 assert.throws(()=>walkForward([f("2024-08-01","A","B",1,0,{result:"A"})]),/INVALID_FIXTURE/);
});
test("duplicate identical fixture is rejected",()=>{
 const row=f("2024-08-01","A","B",1,1);
 assert.throws(()=>walkForward([row,row]),/DUPLICATE_FIXTURE/);
});
test("bad fixture is rejected",()=>{
 assert.throws(()=>walkForward([f("2024-08-01","A","B",1,1,{result:"X"})]),/INVALID_FIXTURE/);
});
test("all metrics have honest failure-to-prove live betting tags",()=>{
 const r=walkForward([f("2024-08-01","A","B",1,0)]);
 assert.equal(r.fullLiveSixModelStackValidated,false);
 assert.equal(r.scoredHoldout.marketCloseComparator.usedForPrediction,false);
 assert.equal(r.scoredHoldout.marketCloseComparator.retrospectiveOnly,true);
 assert.equal(r.calibratedAgainstEmpiricalBaseline,"NO_CLEAR_IMPROVEMENT");
});

test("two matches for one club on same day are rejected rather than double-counted",()=>{
  assert.throws(()=>walkForward([
    f("2024-08-01","A","B",1,0),
    f("2024-08-01","A","C",2,1)
  ]),/SAME_DAY_TEAM_CONFLICT/);
});
