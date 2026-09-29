import { hedgeProfitabilityGate, type PortfolioBenchmark } from "./hedge-profitability-gate.ts";
import type { ScoreHedgeDecision } from "./selective-score-hedge.ts";

export type HedgeShadowRecord = {
  id: string;
  matchId: string;
  capturedAt: string;
  kickoff: string;
  league: string;
  mainMarket: "1X2_H" | "1X2_A";
  mainOdds: number;
  mainStake: number;
  bookmaker: string;
  decisionStatus: ScoreHedgeDecision["status"];
  hedgeScore: "1-1" | "1-2" | "2-1" | null;
  hedgeOdds: number | null;
  hedgeStake: number;
  modelScoreProb: number | null;
  exactScoreEv: number | null;
  settled?: {
    settledAt: string;
    homeGoals: number;
    awayGoals: number;
    mainWon: boolean;
    hedgeWon: boolean;
    baselinePnl: number;
    hedgeLegPnl: number;
    hedgedPortfolioPnl: number;
    baselineCapital: number;
    hedgedCapital: number;
  };
};

export type HedgeShadowMeta = {
  id: string;
  matchId: string;
  capturedAt: string;
  kickoff: string;
  league: string;
  mainMarket: "1X2_H" | "1X2_A";
  mainOdds: number;
  mainStake: number;
  bookmaker: string;
};

export function buildHedgeShadowRecord(meta: HedgeShadowMeta, decision: ScoreHedgeDecision): HedgeShadowRecord {
  const s = decision.selected;
  return {
    ...meta,
    decisionStatus: decision.status,
    hedgeScore: s?.scoreLabel ?? null,
    hedgeOdds: s?.listedOdds ?? null,
    hedgeStake: s?.hedgeStake ?? 0,
    modelScoreProb: s?.scoreProb ?? null,
    exactScoreEv: s?.exactScoreEv ?? null,
  };
}

function mainWon(market: "1X2_H" | "1X2_A", hg: number, ag: number): boolean {
  return market === "1X2_H" ? hg > ag : ag > hg;
}

export function settleHedgeShadowRecord(
  record: HedgeShadowRecord,
  homeGoals: number,
  awayGoals: number,
  settledAt = new Date().toISOString(),
): HedgeShadowRecord {
  if (record.settled) return record;
  const wonMain = mainWon(record.mainMarket, homeGoals, awayGoals);
  const baselinePnl = wonMain ? record.mainStake * (record.mainOdds - 1) : -record.mainStake;
  const actualScore = `${homeGoals}-${awayGoals}`;
  const hedgeWon = Boolean(record.hedgeScore && record.hedgeScore === actualScore && record.hedgeOdds && record.hedgeStake > 0);
  const hedgeLegPnl = record.hedgeStake > 0
    ? hedgeWon
      ? record.hedgeStake * ((record.hedgeOdds ?? 1) - 1)
      : -record.hedgeStake
    : 0;
  return {
    ...record,
    settled: {
      settledAt,
      homeGoals,
      awayGoals,
      mainWon: wonMain,
      hedgeWon,
      baselinePnl,
      hedgeLegPnl,
      hedgedPortfolioPnl: baselinePnl + hedgeLegPnl,
      baselineCapital: record.mainStake,
      hedgedCapital: record.mainStake + record.hedgeStake,
    },
  };
}

function maxDrawdown(pnls: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const pnl of pnls) {
    equity += pnl;
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  return maxDd;
}

export function aggregateShadowPortfolio(records: HedgeShadowRecord[]): {
  baseline: PortfolioBenchmark;
  hedged: PortfolioBenchmark;
  hedgeCount: number;
  hedgeHits: number;
} {
  const settled = records.filter((r) => r.settled);
  const basePnls = settled.map((r) => r.settled!.baselinePnl);
  const hedgedPnls = settled.map((r) => r.settled!.hedgedPortfolioPnl);
  const baseCapital = settled.reduce((s, r) => s + r.settled!.baselineCapital, 0);
  const hedgeCapital = settled.reduce((s, r) => s + r.settled!.hedgedCapital, 0);
  const baseProfit = basePnls.reduce((a, b) => a + b, 0);
  const hedgeProfit = hedgedPnls.reduce((a, b) => a + b, 0);
  return {
    baseline: {
      profit: baseProfit,
      roi: baseCapital > 0 ? baseProfit / baseCapital : 0,
      maxDrawdown: maxDrawdown(basePnls),
      sampleSize: settled.length,
    },
    hedged: {
      profit: hedgeProfit,
      roi: hedgeCapital > 0 ? hedgeProfit / hedgeCapital : 0,
      maxDrawdown: maxDrawdown(hedgedPnls),
      sampleSize: settled.length,
    },
    hedgeCount: settled.filter((r) => r.hedgeStake > 0).length,
    hedgeHits: settled.filter((r) => r.settled!.hedgeWon).length,
  };
}

export function evaluateShadowPromotion(
  records: HedgeShadowRecord[],
  opts: { minSampleSize?: number; maxDrawdownWorsening?: number } = {},
) {
  const portfolio = aggregateShadowPortfolio(records);
  const gate = hedgeProfitabilityGate(portfolio.baseline, portfolio.hedged, opts);
  return { ...portfolio, gate };
}
