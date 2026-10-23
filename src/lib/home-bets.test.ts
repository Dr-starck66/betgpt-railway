import assert from "node:assert/strict";
import test from "node:test";
import { selectHomepageBets } from "./home-bets.ts";
import type { MatchInput, PredictionRecord, MarketQuote } from "../engine/types.ts";

const NOW = Date.parse("2026-10-23T13:00:00Z");
function match(id: string, status: string = "scheduled", kickoff = "2026-10-25T19:00:00Z", league = "PL"): MatchInput {
  return {
    id, status, kickoff, league, competition: "Premier League",
    home: { id: "home-" + id, name: "Home " + id }, away: { id: "away-" + id, name: "Away " + id },
  } as unknown as MatchInput;
}
function prediction(id: string, decision: string = "BET", extras: Partial<MarketQuote> = {}): PredictionRecord {
  return {
    matchId: id, home: { name: "Home " + id }, away: { name: "Away " + id },
    league: "PL",
    markets: [{
      decision, group: "1X2", market: "1X2_H", label: "Victoire à domicile",
      bestOdds: 2.1, bestBook: "Unibet", modelProb: 0.56, stakePct: 0.01,
      ev: 0.1, premium: false, opportunityScore: 80, listed: true, ...extras,
    }],
  } as unknown as PredictionRecord;
}
test("shows a true canonical BET even if missing from the first page of matches", () => {
  const matches = Array.from({ length: 15 }, (_, i) => match(String(i)));
  const result = selectHomepageBets(matches, [prediction("12"), prediction("2")], NOW);
  assert.equal(result.length, 2);
  assert.equal(result[0]?.match.id, "12");
});
test("never advertises WATCH or NO_BET as a ticket to take", () => {
  assert.equal(selectHomepageBets([match("w"), match("n")], [prediction("w", "WATCH"), prediction("n", "NO_BET")], NOW).length, 0);
});
test("does not recommend expired, live, cancelled or unlisted fixtures", () => {
  const matches = [match("past", "scheduled", "2026-10-22T19:00:00Z"), match("live", "live"), match("cancel", "cancelled"), match("unlisted"), match("valid")];
  const preds = matches.map((m) => prediction(m.id, "BET", { listed: m.id !== "unlisted" }));
  assert.deepEqual(selectHomepageBets(matches, preds, NOW).map((x) => x.match.id), ["valid"]);
});
test("excludes noncanonical markets, invalid stake and French clubs in European cups", () => {
  const french = match("fr", "scheduled", "2026-10-25T19:00:00Z", "CL");
  french.home.name = "Paris Saint-Germain";
  const inputs = [match("draw"), match("btts"), match("zero"), french];
  const predictions = [prediction("draw", "BET", { market: "1X2_D" }), prediction("btts", "BET", { market: "BTTS_Y", group: "BTTS" }), prediction("zero", "BET", { stakePct: 0 }), prediction("fr")];
  assert.equal(selectHomepageBets(inputs, predictions, NOW).length, 0);
});
test("sorts premium, respects top-three and avoids duplicate match recommendations", () => {
  const rows = ["a", "b", "c", "d"].map((id) => match(id));
  const picks = [
    prediction("a", "BET", { opportunityScore: 12 }),
    prediction("a", "BET", { opportunityScore: 99 }),
    prediction("b", "BET", { opportunityScore: 20 }),
    prediction("c", "BET", { premium: true, opportunityScore: 10 }),
    prediction("d", "BET", { opportunityScore: 30 }),
  ];
  assert.deepEqual(selectHomepageBets(rows, picks, NOW).map((x) => x.match.id), ["c", "d", "b"]);
});
