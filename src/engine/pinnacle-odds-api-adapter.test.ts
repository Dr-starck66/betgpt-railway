import test from "node:test";
import assert from "node:assert/strict";
import { parsePinnacleFromOddsApi } from "./pinnacle-odds-api-adapter.ts";
const now = Date.parse("2026-11-13T18:00:00Z");
const at = new Date(now - 10_000).toISOString();
const event = {
  home_team: "Paris SG", away_team: "Lyon", commence_time: new Date(now + 3600_000).toISOString(),
  bookmakers: [{key:"pinnacle",last_update:at,markets:[{key:"h2h",last_update:at,
    outcomes:[{name:"Lyon",price:3.75},{name:"Draw",price:3.40},{name:"Paris SG",price:2.05}]}]}],
};
const parse = (payload: unknown, authorizedProviderPayload=true) => parsePinnacleFromOddsApi(payload,{authorizedProviderPayload,nowMs:now});
test("reject if provider rights have not been established", () => assert.deepEqual(parse([event],false), []));
test("extract exactly one fresh Pinnacle pre-match 1X2", () => {
 const result=parse([event]);assert.equal(result.length,1);assert.equal(result[0]!.home,2.05);
 assert.equal(result[0]!.away,3.75);assert.equal(result[0]!.provenance,"LICENSED_FEED");
});
test("reject missing Pinnacle in payload", () => assert.deepEqual(parse([{...event,bookmakers:[]}]), []));
test("reject an outdated odds timestamp", () => assert.deepEqual(parse([{...event,bookmakers:[{...event.bookmakers[0],last_update:new Date(now-600_000).toISOString(),markets:[{...event.bookmakers[0].markets[0],last_update:new Date(now-600_000).toISOString()}]}]}]), []));
test("reject duplicate 1X2 entries", () => assert.deepEqual(parse([{...event,bookmakers:[{...event.bookmakers[0],markets:[event.bookmakers[0].markets[0],event.bookmakers[0].markets[0]]}]}]), []));
test("reject ambiguous team selection", () => assert.deepEqual(parse([{...event,bookmakers:[{...event.bookmakers[0],markets:[{...event.bookmakers[0].markets[0],outcomes:[{name:"Paris SG",price:2.05},{name:"Paris SG",price:2.06},{name:"Lyon",price:3.75}]}]}]}]), []));
test("reject a match already started", () => assert.deepEqual(parse([{...event, commence_time:new Date(now-1000).toISOString()}]), []));
test("reject invalid odds prices", () => assert.deepEqual(parse([{...event,bookmakers:[{...event.bookmakers[0],markets:[{...event.bookmakers[0].markets[0],outcomes:[{name:"Lyon",price:-1},{name:"Draw",price:3.40},{name:"Paris SG",price:2.05}]}]}]}]), []));
