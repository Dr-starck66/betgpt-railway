import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TicketRow } from "./ticket-log.ts";
import {
  calculateBrierScore,
  calculateCalibration,
  calculateLedgerStats,
  calculateModelPerformance,
  calculateROI,
  ledgerHealth,
} from "./ledger-stats.ts";

function t(over: Partial<TicketRow>): TicketRow {
  return {
    id: over.id ?? "a:1X2",
    matchId: over.matchId ?? "a",
    kickoff: "2026-09-10T18:00:00.000Z",
    home: "Home",
    away: "Away",
    market: "1X2_H",
    label: "Victoire Home",
    odds: 2,
    book: "Unibet",
    stakePct: 0,
    modelProb: 0.55,
    ev: 0.1,
    dailyBest: false,
    kind: "prono",
    decision: "BET",
    recordedAt: "2026-09-10T10:00:00.000Z",
    result: "win",
    ...over,
  };
}

describe("canonical ledger stats", () => {
  it("retains losses but marks financial metrics unavailable if any odds are invalid", () => {
    const s = calculateLedgerStats([t({ result: "win" }), t({ id: "bad", result: "lose", odds: NaN })]);
    assert.equal(s.settled, 2);
    assert.equal(s.losses, 1);
    assert.equal(s.roi, null);
    assert.equal(s.netUnits, null);
    assert.equal(s.unitsReturned, null);
    assert.equal(s.maxDrawdown, null);
    assert.equal(calculateROI(Infinity, 2), null);
    assert.equal(calculateROI(1, NaN), null);
  });
  it("does not silently replace missing probabilities with successful scores", () => {
    const s = calculateLedgerStats([t({ modelProb: NaN, result: "lose" })]);
    assert.equal(s.losses, 1);
    assert.equal(s.brier, null);
    assert.equal(s.logLoss, null);
    assert.equal(s.expectedHits, null);
    assert.equal(s.calibration.reduce((sum, bucket) => sum + bucket.n, 0), 0);
  });
  it("calibration covers probabilities below forty percent too", () => {
    const buckets = calculateCalibration([t({ modelProb: 0.2 }), t({ id: "low", modelProb: 0.05 })]);
    assert.equal(buckets.reduce((sum, bucket) => sum + bucket.n, 0), 2);
  });
  it("excludes WATCH rows from ROI accounting", () => {
    const s = calculateLedgerStats([t({ decision: "WATCH", result: "win" })]);
    assert.equal(s.published, 1);
    assert.equal(s.settled, 0);
    assert.equal(s.roi, null);
  });

  it("returns null ROI / winRate on zero settled", () => {
    const s = calculateLedgerStats([]);
    assert.equal(s.settled, 0);
    assert.equal(s.winRate, null);
    assert.equal(s.roi, null);
    assert.equal(s.brier, null);
    assert.equal(s.sampleBand, "unverified");
    assert.equal(s.models.length, 0);
  });

  it("excludes post-kickoff recordings from public performance", () => {
    const rows = [
      t({ id: "ok", recordedAt: "2026-09-10T10:00:00.000Z", result: "win" }),
      t({
        id: "late",
        matchId: "late",
        recordedAt: "2026-09-10T19:00:00.000Z",
        result: "win",
      }),
    ];
    const s = calculateLedgerStats(rows);
    assert.equal(s.beforeKickoff, 1);
    assert.equal(s.afterKickoff, 1);
    assert.equal(s.settled, 1);
    assert.equal(s.wins, 1);
  });

  it("voids do not count as wins or losses", () => {
    const rows = [
      t({ id: "v", result: "void" }),
      t({ id: "w", matchId: "w", result: "win" }),
    ];
    const s = calculateLedgerStats(rows);
    assert.equal(s.voids, 1);
    assert.equal(s.wins, 1);
    assert.equal(s.settled, 1);
  });

  it("ROI is (returned - staked) / staked", () => {
    assert.equal(calculateROI(100, 150), 0.5);
    assert.equal(calculateROI(0, 10), null);
    const rows = [
      t({ id: "1", result: "win", odds: 2 }),
      t({ id: "2", matchId: "2", result: "lose", odds: 2 }),
    ];
    const s = calculateLedgerStats(rows);
    assert.equal(s.unitsWagered, 2);
    assert.equal(s.unitsReturned, 2);
    assert.equal(s.netUnits, 0);
    assert.equal(s.roi, 0);
    assert.equal(s.observedHits, 1);
  });

  it("Brier is mean squared error of probability", () => {
    const rows = [
      t({ id: "1", modelProb: 1, result: "win" }),
      t({ id: "2", matchId: "2", modelProb: 0, result: "lose" }),
    ];
    assert.equal(calculateBrierScore(rows), 0);
  });

  it("calibration buckets mark small samples", () => {
    const rows = [t({ modelProb: 0.55, result: "win" })];
    const cal = calculateCalibration(rows);
    const bucket = cal.find((b) => b.lo === 0.5);
    assert.ok(bucket);
    assert.equal(bucket!.n, 1);
    assert.equal(bucket!.band, "early");
  });

  it("does not delete losing predictions from the count", () => {
    const rows = [
      t({ id: "w", result: "win" }),
      t({ id: "l", matchId: "l", result: "lose" }),
    ];
    const s = calculateLedgerStats(rows);
    assert.equal(s.losses, 1);
    assert.equal(s.wins, 1);
    assert.equal(s.settled, 2);
  });

  it("does not invent a best model from rows without engineVersion", () => {
    const rows = [t({ result: "win" }), t({ id: "2", matchId: "2", result: "lose" })];
    assert.equal(calculateModelPerformance(rows).length, 0);
    const health = ledgerHealth(rows);
    assert.equal(health.hashed, 0);
    assert.equal(health.settled, 2);
  });

  it("keeps two versions of the same fixture in the published count", () => {
    const rows = [
      t({ id: "a:v1", matchId: "a", recordedAt: "2026-09-10T09:00:00.000Z", result: "lose" }),
      t({ id: "a:v2", matchId: "a", recordedAt: "2026-09-10T11:00:00.000Z", result: "win" }),
    ];
    const s = calculateLedgerStats(rows);
    assert.equal(s.published, 2);
    assert.equal(s.settled, 2);
    assert.equal(s.wins + s.losses, 2);
  });
});
