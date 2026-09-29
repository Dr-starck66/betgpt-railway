import type { LeagueId, MarketKind } from "./types.ts";

export type DominanceProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type DominanceEvidenceRow = {
  matchId?: string;
  kickoff: string;
  league?: LeagueId;
  market: MarketKind;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  result?: "win" | "lose" | "void";
};

export type Roi5DominancePolicy = {
  minDominanceMargin: number;
  minSettledQualifiedHistory: number;
};

export const DEFAULT_ROI5_DOMINANCE_POLICY: Roi5DominancePolicy = Object.freeze({
  minDominanceMargin: 0.08,
  minSettledQualifiedHistory: 15,
});

export type Roi5DominanceDecision = {
  blockBet: boolean;
  reason: "PASS" | "LOW_1X2_DOMINANCE" | "SEGMENT_EVIDENCE_TOO_SMALL" | "INVALID_1X2_PROBABILITIES";
  dominanceMargin: number | null;
  qualifiedHistoryN: number;
};

function finiteProb(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

export function oneXTwoDominanceMargin(
  p: DominanceProbabilities,
  market: MarketKind,
): number | null {
  if (![p.home, p.draw, p.away].every(finiteProb)) return null;
  let selected: number;
  let otherA: number;
  let otherB: number;
  if (market === "1X2_H") {
    selected = p.home;
    otherA = p.draw;
    otherB = p.away;
  } else if (market === "1X2_A") {
    selected = p.away;
    otherA = p.home;
    otherB = p.draw;
  } else {
    return null;
  }
  return selected - Math.max(otherA, otherB);
}

/**
 * Counts only observations that were already settled before the target kickoff.
 * Outcome value is deliberately NOT used: settlement is required only to prove
 * the observation is historical, not to cherry-pick wins or losses.
 *
 * A segment is the league, matching the chronological research replay. Shadow
 * / NO_BET observations can mature a segment; otherwise a new segment could
 * never earn enough evidence to graduate.
 */
export function qualifiedLeagueEvidenceCount(
  rows: DominanceEvidenceRow[],
  league: LeagueId,
  beforeKickoff: string,
  policy: Roi5DominancePolicy = DEFAULT_ROI5_DOMINANCE_POLICY,
): number {
  const before = Date.parse(beforeKickoff);
  if (!Number.isFinite(before)) return 0;
  const seen = new Set<string>();
  let n = 0;
  for (const row of rows) {
    if (row.league !== league) continue;
    if (row.result !== "win" && row.result !== "lose") continue;
    if (row.market !== "1X2_H" && row.market !== "1X2_A") continue;
    const t = Date.parse(row.kickoff);
    if (!Number.isFinite(t) || t >= before) continue;
    if (!finiteProb(row.pHome) || !finiteProb(row.pDraw) || !finiteProb(row.pAway)) continue;
    const margin = oneXTwoDominanceMargin(
      { home: row.pHome, draw: row.pDraw, away: row.pAway },
      row.market,
    );
    if (margin == null || margin < policy.minDominanceMargin) continue;
    const key = row.matchId || `${row.kickoff}|${row.league}|${row.market}`;
    if (seen.has(key)) continue;
    seen.add(key);
    n += 1;
  }
  return n;
}

export function roi5DominanceGate(input: {
  league: LeagueId;
  kickoff: string;
  market: MarketKind;
  probabilities: DominanceProbabilities;
  history: DominanceEvidenceRow[];
  policy?: Roi5DominancePolicy;
}): Roi5DominanceDecision {
  const policy = input.policy ?? DEFAULT_ROI5_DOMINANCE_POLICY;
  if (input.market !== "1X2_H" && input.market !== "1X2_A") {
    return { blockBet: false, reason: "PASS", dominanceMargin: null, qualifiedHistoryN: 0 };
  }
  const margin = oneXTwoDominanceMargin(input.probabilities, input.market);
  if (margin == null) {
    return { blockBet: true, reason: "INVALID_1X2_PROBABILITIES", dominanceMargin: null, qualifiedHistoryN: 0 };
  }
  const qualifiedHistoryN = qualifiedLeagueEvidenceCount(
    input.history,
    input.league,
    input.kickoff,
    policy,
  );
  if (margin < policy.minDominanceMargin) {
    return { blockBet: true, reason: "LOW_1X2_DOMINANCE", dominanceMargin: margin, qualifiedHistoryN };
  }
  if (qualifiedHistoryN < policy.minSettledQualifiedHistory) {
    return { blockBet: true, reason: "SEGMENT_EVIDENCE_TOO_SMALL", dominanceMargin: margin, qualifiedHistoryN };
  }
  return { blockBet: false, reason: "PASS", dominanceMargin: margin, qualifiedHistoryN };
}

export type DominanceApplicableMarket = {
  market: MarketKind;
  decision: "BET" | "WATCH" | "NO_BET";
  stakePct: number;
  premium: boolean;
  rejectionReason?: string;
  cover?: unknown;
};

export function applyRoi5DominanceGateToMarkets<T extends DominanceApplicableMarket>(
  markets: T[],
  input: {
    league: LeagueId;
    kickoff: string;
    probabilities: DominanceProbabilities;
    history: DominanceEvidenceRow[];
    policy?: Roi5DominancePolicy;
  },
): Roi5DominanceDecision[] {
  const decisions: Roi5DominanceDecision[] = [];
  for (const market of markets) {
    if (market.decision !== "BET") continue;
    if (market.market !== "1X2_H" && market.market !== "1X2_A") continue;
    const d = roi5DominanceGate({ ...input, market: market.market });
    decisions.push(d);
    if (!d.blockBet) continue;
    market.decision = "NO_BET";
    market.stakePct = 0;
    market.premium = false;
    market.cover = undefined;
    market.rejectionReason =
      d.reason === "LOW_1X2_DOMINANCE"
        ? "NO BET : écart de dominance 1X2 inférieur à 8 points."
        : d.reason === "SEGMENT_EVIDENCE_TOO_SMALL"
          ? `NO BET : segment encore immature (${d.qualifiedHistoryN}/15 précédents qualifiés).`
          : "NO BET : probabilités 1X2 invalides pour le contrôle ROI.";
  }
  return decisions;
}
