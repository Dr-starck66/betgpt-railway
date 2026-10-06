import assert from "node:assert/strict";
import test from "node:test";
import { learnFromErrors } from "./learn.ts";
import type { TicketRow } from "./ticket-log.ts";

function lowOddsProno(i: number, result: "win" | "lose"): TicketRow {
  const kickoff = new Date(Date.UTC(2026, 9, 1 + i, 19)).toISOString();
  return {
    id: `low-${i}`,
    matchId: `low-m-${i}`,
    kickoff,
    recordedAt: new Date(Date.parse(kickoff) - 2 * 3600_000).toISOString(),
    home: `Home ${i}`,
    away: `Away ${i}`,
    market: "1X2_H",
    label: `Home ${i}`,
    odds: 1.38,
    book: "Unibet",
    stakePct: 0,
    modelProb: 0.66,
    ev: -0.02,
    dailyBest: false,
    kind: "prono",
    decision: "NO_BET",
    league: "NL",
    pHome: 0.66,
    pDraw: 0.2,
    pAway: 0.14,
    result,
  };
}

test("short-priced settled 1X2 pronos teach calibration but remain non-bets", () => {
  const rows = Array.from({ length: 8 }, (_, i) => lowOddsProno(i, i < 5 ? "win" : "lose"));
  const learned = learnFromErrors(rows);
  assert.equal(learned.n, 8);
  assert.equal(learned.nWrong, 3);
  assert.ok(learned.hitRate > 0);
  assert.equal(learned.recentMiseN, 0);
});
