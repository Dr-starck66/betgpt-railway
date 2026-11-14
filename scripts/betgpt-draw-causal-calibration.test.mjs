import test from "node:test";
import assert from "node:assert/strict";
import {applyDrawBias,fitDrawBias,evaluateCausalCalibration} from "./betgpt-draw-causal-calibration.mjs";
const p=[.44,.30,.26];
const f=(date,y,p0=p)=>({date,y,p:p0,season:"2324"});
const training=Array.from({length:380},(_,i)=>f("2023-08-01",i<82?1:i%2===0?0:2));
const hold=(season,year)=>Array.from({length:380},(_,i)=>({
 season,date:year+"-08-01",prob:p,y:i%5===0?1:i%2===0?0:2,
}));
const wf=()=>({_trainingPredictions:training,_predictions:[...hold("2425","2024"),...hold("2526","2025")]});
test("draw adjustment preserves nonnegative normalized 1X2 and home/away ordering",()=>{
 const q=applyDrawBias(p,-.2);
 assert.ok(q[1]<p[1]);assert.ok(q[0]>p[0]);assert.ok(q[2]>p[2]);
 assert.ok(Math.abs(q.reduce((s,x)=>s+x,0)-1)<1e-12);
 assert.ok(Math.abs(q[0]/q[2]-p[0]/p[2])<1e-12);
});
test("no adjustment leaves original probabilities identical",()=>{
 assert.deepEqual(applyDrawBias(p,0),p);
});
test("fit of historical nuls below predicted draw rate yields negative bias",()=>{
 const r=fitDrawBias(training);assert.ok(r.bias<0);assert.equal(r.n,380);
});
test("draw-rich training produces positive bias",()=>{
 const rows=Array.from({length:380},(_,i)=>f("2023-08-01",i<250?1:0));
 assert.ok(fitDrawBias(rows).bias>0);
});
test("calibrator rejects too-small history, nonsense odds and forged bias",()=>{
 assert.throws(()=>fitDrawBias(training.slice(0,20)),/INSUFFICIENT/);
 assert.throws(()=>applyDrawBias([.6,.6,-.2],.2),/BAD_INPUT/);
 assert.throws(()=>applyDrawBias(p,42),/BAD_INPUT/);
 assert.throws(()=>fitDrawBias(training.map((r,i)=>i===2?{...r,p:[.3,.3,.3]}:r)),/INVALID_TRAINING/);
});
test("2024/25 correction trained only on 2023/24; its own future outcomes do not tune it",()=>{
 const a=wf(),b=wf();
 b._predictions=b._predictions.map(x=>x.season==="2425"?{...x,y:0}:x);
 const ra=evaluateCausalCalibration(a),rb=evaluateCausalCalibration(b);
 assert.equal(ra.bySeason["2425"].drawLogitBias,rb.bySeason["2425"].drawLogitBias);
 assert.notEqual(ra.bySeason["2526"].drawLogitBias,rb.bySeason["2526"].drawLogitBias);
});
test("altering 2025/26 results never alters either frozen calibration coefficient",()=>{
 const a=wf(),b=wf();
 b._predictions=b._predictions.map(x=>x.season==="2526"?{...x,y:1}:x);
 const ra=evaluateCausalCalibration(a),rb=evaluateCausalCalibration(b);
 assert.equal(ra.bySeason["2425"].drawLogitBias,rb.bySeason["2425"].drawLogitBias);
 assert.equal(ra.bySeason["2526"].drawLogitBias,rb.bySeason["2526"].drawLogitBias);
});
test("changing closing market odds cannot affect calibration fields",()=>{
 const a=wf(),b=wf();
 b._predictions=b._predictions.map(x=>({...x,marketBrier:-12,book:"forged",odds:[1.1,100,100]}));
 assert.deepEqual(evaluateCausalCalibration(a),evaluateCausalCalibration(b));
});
test("trade deployment remains forbidden even if research metric improves",()=>{
 const r=evaluateCausalCalibration(wf());
 assert.equal(r.productionActivated,false);
 assert.equal(r.tradingSignalsEnabled,false);
 assert.equal(r.noMarketOddsUsed,true);
 assert.equal(r.bySeason["2425"].trainingN,380);
 assert.equal(r.bySeason["2526"].trainingN,760);
});
