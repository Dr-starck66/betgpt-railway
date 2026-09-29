import { clamp } from "./math";
import type { MarketKind } from "./types";

export type OneXTwo = "1X2_H" | "1X2_D" | "1X2_A";

export function selectOneXTwo(
  p: { home: number; draw: number; away: number },
  odds: { home: number; draw: number; away: number },
): { market: OneXTwo; modelProb: number; odds: number } {
  return (
    pickCurrentMethod(p, odds) ?? {
      market: "1X2_H",
      modelProb: p.home,
      odds: odds.home,
    }
  );
}

/** Published prono: most likely 1-N-2, no lottery ticket. */
export function pickCurrentMethod(
  p: { home: number; draw: number; away: number },
  odds: { home: number; draw: number; away: number },
  opts?: { skipDraw?: boolean; minProb?: number; maxOdds?: number },
): { market: OneXTwo; modelProb: number; odds: number } | null {
  const minProb = opts?.minProb ?? 0.28;
  const maxOdds = opts?.maxOdds ?? 4.2;
  const cands: { market: OneXTwo; modelProb: number; odds: number }[] = [
    { market: "1X2_H", modelProb: p.home, odds: odds.home },
    { market: "1X2_D", modelProb: p.draw, odds: odds.draw },
    { market: "1X2_A", modelProb: p.away, odds: odds.away },
  ];
  let sane = cands.filter((c) => c.modelProb >= minProb && c.odds <= maxOdds);
  if (opts?.skipDraw) sane = sane.filter((c) => c.market !== "1X2_D");
  const pool = sane.length
    ? sane
    : opts?.skipDraw
      ? cands.filter((c) => c.market !== "1X2_D")
      : cands;
  pool.sort((a, b) => (b.modelProb !== a.modelProb ? b.modelProb - a.modelProb : a.odds - b.odds));
  const top = pool[0];
  if (!top) return null;
  if (top.odds >= 5 || top.modelProb < 0.22) return null;
  if (top.odds > maxOdds && top.odds >= 4.5) return null;
  return top;
}

export function oneXTwoLabel(market: OneXTwo): string {
  if (market === "1X2_H") return "1 — Domicile";
  if (market === "1X2_A") return "2 — Extérieur";
  return "X — Nul";
}

export function prettyPickLabel(home: string, away: string, market: string): string {
  if (market === "1X2_H") return `Victoire ${home}`;
  if (market === "1X2_A") return `Victoire ${away}`;
  if (market === "1X2_D") return "Match nul";
  return market;
}

export function clampProb(x: number): number {
  return clamp(x, 0.04, 0.92);
}
