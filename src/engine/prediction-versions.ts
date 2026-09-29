import { sha256Hex } from "./sha256.ts";
import { readPersist, writePersist } from "../lib/persist.ts";
import { kickoffPassed } from "./verify-core.ts";
import { detectChanges, reasonFrom, snapshotOf, type ChangeReport, type MatchSnapshot } from "./change-detect.ts";
import { inputSnapshot } from "./live-intel.ts";
import { obsInc } from "./obs.ts";
import type { MatchInput, PredictionRecord } from "./types.ts";
import { evaluateClosing } from "./post-match.ts";
import type { PredictionVersion } from "./intel-types.ts";

export type { PredictionVersion } from "./intel-types.ts";

export type VersionSeries = {
  matchId: string;
  input: MatchSnapshot;
  versions: PredictionVersion[];
};

const FILE = "prediction-versions.json";
const TEST = Boolean(process.env.NODE_TEST_CONTEXT);
const MAX_MATCHES = 400;
const MAX_VERSIONS = 12;

let MEM: Record<string, VersionSeries> | null = null;

export function __resetVersionsForTest(): void {
  MEM = {};
}

export function bustVersions(): void {
  MEM = null;
}

function loadAll(): Record<string, VersionSeries> {
  if (MEM) return MEM;
  if (TEST) {
    MEM = {};
    return MEM;
  }
  try {
    const raw = readPersist(FILE);
    if (!raw) {
      MEM = {};
      return MEM;
    }
    const parsed = JSON.parse(raw) as Record<string, VersionSeries>;
    MEM = {};
    if (parsed && typeof parsed === "object") {
      for (const [k, s] of Object.entries(parsed)) {
        if (s?.versions && Array.isArray(s.versions) && s.input && Array.isArray(s.input.current)) {
          MEM[k] = s;
        }
      }
    }
    return MEM;
  } catch {
    MEM = {};
    return MEM;
  }
}

function saveAll(rows: Record<string, VersionSeries>): void {
  MEM = rows;
  if (TEST) return;
  try {
    const keys = Object.keys(rows);
    if (keys.length > MAX_MATCHES) {
      const keep = keys.slice(-MAX_MATCHES);
      const next: Record<string, VersionSeries> = {};
      for (const k of keep) next[k] = rows[k]!;
      MEM = next;
    }
    writePersist(FILE, JSON.stringify(MEM));
    void import("../lib/store.ts")
      .then((m) => m.kvSet("prediction-versions", MEM))
      .catch(() => undefined);
  } catch {
    /* best-effort */
  }
}

let versionsHydrated = false;

export async function hydrateVersions(): Promise<void> {
  if (TEST || versionsHydrated) return;
  versionsHydrated = true;
  try {
    const { kvGet } = await import("../lib/store.ts");
    const remote = await kvGet<Record<string, VersionSeries>>("prediction-versions");
    if (!remote || typeof remote !== "object") return;
    const local = loadAll();
    for (const [k, s] of Object.entries(remote)) {
      if (!s?.versions || !Array.isArray(s.versions) || !s.input) continue;
      const prev = local[k];
      if (!prev || (s.versions.length > (prev.versions?.length ?? 0))) local[k] = s;
    }
    MEM = local;
  } catch {
    /* preview / missing table */
  }
}

function probsMoved(a: PredictionVersion, p: PredictionRecord): boolean {
  return (
    Math.abs(a.homeProbability - p.calibrated.home) >= 0.02 ||
    Math.abs(a.drawProbability - p.calibrated.draw) >= 0.02 ||
    Math.abs(a.awayProbability - p.calibrated.away) >= 0.02
  );
}

function sumOk(p: PredictionRecord): boolean {
  const s = p.calibrated.home + p.calibrated.draw + p.calibrated.away;
  return Math.abs(s - 1) < 0.03;
}

function pack(
  match: MatchInput,
  prediction: PredictionRecord,
  version: number,
  reason: string,
  severity: ChangeReport["severity"] | undefined,
  hash: string,
  nowIso: string,
): PredictionVersion {
  const matrix = prediction.ensemble.matrix ?? [];
  const cells: { score: string; p: number }[] = [];
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    const row = matrix[i] ?? [];
    for (let j = 0; j < Math.min(5, row.length); j++) cells.push({ score: `${i}-${j}`, p: row[j] ?? 0 });
  }
  cells.sort((a, b) => b.p - a.p);
  return {
    predictionId: `${match.id}:v${version}`,
    matchId: match.id,
    version,
    timestamp: nowIso,
    modelVersion: prediction.engineVersion,
    homeProbability: prediction.calibrated.home,
    drawProbability: prediction.calibrated.draw,
    awayProbability: prediction.calibrated.away,
    expectedGoals: { home: prediction.ensemble.lambdaHome, away: prediction.ensemble.lambdaAway },
    likelyScores: cells.filter((c) => c.p > 0).slice(0, 3),
    confidence: prediction.live?.confidence10 ?? Math.round((prediction.intelligence.confidenceScore ?? 0.5) * 10),
    reasonForChange: reason,
    inputHash: hash,
    changeSeverity: severity,
  };
}

/**
 * Append a version only when the input actually changed.
 * Never overwrites an existing version. Frozen after kickoff except settlement.
 */
export function recordPredictionVersion(
  match: MatchInput,
  prediction: PredictionRecord,
  now = Date.now(),
): PredictionVersion {
  obsInc("intel.predict", match.id);
  const all = loadAll();
  const series = all[match.id];
  const hash = sha256Hex(inputSnapshot(match));
  const nowIso = new Date(now).toISOString();
  if (!sumOk(prediction)) obsInc("intel.prob_sum", match.id);

  if (!series) {
    const v = pack(match, prediction, 1, "Première publication", undefined, hash, nowIso);
    all[match.id] = { matchId: match.id, input: snapshotOf(match), versions: [v] };
    saveAll(all);
    obsInc("intel.version", `${match.id}:1`);
    return v;
  }

  const last = series.versions[series.versions.length - 1]!;
  const started = kickoffPassed(match.kickoff, now) || match.status === "live" || match.status === "finished";

  if (match.status === "finished" && match.scoreHome != null && match.scoreAway != null) {
    if (!last.evaluation) {
      last.evaluation = evaluateClosing(last, match.scoreHome, match.scoreAway);
      obsInc("intel.eval", match.id);
      saveAll(all);
    }
    return last;
  }

  if (started) return last;

  const change = detectChanges(series.input, snapshotOf(match));
  const material = last.inputHash !== hash && (change.shouldRecalc || change.severity !== "LOW" || probsMoved(last, prediction));
  if (!material) {
    series.input = snapshotOf(match);
    return last;
  }
  if (series.versions.length >= MAX_VERSIONS) return last;

  const v = pack(
    match,
    prediction,
    last.version + 1,
    reasonFrom(change),
    change.severity,
    hash,
    nowIso,
  );
  series.versions.push(v);
  series.input = snapshotOf(match);
  saveAll(all);
  obsInc("intel.change", `${match.id}:${change.severity}`);
  obsInc("intel.version", `${match.id}:${v.version}`);
  return v;
}

export function versionsFor(matchId: string): PredictionVersion[] {
  return loadAll()[matchId]?.versions ?? [];
}

export function latestVersion(matchId: string): PredictionVersion | undefined {
  const rows = versionsFor(matchId);
  return rows[rows.length - 1];
}

export function versionCount(): number {
  return Object.values(loadAll()).reduce((n, s) => n + s.versions.length, 0);
}
