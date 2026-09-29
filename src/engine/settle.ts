import type { MarketKind } from "./types.ts";

export type MarketResult = "win" | "lose" | "void";

/**
 * Settle a quoted market against the provider full-time score.
 * Extra time: we use the score the provider reports as the match score (AET
 * included when that is the official result). Penalty shootouts are not 1X2.
 */
export function marketHits(market: MarketKind, gh: number, ga: number): MarketResult {
  const tot = gh + ga;
  switch (market) {
    case "1X2_H":
      return gh > ga ? "win" : "lose";
    case "1X2_D":
      return gh === ga ? "win" : "lose";
    case "1X2_A":
      return ga > gh ? "win" : "lose";
    case "DC_1X":
      return gh >= ga ? "win" : "lose";
    case "DC_X2":
      return ga >= gh ? "win" : "lose";
    case "DC_12":
      return gh !== ga ? "win" : "lose";
    case "DNB_H":
      if (gh === ga) return "void";
      return gh > ga ? "win" : "lose";
    case "DNB_A":
      if (gh === ga) return "void";
      return ga > gh ? "win" : "lose";
    case "OU_15_O":
      return tot > 1.5 ? "win" : "lose";
    case "OU_25_O":
      return tot > 2.5 ? "win" : "lose";
    case "OU_35_O":
      return tot > 3.5 ? "win" : "lose";
    case "OU_25_U":
      return tot < 2.5 ? "win" : "lose";
    case "BTTS_Y":
      return gh > 0 && ga > 0 ? "win" : "lose";
    case "BTTS_N":
      return gh === 0 || ga === 0 ? "win" : "lose";
    default:
      return "void";
  }
}

/** Exact-score filet: only the listed score pays, never a 1-1 default. */
export function coverHitsScore(coverScore: string | undefined, gh: number, ga: number): boolean {
  const m = /^(\d+)-(\d+)$/.exec((coverScore ?? "").trim());
  if (!m) return false;
  return Number(m[1]) === gh && Number(m[2]) === ga;
}

/** Filet covers 50 % of the main stake, sized so a hit returns that half-stake. */
export const FILET_COVER_FRAC = 0.5;

export function coverStakeOf(coverOdds: number | undefined, mainStake: number): number {
  if (!coverOdds || coverOdds <= 1.05 || mainStake <= 0) return 0;
  return (mainStake * FILET_COVER_FRAC) / (coverOdds - 1);
}
