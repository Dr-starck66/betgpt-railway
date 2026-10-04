import assert from "node:assert/strict";
import test from "node:test";
import type { BookOdds, MatchInput } from "@/engine/types";
import { bestThreeWay, booksSorted } from "@/lib/money";
import { bookmakerDestination, isExactBookmakerMatchUrl } from "@/lib/bookmaker-url";

const totals = { over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0 };

function quote(book: string, home: number, draw: number, away: number, observedAt?: string, url?: string): BookOdds {
  return { book, home, draw, away, ...totals, observedAt, url, homeUrl: url, drawUrl: url, awayUrl: url };
}

function match(current: BookOdds[]): MatchInput {
  return { current } as unknown as MatchInput;
}

test("public 1N2 fails closed without a fresh provider timestamp", () => {
  const noTime = match([quote("Unibet", 2.1, 3.2, 3.5, undefined, "https://www.unibet.fr/paris-football/france/ligue-1/123-match")]);
  assert.equal(bestThreeWay(noTime), null);

  const stale = new Date(Date.now() - 8 * 60_000).toISOString();
  assert.equal(bestThreeWay(match([quote("Unibet", 2.1, 3.2, 3.5, stale, "https://www.unibet.fr/paris-football/france/ligue-1/123-match")])), null);
});

test("public 1N2 chooses only fresh observed quotes", () => {
  const now = new Date().toISOString();
  const fresh = match([
    quote("Unibet", 2.1, 3.2, 3.5, now, "https://www.unibet.fr/paris-football/france/ligue-1/123-match"),
    quote("Betclic", 2.2, 3.1, 3.4, undefined, "https://www.betclic.fr/football-sfootball/psg-lyon-m123"),
  ]);
  const best = bestThreeWay(fresh);
  assert.equal(best?.home.book, "Unibet");
  assert.equal(best?.home.odds, 2.1);
  assert.deepEqual(booksSorted(fresh).map((b) => b.book), ["Unibet"]);
});

test("generic bookmaker and league pages are never CTA destinations", () => {
  assert.equal(bookmakerDestination("Unibet", "L1", undefined), null);
  assert.equal(bookmakerDestination("Unibet", "L1", "https://www.unibet.fr/paris-football/france/ligue-1-mcdonalds"), null);
  assert.equal(bookmakerDestination("Betclic", "L1", "https://www.betclic.fr/football-sfootball"), null);
});

test("an exact event URL remains eligible", () => {
  const betclic = "https://www.betclic.fr/football-sfootball/paris-sg-lyon-m123456";
  const netbet = "https://www.netbet.fr/evenement/123456-paris-sg-lyon";
  assert.equal(isExactBookmakerMatchUrl(betclic), true);
  assert.equal(isExactBookmakerMatchUrl(netbet), true);
  assert.equal(bookmakerDestination("Betclic", "L1", betclic), betclic);
});
