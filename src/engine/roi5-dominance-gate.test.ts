import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRoi5DominanceGateToMarkets,
  oneXTwoDominanceMargin,
  qualifiedLeagueEvidenceCount,
  roi5DominanceGate,
} from "./roi5-dominance-gate.ts";

function history(n: number, opts: { future?: boolean; unsettled?: boolean; lowMargin?: boolean } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    matchId: `m${i}`,
    kickoff: opts.future ? "2030-01-01T12:00:00Z" : `2026-01-${String((i % 20) + 1).padStart(2, "0")}T12:00:00Z`,
    league: "PL" as const,
    market: "1X2_A" as const,
    pHome: opts.lowMargin ? 0.36 : 0.29,
    pDraw: opts.lowMargin ? 0.31 : 0.29,
    pAway: opts.lowMargin ? 0.33 : 0.42,
    result: opts.unsettled ? undefined : (i % 2 ? "win" as const : "lose" as const),
  }));
}

test("dominance margin is selected side minus second-highest 1X2 probability", () => {
  assert.ok(Math.abs((oneXTwoDominanceMargin({ home: 0.29, draw: 0.29, away: 0.42 }, "1X2_A") ?? 0) - 0.13) < 1e-12);
  assert.equal(oneXTwoDominanceMargin({ home: 0.45, draw: 0.30, away: 0.25 }, "1X2_D"), null);
});

test("low dominance blocks even when the segment is mature", () => {
  const d = roi5DominanceGate({
    league: "PL",
    kickoff: "2026-12-31T12:00:00Z",
    market: "1X2_A",
    probabilities: { home: 0.36, draw: 0.31, away: 0.33 },
    history: history(20),
  });
  assert.equal(d.blockBet, true);
  assert.equal(d.reason, "LOW_1X2_DOMINANCE");
});

test("14 qualified historical observations fail closed", () => {
  const d = roi5DominanceGate({
    league: "PL",
    kickoff: "2026-12-31T12:00:00Z",
    market: "1X2_A",
    probabilities: { home: 0.29, draw: 0.29, away: 0.42 },
    history: history(14),
  });
  assert.equal(d.blockBet, true);
  assert.equal(d.reason, "SEGMENT_EVIDENCE_TOO_SMALL");
  assert.equal(d.qualifiedHistoryN, 14);
});

test("15 qualified historical observations allow a strong side bet", () => {
  const d = roi5DominanceGate({
    league: "PL",
    kickoff: "2026-12-31T12:00:00Z",
    market: "1X2_A",
    probabilities: { home: 0.29, draw: 0.29, away: 0.42 },
    history: history(15),
  });
  assert.equal(d.blockBet, false);
  assert.equal(d.reason, "PASS");
});

test("future and unsettled rows cannot mature a segment", () => {
  const rows = [...history(10), ...history(10, { future: true }), ...history(10, { unsettled: true })];
  assert.equal(qualifiedLeagueEvidenceCount(rows, "PL", "2026-12-31T12:00:00Z"), 10);
});

test("low-dominance historical rows do not count toward maturity", () => {
  assert.equal(qualifiedLeagueEvidenceCount(history(20, { lowMargin: true }), "PL", "2026-12-31T12:00:00Z"), 0);
});

test("duplicate match IDs count once", () => {
  const rows = history(15);
  rows.push({ ...rows[0]! });
  assert.equal(qualifiedLeagueEvidenceCount(rows, "PL", "2026-12-31T12:00:00Z"), 15);
});

test("application zeroes stake and removes cover on a blocked BET", () => {
  const markets = [{ market: "1X2_A" as const, decision: "BET" as const, stakePct: 0.03, premium: true, cover: { odds: 9 } }];
  applyRoi5DominanceGateToMarkets(markets, {
    league: "PL",
    kickoff: "2026-12-31T12:00:00Z",
    probabilities: { home: 0.36, draw: 0.31, away: 0.33 },
    history: history(20),
  });
  assert.equal(markets[0]!.decision, "NO_BET");
  assert.equal(markets[0]!.stakePct, 0);
  assert.equal(markets[0]!.premium, false);
  assert.equal(markets[0]!.cover, undefined);
});

test("non-1X2-side BET is not modified", () => {
  const markets = [{ market: "BTTS_Y" as const, decision: "BET" as const, stakePct: 0.02, premium: false }];
  applyRoi5DominanceGateToMarkets(markets, {
    league: "PL",
    kickoff: "2026-12-31T12:00:00Z",
    probabilities: { home: 0.36, draw: 0.31, away: 0.33 },
    history: [],
  });
  assert.equal(markets[0]!.decision, "BET");
});
