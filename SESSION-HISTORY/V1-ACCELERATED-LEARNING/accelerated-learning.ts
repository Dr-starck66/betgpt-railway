import type { TicketRow } from "./ticket-log.ts";

export const ACCEL_TARGET = Object.freeze({
  minOdds: 1.8,
  targetHitRate: 0.6,
  targetRoi: 0.08,
  minValidationBets: 30,
  minPromotionLift: 0.015,
});

export type ValidationMetrics = {
  n: number;
  wins: number;
  losses: number;
  hitRate: number;
  roi: number;
  avgOdds: number;
};

export type ErrorBucket = {
  key: string;
  n: number;
  losses: number;
  hitRate: number;
  avgOdds: number;
};

export type LearningAudit = {
  target: typeof ACCEL_TARGET;
  eligible: number;
  train: ValidationMetrics;
  validation: ValidationMetrics;
  errors: ErrorBucket[];
  targetReached: boolean;
  promotionAllowed: boolean;
  reason: string;
};

function metrics(rows: TicketRow[]): ValidationMetrics {
  const settled = rows.filter((r) => r.result === "win" || r.result === "lose");
  const wins = settled.filter((r) => r.result === "win").length;
  const losses = settled.length - wins;
  const returned = settled.reduce((sum, r) => sum + (r.result === "win" ? r.odds : 0), 0);
  return {
    n: settled.length,
    wins,
    losses,
    hitRate: settled.length ? wins / settled.length : 0,
    roi: settled.length ? returned / settled.length - 1 : 0,
    avgOdds: settled.length ? settled.reduce((s, r) => s + r.odds, 0) / settled.length : 0,
  };
}

function bucketKey(r: TicketRow): string {
  const band = r.odds < 2 ? "1.80-1.99" : r.odds < 2.5 ? "2.00-2.49" : r.odds < 3 ? "2.50-2.99" : "3.00+";
  return `${r.league ?? "UNK"}|${r.market}|${band}`;
}

export function auditAcceleratedLearning(rows: TicketRow[], validationFrac = 0.25): LearningAudit {
  const eligible = rows
    .filter((r) => (r.result === "win" || r.result === "lose") && r.odds >= ACCEL_TARGET.minOdds)
    .filter((r) => Number.isFinite(Date.parse(r.kickoff)))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const cut = Math.max(1, Math.floor(eligible.length * (1 - validationFrac)));
  const trainRows = eligible.slice(0, cut);
  const validationRows = eligible.slice(cut);
  const train = metrics(trainRows);
  const validation = metrics(validationRows);

  const buckets = new Map<string, TicketRow[]>();
  for (const r of trainRows) {
    const key = bucketKey(r);
    const a = buckets.get(key) ?? [];
    a.push(r);
    buckets.set(key, a);
  }
  const errors = [...buckets.entries()]
    .map(([key, rs]) => ({ key, ...metrics(rs) }))
    .filter((x) => x.n >= 5)
    .sort((a, b) => a.hitRate - b.hitRate || b.n - a.n)
    .slice(0, 12)
    .map(({ key, n, losses, hitRate, avgOdds }) => ({ key, n, losses, hitRate, avgOdds }));

  const enough = validation.n >= ACCEL_TARGET.minValidationBets;
  const targetReached = enough && validation.hitRate >= ACCEL_TARGET.targetHitRate && validation.roi > 0;
  const promotionAllowed = targetReached && validation.hitRate + 1e-9 >= train.hitRate - 0.05;
  const reason = !enough
    ? `Validation insuffisante: ${validation.n}/${ACCEL_TARGET.minValidationBets} paris.`
    : !targetReached
      ? `Cible non prouvée: ${(validation.hitRate * 100).toFixed(1)}% à cote moyenne ${validation.avgOdds.toFixed(2)}.`
      : promotionAllowed
        ? `PASS hors-échantillon: ${(validation.hitRate * 100).toFixed(1)}%, ROI ${(validation.roi * 100).toFixed(1)}%.`
        : "Cible atteinte mais profil instable: promotion refusée.";

  return { target: ACCEL_TARGET, eligible: eligible.length, train, validation, errors, targetReached, promotionAllowed, reason };
}


export type SegmentPolicy = {
  key: string;
  action: "ALLOW" | "WATCH" | "BAN";
  n: number;
  hitRate: number;
};

export function deriveSegmentPolicy(rows: TicketRow[]): SegmentPolicy[] {
  const settled = rows
    .filter((r) => (r.result === "win" || r.result === "lose") && r.odds >= ACCEL_TARGET.minOdds)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const train = settled.slice(0, Math.max(1, Math.floor(settled.length * 0.75)));
  const groups = new Map<string, TicketRow[]>();
  for (const r of train) {
    const key = bucketKey(r);
    const a = groups.get(key) ?? []; a.push(r); groups.set(key, a);
  }
  return [...groups.entries()].map(([key, rs]) => {
    const m = metrics(rs);
    const action = m.n >= 6 && m.hitRate < 0.45 ? "BAN" : m.n >= 8 && m.hitRate >= 0.6 ? "ALLOW" : "WATCH";
    return { key, action, n: m.n, hitRate: m.hitRate };
  }).sort((a,b) => a.key.localeCompare(b.key));
}

export function segmentKeyForCandidate(league: string | undefined, market: string, odds: number): string {
  const band = odds < 2 ? "1.80-1.99" : odds < 2.5 ? "2.00-2.49" : odds < 3 ? "2.50-2.99" : "3.00+";
  return `${league ?? "UNK"}|${market}|${band}`;
}

/** Candidate-level hard gate. No prediction is forced into a bet. */
export function qualifiesForTarget(modelProb: number, odds: number, minEv = ACCEL_TARGET.targetRoi): boolean {
  return odds >= ACCEL_TARGET.minOdds && modelProb >= ACCEL_TARGET.targetHitRate && modelProb * odds - 1 >= minEv;
}
