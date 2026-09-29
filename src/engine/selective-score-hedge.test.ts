import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SCORE_HEDGE_POLICY, isAllowedHedgeScoreLabel, selectiveScoreHedge } from "./selective-score-hedge.ts";

const base = {
  league: "LL" as const,
  market: "1X2_H" as const,
  mainOdds: 2.1,
  mainStake: 10,
  mainModelProb: 0.45,
  p11: 0.16,
  pOpponent21: 0.06,
  listed11Odds: 8,
  listedOpponent21Odds: 18,
};

test("selects at most one hedge and prefers the stronger expected contribution", () => {
  const d = selectiveScoreHedge(base);
  assert.equal(d.eligible, true);
  assert.equal(d.status, "SHADOW_HEDGE");
  assert.equal(d.considered.length, 2);
  assert.equal(d.selected?.selection, "1-1");
  assert.ok(Math.abs((d.selected?.hedgeStake ?? 0) - 10 / 7) < 1e-12);
});

test("outside La Liga the validated opponent 2-1 segment can still qualify", () => {
  const d = selectiveScoreHedge({ ...base, league: "PL", listed11Odds: 9 });
  assert.equal(d.eligible, true);
  assert.equal(d.selected?.selection, "OPPONENT_2_1");
  assert.equal(d.selected?.scoreLabel, "1-2");
});

test("away picks fail closed because no away-side opponent-2-1 segment survived holdout", () => {
  const d = selectiveScoreHedge({ ...base, market: "1X2_A" });
  assert.equal(d.eligible, false);
  assert.equal(d.status, "NO_HEDGE");
});

test("real bookmaker exact-score odds are mandatory", () => {
  const d = selectiveScoreHedge({ ...base, listed11Odds: null, listedOpponent21Odds: null });
  assert.equal(d.eligible, false);
});

test("negative or weak exact-score EV is rejected", () => {
  const d = selectiveScoreHedge({ ...base, p11: 0.10, listed11Odds: 8, pOpponent21: 0.04, listedOpponent21Odds: 20 });
  assert.equal(d.eligible, false);
});

test("100 percent recovery is rejected when the required insurance stake is too large", () => {
  const policy = {
    ...DEFAULT_SCORE_HEDGE_POLICY,
    maxHedgeStakeFraction: 0.1,
  };
  const d = selectiveScoreHedge(base, policy);
  // 1-1 needs 14.29%; opponent 2-1 still needs only 5.88% and remains eligible.
  assert.equal(d.eligible, true);
  assert.equal(d.selected?.selection, "OPPONENT_2_1");
});

test("active policy executes the selected hedge", () => {
  const policy = { ...DEFAULT_SCORE_HEDGE_POLICY, status: "ACTIVE" as const };
  const d = selectiveScoreHedge(base, policy);
  assert.equal(d.execute, true);
  assert.equal(d.status, "HEDGE");
});


test("hard scope lock permits only 1-1 or predicted-loser 2-1 orientation", () => {
  assert.equal(isAllowedHedgeScoreLabel("1-1", "1X2_H"), true);
  assert.equal(isAllowedHedgeScoreLabel("1-2", "1X2_H"), true);
  assert.equal(isAllowedHedgeScoreLabel("2-1", "1X2_H"), false);
  assert.equal(isAllowedHedgeScoreLabel("2-1", "1X2_A"), true);
  assert.equal(isAllowedHedgeScoreLabel("1-2", "1X2_A"), false);
  for (const forbidden of ["0-0", "1-0", "0-1", "2-2", "2-0", "0-2", "3-1"]) {
    assert.equal(isAllowedHedgeScoreLabel(forbidden, "1X2_H"), false);
    assert.equal(isAllowedHedgeScoreLabel(forbidden, "1X2_A"), false);
  }
});

test("away-pick opponent score maps to 2-1 when explicitly enabled by a research policy", () => {
  const policy = {
    ...DEFAULT_SCORE_HEDGE_POLICY,
    segments: {
      ...DEFAULT_SCORE_HEDGE_POLICY.segments,
      draw11: { ...DEFAULT_SCORE_HEDGE_POLICY.segments.draw11, allowedMarkets: [] },
      opponent21: {
        ...DEFAULT_SCORE_HEDGE_POLICY.segments.opponent21,
        allowedMarkets: ["1X2_A" as const],
      },
    },
  };
  const d = selectiveScoreHedge({ ...base, market: "1X2_A", pOpponent21: 0.07, listedOpponent21Odds: 18 }, policy);
  assert.equal(d.eligible, true);
  assert.equal(d.selected?.selection, "OPPONENT_2_1");
  assert.equal(d.selected?.scoreLabel, "2-1");
});
