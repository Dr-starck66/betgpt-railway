import test from "node:test";
import assert from "node:assert/strict";
import {planResultRecovery,RECOVERY_BATCH_LIMIT} from "./result-recovery-plan.ts";
const now=Date.UTC(2026,9,15,12);
const ticket=(id,days,kind="mise",result=undefined)=>({
 matchId:id,kind,result,kickoff:new Date(now-days*864e5).toISOString(),
 league:"PL",home:"A",away:"B",
});
test("recover actual BETs older than the previous 8-day cutoff, without unbounded work",()=>{
 const rows=[...Array.from({length:35},(_,i)=>ticket("old-"+i,9+i)),...Array.from({length:30},(_,i)=>ticket("new-"+i,1+i*0.1))];
 const out=planResultRecovery(rows,now);
 assert.equal(out.targets.length,RECOVERY_BATCH_LIMIT);
 assert.ok(out.targets.some(x=>Date.parse(x.kickoff)<now-8*864e5));
 assert.equal(out.historicalPending,35);
 assert.equal(out.recentPending,30);
});
test("rotate across old records so repeated refreshes cannot starve long-lived tickets",()=>{
 const rows=Array.from({length:8},(_,i)=>ticket("hist-"+i,12+i));
 let cursor={recent:0,historical:0};const ids=new Set();
 for(let k=0;k<4;k++){const p=planResultRecovery(rows,now,cursor);cursor=p.nextCursor;p.targets.forEach(t=>ids.add(t.matchId));}
 assert.equal(ids.size,8);
});
test("no invented outcomes: settled, void, too old, recent kickoff and future excluded",()=>{
 const rows=[ticket("valid",14),ticket("settled",14,"mise","win"),ticket("void",14,"prono","void"),
  ticket("outside-90",91),ticket("not-finished",0.01),ticket("future",-1),
  ticket("invalid",20),ticket("valid",14)];
 rows[6].kickoff="bad";
 const p=planResultRecovery(rows,now);
 assert.deepEqual(p.targets.map(t=>t.matchId),["valid"]);
});
test("prioritize real BETs inside quota and respect total bound",()=>{
 const rows=[...Array.from({length:5},(_,i)=>ticket("p"+i,14+i,"prono")),
  ...Array.from({length:5},(_,i)=>ticket("m"+i,18+i,"mise"))];
 const x=planResultRecovery(rows,now);
 assert.ok(x.targets.length<=4);
 assert.ok(x.targets.every(t=>t.matchId.startsWith("m")));
});
test("future and postkickoff records cannot be settled by selection alone",()=>{
 const p=planResultRecovery([ticket("a",20)],now);
 assert.equal(p.targets.length,1);
 assert.equal(p.targets[0].matchId,"a");
 assert.equal("result" in p.targets[0],false);
});
