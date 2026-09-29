import test from "node:test";
import assert from "node:assert/strict";
import { aggregateShadowPortfolio, buildHedgeShadowRecord, evaluateShadowPromotion, settleHedgeShadowRecord } from "./hedge-shadow-ledger.ts";
import type { ScoreHedgeDecision } from "./selective-score-hedge.ts";

function decision(score: "1-1" | "1-2", odds: number, stake: number): ScoreHedgeDecision {
  return {
    eligible: true,
    execute: false,
    status: "SHADOW_HEDGE",
    reason: "TEST",
    considered: [],
    selected: {
      selection: score === "1-1" ? "1-1" : "OPPONENT_2_1",
      scoreLabel: score,
      scoreProb: 0.1,
      listedOdds: odds,
      exactScoreEv: 0.1,
      recoveryFraction: 1,
      hedgeStake: stake,
      hedgeStakeFraction: stake,
      expectedPnlPerMainStake: 0.02,
    },
  };
}

const meta = { id: "r1", matchId: "m1", capturedAt: "2026-09-27T00:00:00Z", kickoff: "2026-09-27T18:00:00Z", league: "LL", mainMarket: "1X2_H" as const, mainOdds: 2, mainStake: 1, bookmaker: "Unibet" };

test("settles the same match both unhedged and hedged with identical main stake", () => {
  const r = buildHedgeShadowRecord(meta, decision("1-2", 11, 0.1));
  const s = settleHedgeShadowRecord(r, 1, 2, "2026-09-27T20:00:00Z");
  assert.equal(s.settled?.baselinePnl, -1);
  assert.equal(s.settled?.hedgeWon, true);
  assert.ok(Math.abs((s.settled?.hedgedPortfolioPnl ?? 99) - 0) < 1e-12);
  assert.equal(s.settled?.baselineCapital, 1);
  assert.equal(s.settled?.hedgedCapital, 1.1);
});

test("a losing hedge correctly charges its small insurance premium", () => {
  const r = buildHedgeShadowRecord(meta, decision("1-1", 7, 0.1));
  const s = settleHedgeShadowRecord(r, 2, 0);
  assert.equal(s.settled?.baselinePnl, 1);
  assert.equal(s.settled?.hedgeLegPnl, -0.1);
  assert.equal(s.settled?.hedgedPortfolioPnl, 0.9);
});

test("aggregate compares ROI on actual capital committed, not ticket win rate", () => {
  const a = settleHedgeShadowRecord(buildHedgeShadowRecord(meta, decision("1-2", 11, 0.1)), 1, 2);
  const b = settleHedgeShadowRecord(buildHedgeShadowRecord({ ...meta, id: "r2", matchId: "m2" }, decision("1-1", 7, 0.1)), 2, 0);
  const p = aggregateShadowPortfolio([a, b]);
  assert.equal(p.baseline.sampleSize, 2);
  assert.equal(p.hedgeCount, 2);
  assert.equal(p.hedgeHits, 1);
  assert.ok(Number.isFinite(p.hedged.roi));
});

test("promotion stays fail-closed when the live sample is too small", () => {
  const r = settleHedgeShadowRecord(buildHedgeShadowRecord(meta, decision("1-2", 11, 0.1)), 1, 2);
  const out = evaluateShadowPromotion([r], { minSampleSize: 30 });
  assert.equal(out.gate.promote, false);
  assert.ok(out.gate.reasons.includes("INSUFFICIENT_HOLDOUT_SAMPLE"));
});
