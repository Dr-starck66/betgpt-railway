import assert from "node:assert/strict";
import test from "node:test";
import { learnContinuousRoi5Policy } from "./roi5-continuous-learning.ts";
import type { TicketRow } from "./ticket-log.ts";

function row(i: number, margin: number, win: boolean, league = "PL"): TicketRow {
  const away = 0.34 + margin;
  const home = 0.34;
  const draw = Math.max(0.05, 1 - home - away);
  const d = new Date(Date.UTC(2026, 0, 1 + i));
  const kickoff = d.toISOString();
  const recordedAt = new Date(d.getTime() - 6 * 3600_000).toISOString();
  return {
    id: `t${i}`,
    matchId: `m${i}`,
    kickoff,
    home: `H${i}`,
    away: `A${i}`,
    market: "1X2_A",
    label: "Away",
    odds: 2.2,
    book: "Unibet",
    stakePct: 0.02,
    modelProb: away,
    ev: away * 2.2 - 1,
    dailyBest: false,
    kind: "mise",
    decision: "BET",
    league: league as TicketRow["league"],
    pHome: home,
    pDraw: draw,
    pAway: away,
    recordedAt,
    result: win ? "win" : "lose",
  };
}

test("falls back to validated default while honest settled sample is too small", () => {
  const rows = Array.from({ length: 20 }, (_, i) => row(i, 0.12, i % 2 === 0));
  const r = learnContinuousRoi5Policy(rows, "2030-01-01T00:00:00Z");
  assert.equal(r.status, "DEFAULT_SHADOW");
  assert.equal(r.reason, "INSUFFICIENT_HONEST_SETTLED_SAMPLE");
  assert.equal(r.policy.minDominanceMargin, 0.08);
  assert.equal(r.policy.minSettledQualifiedHistory, 15);
});

test("post-kickoff records and reconstructed books cannot train production policy", () => {
  const rows = Array.from({ length: 60 }, (_, i) => {
    const r = row(i, 0.12, true);
    if (i % 2 === 0) r.recordedAt = new Date(Date.parse(r.kickoff) + 1000).toISOString();
    else r.book = "Opening · dérivé";
    return r;
  });
  const r = learnContinuousRoi5Policy(rows, "2030-01-01T00:00:00Z");
  assert.equal(r.eligibleSettledN, 0);
  assert.equal(r.status, "DEFAULT_SHADOW");
});

test("stronger dominance can be promoted only after later chronological holdout confirms ROI", () => {
  const rows: TicketRow[] = [];
  for (let i = 0; i < 120; i++) {
    const strong = i % 3 !== 0;
    const margin = strong ? 0.14 : 0.085;
    // Strong-margin picks win 2/3, weak-margin picks lose 3/4.
    const win = strong ? i % 3 !== 1 : i % 4 === 0;
    rows.push(row(i, margin, win));
  }
  const r = learnContinuousRoi5Policy(rows, "2030-01-01T00:00:00Z");
  assert.equal(r.status, "PROMOTED");
  assert.ok(r.policy.minDominanceMargin >= 0.09);
  assert.ok((r.challengerHoldout?.n ?? 0) >= 12);
  assert.ok(r.roiLiftHoldout >= 0.015);
});

test("future settled rows cannot influence an earlier target kickoff", () => {
  const rows = Array.from({ length: 80 }, (_, i) => row(i, 0.12, true));
  const cutoff = rows[40]!.kickoff;
  const r = learnContinuousRoi5Policy(rows, cutoff);
  assert.ok(r.eligibleSettledN <= 40);
});


test("WATCH/NO_BET and odds outside canonical 1.80-3.00 never train ROI5 production policy", () => {
  const rows = Array.from({ length: 80 }, (_, i) => {
    const r = row(i, 0.12, true);
    if (i % 3 === 0) r.decision = "WATCH";
    else if (i % 3 === 1) r.odds = 3.4;
    else r.kind = "prono";
    return r;
  });
  const report = learnContinuousRoi5Policy(rows, "2030-01-01T00:00:00Z");
  assert.equal(report.eligibleSettledN, 0);
  assert.equal(report.status, "DEFAULT_SHADOW");
});
