import type { ErrorLearn } from "./learn.ts";

/** Public method band — same advertised rules as pickCurrentMethod + isMethodPick. */
export const METHOD_ODDS_MIN = 1.12;
export const METHOD_ODDS_MAX = 4.2;
export const SWEET_ODDS_MIN = 1.4;
export const SWEET_ODDS_MAX = 3.2;

export type PickGate = {
  minProb: number;
  maxOdds: number;
  skipDraw: boolean;
  extraMinEv: number;
};

export function tightenFromLearn(
  learn: Pick<ErrorLearn, "n" | "hitRate" | "maxOdds1x2" | "banDrawBet" | "extraMinEv"> | null | undefined,
): PickGate {
  const base: PickGate = {
    minProb: 0.28,
    maxOdds: METHOD_ODDS_MAX,
    skipDraw: false,
    extraMinEv: 0,
  };
  if (!learn || learn.n < 12) return base;
  let minProb = 0.28;
  let maxOdds = Math.min(METHOD_ODDS_MAX, learn.maxOdds1x2 || METHOD_ODDS_MAX);
  let extraMinEv = learn.extraMinEv ?? 0;
  if (learn.hitRate < 0.5) {
    minProb = 0.34;
    maxOdds = Math.min(maxOdds, 3.4);
    extraMinEv = Math.max(extraMinEv, 0.02);
  }
  if (learn.hitRate < 0.42) {
    minProb = 0.4;
    maxOdds = Math.min(maxOdds, 2.9);
    extraMinEv = Math.max(extraMinEv, 0.035);
  }
  return {
    minProb,
    maxOdds,
    skipDraw: Boolean(learn.banDrawBet),
    extraMinEv,
  };
}

export function inSweetSpot(odds: number): boolean {
  return odds >= SWEET_ODDS_MIN && odds <= SWEET_ODDS_MAX;
}

/** Rank a 1X2 candidate: prefer historically paying band, then modelProb. */
export function qualityScore(modelProb: number, odds: number): number {
  let s = modelProb * 100;
  if (inSweetSpot(odds)) s += 8;
  if (odds >= 1.7 && odds <= 2.8) s += 4;
  if (odds < 1.2 || odds > 4.2) s -= 40;
  if (odds >= 4.5) s -= 30;
  return s;
}
