import test from "node:test";
import assert from "node:assert/strict";
import { listedHedgeQuotes, opponent21ScoreLabel } from "./exact-score-book-odds.ts";
import type { BookOdds } from "./types.ts";

function book(name: string, cs: Record<string, number>): BookOdds {
  return { book: name, home: 2, draw: 3.3, away: 4, over15: 1.3, over25: 1.9, over35: 3, under25: 1.8, bttsYes: 1.8, bttsNo: 2, cs };
}

test("opponent 2-1 score orientation follows the predicted loser", () => {
  assert.equal(opponent21ScoreLabel("1X2_H"), "1-2");
  assert.equal(opponent21ScoreLabel("1X2_A"), "2-1");
  assert.equal(opponent21ScoreLabel("1X2_D"), null);
});

test("selects the best real listed exact-score quotes without inventing a price", () => {
  const books = [book("A", { "1-1": 7, "1-2": 14 }), book("B", { "1-1": 7.5, "1-2": 13 })];
  const q = listedHedgeQuotes(books, "1X2_H");
  assert.equal(q.oneOne?.book, "B");
  assert.equal(q.oneOne?.odds, 7.5);
  assert.equal(q.opponent21?.book, "A");
  assert.equal(q.opponent21?.odds, 14);
});

test("fails closed when the required exact score is not listed", () => {
  const q = listedHedgeQuotes([book("A", { "1-1": 7 })], "1X2_A");
  assert.equal(q.oneOne?.odds, 7);
  assert.equal(q.opponent21, null);
});
