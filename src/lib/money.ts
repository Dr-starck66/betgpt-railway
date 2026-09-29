import type { BookOdds, MatchInput } from "@/engine/types";

export type BestLine = { side: "1" | "N" | "2"; odds: number; book: string; url?: string };

export function bestThreeWay(match: MatchInput): { home: BestLine; draw: BestLine; away: BestLine } | null {
  const books = match.current.filter((b) => b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05);
  if (!books.length) return null;
  const pick = (key: "home" | "draw" | "away", side: BestLine["side"]): BestLine => {
    const b = books.reduce((a, c) => (c[key] > a[key] ? c : a));
    return { side, odds: b[key], book: b.book, url: key === "home" ? b.homeUrl ?? b.url : key === "draw" ? b.drawUrl ?? b.url : b.awayUrl ?? b.url };
  };
  return { home: pick("home", "1"), draw: pick("draw", "N"), away: pick("away", "2") };
}

export function kellyFraction(p: number, odds: number): number {
  const b = odds - 1;
  if (b <= 0 || p <= 0 || p >= 1) return 0;
  const f = (b * p - (1 - p)) / b;
  return Math.max(0, Math.min(0.08, f));
}

export function booksSorted(match: MatchInput): BookOdds[] {
  return [...match.current].sort((a, b) => Math.max(b.home, b.draw, b.away) - Math.max(a.home, a.draw, a.away));
}
