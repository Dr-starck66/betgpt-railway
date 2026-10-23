import assert from "node:assert/strict";
import test from "node:test";
import { evaluateForwardAccuracy } from "./betgpt-forward-accuracy.mjs";

const from = "2026-10-23T14:00:00Z";
const asOf = "2026-10-27T12:00:00Z";
function ticket(i, overrides = {}) {
  return {
    id: "f" + i, home: "Home " + i, away: "Away " + i, market: "1X2_H",
    recordedAt: "2026-10-24T10:00:00Z", kickoff: "2026-10-25T19:00:00Z",
    modelProb: 0.6, odds: 2.0, result: i % 2 ? "win" : "lose",
    book: "Unibet", kind: "prono", decision: "NO_BET", ...overrides,
  };
}
function checkpoint(tickets) {
  return { schema: "astra-betgpt-runtime-checkpoint/v2", refresh: { status: "PASS" }, tickets };
}

test("refuses snapshots with no verified live refresh", () => {
  assert.throws(() => evaluateForwardAccuracy(checkpoint([]) && { ...checkpoint([]), refresh: { status: "FAILED" } }, { from, asOf }), /UNVERIFIED/);
});

test("frozen as-of evaluation rejects post-kickoff, old, synthetic and future rows", () => {
  const rows = [
    ticket(1),
    ticket(2, { recordedAt: "2026-10-25T19:00:00Z" }),
    ticket(3, { recordedAt: "2026-10-22T10:00:00Z" }),
    ticket(4, { book: "clôture" }),
    ticket(5, { kickoff: "2026-10-28T19:00:00Z" }),
  ];
  const report = evaluateForwardAccuracy(checkpoint(rows), { from, asOf });
  assert.equal(report.metrics.n, 1);
  assert.equal(report.status, "COLLECTING_FORWARD_MATCHES");
});

test("duplicate predictions keep the earliest forecast and cannot boost precision", () => {
  const first = ticket(1);
  const revised = ticket(11, { home: first.home, away: first.away, kickoff: first.kickoff, market: first.market, recordedAt: "2026-10-24T12:00:00Z", modelProb: 0.95, result: "lose" });
  const report = evaluateForwardAccuracy(checkpoint([revised, first]), { from, asOf });
  assert.equal(report.metrics.n, 1);
  assert.equal(report.metrics.wins, 1);
  assert.ok(Math.abs(report.metrics.brier - 0.16) < 1e-12);
});

test("does not call a small or poor sample validated", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ticket(i, { result: i < 30 ? "win" : "lose" }));
  const report = evaluateForwardAccuracy(checkpoint(rows), { from, asOf });
  assert.equal(report.metrics.n, 60);
  assert.equal(report.metrics.hitRate, 0.5);
  assert.equal(report.status, "ABSOLUTE_TARGET_NOT_MET");
});

test("a strong sample still cannot claim improvement without a parallel champion", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ticket(i, { result: i < 45 ? "win" : "lose" }));
  const report = evaluateForwardAccuracy(checkpoint(rows), { from, asOf });
  assert.equal(report.status, "ABSOLUTE_TARGET_MET_NO_CHAMPION_COMPARISON");
  assert.equal(report.integrity.relativeModelImprovement, "NOT_PROVEN_WITHOUT_FROZEN_PARALLEL_CHAMPION");
});
