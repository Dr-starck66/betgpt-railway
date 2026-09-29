import type { LeagueId, MarketKind } from "./types";
import { hedgeXgEligibility } from "./hedge-xg-eligibility.ts";

export type ScoreHedgeSelection = "1-1" | "OPPONENT_2_1";
export type AllowedHedgeScoreLabel = "1-1" | "1-2" | "2-1";

export type ScoreHedgePolicy = {
  status: "SHADOW" | "ACTIVE";
  minExactScoreEv: number;
  maxHedgeStakeFraction: number;
  requiresListedBookmakerOdds: boolean;
  segments: {
    draw11: {
      allowedLeagues: LeagueId[];
      allowedMarkets: MarketKind[];
      mainOddsMin: number;
      mainOddsMax: number;
      maxMainProb: number;
      minScoreProb: number;
      recoveryFraction: number;
      minListedOdds: number;
    };
    opponent21: {
      allowedLeagues: LeagueId[] | "ALL";
      allowedMarkets: MarketKind[];
      mainOddsMin: number;
      mainOddsMax: number;
      maxMainProb: number;
      minScoreProb: number;
      recoveryFraction: number;
      minListedOdds: number;
    };
  };
};

export type ScoreHedgeInput = {
  league: LeagueId;
  market: MarketKind;
  mainOdds: number;
  mainStake: number;
  mainModelProb: number;
  p11: number;
  pOpponent21: number;
  listed11Odds?: number | null;
  listedOpponent21Odds?: number | null;
  // Optional pre-match scoring context. Observed rolling xG/xGA is preferred;
  // model lambdas are an explicit fallback, never mislabeled as observed xG.
  scoringContext?: {
    source: "OBSERVED_XG" | "MODEL_LAMBDA";
    expectedHomeGoals: number;
    expectedAwayGoals: number;
    bttsProb?: number | null;
    over25Prob?: number | null;
  };
};

export type ScoreHedgeCandidate = {
  selection: ScoreHedgeSelection;
  scoreLabel: AllowedHedgeScoreLabel;
  scoreProb: number;
  listedOdds: number;
  exactScoreEv: number;
  recoveryFraction: number;
  hedgeStake: number;
  hedgeStakeFraction: number;
  expectedPnlPerMainStake: number;
};

export type ScoreHedgeDecision = {
  eligible: boolean;
  execute: boolean;
  status: "NO_HEDGE" | "SHADOW_HEDGE" | "HEDGE";
  reason: string;
  selected: ScoreHedgeCandidate | null;
  considered: ScoreHedgeCandidate[];
};

/**
 * V2 research policy discovered with a strict chronological 60/20/20 split.
 * The exact-score prices in the retrospective archive are synthetic, so this
 * policy MUST remain SHADOW until timestamped bookmaker prices are collected.
 */
export const DEFAULT_SCORE_HEDGE_POLICY: ScoreHedgePolicy = {
  status: "SHADOW",
  minExactScoreEv: 0.05,
  maxHedgeStakeFraction: 0.2,
  requiresListedBookmakerOdds: true,
  segments: {
    draw11: {
      allowedLeagues: ["LL"],
      allowedMarkets: ["1X2_H"],
      mainOddsMin: 1.8,
      mainOddsMax: 2.5,
      maxMainProb: 0.47,
      minScoreProb: 0.10,
      recoveryFraction: 1.0,
      minListedOdds: 5.0,
    },
    opponent21: {
      allowedLeagues: "ALL",
      allowedMarkets: ["1X2_H"],
      mainOddsMin: 1.8,
      mainOddsMax: 2.2,
      maxMainProb: 0.47,
      minScoreProb: 0.04,
      recoveryFraction: 1.0,
      minListedOdds: 8.0,
    },
  },
};

function scoreLabel(selection: ScoreHedgeSelection, market: MarketKind): AllowedHedgeScoreLabel | null {
  if (selection === "1-1") return "1-1";
  if (market === "1X2_H") return "1-2"; // predicted loser (away) wins 2-1
  if (market === "1X2_A") return "2-1"; // predicted loser (home) wins 2-1
  return null;
}

/**
 * Hard scope lock requested for the BetGPT hedge subsystem:
 * - 1-1 draw; or
 * - predicted losing side wins 2-1 (1-2 after a HOME pick, 2-1 after an AWAY pick).
 * No 0-0, 1-0, 0-1, 2-2 or any other exact score may ever be emitted here.
 */
export function isAllowedHedgeScoreLabel(label: string, market: MarketKind): label is AllowedHedgeScoreLabel {
  if (label === "1-1") return market === "1X2_H" || market === "1X2_A";
  if (market === "1X2_H") return label === "1-2";
  if (market === "1X2_A") return label === "2-1";
  return false;
}

function candidate(
  selection: ScoreHedgeSelection,
  scoreProb: number,
  listedOdds: number | null | undefined,
  input: ScoreHedgeInput,
  policy: ScoreHedgePolicy,
): ScoreHedgeCandidate | null {
  const seg = selection === "1-1" ? policy.segments.draw11 : policy.segments.opponent21;
  const ctx = input.scoringContext;
  if (ctx) {
    const xg = hedgeXgEligibility({ market: input.market, ...ctx });
    if (selection === "1-1" && !xg.oneOne) return null;
    if (selection === "OPPONENT_2_1" && !xg.opponent21) return null;
  }
  if (selection === "OPPONENT_2_1" && ctx) {
    const total = ctx.expectedHomeGoals + ctx.expectedAwayGoals;
    const loserGoals = input.market === "1X2_H" ? ctx.expectedAwayGoals : ctx.expectedHomeGoals;
    // Conservative plausibility gate: a 2-1 hedge needs a genuine three-goal /
    // both-teams-score profile. These defaults fail closed and are intended to
    // be continuously re-estimated once timestamped observed xG is available.
    if (!Number.isFinite(total) || total < 2.30) return null;
    if (!Number.isFinite(loserGoals) || loserGoals < 0.92) return null;
    if (ctx.bttsProb != null && Number.isFinite(ctx.bttsProb) && ctx.bttsProb < 0.46) return null;
    if (ctx.over25Prob != null && Number.isFinite(ctx.over25Prob) && ctx.over25Prob < 0.40) return null;
  }
  if (!seg.allowedMarkets.includes(input.market)) return null;
  if (seg.allowedLeagues !== "ALL" && !seg.allowedLeagues.includes(input.league)) return null;
  if (input.mainOdds < seg.mainOddsMin || input.mainOdds > seg.mainOddsMax) return null;
  if (!Number.isFinite(input.mainModelProb) || input.mainModelProb > seg.maxMainProb) return null;
  if (!Number.isFinite(scoreProb) || scoreProb < seg.minScoreProb) return null;
  if (policy.requiresListedBookmakerOdds && (!(listedOdds && Number.isFinite(listedOdds)) || listedOdds < seg.minListedOdds)) return null;
  if (!(listedOdds && listedOdds > 1)) return null;

  const label = scoreLabel(selection, input.market);
  if (!label || !isAllowedHedgeScoreLabel(label, input.market)) return null;

  const exactScoreEv = scoreProb * listedOdds - 1;
  if (exactScoreEv < policy.minExactScoreEv) return null;

  const recoveryFraction = Math.max(0, Math.min(1, seg.recoveryFraction));
  const hedgeStake = (input.mainStake * recoveryFraction) / (listedOdds - 1);
  const hedgeStakeFraction = hedgeStake / input.mainStake;
  if (!(hedgeStake > 0) || hedgeStakeFraction > policy.maxHedgeStakeFraction) return null;

  // Expected incremental hedge PnL normalized by the main stake. This lets the
  // selector compare a frequent lower-odds 1-1 with a rarer high-odds 2-1.
  const expectedPnlPerMainStake = recoveryFraction * exactScoreEv / (listedOdds - 1);
  return {
    selection,
    scoreLabel: label,
    scoreProb,
    listedOdds,
    exactScoreEv,
    recoveryFraction,
    hedgeStake,
    hedgeStakeFraction,
    expectedPnlPerMainStake,
  };
}

/**
 * Select at most ONE score hedge for the match. Never stack 1-1 and opponent
 * 2-1. Missing real bookmaker odds, unvalidated segments, weak EV or excessive
 * stake all fail closed to NO_HEDGE.
 */
export function selectiveScoreHedge(
  input: ScoreHedgeInput,
  policy: ScoreHedgePolicy = DEFAULT_SCORE_HEDGE_POLICY,
): ScoreHedgeDecision {
  if (!(input.mainStake > 0) || !Number.isFinite(input.mainStake)) {
    return { eligible: false, execute: false, status: "NO_HEDGE", reason: "INVALID_MAIN_STAKE", selected: null, considered: [] };
  }
  if (input.market !== "1X2_H" && input.market !== "1X2_A") {
    return { eligible: false, execute: false, status: "NO_HEDGE", reason: "MAIN_MARKET_NOT_SCORE_HEDGEABLE", selected: null, considered: [] };
  }

  const considered = [
    candidate("1-1", input.p11, input.listed11Odds, input, policy),
    candidate("OPPONENT_2_1", input.pOpponent21, input.listedOpponent21Odds, input, policy),
  ].filter((x): x is ScoreHedgeCandidate => Boolean(x));

  if (!considered.length) {
    return {
      eligible: false,
      execute: false,
      status: "NO_HEDGE",
      reason: "NO_VALIDATED_POSITIVE_EV_SCORE_HEDGE",
      selected: null,
      considered: [],
    };
  }

  considered.sort((a, b) => b.expectedPnlPerMainStake - a.expectedPnlPerMainStake);
  const selected = considered[0]!;
  const shadow = policy.status !== "ACTIVE";
  return {
    eligible: true,
    execute: !shadow,
    status: shadow ? "SHADOW_HEDGE" : "HEDGE",
    reason: shadow ? "BEST_SCORE_HEDGE_QUALIFIES_BUT_POLICY_IS_SHADOW" : "BEST_SCORE_HEDGE_QUALIFIED",
    selected,
    considered,
  };
}
