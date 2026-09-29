import type { MarketKind } from "./types.ts";
import { lowScoringNoBetGate, type LowScoringContext } from "./low-scoring-no-bet-gate.ts";

export type HedgeXgPolicy = {
  minLambdaForOneOne: number;
  minTotalForOneOne: number;
  minPredictedLoserForOpponent21: number;
  minPredictedWinnerForOpponent21: number;
  minTotalForOpponent21: number;
};

export const DEFAULT_HEDGE_XG_POLICY: HedgeXgPolicy = Object.freeze({
  minLambdaForOneOne: 0.65,
  minTotalForOneOne: 1.9,
  minPredictedLoserForOpponent21: 0.85,
  minPredictedWinnerForOpponent21: 0.7,
  minTotalForOpponent21: 2.2,
});

export type HedgeXgEligibility = {
  oneOne: boolean;
  opponent21: boolean;
  reasons: string[];
};

/**
 * Plausibility gate shared by the public cover display and the research hedge
 * engine. It never manufactures odds; it only says whether 1-1 / adverse 2-1
 * are compatible with the pre-match scoring profile.
 */
export function hedgeXgEligibility(
  input: { market: MarketKind } & LowScoringContext,
  policy: HedgeXgPolicy = DEFAULT_HEDGE_XG_POLICY,
): HedgeXgEligibility {
  const noBet = lowScoringNoBetGate(input);
  if (noBet.blockBet) {
    return { oneOne: false, opponent21: false, reasons: [noBet.reason] };
  }

  const h = Math.max(0, input.expectedHomeGoals);
  const a = Math.max(0, input.expectedAwayGoals);
  const total = h + a;
  const oneOne =
    h >= policy.minLambdaForOneOne &&
    a >= policy.minLambdaForOneOne &&
    total >= policy.minTotalForOneOne;

  let loser = 0;
  let winner = 0;
  if (input.market === "1X2_H") {
    winner = h;
    loser = a;
  } else if (input.market === "1X2_A") {
    winner = a;
    loser = h;
  }
  const opponent21 =
    (input.market === "1X2_H" || input.market === "1X2_A") &&
    total >= policy.minTotalForOpponent21 &&
    loser >= policy.minPredictedLoserForOpponent21 &&
    winner >= policy.minPredictedWinnerForOpponent21;

  const reasons: string[] = [];
  if (!oneOne) reasons.push("XG_PROFILE_REJECTS_1_1_HEDGE");
  if (!opponent21) reasons.push("XG_PROFILE_REJECTS_OPPONENT_2_1_HEDGE");
  return { oneOne, opponent21, reasons };
}
