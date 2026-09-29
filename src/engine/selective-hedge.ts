import type { LeagueId, MarketKind } from "./types";

export type SelectiveHedgePolicy = {
  status: "SHADOW" | "ACTIVE";
  recoveryFraction: number;
  mainOddsMin: number;
  mainOddsMax: number;
  p11Min: number;
  allowedLeagues: LeagueId[];
  minListedExactOdds: number;
  minExactScoreEv: number;
  maxHedgeStakeFraction: number;
  requiresListedBookmakerOdds: boolean;
};

export type SelectiveHedgeInput = {
  league: LeagueId;
  market: MarketKind;
  mainOdds: number;
  mainStake: number;
  p11: number;
  listed11Odds?: number | null;
};

export type SelectiveHedgeDecision = {
  eligible: boolean;
  execute: boolean;
  status: "NO_HEDGE" | "SHADOW_HEDGE" | "HEDGE";
  reason: string;
  hedgeStake: number;
  hedgeStakeFraction: number;
  recoveryFraction: number;
  exactScoreEv: number | null;
};

export const DEFAULT_SELECTIVE_HEDGE_POLICY: SelectiveHedgePolicy = {
  status: "SHADOW",
  recoveryFraction: 0.5,
  mainOddsMin: 1.8,
  mainOddsMax: 2.5,
  p11Min: 0.143,
  allowedLeagues: ["LL"],
  minListedExactOdds: 4.5,
  minExactScoreEv: 0.05,
  maxHedgeStakeFraction: 0.1,
  requiresListedBookmakerOdds: true,
};

function no(reason: string, recoveryFraction: number): SelectiveHedgeDecision {
  return {
    eligible: false,
    execute: false,
    status: "NO_HEDGE",
    reason,
    hedgeStake: 0,
    hedgeStakeFraction: 0,
    recoveryFraction,
    exactScoreEv: null,
  };
}

/**
 * Selective 1-1 hedge gate.
 *
 * The hedge is deliberately independent from the main-bet promotion gate.
 * It may only protect HOME/AWAY 1X2 bets because a 1-1 is not an independent
 * hedge for a draw selection. It is fail-closed when listed bookmaker exact
 * score odds are missing.
 */
export function selectiveHedge11(
  input: SelectiveHedgeInput,
  policy: SelectiveHedgePolicy = DEFAULT_SELECTIVE_HEDGE_POLICY,
): SelectiveHedgeDecision {
  const recovery = Math.max(0, Math.min(1, policy.recoveryFraction));
  if (!(input.mainStake > 0) || !Number.isFinite(input.mainStake)) return no("INVALID_MAIN_STAKE", recovery);
  if (input.market !== "1X2_H" && input.market !== "1X2_A") return no("MAIN_MARKET_NOT_HEDGEABLE_BY_1_1", recovery);
  if (input.mainOdds < policy.mainOddsMin || input.mainOdds > policy.mainOddsMax) return no("MAIN_ODDS_OUTSIDE_POLICY", recovery);
  if (!policy.allowedLeagues.includes(input.league)) return no("LEAGUE_NOT_VALIDATED", recovery);
  if (!Number.isFinite(input.p11) || input.p11 < policy.p11Min) return no("P11_BELOW_SELECTIVE_THRESHOLD", recovery);

  const listed = input.listed11Odds ?? null;
  if (policy.requiresListedBookmakerOdds && (!(listed && Number.isFinite(listed)) || listed < policy.minListedExactOdds)) {
    return no("REAL_LISTED_1_1_ODDS_REQUIRED", recovery);
  }
  if (!(listed && listed > 1)) return no("INVALID_1_1_ODDS", recovery);

  const exactScoreEv = input.p11 * listed - 1;
  if (exactScoreEv < policy.minExactScoreEv) {
    return {
      ...no("1_1_EV_BELOW_THRESHOLD", recovery),
      exactScoreEv,
    };
  }

  const rawStake = (input.mainStake * recovery) / (listed - 1);
  const cap = input.mainStake * policy.maxHedgeStakeFraction;
  const hedgeStake = Math.max(0, Math.min(rawStake, cap));
  if (!(hedgeStake > 0)) return no("HEDGE_STAKE_ZERO", recovery);

  const hedgeStakeFraction = hedgeStake / input.mainStake;
  const shadow = policy.status !== "ACTIVE";
  return {
    eligible: true,
    execute: !shadow,
    status: shadow ? "SHADOW_HEDGE" : "HEDGE",
    reason: shadow ? "QUALIFIES_BUT_POLICY_IS_SHADOW" : "QUALIFIED_SELECTIVE_1_1_HEDGE",
    hedgeStake,
    hedgeStakeFraction,
    recoveryFraction: recovery,
    exactScoreEv,
  };
}
