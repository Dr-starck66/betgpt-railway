import type { LeagueId } from "./types.ts";

export type RoiLeagueExpansion = {
  league: LeagueId;
  name: string;
  espnSlug: string;
  status: "ACTIVE" | "SHADOW";
  screeningHistoricalRoi: number;
  screeningRecentRoi: number;
  canonicalRoi?: number;
  canonicalValidationRoi?: number;
};

/** Canonical ROI5 + selective hedge champion. */
export const ROI5_CANONICAL_CHAMPION = Object.freeze({
  roi: 0.3567667905898516,
  maxDrawdown: 5,
  n: 178,
  validationRoi: 0.32225206899068637,
  validationMaxDrawdown: 3.2871767545117394,
  validationN: 57,
  source: "data/dominance-uncertainty-gate-v1.json",
});

/**
 * OpenFootball screening identified these leagues as interesting challengers,
 * but screening ROI is NOT comparable to the canonical 35.6767% replay.
 * They therefore remain SHADOW until the same canonical replay contains their
 * historical rows and proves an improvement on both the full replay and the
 * chronological validation slice.
 */
export const ROI_LEAGUE_EXPANSION: readonly RoiLeagueExpansion[] = Object.freeze([
  { league: "ER", name: "Eredivisie", espnSlug: "ned.1", status: "SHADOW", screeningHistoricalRoi: 0.1971563761, screeningRecentRoi: 0.1296837586 },
  { league: "PT", name: "Primeira Liga", espnSlug: "por.1", status: "SHADOW", screeningHistoricalRoi: 0.1264241717, screeningRecentRoi: 0.1509559440 },
  { league: "SC", name: "Premiership écossaise", espnSlug: "sco.1", status: "SHADOW", screeningHistoricalRoi: 0.1141344303, screeningRecentRoi: 0.1268570912 },
  { league: "TR", name: "Süper Lig", espnSlug: "tur.1", status: "SHADOW", screeningHistoricalRoi: 0.1152802748, screeningRecentRoi: 0.2365240909 },
]);

export const ROI_EXPANSION_LEAGUES: readonly LeagueId[] = Object.freeze(ROI_LEAGUE_EXPANSION.map((x) => x.league));
export const ROI_ACTIVE_EXPANSION_LEAGUES: readonly LeagueId[] = Object.freeze(
  ROI_LEAGUE_EXPANSION.filter((x) => x.status === "ACTIVE").map((x) => x.league),
);
export const ROI_SHADOW_EXPANSION_LEAGUES: readonly LeagueId[] = Object.freeze(
  ROI_LEAGUE_EXPANSION.filter((x) => x.status === "SHADOW").map((x) => x.league),
);

export function isShadowExpansionLeague(league: LeagueId): boolean {
  return ROI_SHADOW_EXPANSION_LEAGUES.includes(league);
}

export type ExpansionApplicableMarket = {
  decision: "BET" | "WATCH" | "NO_BET";
  stakePct: number;
  premium: boolean;
  rejectionReason?: string;
  cover?: unknown;
};

/**
 * Fail-closed production guard. Shadow leagues are still fetched, modelled and
 * archived, but cannot consume bankroll until canonical promotion is proven.
 */
export function applyRoiExpansionShadowGateToMarkets<T extends ExpansionApplicableMarket>(
  markets: T[],
  league: LeagueId,
): boolean {
  if (!isShadowExpansionLeague(league)) return false;
  let blocked = false;
  for (const market of markets) {
    if (market.decision !== "BET") continue;
    blocked = true;
    market.decision = "NO_BET";
    market.stakePct = 0;
    market.premium = false;
    market.cover = undefined;
    market.rejectionReason =
      "NO BET : championnat en SHADOW jusqu’à preuve d’un ROI canonique supérieur au champion 35,68 %.";
  }
  return blocked;
}

export function canonicalPromotionPass(input: {
  roi: number;
  maxDrawdown: number;
  n: number;
  validationRoi: number;
  validationMaxDrawdown: number;
  validationN: number;
  minRoiLift?: number;
}): boolean {
  const minLift = input.minRoiLift ?? 0.005;
  return (
    input.n >= ROI5_CANONICAL_CHAMPION.n &&
    input.validationN >= ROI5_CANONICAL_CHAMPION.validationN &&
    input.roi >= ROI5_CANONICAL_CHAMPION.roi + minLift &&
    input.validationRoi >= ROI5_CANONICAL_CHAMPION.validationRoi &&
    input.maxDrawdown <= ROI5_CANONICAL_CHAMPION.maxDrawdown * 1.15 &&
    input.validationMaxDrawdown <= ROI5_CANONICAL_CHAMPION.validationMaxDrawdown * 1.15
  );
}
