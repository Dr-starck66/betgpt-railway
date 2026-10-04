import type { BookOdds, MatchInput } from "@/engine/types";
import { bestFreshMainQuote, freshBookSnapshots, DEFAULT_MAX_QUOTE_AGE_MS } from "@/engine/best-odds-engine";

export type BestLine = {
  side: "1" | "N" | "2";
  odds: number;
  book: string;
  url?: string;
  observedAt?: string;
};

const LIVE_QUOTE_MAX_AGE_MS = DEFAULT_MAX_QUOTE_AGE_MS;

export function bestThreeWay(match: MatchInput): { home: BestLine; draw: BestLine; away: BestLine } | null {
  const opts = {
    maxAgeMs: LIVE_QUOTE_MAX_AGE_MS,
    requireTimestamp: true,
  };
  const home = bestFreshMainQuote(match.current, "1X2_H", opts);
  const draw = bestFreshMainQuote(match.current, "1X2_D", opts);
  const away = bestFreshMainQuote(match.current, "1X2_A", opts);
  if (!home || !draw || !away) return null;
  return {
    home: { side: "1", odds: home.odds, book: home.book, url: home.url, observedAt: home.observedAt },
    draw: { side: "N", odds: draw.odds, book: draw.book, url: draw.url, observedAt: draw.observedAt },
    away: { side: "2", odds: away.odds, book: away.book, url: away.url, observedAt: away.observedAt },
  };
}

export function kellyFraction(p: number, odds: number): number {
  const b = odds - 1;
  if (b <= 0 || p <= 0 || p >= 1) return 0;
  const f = (b * p - (1 - p)) / b;
  return Math.max(0, Math.min(0.08, f));
}

export function booksSorted(match: MatchInput): BookOdds[] {
  const fresh = freshBookSnapshots(match.current, Date.now(), LIVE_QUOTE_MAX_AGE_MS, true);
  return [...fresh].sort((a, b) => Math.max(b.home, b.draw, b.away) - Math.max(a.home, a.draw, a.away));
}
