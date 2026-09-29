import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SELECTIVE_HEDGE_POLICY, selectiveHedge11 } from "./selective-hedge.ts";

const base = {
  league: "LL" as const,
  market: "1X2_H" as const,
  mainOdds: 2.25,
  mainStake: 10,
  p11: 0.16,
  listed11Odds: 8,
};

test("qualifying selection remains shadow until real-odds validation promotes policy", () => {
  const d = selectiveHedge11(base);
  assert.equal(d.eligible, true);
  assert.equal(d.execute, false);
  assert.equal(d.status, "SHADOW_HEDGE");
  assert.ok(Math.abs(d.hedgeStake - 10 * 0.5 / 7) < 1e-12);
});

test("1-1 never hedges a draw selection", () => {
  const d = selectiveHedge11({ ...base, market: "1X2_D" });
  assert.equal(d.eligible, false);
  assert.equal(d.reason, "MAIN_MARKET_NOT_HEDGEABLE_BY_1_1");
});

test("policy is selective by validated league and p11 threshold", () => {
  assert.equal(selectiveHedge11({ ...base, league: "PL" }).eligible, false);
  assert.equal(selectiveHedge11({ ...base, p11: 0.1429 }).eligible, false);
  assert.equal(selectiveHedge11({ ...base, p11: 0.143 }).eligible, true);
});

test("real bookmaker 1-1 odds are mandatory", () => {
  const d = selectiveHedge11({ ...base, listed11Odds: null });
  assert.equal(d.eligible, false);
  assert.equal(d.reason, "REAL_LISTED_1_1_ODDS_REQUIRED");
});

test("positive exact-score EV is mandatory", () => {
  const d = selectiveHedge11({ ...base, p11: 0.143, listed11Odds: 7.2 });
  assert.equal(d.eligible, false);
  assert.equal(d.reason, "1_1_EV_BELOW_THRESHOLD");
});

test("active policy executes but stake remains capped", () => {
  const policy = { ...DEFAULT_SELECTIVE_HEDGE_POLICY, status: "ACTIVE" as const, maxHedgeStakeFraction: 0.04 };
  const d = selectiveHedge11({ ...base, listed11Odds: 8 }, policy);
  assert.equal(d.execute, true);
  assert.equal(d.status, "HEDGE");
  assert.equal(d.hedgeStake, 0.4);
});
