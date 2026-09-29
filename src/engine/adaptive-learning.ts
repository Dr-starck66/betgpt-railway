import type { LeagueId, MarketKind } from "./types.ts";
import type { TicketRow } from "./ticket-log.ts";

export const ADAPTIVE_CONFIG = Object.freeze({
  archiveWeight: 0.12,
  actualWeight: 1,
  priorStrength: 12,
  modelBlend: 0.28,
  minOdds: 1.8,
  targetHitRate: 0.6,
  trainFraction: 0.72,
  minTrainSelected: 14,
  minHoldoutSelected: 12,
  objective: "ROI_FIRST" as const,
  minRoiLiftVsBaseline: 0.02,
  minStability: 0.45,
});

type SegmentDimension = "market" | "family" | "league" | "odds" | "prob" | "marketOdds" | "familyLeague";

type WeightedCount = { n: number; wins: number };

type ProfileState = {
  global: WeightedCount;
  by: Record<SegmentDimension, Map<string, WeightedCount>>;
};

export type WalkForwardPoint = {
  id: string;
  kickoff: string;
  market: MarketKind;
  league: LeagueId;
  odds: number;
  modelProb: number;
  ev: number;
  trust: number;
  result: "win" | "lose";
};

export type AdaptiveMetrics = {
  n: number;
  wins: number;
  losses: number;
  hitRate: number;
  avgOdds: number;
  roiFlat: number;
};

export type AdaptiveCandidate = {
  minTrust: number;
  minProb: number;
  maxOdds: number;
  minEv: number;
  profile: "ALL" | "NO_DRAW" | "1X2_SIDE" | "SIDE_PLUS_BTTS";
};

export type AdaptivePolicy = AdaptiveCandidate & {
  status: "PROMOTED" | "SHADOW";
  objective: "ROI_FIRST";
  baselineHoldout: AdaptiveMetrics;
  accuracyTargetMet: boolean;
  train: AdaptiveMetrics;
  trainRecent: AdaptiveMetrics;
  holdout: AdaptiveMetrics;
  stability: number;
  candidateCount: number;
  reason: string;
};

export type SegmentLesson = {
  dimension: "market" | "league" | "odds";
  key: string;
  n: number;
  hitRate: number;
  severity: "WATCH" | "AVOID";
};

export type AdaptiveLearningReport = {
  archivePriorN: number;
  honestWalkForwardN: number;
  trustTopQuartile: AdaptiveMetrics;
  policy: AdaptivePolicy;
  drift: {
    detected: boolean;
    earlierHitRate: number;
    recentHitRate: number;
    delta: number;
    message: string;
  };
  toxicSegments: SegmentLesson[];
  lessons: string[];
};

function settled(row: TicketRow): row is TicketRow & { result: "win" | "lose" } {
  return row.result === "win" || row.result === "lose";
}

function validTarget(row: TicketRow): boolean {
  return settled(row) && Number.isFinite(row.odds) && row.odds >= ADAPTIVE_CONFIG.minOdds && Number.isFinite(row.modelProb);
}

function honest(row: TicketRow): boolean {
  const r = Date.parse(row.recordedAt);
  const k = Date.parse(row.kickoff);
  return Number.isFinite(r) && Number.isFinite(k) && r < k;
}

function marketFamily(market: MarketKind): string {
  if (market === "1X2_H" || market === "1X2_A") return "SIDE";
  if (market === "1X2_D") return "DRAW";
  if (market.startsWith("OU_")) return "TOTAL";
  if (market.startsWith("BTTS")) return "BTTS";
  return "OTHER";
}

function oddsBucket(odds: number): string {
  if (odds < 2.1) return "1.80–2.09";
  if (odds < 2.4) return "2.10–2.39";
  if (odds < 2.8) return "2.40–2.79";
  if (odds < 3.4) return "2.80–3.39";
  return "3.40+";
}

function probBucket(prob: number): string {
  if (prob < 0.38) return "<38%";
  if (prob < 0.44) return "38–43%";
  if (prob < 0.5) return "44–49%";
  if (prob < 0.56) return "50–55%";
  return "56%+";
}

function keys(row: TicketRow): Record<SegmentDimension, string> {
  const family = marketFamily(row.market);
  const odds = oddsBucket(row.odds);
  return {
    market: row.market,
    family,
    league: row.league ?? "L1",
    odds,
    prob: probBucket(row.modelProb),
    marketOdds: `${row.market}|${odds}`,
    familyLeague: `${family}|${row.league ?? "L1"}`,
  };
}

function emptyState(): ProfileState {
  const make = () => new Map<string, WeightedCount>();
  return {
    global: { n: 0, wins: 0 },
    by: {
      market: make(),
      family: make(),
      league: make(),
      odds: make(),
      prob: make(),
      marketOdds: make(),
      familyLeague: make(),
    },
  };
}

function add(state: ProfileState, row: TicketRow, weight: number): void {
  if (!validTarget(row) || weight <= 0) return;
  const y = row.result === "win" ? 1 : 0;
  state.global.n += weight;
  state.global.wins += y * weight;
  const ks = keys(row);
  for (const d of Object.keys(ks) as SegmentDimension[]) {
    const map = state.by[d];
    const key = ks[d];
    const c = map.get(key) ?? { n: 0, wins: 0 };
    c.n += weight;
    c.wins += y * weight;
    map.set(key, c);
  }
}

function posterior(c: WeightedCount, priorMean: number, strength: number): number {
  return (c.wins + priorMean * strength) / Math.max(c.n + strength, 1e-9);
}

function trustOf(state: ProfileState, row: TicketRow): number {
  const global = posterior(state.global, 0.5, 20);
  const weights: Record<SegmentDimension, number> = {
    market: 0.18,
    family: 0.1,
    league: 0.12,
    odds: 0.15,
    prob: 0.15,
    marketOdds: 0.18,
    familyLeague: 0.12,
  };
  const ks = keys(row);
  let total = 0;
  let den = 0;
  for (const d of Object.keys(weights) as SegmentDimension[]) {
    const c = state.by[d].get(ks[d]) ?? { n: 0, wins: 0 };
    const p = posterior(c, global, ADAPTIVE_CONFIG.priorStrength);
    const reliability = Math.min(1, Math.log1p(c.n) / Math.log(40));
    const w = weights[d] * reliability;
    total += p * w;
    den += w;
  }
  const segment = den > 0 ? total / den : global;
  const model = Math.max(0.05, Math.min(0.95, row.modelProb));
  return segment * (1 - ADAPTIVE_CONFIG.modelBlend) + model * ADAPTIVE_CONFIG.modelBlend;
}

export function walkForwardTrust(actualRows: TicketRow[], archiveRows: TicketRow[]): WalkForwardPoint[] {
  const actual = actualRows
    .filter((r) => validTarget(r) && honest(r) && r.book !== "clôture")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const archive = archiveRows
    .filter(validTarget)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const state = emptyState();
  const out: WalkForwardPoint[] = [];
  let ai = 0;
  for (const row of actual) {
    const cutoff = Date.parse(row.kickoff);
    while (ai < archive.length) {
      const r = archive[ai]!;
      const k = Date.parse(r.kickoff);
      if (!Number.isFinite(k) || k >= cutoff) break;
      add(state, r, ADAPTIVE_CONFIG.archiveWeight);
      ai += 1;
    }
    const trust = trustOf(state, row);
    out.push({
      id: row.id,
      kickoff: row.kickoff,
      market: row.market,
      league: row.league ?? "L1",
      odds: row.odds,
      modelProb: row.modelProb,
      ev: row.ev ?? 0,
      trust,
      result: row.result as "win" | "lose",
    });
    // Only after scoring: no row can teach the model its own answer.
    add(state, row, ADAPTIVE_CONFIG.actualWeight);
  }
  return out;
}

export function adaptiveMetrics(rows: WalkForwardPoint[]): AdaptiveMetrics {
  const wins = rows.filter((r) => r.result === "win").length;
  const returned = rows.reduce((sum, r) => sum + (r.result === "win" ? r.odds : 0), 0);
  const avgOdds = rows.length ? rows.reduce((s, r) => s + r.odds, 0) / rows.length : 0;
  return {
    n: rows.length,
    wins,
    losses: rows.length - wins,
    hitRate: rows.length ? wins / rows.length : 0,
    avgOdds,
    roiFlat: rows.length ? (returned - rows.length) / rows.length : 0,
  };
}

function profilePass(row: WalkForwardPoint, profile: AdaptiveCandidate["profile"]): boolean {
  if (profile === "ALL") return true;
  if (profile === "NO_DRAW") return row.market !== "1X2_D";
  if (profile === "1X2_SIDE") return row.market === "1X2_H" || row.market === "1X2_A";
  return row.market === "1X2_H" || row.market === "1X2_A" || row.market === "BTTS_Y" || row.market === "BTTS_N";
}

function selected(rows: WalkForwardPoint[], c: AdaptiveCandidate): WalkForwardPoint[] {
  return rows.filter((r) =>
    r.odds >= ADAPTIVE_CONFIG.minOdds &&
    r.odds <= c.maxOdds &&
    r.trust >= c.minTrust &&
    r.modelProb >= c.minProb &&
    r.ev >= c.minEv &&
    profilePass(r, c.profile),
  );
}

function blocks(rows: WalkForwardPoint[], n = 3): WalkForwardPoint[][] {
  if (!rows.length) return [];
  const out: WalkForwardPoint[][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((rows.length * i) / n);
    const b = Math.floor((rows.length * (i + 1)) / n);
    out.push(rows.slice(a, b));
  }
  return out.filter((x) => x.length);
}

function candidateGrid(): AdaptiveCandidate[] {
  const out: AdaptiveCandidate[] = [];
  const profiles: AdaptiveCandidate["profile"][] = ["ALL", "NO_DRAW", "1X2_SIDE", "SIDE_PLUS_BTTS"];
  for (const minTrust of [0.44, 0.46, 0.48, 0.5, 0.52, 0.54]) {
    for (const minProb of [0.36, 0.4, 0.44, 0.48, 0.52]) {
      for (const maxOdds of [2.1, 2.3, 2.5, 2.8, 3.2]) {
        for (const minEv of [-0.1, 0, 0.03, 0.06, 0.1]) {
          for (const profile of profiles) out.push({ minTrust, minProb, maxOdds, minEv, profile });
        }
      }
    }
  }
  return out;
}

function scoreCandidate(train: WalkForwardPoint[], c: AdaptiveCandidate): { score: number; metrics: AdaptiveMetrics; recent: AdaptiveMetrics; stability: number } | null {
  const xs = selected(train, c);
  if (xs.length < ADAPTIVE_CONFIG.minTrainSelected) return null;
  const recentWindow = train.slice(Math.floor(train.length * 0.55));
  const recent = adaptiveMetrics(selected(recentWindow, c));
  if (recent.n < 5) return null;
  const m = adaptiveMetrics(xs);
  const blockMetrics = blocks(train, 3)
    .map((b) => adaptiveMetrics(selected(b, c)))
    .filter((x) => x.n >= 3);
  if (blockMetrics.length < 2) return null;
  const blockRois = blockMetrics.map((x) => x.roiFlat);
  const meanRoi = blockRois.reduce((s, x) => s + x, 0) / blockRois.length;
  const variance = blockRois.reduce((s, x) => s + (x - meanRoi) ** 2, 0) / blockRois.length;
  const roiSd = Math.sqrt(variance);
  const stability = Math.max(0, 1 - roiSd / 0.3);
  const smallPenalty = 0.2 / Math.sqrt(xs.length);
  const driftPenalty = Math.max(0, m.roiFlat - recent.roiFlat) * 0.45;
  const robustRoi = Math.min(m.roiFlat, recent.roiFlat);
  const clippedRoi = Math.max(-0.5, Math.min(0.75, robustRoi));
  // ROI is now the primary objective; hit rate is retained only as a secondary
  // quality signal so the learner does not chase accuracy at the expense of value.
  const score = 0.68 * clippedRoi + 0.17 * stability + 0.08 * m.hitRate + 0.07 * Math.min(0.5, Math.max(-0.5, meanRoi)) - smallPenalty - driftPenalty;
  return { score, metrics: m, recent, stability };
}

export function chooseAdaptivePolicy(points: WalkForwardPoint[]): AdaptivePolicy {
  if (points.length < 28) {
    const baselineHoldout = adaptiveMetrics(points);
    return {
      minTrust: 0.5,
      minProb: 0.46,
      maxOdds: 2.5,
      minEv: 0.03,
      profile: "NO_DRAW",
      status: "SHADOW",
      objective: "ROI_FIRST",
      baselineHoldout,
      accuracyTargetMet: baselineHoldout.hitRate >= ADAPTIVE_CONFIG.targetHitRate,
      train: adaptiveMetrics([]),
      trainRecent: adaptiveMetrics([]),
      holdout: baselineHoldout,
      stability: 0,
      candidateCount: 0,
      reason: "Pas assez de tickets honnêtes pour séparer apprentissage et holdout sans faux progrès.",
    };
  }
  const split = Math.max(18, Math.floor(points.length * ADAPTIVE_CONFIG.trainFraction));
  const train = points.slice(0, split);
  const holdout = points.slice(split);
  let best: { c: AdaptiveCandidate; score: number; metrics: AdaptiveMetrics; recent: AdaptiveMetrics; stability: number } | null = null;
  let candidateCount = 0;
  for (const c of candidateGrid()) {
    const s = scoreCandidate(train, c);
    if (!s) continue;
    candidateCount += 1;
    if (!best || s.score > best.score) best = { c, ...s };
  }
  const c = best?.c ?? { minTrust: 0.5, minProb: 0.46, maxOdds: 2.5, minEv: 0.03, profile: "NO_DRAW" as const };
  const trainMetrics = best?.metrics ?? adaptiveMetrics(selected(train, c));
  const trainRecent = best?.recent ?? adaptiveMetrics(selected(train.slice(Math.floor(train.length * 0.55)), c));
  const holdoutMetrics = adaptiveMetrics(selected(holdout, c));
  const baselineHoldout = adaptiveMetrics(holdout);
  const enough = holdoutMetrics.n >= ADAPTIVE_CONFIG.minHoldoutSelected;
  const roiLift = holdoutMetrics.roiFlat - baselineHoldout.roiFlat;
  const stability = best?.stability ?? 0;
  const promoted =
    enough &&
    holdoutMetrics.roiFlat > 0 &&
    trainRecent.roiFlat > 0 &&
    roiLift >= ADAPTIVE_CONFIG.minRoiLiftVsBaseline &&
    stability >= ADAPTIVE_CONFIG.minStability;
  return {
    ...c,
    status: promoted ? "PROMOTED" : "SHADOW",
    objective: "ROI_FIRST",
    baselineHoldout,
    accuracyTargetMet: holdoutMetrics.hitRate >= ADAPTIVE_CONFIG.targetHitRate,
    train: trainMetrics,
    trainRecent,
    holdout: holdoutMetrics,
    stability,
    candidateCount,
    reason: promoted
      ? `PROMOTED ROI-FIRST : challenger +${(roiLift * 100).toFixed(2)} points de ROI vs baseline sur holdout chronologique, stabilité ${(stability * 100).toFixed(0)} %.`
      : `SHADOW ROI-FIRST : promotion refusée (lift ROI ${(roiLift * 100).toFixed(2)} pts, stabilité ${(stability * 100).toFixed(0)} %, n=${holdoutMetrics.n}).`,
  };
}

function percentile(values: number[], q: number): number {
  if (!values.length) return 1;
  const xs = [...values].sort((a, b) => a - b);
  const i = Math.max(0, Math.min(xs.length - 1, Math.floor((xs.length - 1) * q)));
  return xs[i]!;
}

function toxic(points: WalkForwardPoint[]): SegmentLesson[] {
  const dims: Array<{ dimension: SegmentLesson["dimension"]; key: (r: WalkForwardPoint) => string }> = [
    { dimension: "market", key: (r) => r.market },
    { dimension: "league", key: (r) => r.league },
    { dimension: "odds", key: (r) => oddsBucket(r.odds) },
  ];
  const out: SegmentLesson[] = [];
  for (const d of dims) {
    const groups = new Map<string, WalkForwardPoint[]>();
    for (const r of points) {
      const k = d.key(r);
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const [key, rows] of groups) {
      if (rows.length < 5) continue;
      const m = adaptiveMetrics(rows);
      if (m.hitRate < 0.45) out.push({ dimension: d.dimension, key, n: m.n, hitRate: m.hitRate, severity: m.hitRate < 0.32 && m.n >= 8 ? "AVOID" : "WATCH" });
    }
  }
  return out.sort((a, b) => a.hitRate - b.hitRate || b.n - a.n).slice(0, 10);
}

export function buildAdaptiveLearningReport(actualRows: TicketRow[], archiveRows: TicketRow[]): AdaptiveLearningReport {
  const points = walkForwardTrust(actualRows, archiveRows);
  const threshold = percentile(points.map((p) => p.trust), 0.75);
  const top = points.filter((p) => p.trust >= threshold);
  const earlier = points.slice(0, Math.max(0, points.length - 30));
  const recent = points.slice(-30);
  const earlierTop = earlier.filter((p) => p.trust >= threshold);
  const recentTop = recent.filter((p) => p.trust >= threshold);
  const em = adaptiveMetrics(earlierTop);
  const rm = adaptiveMetrics(recentTop);
  const delta = rm.n && em.n ? rm.hitRate - em.hitRate : 0;
  const detected = em.n >= 8 && rm.n >= 5 && delta <= -0.15;
  const policy = chooseAdaptivePolicy(points);
  const lessons = [
    `Rétro-apprentissage activé sur ${archiveRows.filter(validTarget).length.toLocaleString("fr-FR")} observations historiques pondérées comme prior, sans les compter comme preuve du KPI.`,
    `Walk-forward honnête : ${points.length} tickets scorés uniquement avec l'information disponible avant chacun d'eux.`,
    detected
      ? "Dérive détectée : les segments auparavant fiables se dégradent récemment ; le poids du passé doit être réduit et le challenger reste en shadow."
      : "Pas de dérive majeure prouvée sur la fenêtre disponible ; le système continue néanmoins la validation chronologique.",
    "Chaque nouveau résultat réglé est ajouté après son scoring : une erreur peut corriger les matchs suivants, jamais son propre passé.",
  ];
  return {
    archivePriorN: archiveRows.filter(validTarget).length,
    honestWalkForwardN: points.length,
    trustTopQuartile: adaptiveMetrics(top),
    policy,
    drift: {
      detected,
      earlierHitRate: em.hitRate,
      recentHitRate: rm.hitRate,
      delta,
      message: detected ? "CONCEPT_DRIFT: recalibration accélérée requise" : "STABLE_OR_UNPROVEN",
    },
    toxicSegments: toxic(points),
    lessons,
  };
}

export function adaptiveSafetyBlock(
  input: { market: MarketKind; odds: number; league: LeagueId },
  report: AdaptiveLearningReport,
): string | null {
  if (input.odds < ADAPTIVE_CONFIG.minOdds) return "ODDS_BELOW_1_80";
  const checks: Array<{ dimension: SegmentLesson["dimension"]; key: string }> = [
    { dimension: "market", key: input.market },
    { dimension: "league", key: input.league },
    { dimension: "odds", key: oddsBucket(input.odds) },
  ];
  for (const c of checks) {
    const bad = report.toxicSegments.find((x) => x.dimension === c.dimension && x.key === c.key && x.severity === "AVOID");
    if (bad) return `${c.dimension}:${c.key}:${bad.n}:${bad.hitRate.toFixed(3)}`;
  }
  return null;
}

export function scoreProspectiveTrust(row: TicketRow, actualRows: TicketRow[], archiveRows: TicketRow[]): number {
  const cutoff = Date.parse(row.kickoff);
  const state = emptyState();
  for (const r of archiveRows) {
    const k = Date.parse(r.kickoff);
    if (validTarget(r) && Number.isFinite(k) && Number.isFinite(cutoff) && k < cutoff) add(state, r, ADAPTIVE_CONFIG.archiveWeight);
  }
  for (const r of actualRows) {
    const k = Date.parse(r.kickoff);
    if (validTarget(r) && honest(r) && r.book !== "clôture" && Number.isFinite(k) && Number.isFinite(cutoff) && k < cutoff) add(state, r, ADAPTIVE_CONFIG.actualWeight);
  }
  return trustOf(state, row);
}

export function adaptiveAllows(input: { market: MarketKind; odds: number; modelProb: number; ev: number; league: LeagueId; trust?: number }, policy: AdaptivePolicy): boolean {
  if (input.odds < ADAPTIVE_CONFIG.minOdds) return false;
  if (policy.status !== "PROMOTED") return true;
  if (input.odds > policy.maxOdds || input.modelProb < policy.minProb || input.ev < policy.minEv) return false;
  if (input.trust != null && input.trust < policy.minTrust) return false;
  const pseudo: WalkForwardPoint = { id: "live", kickoff: "", market: input.market, league: input.league, odds: input.odds, modelProb: input.modelProb, ev: input.ev, trust: input.trust ?? 1, result: "win" };
  return profilePass(pseudo, policy.profile);
}
