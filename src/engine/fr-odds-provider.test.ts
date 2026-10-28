import assert from "node:assert/strict";
import test from "node:test";
import { bestFreshMainQuote } from "./best-odds-engine.ts";
import { findFrenchFixture, parseFrenchOddsEvents, fetchFrenchBookmakerOdds } from "./fr-odds-provider.ts";

const now = Date.parse("2026-10-28T08:00:00Z");
const fresh = "2026-10-28T07:59:20Z";
const kickoff = "2026-10-28T19:00:00Z";
const quote = (key: string, home: number, draw: number, away: number, at = fresh) => ({
  key, last_update: at, markets: [{
    key: "h2h", last_update: at, outcomes: [
      { name: "Benfica", price: away },
      { name: "Draw", price: draw },
      { name: "Porto", price: home },
    ],
  }],
});
const event = (books: unknown[], override: Record<string, unknown> = {}) => ({
  home_team: "Porto", away_team: "Benfica", commence_time: kickoff,
  bookmakers: books, ...override,
});

test("selects the highest French licensed operator's REAL away quote", () => {
  const fixtures = parseFrenchOddsEvents([event([
    quote("betclic_fr", 2.1, 3.3, 2.05),
    quote("winamax_fr", 2.09, 3.42, 2.18),
    quote("unibet_fr", 2.11, 3.5, 2.12),
    quote("pmu_fr", 2.08, 3.2, 2.14),
    quote("netbet_fr", 2.05, 3.1, 2.08),
  ])], now);
  assert.equal(fixtures.length, 1);
  assert.equal(fixtures[0]?.books.length, 5);
  const best = bestFreshMainQuote(fixtures[0]!.books, "1X2_A", { nowMs: now });
  assert.equal(best?.book, "Winamax");
  assert.equal(best?.odds, 2.18);
  assert.equal(best?.observedAt, fresh);
});

test("no key means no API request and no modelled fallback", async () => {
  const saved = process.env.THE_ODDS_API_KEY;
  delete process.env.THE_ODDS_API_KEY;
  try { assert.deepEqual(await fetchFrenchBookmakerOdds(["CL"]), []); }
  finally { if (saved !== undefined) process.env.THE_ODDS_API_KEY = saved; }
});

test("rejects UK/US/unlicensed books even when prices are better", () => {
  const rows = parseFrenchOddsEvents([event([
    quote("draftkings", 1.5, 3.0, 3.7),
    quote("unibet_uk", 1.8, 3.2, 3.5),
    quote("betclic_fr", 2.0, 3.6, 2.1),
  ])], now);
  assert.deepEqual(rows[0]?.books.map((x) => x.book), ["Betclic"]);
});

test("rejects stale or future-dated market quotes", () => {
  const rows = parseFrenchOddsEvents([event([
    quote("betclic_fr", 2, 3, 2.1, "2026-10-28T07:50:00Z"),
    quote("unibet_fr", 2, 3, 2.2, "2026-10-28T08:02:00Z"),
  ])], now);
  assert.equal(rows.length, 0);
});

test("rejects incomplete or mislabeled 1X2 markets", () => {
  const b = quote("winamax_fr", 2.1, 3.2, 2.2);
  b.markets[0]!.outcomes = b.markets[0]!.outcomes.filter((o) => o.name !== "Draw");
  assert.deepEqual(parseFrenchOddsEvents([event([b])], now), []);
  const wrongMarket = quote("winamax_fr", 2.1, 3.2, 2.2);
  wrongMarket.markets[0]!.key = "spreads";
  assert.deepEqual(parseFrenchOddsEvents([event([wrongMarket])], now), []);
});

test("match identity must include kickoff and consistent home/away sides", () => {
  const f = parseFrenchOddsEvents([event([quote("winamax_fr", 2, 3, 2.2)])], now);
  assert.ok(findFrenchFixture(f, "Porto", "Benfica", kickoff));
  assert.equal(findFrenchFixture(f, "Benfica", "Porto", kickoff), null);
  assert.equal(findFrenchFixture(f, "Porto", "Benfica", "2026-10-29T19:00:00Z"), null);
});

test("rejects post-kickoff fixtures", () => {
  assert.deepEqual(parseFrenchOddsEvents([event([quote("betclic_fr", 2, 3, 2.1)], { commence_time: "2026-10-28T07:00:00Z" })], now), []);
});

test("external bookmaker links must match the actual operator domain", () => {
  const b = quote("betclic_fr", 2, 3, 2.1);
  (b as { link?: string }).link = "https://attacker.example.com/cote-match/123";
  const f = parseFrenchOddsEvents([event([b])], now);
  assert.equal(f[0]?.books[0]?.url, undefined);
});
