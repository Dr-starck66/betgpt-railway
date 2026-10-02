import type { TicketRow } from "./ticket-log.ts";
import { isCanonicalRoi5Selection } from "./ledger-pick.ts";
import {
  DEFAULT_ROI5_DOMINANCE_POLICY,
  oneXTwoDominanceMargin,
  type Roi5DominancePolicy,
} from "./roi5-dominance-gate.ts";

export type Roi5PolicyMetrics = {
  n: number;
  wins: number;
  hitRate: number;
  roi: number;
  profit: number;
  maxDrawdown: number;
};

export type Roi5ContinuousLearningReport = {
  mode: "CONTINUOUS_CHAMPION_CHALLENGER";
  status: "PROMOTED" | "DEFAULT_SHADOW";
  policy: Roi5DominancePolicy;
  defaultPolicy: Roi5DominancePolicy;
  eligibleSettledN: number;
  trainN: number;
  holdoutN: number;
  candidateCount: number;
  baselineTrain: Roi5PolicyMetrics;
  challengerTrain: Roi5PolicyMetrics | null;
  baselineHoldout: Roi5PolicyMetrics;
  challengerHoldout: Roi5PolicyMetrics | null;
  roiLiftHoldout: number;
  reason: string;
};

const MARGIN_GRID = Object.freeze([0.06, 0.07, 0.08, 0.09, 0.10, 0.11, 0.12, 0.14]);
const MATURITY_GRID = Object.freeze([10, 15, 20, 25, 30]);
const MIN_ELIGIBLE = 48;
const MIN_TRAIN_SELECTED = 20;
const MIN_HOLDOUT_SELECTED = 12;
const MIN_HOLDOUT_ROI_LIFT = 0.015;
const MAX_DRAWDOWN_MULTIPLIER = 1.15;

type EligibleRow = TicketRow & {
  result: "win" | "lose";
  pHome: number;
  pDraw: number;
  pAway: number;
};

function finiteProb(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function isHonestSettledSide(row: TicketRow, beforeMs: number): row is EligibleRow {
  if (row.result !== "win" && row.result !== "lose") return false;
  if (row.kind !== "mise") return false;
  if (!isCanonicalRoi5Selection(row)) return false;
  if (!finiteProb(row.pHome) || !finiteProb(row.pDraw) || !finiteProb(row.pAway)) return false;
  if (!Number.isFinite(row.odds) || row.odds < 1.5 || row.odds > 5) return false;
  const kickoff = Date.parse(row.kickoff);
  const recorded = Date.parse(row.recordedAt);
  if (!Number.isFinite(kickoff) || !Number.isFinite(recorded)) return false;
  if (kickoff >= beforeMs || recorded >= kickoff) return false;
  // Reconstructed/closing rows are useful for research priors elsewhere, but
  // they are not allowed to promote a production ROI5 policy.
  if (/cl[oô]ture|d[eé]riv[eé]|archive/i.test(row.book || "")) return false;
  return true;
}

function eligibleRows(rows: TicketRow[], beforeKickoff: string): EligibleRow[] {
  const beforeMs = Date.parse(beforeKickoff);
  const cutoff = Number.isFinite(beforeMs) ? beforeMs : Date.now();
  const seen = new Set<string>();
  const out: EligibleRow[] = [];
  for (const row of [...rows].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    if (!isHonestSettledSide(row, cutoff)) continue;
    const key = row.matchId || `${row.kickoff}|${row.home}|${row.away}|${row.market}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function metricsFromSelected(rows: EligibleRow[]): Roi5PolicyMetrics {
  let bankroll = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let wins = 0;
  for (const row of rows) {
    const pnl = row.result === "win" ? row.odds - 1 : -1;
    if (row.result === "win") wins += 1;
    bankroll += pnl;
    peak = Math.max(peak, bankroll);
    maxDrawdown = Math.max(maxDrawdown, peak - bankroll);
  }
  return {
    n: rows.length,
    wins,
    hitRate: rows.length ? wins / rows.length : 0,
    roi: rows.length ? bankroll / rows.length : 0,
    profit: bankroll,
    maxDrawdown,
  };
}

function selectedByPolicy(rows: EligibleRow[], policy: Roi5DominancePolicy, seed: EligibleRow[] = []): EligibleRow[] {
  const qualifiedByLeague = new Map<string, number>();
  const countQualified = (row: EligibleRow) => {
    const margin = oneXTwoDominanceMargin(
      { home: row.pHome, draw: row.pDraw, away: row.pAway },
      row.market,
    );
    if (margin != null && margin >= policy.minDominanceMargin) {
      qualifiedByLeague.set(row.league ?? "L1", (qualifiedByLeague.get(row.league ?? "L1") ?? 0) + 1);
    }
  };
  for (const row of seed) countQualified(row);

  const selected: EligibleRow[] = [];
  for (const row of rows) {
    const margin = oneXTwoDominanceMargin(
      { home: row.pHome, draw: row.pDraw, away: row.pAway },
      row.market,
    );
    const league = row.league ?? "L1";
    const maturity = qualifiedByLeague.get(league) ?? 0;
    if (margin != null && margin >= policy.minDominanceMargin && maturity >= policy.minSettledQualifiedHistory) {
      selected.push(row);
    }
    // Update only AFTER scoring this row: no self-teaching / no future leak.
    countQualified(row);
  }
  return selected;
}

function evaluate(rows: EligibleRow[], policy: Roi5DominancePolicy, seed: EligibleRow[] = []): Roi5PolicyMetrics {
  return metricsFromSelected(selectedByPolicy(rows, policy, seed));
}

function scoreCandidate(m: Roi5PolicyMetrics): number {
  // ROI-first, with explicit penalties for fragile samples and drawdown.
  const sample = Math.min(1, m.n / 60);
  return m.roi * 100 + m.hitRate * 7 + sample * 5 - m.maxDrawdown * 0.18;
}

/**
 * Production-safe continuous learning for the ROI5 gate.
 * Only timestamped, settled, pre-kickoff tickets are eligible to promote a
 * challenger. Candidate selection happens on the earlier chronological block;
 * promotion requires a later holdout improvement. If no challenger clears the
 * holdout gate, the fixed, already-validated default remains champion.
 */
export function learnContinuousRoi5Policy(
  rows: TicketRow[],
  beforeKickoff: string,
): Roi5ContinuousLearningReport {
  const eligible = eligibleRows(rows, beforeKickoff);
  const empty = metricsFromSelected([]);
  const fallback = (reason: string): Roi5ContinuousLearningReport => ({
    mode: "CONTINUOUS_CHAMPION_CHALLENGER",
    status: "DEFAULT_SHADOW",
    policy: DEFAULT_ROI5_DOMINANCE_POLICY,
    defaultPolicy: DEFAULT_ROI5_DOMINANCE_POLICY,
    eligibleSettledN: eligible.length,
    trainN: 0,
    holdoutN: 0,
    candidateCount: MARGIN_GRID.length * MATURITY_GRID.length,
    baselineTrain: empty,
    challengerTrain: null,
    baselineHoldout: empty,
    challengerHoldout: null,
    roiLiftHoldout: 0,
    reason,
  });

  if (eligible.length < MIN_ELIGIBLE) return fallback("INSUFFICIENT_HONEST_SETTLED_SAMPLE");

  const split = Math.max(1, Math.floor(eligible.length * 0.72));
  const train = eligible.slice(0, split);
  const holdout = eligible.slice(split);
  const baselineTrain = evaluate(train, DEFAULT_ROI5_DOMINANCE_POLICY);
  const baselineHoldout = evaluate(holdout, DEFAULT_ROI5_DOMINANCE_POLICY, train);

  let bestPolicy: Roi5DominancePolicy | null = null;
  let bestTrain: Roi5PolicyMetrics | null = null;
  let bestScore = -Infinity;
  for (const minDominanceMargin of MARGIN_GRID) {
    for (const minSettledQualifiedHistory of MATURITY_GRID) {
      const policy = { minDominanceMargin, minSettledQualifiedHistory };
      const m = evaluate(train, policy);
      if (m.n < MIN_TRAIN_SELECTED || m.roi <= 0) continue;
      const s = scoreCandidate(m);
      if (s > bestScore) {
        bestScore = s;
        bestPolicy = policy;
        bestTrain = m;
      }
    }
  }

  if (!bestPolicy || !bestTrain) {
    return {
      ...fallback("NO_ROBUST_CHALLENGER_ON_TRAIN"),
      trainN: train.length,
      holdoutN: holdout.length,
      baselineTrain,
      baselineHoldout,
    };
  }

  const challengerHoldout = evaluate(holdout, bestPolicy, train);
  const roiLift = challengerHoldout.roi - baselineHoldout.roi;
  const drawdownOk =
    baselineHoldout.maxDrawdown <= 0
      ? challengerHoldout.maxDrawdown <= 2
      : challengerHoldout.maxDrawdown <= baselineHoldout.maxDrawdown * MAX_DRAWDOWN_MULTIPLIER;
  const promote =
    challengerHoldout.n >= MIN_HOLDOUT_SELECTED &&
    challengerHoldout.roi > 0 &&
    roiLift >= MIN_HOLDOUT_ROI_LIFT &&
    drawdownOk;

  return {
    mode: "CONTINUOUS_CHAMPION_CHALLENGER",
    status: promote ? "PROMOTED" : "DEFAULT_SHADOW",
    policy: promote ? bestPolicy : DEFAULT_ROI5_DOMINANCE_POLICY,
    defaultPolicy: DEFAULT_ROI5_DOMINANCE_POLICY,
    eligibleSettledN: eligible.length,
    trainN: train.length,
    holdoutN: holdout.length,
    candidateCount: MARGIN_GRID.length * MATURITY_GRID.length,
    baselineTrain,
    challengerTrain: bestTrain,
    baselineHoldout,
    challengerHoldout,
    roiLiftHoldout: roiLift,
    reason: promote
      ? "PROMOTE_ONLY_AFTER_CHRONOLOGICAL_HOLDOUT_ROI_LIFT"
      : !drawdownOk
        ? "CHALLENGER_REJECTED_DRAWDOWN"
        : challengerHoldout.n < MIN_HOLDOUT_SELECTED
          ? "CHALLENGER_REJECTED_SMALL_HOLDOUT"
          : challengerHoldout.roi <= 0
            ? "CHALLENGER_REJECTED_NEGATIVE_HOLDOUT_ROI"
            : "CHALLENGER_REJECTED_INSUFFICIENT_ROI_LIFT",
  };
}
