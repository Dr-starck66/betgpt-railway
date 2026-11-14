import test from "node:test";
import assert from "node:assert/strict";
import { freezePrematch } from "./betgpt-prematch-freeze.mjs";

const AT="2026-11-14T00:00:00.000Z";
const KO="2026-11-21T15:00:00.000Z";
const hashes={standings:"a".repeat(64),"20261121":"b".repeat(64)};
const makeStats=(i)=>[
  {name:"gamesPlayed",value:10},{name:"pointsFor",value:10+i},
  {name:"pointsAgainst",value:10},{name:"rank",value:i+1},
  {name:"points",value:30-i},{name:"wins",value:8},
  {name:"losses",value:1},{name:"ties",value:1},
];
function standings(){return {children:[{standings:{entries:Array.from({length:20},(_,i)=>({
  team:{id:String(i+1),displayName:"Club "+(i+1)},stats:makeStats(i)
}))}}]};}
function fixture(override={}){
  return {id:"real-123",date:KO,name:"Club 2 at Club 1",
    competitions:[{status:{type:{state:"pre",completed:false}},
      competitors:[{homeAway:"home",team:{id:"1",displayName:"Club 1"},score:"0"},
        {homeAway:"away",team:{id:"2",displayName:"Club 2"},score:"0"}]}],...override};
}
const run=(override={})=>freezePrematch({
  standings:standings(),boards:[{events:[fixture()]}],capturedAt:AT,
  sourceHashes:hashes,sourceFetchedAt:{
    standings:{url:"https://site.web.api.espn.com/standings",finishedAt:AT},
    "20261121":{url:"https://site.web.api.espn.com/board",finishedAt:AT}
  },
  ...override,
});
test("exact six-model source code runs on frozen pre-match standings proxy input",()=>{
  const r=run(); assert.equal(r.status,"PARTIAL_PREMATCH_SHADOW_FROZEN");
  assert.equal(r.forecasts.length,1);assert.equal(r.predictionsFrozenBeforeKickoff,1);
  assert.equal(r.evaluatedMatches,0);
  assert.equal(r.forecasts[0].models.length,6);
  assert.equal(r.forecasts[0].independence.sixModelCodeExecuted,true);
  assert.equal(r.forecasts[0].independence.marketQuoteObserved,false);
  assert.equal(r.forecasts[0].independence.xgObserved,false);
  assert.equal(r.forecasts[0].independence.productionProfileEquivalent,false);
  assert.equal(r.forecasts[0].signalEligibility,"BLOCKED_NO_MARKET_AND_INPUT_PROVENANCE");
  assert.ok(Math.abs(r.forecasts[0].ensemble.probabilities.reduce((s,x)=>s+x,0)-1)<1e-6);
});
test("only six exact existing submodel ids are accepted",()=>{
  const actual=run().forecasts[0].models.map(x=>x.model);
  assert.deepEqual(actual,["poisson","dixonColes","elo","xg","glm","market"]);
});
test("observed final score and bookmaker fields in upstream event cannot enter model",()=>{
  const a=run();
  const b=run({boards:[{events:[fixture({FTR:"A",FTAG:5,FTHG:0,
    odds:[{provider:{displayName:"Ghost"},price:10}],
    competitions:[{status:{type:{state:"pre",completed:false}},competitors:[
      {homeAway:"home",team:{id:"1",displayName:"Club 1"},score:"42"},
      {homeAway:"away",team:{id:"2",displayName:"Club 2"},score:"99"}]}]
  })]}]});
  assert.equal(a.contentPredictionSha256,b.contentPredictionSha256);
  assert.equal(a.forecasts[0].inputSha256,b.forecasts[0].inputSha256);
  assert.deepEqual(b.forecasts[0].inputSnapshot.current,[]);
  assert.equal(JSON.stringify(b.forecasts).includes('"FTR"'),false);
});
test("past or within-60-min kickoff is rejected",()=>{
  const cases=[new Date(Date.parse(AT)-1000).toISOString(),new Date(Date.parse(AT)+59*60_000).toISOString()];
  for(const date of cases){
    const r=run({boards:[{events:[fixture({date})]}]});
    assert.equal(r.forecasts.length,0);
    assert.equal(r.status,"FAIL_NO_ELIGIBLE_FIXTURES");
  }
});
test("finished fixture is rejected despite future timestamp",()=>{
  const f=fixture();f.competitions[0].status.type={state:"post",completed:true};
  const r=run({boards:[{events:[f]}]}); assert.equal(r.forecasts.length,0);
});
test("missing standings for one club refuses even to compute",()=>{
  const f=fixture();f.competitions[0].competitors[1].team.id="99999";
  const r=run({boards:[{events:[f]}]});
  assert.equal(r.forecasts.length,0);
  assert.equal(r.rejections[0].reason,"MISSING_OBSERVED_STANDINGS");
});
test("standings are not silently defaulted when coverage is missing",()=>{
  assert.throws(()=>run({standings:{children:[{standings:{entries:[]}}]}}),/STANDINGS_SOURCE_INVALID|STANDINGS_COVERAGE_LOW/);
});
test("unknown incomplete source digests fail closed",()=>{
  assert.throws(()=>run({sourceHashes:{standings:"abc"}}),/SOURCE_HASHES_REQUIRED/);
});
test("duplicate ESPN event cannot duplicate frozen predictions",()=>{
  const e=fixture();const r=run({boards:[{events:[e,e]}]});
  assert.equal(r.forecasts.length,1);
  assert.equal(r.rejections[0].reason,"DUPLICATE_EVENT");
});
test("malformed six-model output and invalid simplex fail",()=>{
  assert.throws(()=>run({predictor:()=>({models:[],ensemble:{home:.5,draw:.2,away:.3}})}),/MODEL_STACK_NOT_EXECUTED/);
  const proper=run();
  assert.ok(proper.forecasts[0].leadMinutes>60);
});
test("capturedAt must be a parseable clock timestamp",()=>{
  assert.throws(()=>run({capturedAt:"tomorrow"}),/INVALID_PREMATCH_CAPTURE_INPUT/);
});
