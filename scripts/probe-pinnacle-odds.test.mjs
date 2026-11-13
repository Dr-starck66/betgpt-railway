import test from "node:test";
import assert from "node:assert/strict";
import { probePinnacleKey } from "./probe-pinnacle-odds.mjs";
const key = "a".repeat(32);
const sport = "soccer_epl";
function reply(data, remaining="10", status=200) {
  return { ok: status === 200, status, headers: {get: k => k === "x-requests-remaining" ? remaining : null}, json: async () => data };
}
const liveSport = [{key: sport, active:true}];
test("missing credentials fail without network", async () => {
  let calls=0;
  const out=await probePinnacleKey({key:"",http:async()=>{calls++;throw Error("network");}});
  assert.equal(out.status,"KEY_MISSING_OR_MALFORMED");assert.equal(calls,0);
});
test("key check is free sports endpoint only with header not URL secret", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,http:async(url,opts)=>{
    calls++;assert.equal(url,"https://api.the-odds-api.com/v4/sports/");
    assert.equal(opts.headers["x-api-key"],key);
    assert.ok(!url.includes(key));return reply(liveSport);
  }});
  assert.equal(calls,1);assert.equal(out.status,"KEY_VALID");assert.equal(out.sportActive,true);
});
test("reject unauthorised key with HTTP status only", async () => {
  const out=await probePinnacleKey({key,http:async()=>reply({},null,401)});
  assert.equal(out.status,"KEY_UNVERIFIED");assert.equal(out.httpStatus,401);
});
test("low quota prevents even one odds request", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,oneSnapshot:true,http:async()=>{
    calls++;return reply(liveSport,"1");
  }});
  assert.equal(out.status,"QUOTA_NOT_SAFE");assert.equal(calls,1);
});
test("unknown quota blocks billed odds request", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,oneSnapshot:true,http:async()=>{
    calls++;return reply(liveSport,null);
  }});
  assert.equal(out.status,"QUOTA_NOT_SAFE");assert.equal(calls,1);
});
test("inactive football competition prevents odds request", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,oneSnapshot:true,http:async()=>{
    calls++;return reply([{key:sport,active:false}],"10");
  }});
  assert.equal(out.status,"SPORT_INACTIVE");assert.equal(calls,1);
});
test("one snapshot requests Pinnacle 1X2 only, no token in URL", async () => {
  const calls=[];
  const out=await probePinnacleKey({key,oneSnapshot:true,http:async(url,opts)=>{
    calls.push(url);assert.equal(opts.headers["x-api-key"],key);assert.ok(!url.includes(key));
    return calls.length===1 ? reply(liveSport) :
      reply([{bookmakers:[{key:"pinnacle",markets:[{key:"h2h",outcomes:[]}]}]}],"9");
  }});
  assert.equal(calls.length,2);assert.ok(calls[1].includes("bookmakers=pinnacle"));assert.ok(calls[1].includes("markets=h2h"));
  assert.equal(out.status,"PINNACLE_FEED_PRESENT");assert.equal(out.quotaRemaining,9);
});
test("empty authorized Pinnacle feed is not a successful observed quote", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,oneSnapshot:true,http:async()=>{
    calls++;return calls===1 ? reply(liveSport) : reply([],"9");
  }});
  assert.equal(out.status,"PINNACLE_FEED_ABSENT");assert.equal(out.pinnacleEvents,0);
});
test("unknown sport blocks without making a network call", async () => {
  let calls=0;
  const out=await probePinnacleKey({key,sport:"americanfootball_nfl",http:async()=>{
    calls++;return reply(liveSport);
  }});
  assert.equal(out.status,"SPORT_NOT_ALLOWLISTED");assert.equal(calls,0);
});
