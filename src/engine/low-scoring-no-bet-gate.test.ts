import test from "node:test";
import assert from "node:assert/strict";
import type { NoBetApplicableMarket } from "./low-scoring-no-bet-gate.ts";
import { applyLowScoringNoBetGateToMarkets, lowScoringNoBetGate } from "./low-scoring-no-bet-gate.ts";

test("blocks a match when both expected-goal values are weak and 0-0 risk is elevated", () => {
  const d = lowScoringNoBetGate({
    source: "OBSERVED_XG",
    expectedHomeGoals: 0.88,
    expectedAwayGoals: 0.82,
  });
  assert.equal(d.blockBet, true);
  assert.equal(d.reason, "LOW_XG_00_RISK_NO_BET");
  assert.ok((d.zeroZeroProb ?? 0) > 0.18);
});

test("does not block when one attack has a credible scoring expectation", () => {
  const d = lowScoringNoBetGate({
    source: "OBSERVED_XG",
    expectedHomeGoals: 1.42,
    expectedAwayGoals: 0.72,
  });
  assert.equal(d.blockBet, false);
});

test("explicit model 0-0 probability can veto an otherwise borderline match", () => {
  const d = lowScoringNoBetGate({
    source: "MODEL_LAMBDA",
    expectedHomeGoals: 1.02,
    expectedAwayGoals: 1.02,
    zeroZeroProb: 0.15,
  });
  assert.equal(d.blockBet, true);
});

test("a low total alone is not enough when both-team weakness condition is not met", () => {
  const d = lowScoringNoBetGate({
    source: "MODEL_LAMBDA",
    expectedHomeGoals: 1.25,
    expectedAwayGoals: 0.72,
    zeroZeroProb: 0.14,
  });
  assert.equal(d.blockBet, false);
});

test("invalid scoring context fails closed", () => {
  const d = lowScoringNoBetGate({
    source: "OBSERVED_XG",
    expectedHomeGoals: Number.NaN,
    expectedAwayGoals: 0.9,
  });
  assert.equal(d.blockBet, true);
  assert.equal(d.reason, "INVALID_SCORING_CONTEXT");
});


test("hard-vetoes every market, zeroes stake, and removes premium status", () => {
  const markets: NoBetApplicableMarket[] = [
    { decision: "BET", stakePct: 0.04, premium: true, rejectionReason: undefined },
    { decision: "WATCH", stakePct: 0, premium: false, rejectionReason: undefined },
  ];
  const d = applyLowScoringNoBetGateToMarkets(markets, {
    source: "MODEL_LAMBDA",
    expectedHomeGoals: 0.95,
    expectedAwayGoals: 0.88,
    zeroZeroProb: 0.16,
  });
  assert.equal(d.blockBet, true);
  for (const m of markets) {
    assert.equal(m.decision, "NO_BET");
    assert.equal(m.stakePct, 0);
    assert.equal(m.premium, false);
    assert.match(m.rejectionReason ?? "", /xG faibles.*0-0/i);
  }
});
