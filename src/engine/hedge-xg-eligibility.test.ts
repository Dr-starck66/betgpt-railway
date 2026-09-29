import test from "node:test";
import assert from "node:assert/strict";
import { hedgeXgEligibility } from "./hedge-xg-eligibility.ts";

test("low-xG 0-0-risk profile rejects every score hedge", () => {
  const r = hedgeXgEligibility({
    market: "1X2_H",
    source: "MODEL_LAMBDA",
    expectedHomeGoals: 0.92,
    expectedAwayGoals: 0.84,
    zeroZeroProb: 0.17,
  });
  assert.equal(r.oneOne, false);
  assert.equal(r.opponent21, false);
});

test("1-1 can remain plausible without making adverse 2-1 plausible", () => {
  const r = hedgeXgEligibility({
    market: "1X2_H",
    source: "MODEL_LAMBDA",
    expectedHomeGoals: 1.18,
    expectedAwayGoals: 0.72,
    zeroZeroProb: 0.09,
  });
  assert.equal(r.oneOne, true);
  assert.equal(r.opponent21, false);
});

test("open profile allows both hedge families", () => {
  const r = hedgeXgEligibility({
    market: "1X2_H",
    source: "OBSERVED_XG",
    expectedHomeGoals: 1.45,
    expectedAwayGoals: 1.05,
    zeroZeroProb: 0.07,
  });
  assert.equal(r.oneOne, true);
  assert.equal(r.opponent21, true);
});
