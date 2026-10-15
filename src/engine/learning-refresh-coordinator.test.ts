import test from "node:test";
import assert from "node:assert/strict";
import {
  createLearningCheckpointCoordinator,
  usableLearningSnapshot,
  withinDeadline,
} from "./learning-refresh-coordinator.ts";

const policy={maxLiveAgeMs:600_000,liveTimeoutMs:20,recoveryTimeoutMs:15,
  failedLiveCooldownMs:100,recoveryCooldownMs:90};
const now=1_500_000;
const snap=(fetchedAt=now)=>({fetchedAt,matches:[{id:"real-fixture"}],
  meta:{stale:false,asOf:"2026-10-15T00:00:00Z"}});

test("fresh cached feed is PASS without duplicate provider work",async()=>{
 let live=0, engines=0, recoveries=0;
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>snap(),ensureLive:async()=>{live++;},
  recoverPending:async()=>{recoveries++;return {targets:2,recovered:1}},
  runEngine:()=>{engines++;},now:()=>now
 },policy);
 const results=await Promise.all(Array.from({length:8},()=>gate.refresh()));
 assert.ok(results.every(r=>r.refresh.source==="FRESH_CACHE"));
 assert.equal(live,0);assert.equal(engines,1);assert.equal(recoveries,1);
 const again=await gate.refresh();
 assert.equal(again.recovery.status,"SKIPPED_COOLDOWN");
});
test("no stale snapshot may masquerade as PASS",async()=>{
 let current=snap(now-900_000);
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>current,ensureLive:async()=>{},recoverPending:async()=>({targets:0,recovered:0}),
  runEngine:()=>{throw Error("must not run stale")},now:()=>now
 },policy);
 await assert.rejects(gate.refresh(),/STALE_OR_EMPTY/);
 current={...snap(),meta:{...snap().meta,stale:true}};
 await assert.rejects(gate.refresh(),/STALE_OR_EMPTY/);
});
test("mandatory live refresh succeeds and feeds engine",async()=>{
 let current: ReturnType<typeof snap> | null=null, engines=0;
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>current,ensureLive:async()=>{current=snap();},
  recoverPending:async()=>({targets:2,recovered:2}),runEngine:()=>{engines++},now:()=>now
 },policy);
 const r=await gate.refresh();
 assert.equal(r.refresh.source,"LIVE_REFRESH");assert.equal(r.recovery.recovered,2);
 assert.equal(engines,1);
});
test("slow optional recovery degrades but no 503 and no duplicate attempt",async()=>{
 let engines=0,recoveryCalls=0;
 let done: ((value: {targets:number; recovered:number}) => void) | undefined;
 const pending=new Promise<{targets:number; recovered:number}>(resolve=>{done=resolve});
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>snap(),ensureLive:async()=>{throw Error("unwanted")},
  recoverPending:()=>{recoveryCalls++;return pending},
  runEngine:()=>{engines++},now:()=>now
 },policy);
 const a=await gate.refresh();
 assert.equal(a.refresh.status,"PASS");assert.equal(a.recovery.status,"DEGRADED");
 const b=await gate.refresh();
 assert.equal(b.recovery.status,"DEGRADED");assert.equal(recoveryCalls,1);
 assert.equal(engines,2);
 done!({targets:1,recovered:1});
 await pending;
});
test("upstream timeout is a truthful failure with bounded repeated calls",async()=>{
 let current: ReturnType<typeof snap> | null=null,calls=0, clock=now;
 let resolve: (() => void) | undefined;
 const pending=new Promise<void>(r=>{resolve=r});
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>current,ensureLive:()=>{calls++;return pending},
  recoverPending:async()=>({targets:1,recovered:0}),runEngine:()=>{throw Error("bad")},
  now:()=>clock
 },policy);
 await assert.rejects(gate.refresh(),/LIVE_TIMEOUT/);
 await assert.rejects(gate.refresh(),/COOLDOWN/);
 assert.equal(calls,1);
 resolve!();
 await pending;
 clock+=101;
 await assert.rejects(gate.refresh(),/STALE_OR_EMPTY/);
});
test("upstream timeout may use a genuinely fresh snapshot only with warning",async()=>{
 let current=null;
 const gate=createLearningCheckpointCoordinator({
  getSnapshot:()=>current,ensureLive:async()=>{current=snap();throw Error("partial upstream failure")},
  recoverPending:async()=>({targets:0,recovered:0}),runEngine:()=>{},now:()=>now
 },policy);
 const r=await gate.refresh();
 assert.equal(r.refresh.source,"FRESH_AFTER_TIMEOUT");
 assert.match(r.refresh.warning ?? '',/partial upstream/);
});
test("freshness rejects invalid future and expired timestamps",()=>{
 assert.equal(usableLearningSnapshot(snap(now+1),now),false);
 assert.equal(usableLearningSnapshot(snap(now-700_000),now),false);
 assert.equal(usableLearningSnapshot(snap(),now),true);
 assert.equal(usableLearningSnapshot({...snap(),matches:[]},now),false);
});
test("deadline resolves and rejects without inventing success",async()=>{
 assert.equal(await withinDeadline(Promise.resolve(7),30,"TIMEOUT"),7);
 await assert.rejects(withinDeadline(new Promise(()=>{}),15,"TIMEOUT"),/TIMEOUT/);
});
