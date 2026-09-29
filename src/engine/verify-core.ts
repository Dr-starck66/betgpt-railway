export type VerifyStatus = "verified" | "partial" | "legacy" | "unverified";
export type SampleBand = "unverified" | "early" | "limited" | "meaningful";
export type Lifecycle = "published" | "locked" | "settled" | "void" | "unverified";

export type EvidenceRow = {
  id: string;
  matchId: string;
  kickoff: string;
  recordedAt: string;
  market: string;
  label: string;
  odds: number;
  book: string;
  modelProb: number;
  kind?: string;
  decision?: string;
  lockedAt?: string;
  predictionHash?: string;
  engineVersion?: string;
  revision?: number;
  supersedesId?: string;
  result?: "win" | "lose" | "void";
};

export function kickoffPassed(kickoff: string, now = Date.now()): boolean {
  const t = Date.parse(kickoff);
  return Number.isFinite(t) && now >= t;
}

export function publishedBeforeKickoff(row: Pick<EvidenceRow, "recordedAt" | "kickoff">): boolean {
  const rec = Date.parse(row.recordedAt);
  const ko = Date.parse(row.kickoff);
  if (!Number.isFinite(rec) || !Number.isFinite(ko)) return false;
  return rec < ko;
}

export function isImmutable(row: Pick<EvidenceRow, "kickoff" | "lockedAt">, now = Date.now()): boolean {
  if (row.lockedAt) return true;
  return kickoffPassed(row.kickoff, now);
}

export function canMutatePrediction(row: Pick<EvidenceRow, "kickoff" | "lockedAt">, now = Date.now()): boolean {
  return !isImmutable(row, now);
}

export function canonicalPayload(row: EvidenceRow): string {
  return JSON.stringify({
    id: row.id,
    matchId: row.matchId,
    kickoff: row.kickoff,
    market: row.market,
    selection: row.label,
    odds: row.odds,
    book: row.book,
    modelProb: Number(row.modelProb.toFixed(6)),
    recordedAt: row.recordedAt,
    engineVersion: row.engineVersion ?? null,
  });
}

export function verifyStatus(row: EvidenceRow): VerifyStatus {
  const rec = Date.parse(row.recordedAt);
  const ko = Date.parse(row.kickoff);
  if (!Number.isFinite(rec) || !Number.isFinite(ko)) return "legacy";
  if (rec >= ko) return "unverified";
  if (row.predictionHash && row.engineVersion) return "verified";
  return "partial";
}

export function verifyLabel(status: VerifyStatus): string {
  if (status === "verified") return "Vérifié";
  if (status === "partial") return "Partiellement vérifié";
  if (status === "legacy") return "Hérité";
  return "Non vérifié";
}

export function lifecycle(row: EvidenceRow, now = Date.now()): Lifecycle {
  if (row.result === "void") return "void";
  if (!publishedBeforeKickoff(row)) return "unverified";
  if (row.result === "win" || row.result === "lose") return "settled";
  if (isImmutable(row, now)) return "locked";
  return "published";
}

export function lifecycleLabel(state: Lifecycle): string {
  if (state === "published") return "Publié";
  if (state === "locked") return "Verrouillé";
  if (state === "settled") return "Tranché";
  if (state === "void") return "Annulé";
  return "Non vérifié";
}

export function sampleBand(n: number): SampleBand {
  if (n <= 0) return "unverified";
  if (n < 30) return "early";
  if (n < 100) return "limited";
  return "meaningful";
}

export function sampleLabel(n: number): string {
  const band = sampleBand(n);
  if (band === "unverified") return "Non vérifié · échantillon insuffisant";
  if (band === "early") return "Échantillon précoce";
  if (band === "limited") return "Échantillon limité";
  return "Échantillon significatif";
}

export function minutesBeforeKickoff(row: Pick<EvidenceRow, "recordedAt" | "kickoff">): number | null {
  const rec = Date.parse(row.recordedAt);
  const ko = Date.parse(row.kickoff);
  if (!Number.isFinite(rec) || !Number.isFinite(ko)) return null;
  return Math.round((ko - rec) / 60000);
}
