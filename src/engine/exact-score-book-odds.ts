import type { BookOdds, MarketKind } from "./types.ts";
import type { AllowedHedgeScoreLabel } from "./selective-score-hedge.ts";

export type ListedExactScoreQuote = {
  book: string;
  scoreLabel: AllowedHedgeScoreLabel;
  odds: number;
  url?: string;
};

export function opponent21ScoreLabel(market: MarketKind): "1-2" | "2-1" | null {
  if (market === "1X2_H") return "1-2";
  if (market === "1X2_A") return "2-1";
  return null;
}

export function bestListedExactScoreQuote(
  books: BookOdds[],
  scoreLabel: AllowedHedgeScoreLabel,
): ListedExactScoreQuote | null {
  let best: ListedExactScoreQuote | null = null;
  for (const book of books) {
    const raw = scoreLabel === "1-1" ? (book.cs?.[scoreLabel] ?? book.cs11) : book.cs?.[scoreLabel];
    if (!(raw && Number.isFinite(raw) && raw > 1)) continue;
    if (!best || raw > best.odds) {
      best = { book: book.book, scoreLabel, odds: raw, url: book.url };
    }
  }
  return best;
}

export function listedHedgeQuotes(books: BookOdds[], market: MarketKind): {
  oneOne: ListedExactScoreQuote | null;
  opponent21: ListedExactScoreQuote | null;
} {
  const opponent = opponent21ScoreLabel(market);
  return {
    oneOne: bestListedExactScoreQuote(books, "1-1"),
    opponent21: opponent ? bestListedExactScoreQuote(books, opponent) : null,
  };
}
