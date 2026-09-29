import assert from "node:assert/strict";
import test from "node:test";
import { hedgeProfitabilityGate } from "./hedge-profitability-gate.ts";

const base = { profit: 130, roi: 0.0782, maxDrawdown: 20, sampleSize: 1662 };

test("promotes only when hedge beats no-hedge on profit, ROI and drawdown", () => {
  const r = hedgeProfitabilityGate(base, { profit: 147.01, roi: 0.0859, maxDrawdown: 18.36, sampleSize: 1662 });
  assert.equal(r.promote, true);
  assert.equal(r.status, "PASS");
  assert.ok(r.profitUplift > 17 - 1e-9);
  assert.ok(r.roiUplift > 0.0076);
  assert.ok(r.drawdownChange < 0);
});

test("rejects a hedge that raises profit but lowers ROI", () => {
  const r = hedgeProfitabilityGate(base, { profit: 140, roi: 0.075, maxDrawdown: 19, sampleSize: 1662 });
  assert.equal(r.promote, false);
  assert.ok(r.reasons.includes("NO_ROI_UPLIFT"));
});

test("rejects a hedge that improves ROI but loses absolute profit", () => {
  const r = hedgeProfitabilityGate(base, { profit: 125, roi: 0.082, maxDrawdown: 19, sampleSize: 1662 });
  assert.equal(r.promote, false);
  assert.ok(r.reasons.includes("NO_PROFIT_UPLIFT"));
});

test("rejects a tiny holdout even if headline metrics look better", () => {
  const r = hedgeProfitabilityGate(
    { ...base, sampleSize: 50 },
    { profit: 15, roi: 0.12, maxDrawdown: 5, sampleSize: 50 },
  );
  assert.equal(r.promote, false);
  assert.ok(r.reasons.includes("INSUFFICIENT_HOLDOUT_SAMPLE"));
});
