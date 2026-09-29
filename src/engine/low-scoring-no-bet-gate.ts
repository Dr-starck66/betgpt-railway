export type LowScoringContext = {
  source: "OBSERVED_XG" | "MODEL_LAMBDA";
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  zeroZeroProb?: number | null;
  bttsProb?: number | null;
  over25Prob?: number | null;
};

export type LowScoringNoBetPolicy = {
  maxHomeExpectedGoals: number;
  maxAwayExpectedGoals: number;
  maxTotalExpectedGoals: number;
  minZeroZeroProb: number;
};

export type LowScoringNoBetDecision = {
  blockBet: boolean;
  reason: "PASS" | "LOW_XG_00_RISK_NO_BET" | "INVALID_SCORING_CONTEXT";
  source: LowScoringContext["source"] | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  totalExpectedGoals: number | null;
  zeroZeroProb: number | null;
};

/**
 * Conservative first production rule requested for BetGPT:
 * when BOTH teams have weak pre-match scoring expectation and the 0-0 risk is
 * material, the match is a hard NO_BET. It must contribute zero stake and must
 * not enter ROI denominators.
 *
 * These thresholds are intentionally conservative defaults. They are exposed
 * as policy so timestamped observed-xG data can re-estimate them later without
 * changing the invariant: low-xG + elevated 0-0 risk => no wager.
 */
export const DEFAULT_LOW_SCORING_NO_BET_POLICY: LowScoringNoBetPolicy = Object.freeze({
  maxHomeExpectedGoals: 1.1,
  maxAwayExpectedGoals: 1.1,
  maxTotalExpectedGoals: 2.1,
  minZeroZeroProb: 0.12,
});

function poissonZeroZero(home: number, away: number): number {
  return Math.exp(-(home + away));
}

export function lowScoringNoBetGate(
  context: LowScoringContext | undefined,
  policy: LowScoringNoBetPolicy = DEFAULT_LOW_SCORING_NO_BET_POLICY,
): LowScoringNoBetDecision {
  if (!context) {
    return {
      blockBet: false,
      reason: "PASS",
      source: null,
      expectedHomeGoals: null,
      expectedAwayGoals: null,
      totalExpectedGoals: null,
      zeroZeroProb: null,
    };
  }

  const home = context.expectedHomeGoals;
  const away = context.expectedAwayGoals;
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) {
    return {
      blockBet: true,
      reason: "INVALID_SCORING_CONTEXT",
      source: context.source,
      expectedHomeGoals: Number.isFinite(home) ? home : null,
      expectedAwayGoals: Number.isFinite(away) ? away : null,
      totalExpectedGoals: null,
      zeroZeroProb: null,
    };
  }

  const total = home + away;
  const explicit00 = context.zeroZeroProb;
  const p00 = explicit00 != null && Number.isFinite(explicit00)
    ? Math.max(0, Math.min(1, explicit00))
    : poissonZeroZero(home, away);

  const weakBoth =
    home <= policy.maxHomeExpectedGoals &&
    away <= policy.maxAwayExpectedGoals &&
    total <= policy.maxTotalExpectedGoals;
  const elevated00 = p00 >= policy.minZeroZeroProb;
  const blockBet = weakBoth && elevated00;

  return {
    blockBet,
    reason: blockBet ? "LOW_XG_00_RISK_NO_BET" : "PASS",
    source: context.source,
    expectedHomeGoals: home,
    expectedAwayGoals: away,
    totalExpectedGoals: total,
    zeroZeroProb: p00,
  };
}

export type NoBetApplicableMarket = {
  decision: "BET" | "WATCH" | "NO_BET";
  stakePct: number;
  premium: boolean;
  rejectionReason?: string;
};

/** Apply the invariant to every market for a match, not just to hedge execution. */
export function applyLowScoringNoBetGateToMarkets<T extends NoBetApplicableMarket>(
  markets: T[],
  context: LowScoringContext | undefined,
  policy: LowScoringNoBetPolicy = DEFAULT_LOW_SCORING_NO_BET_POLICY,
): LowScoringNoBetDecision {
  const gate = lowScoringNoBetGate(context, policy);
  if (!gate.blockBet) return gate;
  for (const market of markets) {
    market.decision = "NO_BET";
    market.stakePct = 0;
    market.premium = false;
    market.rejectionReason =
      gate.reason === "INVALID_SCORING_CONTEXT"
        ? "NO BET : contexte xG invalide ou incomplet."
        : "NO BET : xG faibles des deux équipes et risque de 0-0 trop élevé.";
  }
  return gate;
}
