import { sha256Hex } from "./sha256.ts";
import { readPersist, writePersist } from "../lib/persist.ts";
import {
  canonicalPayload,
  kickoffPassed,
  publishedBeforeKickoff,
  type EvidenceRow,
} from "./verify-core.ts";

export type {
  EvidenceRow,
  Lifecycle,
  SampleBand,
  VerifyStatus,
} from "./verify-core.ts";
export {
  canMutatePrediction,
  canonicalPayload,
  isImmutable,
  kickoffPassed,
  lifecycle,
  lifecycleLabel,
  minutesBeforeKickoff,
  publishedBeforeKickoff,
  sampleBand,
  sampleLabel,
  verifyLabel,
  verifyStatus,
} from "./verify-core.ts";

export type LedgerEvent = {
  id: string;
  predictionId: string;
  at: string;
  type:
    | "prediction_created"
    | "prediction_published"
    | "prediction_updated"
    | "prediction_locked"
    | "prediction_settled"
    | "match_started"
    | "match_finished";
  meta?: Record<string, string | number | boolean | null>;
};

const EVENTS_FILE = "prediction-events.json";
const MAX_EVENTS = 2500;
const TEST = Boolean(process.env.NODE_TEST_CONTEXT);
let MEM_EVENTS: LedgerEvent[] | null = null;

export function hashPrediction(row: EvidenceRow): string {
  return sha256Hex(canonicalPayload(row));
}

export function hashIntegrity(row: EvidenceRow): "ok" | "mismatch" | "unavailable" {
  if (!row.predictionHash) return "unavailable";
  return hashPrediction(row) === row.predictionHash ? "ok" : "mismatch";
}

export function stampLock<T extends EvidenceRow>(row: T, now = Date.now()): T {
  if (!kickoffPassed(row.kickoff, now)) return row;
  if (!publishedBeforeKickoff(row)) {
    if (row.predictionHash) delete row.predictionHash;
    if (!row.lockedAt) row.lockedAt = new Date(now).toISOString();
    return row;
  }
  if (row.lockedAt && row.predictionHash) return row;
  if (!row.lockedAt) row.lockedAt = new Date(now).toISOString();
  if (row.engineVersion && !row.predictionHash) {
    row.predictionHash = hashPrediction(row);
  }
  appendEvent({
    type: "prediction_locked",
    predictionId: row.id,
    at: row.lockedAt,
    meta: { hash: row.predictionHash ?? null, engineVersion: row.engineVersion ?? null },
  });
  return row;
}

export function loadEvents(): LedgerEvent[] {
  if (MEM_EVENTS) return MEM_EVENTS;
  if (TEST) {
    MEM_EVENTS = [];
    return MEM_EVENTS;
  }
  try {
    const raw = readPersist(EVENTS_FILE);
    if (!raw) {
      MEM_EVENTS = [];
      return MEM_EVENTS;
    }
    const parsed = JSON.parse(raw) as LedgerEvent[];
    MEM_EVENTS = Array.isArray(parsed) ? parsed : [];
    return MEM_EVENTS;
  } catch {
    MEM_EVENTS = [];
    return MEM_EVENTS;
  }
}

export function appendEvent(partial: Omit<LedgerEvent, "id"> & { id?: string }): void {
  const ev: LedgerEvent = {
    id: partial.id ?? `${partial.predictionId}:${partial.type}:${partial.at}`,
    predictionId: partial.predictionId,
    at: partial.at,
    type: partial.type,
    meta: partial.meta,
  };
  const rows = loadEvents();
  if (rows.some((e) => e.id === ev.id)) return;
  rows.push(ev);
  MEM_EVENTS = rows.slice(-MAX_EVENTS);
  if (TEST) return;
  try {
    writePersist(EVENTS_FILE, JSON.stringify(MEM_EVENTS));
  } catch {
    /* persist is best-effort */
  }
}

export function eventsFor(predictionId: string): LedgerEvent[] {
  return loadEvents().filter((e) => e.predictionId === predictionId);
}
