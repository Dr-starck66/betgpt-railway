import { marketHits } from "./settle.ts";
import { publishedBeforeKickoff, sampleBand, sampleLabel, verifyStatus, type SampleBand } from "./verify-core.ts";
import type { TicketRow } from "./ticket-log.ts";

export type CalibrationBucket = {
  label: string;
  lo: number;
  hi: number;
  n: number;
  predicted: number;
  observed: number;
  band: SampleBand;
};

export type ModelPerf = {
  engine: string;
  n: number;
  brier: number | null;
  roi: number | null;
  winRate: number | null;
  band: SampleBand;
};

export type LedgerStats = {
  published: number;
  beforeKickoff: number;
  afterKickoff: number;
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  voids: number;
  winRate: number | null;
  roi: number | null;
  unitsWagered: number;
  unitsReturned: number | null;
  netUnits: number | null;
  avgOdds: number | null;
  brier: number | null;
  logLoss: number | null;
  expectedHits: number | null;
  observedHits: number;
  clv: number | null;
  maxDrawdown: number | null;
  longestWin: number;
  longestLose: number;
  sampleBand: SampleBand;
  sampleLabel: string;
  calibration: CalibrationBucket[];
  models: ModelPerf[];
  unavailable: string[];
};

const STAKE = 1;
const validOdds = (row: TicketRow) => Number.isFinite(row.odds) && row.odds > 1;
const validProbability = (row: TicketRow) => Number.isFinite(row.modelProb) && row.modelProb >= 0 && row.modelProb <= 1;

function eligible(row: TicketRow): boolean {
  if (row.book === "clôture") return false;
  if (row.result === "void") return false;
  if (row.kind === "mise") return false;
  if (row.decision === "NO_BET") return false;
  return publishedBeforeKickoff(row);
}

function settledOk(row: TicketRow): boolean {
  return eligible(row) && (row.result === "win" || row.result === "lose");
}

function brierOf(p: number, win: boolean): number {
  const y = win ? 1 : 0;
  return (p - y) ** 2;
}

function logLossOf(p: number, win: boolean): number {
  const q = Math.min(Math.max(win ? p : 1 - p, 1e-6), 1 - 1e-6);
  return -Math.log(q);
}

export function calculateROI(staked: number, returned: number): number | null {
  if (!Number.isFinite(staked) || !Number.isFinite(returned) || staked <= 0 || returned < 0) return null;
  return (returned - staked) / staked;
}

export function calculateBrierScore(rows: TicketRow[]): number | null {
  const settled = rows.filter(settledOk);
  if (!settled.length || !settled.every(validProbability)) return null;
  let s = 0;
  for (const r of settled) s += brierOf(r.modelProb, r.result === "win");
  return s / settled.length;
}

export function calculateCalibration(rows: TicketRow[]): CalibrationBucket[] {
  const settled = rows.filter(settledOk).filter(validProbability);
  const edges = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];
  const out: CalibrationBucket[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const bucket = settled.filter((r) => r.modelProb >= lo && r.modelProb < hi);
    const wins = bucket.filter((r) => r.result === "win").length;
    const pred = bucket.length ? bucket.reduce((a, r) => a + r.modelProb, 0) / bucket.length : 0;
    out.push({
      label: i === edges.length - 2 ? `${Math.round(lo * 100)} % +` : `${Math.round(lo * 100)}–${Math.round(hi * 100)} %`,
      lo,
      hi,
      n: bucket.length,
      predicted: pred,
      observed: bucket.length ? wins / bucket.length : 0,
      band: sampleBand(bucket.length),
    });
  }
  return out;
}

export function calculateModelPerformance(rows: TicketRow[]): ModelPerf[] {
  const by = new Map<string, TicketRow[]>();
  for (const r of rows.filter(settledOk)) {
    const key = r.engineVersion;
    if (!key) continue;
    const list = by.get(key) ?? [];
    list.push(r);
    by.set(key, list);
  }
  return [...by.entries()].map(([engine, list]) => {
    const wins = list.filter((r) => r.result === "win").length;
    const staked = list.length * STAKE;
    const returned = list.reduce((a, r) => a + (r.result === "win" ? r.odds * STAKE : 0), 0);
    return {
      engine,
      n: list.length,
      brier: calculateBrierScore(list),
      roi: list.every(validOdds) ? calculateROI(staked, returned) : null,
      winRate: list.length ? wins / list.length : null,
      band: sampleBand(list.length),
    };
  });
}

export function calculateLedgerStats(rows: TicketRow[]): LedgerStats {
  const published = rows.filter((r) => r.kind !== "mise" && r.decision !== "NO_BET" && r.book !== "clôture");
  const before = published.filter((r) => publishedBeforeKickoff(r));
  const after = published.filter((r) => !publishedBeforeKickoff(r));
  const settled = before.filter((r) => r.result === "win" || r.result === "lose");
  const pending = before.filter((r) => !r.result);
  const wins = settled.filter((r) => r.result === "win").length;
  const losses = settled.filter((r) => r.result === "lose").length;
  const oddsComplete = settled.every(validOdds);
  const probabilitiesComplete = settled.every(validProbability);
  const voids = published.filter((r) => r.result === "void").length;
  const unitsWagered = settled.length * STAKE;
  const unitsReturned = oddsComplete ? settled.reduce((a, r) => a + (r.result === "win" ? r.odds * STAKE : 0), 0) : null;
  const clvs = settled.map((r) => r.clv).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const odds = settled.filter(validOdds).map((r) => r.odds);
  let runW = 0;
  let runL = 0;
  let longestWin = 0;
  let longestLose = 0;
  let peak = 0;
  let equity = 0;
  let maxDd = 0;
  for (const r of [...settled].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    if (r.result === "win") {
      runW += 1;
      runL = 0;
      equity += r.odds * STAKE - STAKE;
    } else {
      runL += 1;
      runW = 0;
      equity -= STAKE;
    }
    longestWin = Math.max(longestWin, runW);
    longestLose = Math.max(longestLose, runL);
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  const unavailable: string[] = [];
  if (!oddsComplete) unavailable.push("ROI et drawdown : cotes manquantes ou invalides");
  if (!probabilitiesComplete) unavailable.push("Brier et pertes logarithmiques : probabilités manquantes ou invalides");
  if (!clvs.length) unavailable.push("CLV");
  const models = calculateModelPerformance(rows);
  if (!models.length) unavailable.push("comparaison moteurs");
  return {
    published: published.length,
    beforeKickoff: before.length,
    afterKickoff: after.length,
    settled: settled.length,
    pending: pending.length,
    wins,
    losses,
    voids,
    winRate: settled.length ? wins / settled.length : null,
    roi: unitsReturned == null ? null : calculateROI(unitsWagered, unitsReturned),
    unitsWagered,
    unitsReturned,
    netUnits: unitsReturned == null ? null : unitsReturned - unitsWagered,
    avgOdds: oddsComplete && odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : null,
    brier: calculateBrierScore(rows),
    logLoss: (() => {
      const s = settled;
      if (!s.length || !probabilitiesComplete) return null;
      return s.reduce((a, r) => a + logLossOf(r.modelProb, r.result === "win"), 0) / s.length;
    })(),
    expectedHits: probabilitiesComplete ? settled.reduce((a, r) => a + r.modelProb, 0) : null,
    observedHits: wins,
    clv: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : null,
    maxDrawdown: settled.length && oddsComplete ? maxDd : null,
    longestWin,
    longestLose,
    sampleBand: sampleBand(settled.length),
    sampleLabel: sampleLabel(settled.length),
    calibration: calculateCalibration(rows),
    models,
    unavailable,
  };
}

export function settleMarket(market: TicketRow["market"], gh: number, ga: number) {
  return marketHits(market, gh, ga);
}

export function ledgerHealth(rows: TicketRow[]) {
  const stats = calculateLedgerStats(rows);
  let missingResult = 0;
  let locked = 0;
  let hashed = 0;
  let unverified = 0;
  let partial = 0;
  let legacy = 0;
  const now = Date.now();
  for (const r of rows) {
    const st = verifyStatus(r);
    if (st === "unverified") unverified += 1;
    if (st === "partial") partial += 1;
    if (st === "legacy") legacy += 1;
    if (r.lockedAt) locked += 1;
    if (r.predictionHash) hashed += 1;
    const ko = Date.parse(r.kickoff);
    if (publishedBeforeKickoff(r) && Number.isFinite(ko) && now >= ko && !r.result) missingResult += 1;
  }
  return { ...stats, unverified, partial, legacy, locked, hashed, missingResult, total: rows.length };
}

export { sampleBand, sampleLabel, publishedBeforeKickoff, verifyStatus };
