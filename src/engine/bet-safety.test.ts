import { it } from "node:test";
import assert from "node:assert/strict";
import { enforceBetSafety } from "./bet-safety.ts";
import type { MarketQuote, MatchInput } from "./types.ts";
const now = Date.parse("2026-09-19T10:00:00Z");
const match = { status: "scheduled", kickoff: "2026-09-19T18:00:00Z" } as MatchInput;
const quote = (over: Partial<MarketQuote> = {}) =>
  ({
    decision: "BET",
    modelProb: 0.6,
    bestOdds: 2,
    ev: 0.2,
    listed: true,
    stakePct: 0.01,
    premium: true,
    ...over,
  }) as MarketQuote;
it("retains eligible bets without inventing a higher EV", () => {
  const q = quote();
  enforceBetSafety([q], match, false, now);
  assert.equal(q.decision, "BET");
  assert.equal(q.ev, 0.2);
});
it("rejects manufactured positive EV, bad odds and invalid probabilities", () => {
  for (const q of [
    quote({ modelProb: 0.4, ev: 0.03 }),
    quote({ listed: false }),
    quote({ modelProb: NaN }),
    quote({ bestOdds: Infinity }),
    quote({ stakePct: NaN }),
    quote({ ev: -0.1 }),
    quote({ bestOdds: 1.75 }),
  ]) {
    enforceBetSafety([q], match, false, now);
    assert.equal(q.decision, "WATCH");
    assert.equal(q.stakePct, 0);
    assert.equal(q.premium, false);
  }
});
it("rejects stale snapshots and non-prematch fixtures", () => {
  for (const status of ["live", "finished", "cancelled"] as const) {
    const q = quote();
    enforceBetSafety([q], { ...match, status }, false, now);
    assert.equal(q.decision, "WATCH");
  }
  const q = quote();
  enforceBetSafety([q], match, true, now);
  assert.equal(q.stakePct, 0);
  const past = quote();
  enforceBetSafety([past], { ...match, kickoff: "2026-09-18T18:00:00Z" }, false, now);
  assert.equal(past.stakePct, 0);
});
it("never promotes WATCH or NO_BET selections", () => {
  for (const decision of ["WATCH", "NO_BET"] as const) {
    const q = quote({ decision, stakePct: 0 });
    enforceBetSafety([q], match, false, now);
    assert.equal(q.decision, decision);
  }
});
