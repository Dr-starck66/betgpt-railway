import assert from "node:assert/strict";
import test from "node:test";
import { ACCEL_TARGET, auditAcceleratedLearning, qualifiesForTarget } from "./accelerated-learning.ts";
import type { TicketRow } from "./ticket-log.ts";

function row(i: number, win: boolean, odds = 1.9): TicketRow {
  return {
    id: String(i), matchId: String(i), kickoff: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
    home: "A", away: "B", market: "1X2_H", label: "A", odds, book: "test", stakePct: 1,
    modelProb: .64, ev: .216, dailyBest: false, kind: "mise", decision: "BET", league: "PL",
    recordedAt: "2025-12-01T00:00:00Z", result: win ? "win" : "lose",
  };
}

test("hard target gate rejects odds below 1.80", () => {
  assert.equal(qualifiesForTarget(.7, 1.79), false);
  assert.equal(qualifiesForTarget(.6, 1.8), true);
});

test("audit never declares target with too few validation bets", () => {
  const a = auditAcceleratedLearning(Array.from({length:40},(_,i)=>row(i,true)));
  assert.equal(a.promotionAllowed, false);
});

test("walk-forward audit can prove target on sufficiently large unseen tail", () => {
  const rows = Array.from({length:160},(_,i)=>row(i, i < 120 ? i%2===0 : i%5!==0));
  const a = auditAcceleratedLearning(rows);
  assert.ok(a.validation.n >= ACCEL_TARGET.minValidationBets);
  assert.ok(a.validation.hitRate >= .6);
  assert.equal(a.promotionAllowed, true);
});

test("bad historical segment becomes BAN without looking at validation tail", async () => {
  const { deriveSegmentPolicy } = await import("./accelerated-learning.ts");
  const rows = Array.from({length:80},(_,i)=>row(i, i >= 60 ? true : i % 4 === 0, 2.1));
  const policy = deriveSegmentPolicy(rows);
  assert.equal(policy.find(x => x.key === "PL|1X2_H|2.00-2.49")?.action, "BAN");
});
