import assert from "node:assert/strict";
import test from "node:test";
import { ADAPTIVE_CONFIG, adaptiveAllows, adaptiveSafetyBlock, buildAdaptiveLearningReport, walkForwardTrust } from "./adaptive-learning.ts";
import type { TicketRow } from "./ticket-log.ts";

function row(i: number, win: boolean, opts: Partial<TicketRow> = {}): TicketRow {
  const day = String((i % 27) + 1).padStart(2, "0");
  return {
    id: `r${i}`,
    matchId: `m${i}`,
    kickoff: `2026-09-${day}T20:00:00Z`,
    recordedAt: `2026-09-${day}T10:00:00Z`,
    home: "A",
    away: "B",
    market: "1X2_H",
    label: "A",
    odds: 1.9,
    book: "Unibet",
    stakePct: 0.01,
    modelProb: 0.55,
    ev: 0.045,
    dailyBest: false,
    kind: "mise",
    decision: "BET",
    league: "L1",
    result: win ? "win" : "lose",
    ...opts,
  };
}

test("walk-forward cannot learn the current result before scoring it", () => {
  const first = row(1, false);
  const second = row(2, true);
  const base = walkForwardTrust([first, second], []);
  const flipped = walkForwardTrust([{ ...first, result: "win" }, second], []);
  assert.equal(base[0]!.trust, flipped[0]!.trust);
  assert.notEqual(base[1]!.trust, flipped[1]!.trust);
});

test("future archive rows cannot leak into an earlier prediction", () => {
  const actual = row(3, true, { kickoff: "2026-09-03T20:00:00Z", recordedAt: "2026-09-03T10:00:00Z" });
  const future = Array.from({ length: 40 }, (_, i) => row(100 + i, true, { book: "clôture", kickoff: "2026-10-01T20:00:00Z", recordedAt: "2026-10-01T20:00:00Z" }));
  const a = walkForwardTrust([actual], []);
  const b = walkForwardTrust([actual], future);
  assert.equal(a[0]!.trust, b[0]!.trust);
});

test("archive prior accelerates learning but never counts as honest proof", () => {
  const archive = Array.from({ length: 80 }, (_, i) => row(i, true, { book: "clôture", kickoff: `2025-09-${String((i % 27) + 1).padStart(2, "0")}T20:00:00Z`, recordedAt: `2025-09-${String((i % 27) + 1).padStart(2, "0")}T20:00:00Z` }));
  const actual = Array.from({ length: 8 }, (_, i) => row(200 + i, i % 2 === 0));
  const report = buildAdaptiveLearningReport(actual, archive);
  assert.equal(report.archivePriorN, 80);
  assert.equal(report.honestWalkForwardN, 8);
  assert.equal(report.policy.status, "SHADOW");
});

test("odds floor remains hard even when a policy is shadow", () => {
  const report = buildAdaptiveLearningReport(Array.from({ length: 8 }, (_, i) => row(300 + i, true)), []);
  assert.equal(ADAPTIVE_CONFIG.minOdds, 1.8);
  assert.equal(adaptiveAllows({ market: "1X2_H", odds: 1.79, modelProb: 0.9, ev: 0.5, league: "L1", trust: 0.9 }, report.policy), false);
});


test("repeated losing segments can veto a new bet before positive policy promotion", () => {
  const bad = Array.from({ length: 12 }, (_, i) => row(400 + i, i < 2, { league: "EL", odds: 2.1 }));
  const report = buildAdaptiveLearningReport(bad, []);
  const block = adaptiveSafetyBlock({ market: "1X2_H", odds: 2.1, league: "EL" }, report);
  assert.ok(block?.startsWith("league:EL") || block?.startsWith("market:"));
});
