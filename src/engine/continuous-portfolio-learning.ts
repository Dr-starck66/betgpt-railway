import { portfolioMetrics, ruleMatches, type PortfolioMetrics, type PortfolioRule, type PortfolioTicket } from "./portfolio-lab.ts";

export type ContinuousLearningConfig = {
  minOdds: number;
  maxOdds: number;
  historyWindow: number;
  warmup: number;
  retrainEvery: number;
  blocks: number;
  minBlockN: number;
  minTotalN: number;
  minRoiLift: number;
  minAbsoluteRoi?: number;
  maxDrawdownMultiplier: number;
};

export const CONTINUOUS_ROI_CONFIG: ContinuousLearningConfig = Object.freeze({
  minOdds: 1.8,
  maxOdds: 3.0,
  historyWindow: 6000,
  warmup: 4500,
  retrainEvery: 350,
  blocks: 4,
  minBlockN: 35,
  minTotalN: 180,
  minRoiLift: 0.015,
  minAbsoluteRoi: 0.13,
  maxDrawdownMultiplier: 1.15,
});

export type RoiCandidateScore = {
  rule: PortfolioRule;
  score: number;
  totalN: number;
  blockRois: number[];
  blockHitRates: number[];
  worstBlockRoi: number;
  roiStd: number;
};

export type LearningDecision = {
  atIndex: number;
  learnedFrom: number;
  evaluationN: number;
  champion: PortfolioRule | null;
  challenger: PortfolioRule | null;
  promoted: boolean;
  reason: string;
  baselineRecent: PortfolioMetrics;
  challengerRecent: PortfolioMetrics | null;
};

export type ContinuousLearningReport = {
  mode: "PREQUENTIAL_RESEARCH_SHADOW";
  config: ContinuousLearningConfig;
  evaluated: PortfolioMetrics;
  baseline: PortfolioMetrics;
  roiLift: number;
  profitLift: number;
  drawdownDelta: number;
  decisions: LearningDecision[];
  finalChampion: PortfolioRule | null;
  promotions: number;
  rollbacks: number;
};

function splitBlocks<T>(rows: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((rows.length * i) / n);
    const b = Math.floor((rows.length * (i + 1)) / n);
    if (b > a) out.push(rows.slice(a, b));
  }
  return out;
}

function std(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  return Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length);
}

export const ROI_MIN_ODDS_GRID = Object.freeze([1.8, 1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.15, 2.2, 2.25, 2.3]);

function candidateGrid(leagues: string[]): PortfolioRule[] {
  const out: PortfolioRule[] = [];
  let id = 0;
  for (const minOdds of ROI_MIN_ODDS_GRID) {
    for (const maxOdds of [1.95, 2.0, 2.2, 2.5, 3.0]) {
      if (maxOdds < minOdds) continue;
      for (const minModelProb of [0, 0.4, 0.44, 0.48]) {
        for (const market of ["ALL", "1X2_H", "1X2_A"] as const) {
          for (const league of ["ALL", ...leagues]) {
            out.push({ id: `roi-${++id}`, market, minOdds, maxOdds, minModelProb, league });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Selects a challenger using past observations only.
 * No future/holdout observation participates in candidate ranking.
 */
export function discoverRoiChallenger(historyRaw: PortfolioTicket[], config: ContinuousLearningConfig = CONTINUOUS_ROI_CONFIG): RoiCandidateScore | null {
  const history = historyRaw
    .filter((t) => Number.isFinite(t.odds) && t.odds >= config.minOdds && t.odds <= config.maxOdds)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(-config.historyWindow);
  if (history.length < config.minTotalN) return null;
  const blocks = splitBlocks(history, config.blocks);
  const leagues = [...new Set(history.map((t) => t.league))].sort();
  let best: RoiCandidateScore | null = null;

  for (const rule of candidateGrid(leagues)) {
    const metrics = blocks.map((b) => portfolioMetrics(b.filter((t) => ruleMatches(t, rule))));
    if (metrics.length !== config.blocks || metrics.some((m) => m.n < config.minBlockN || m.roi <= 0)) continue;
    const totalN = metrics.reduce((s, m) => s + m.n, 0);
    if (totalN < config.minTotalN) continue;
    const blockRois = metrics.map((m) => m.roi);
    const blockHitRates = metrics.map((m) => m.hitRate);
    const roiStd = std(blockRois);
    const worstBlockRoi = Math.min(...blockRois);
    // ROI first. Stability and sample size prevent tiny, spectacular false positives.
    const score = worstBlockRoi - 0.35 * roiStd + Math.min(0.03, Math.log1p(totalN) / 250);
    const candidate = { rule, score, totalN, blockRois, blockHitRates, worstBlockRoi, roiStd };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function baselineRows(rows: PortfolioTicket[]): PortfolioTicket[] {
  return rows.filter((t) => t.odds >= 1.8 && t.odds <= 2.5);
}

function shouldPromote(
  baseline: PortfolioMetrics,
  challenger: PortfolioMetrics,
  config: ContinuousLearningConfig,
): { pass: boolean; reason: string } {
  if (challenger.n < config.minBlockN) return { pass: false, reason: "CHALLENGER_SAMPLE_TOO_SMALL" };
  const absoluteTarget = config.minAbsoluteRoi ?? 0;
  if (challenger.roi < absoluteTarget) return { pass: false, reason: "ABSOLUTE_ROI_TARGET_NOT_MET" };
  if (challenger.roi < baseline.roi + config.minRoiLift) return { pass: false, reason: "ROI_LIFT_TOO_SMALL" };
  if (challenger.profit <= 0) return { pass: false, reason: "CHALLENGER_PROFIT_NOT_POSITIVE" };
  if (challenger.maxDrawdown > baseline.maxDrawdown * config.maxDrawdownMultiplier) return { pass: false, reason: "DRAWDOWN_TOO_HIGH" };
  return { pass: true, reason: "PROMOTE_ROI_STABLE" };
}

/**
 * Honest prequential simulation of continuous learning.
 * At each checkpoint the learner sees only earlier matches, then the frozen
 * champion is applied to the next block. This approximates production learning
 * without leaking future outcomes into policy selection.
 */
export function runContinuousPortfolioLearning(raw: PortfolioTicket[], config: ContinuousLearningConfig = CONTINUOUS_ROI_CONFIG): ContinuousLearningReport {
  const tickets = raw
    .filter((t) => (t.market === "1X2_H" || t.market === "1X2_A") && Number.isFinite(t.odds) && t.odds >= config.minOdds && t.odds <= config.maxOdds)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const start = Math.min(Math.max(config.warmup, config.minTotalN), tickets.length);
  let champion: PortfolioRule | null = null;
  let promotions = 0;
  let rollbacks = 0;
  const decisions: LearningDecision[] = [];
  const selected: PortfolioTicket[] = [];
  const baselineSelected: PortfolioTicket[] = [];

  for (let at = start; at < tickets.length; at += config.retrainEvery) {
    const history = tickets.slice(0, at);
    const future = tickets.slice(at, Math.min(tickets.length, at + config.retrainEvery));
    const recent = history.slice(-Math.max(config.retrainEvery * 2, 700));
    const baselineRecentRows = baselineRows(recent);
    const baselineRecent = portfolioMetrics(baselineRecentRows);
    const candidate = discoverRoiChallenger(history, config);
    const challengerRecentRows = candidate ? recent.filter((t) => ruleMatches(t, candidate.rule)) : [];
    const challengerRecent = candidate ? portfolioMetrics(challengerRecentRows) : null;

    let promoted = false;
    let reason = candidate ? "CHALLENGER_NOT_PROMOTED" : "NO_ELIGIBLE_CHALLENGER";
    if (candidate && challengerRecent) {
      const gate = shouldPromote(baselineRecent, challengerRecent, config);
      if (gate.pass) {
        champion = candidate.rule;
        promotions += 1;
        promoted = true;
      }
      reason = gate.reason;
    }

    // Automatic rollback if the currently active champion no longer beats the
    // recent baseline or its drawdown becomes materially worse.
    if (champion) {
      const championRecent = portfolioMetrics(recent.filter((t) => ruleMatches(t, champion!)));
      const baseline = baselineRecent;
      const degraded =
        championRecent.n >= config.minBlockN &&
        (championRecent.roi < Math.max(baseline.roi, config.minAbsoluteRoi ?? 0) || championRecent.maxDrawdown > baseline.maxDrawdown * config.maxDrawdownMultiplier);
      if (degraded && !promoted) {
        champion = null;
        rollbacks += 1;
        reason = "ROLLBACK_CHAMPION_DRIFT";
      }
    }

    decisions.push({
      atIndex: at,
      learnedFrom: history.length,
      evaluationN: future.length,
      champion,
      challenger: candidate?.rule ?? null,
      promoted,
      reason,
      baselineRecent,
      challengerRecent,
    });

    baselineSelected.push(...baselineRows(future));
    if (champion) selected.push(...future.filter((t) => ruleMatches(t, champion!)));
  }

  const evaluated = portfolioMetrics(selected);
  const baseline = portfolioMetrics(baselineSelected);
  return {
    mode: "PREQUENTIAL_RESEARCH_SHADOW",
    config,
    evaluated,
    baseline,
    roiLift: evaluated.roi - baseline.roi,
    profitLift: evaluated.profit - baseline.profit,
    drawdownDelta: evaluated.maxDrawdown - baseline.maxDrawdown,
    decisions,
    finalChampion: champion,
    promotions,
    rollbacks,
  };
}
