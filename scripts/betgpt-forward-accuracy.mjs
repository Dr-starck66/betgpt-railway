/**
 * Frozen forward-only evaluation of BetGPT forecasts.
 * Does NOT train, publish picks, or promote a betting policy.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCOPE = "HONEST_1X2_SIDES_ODDS_1_80_TO_3_00";
const MIN_HOLDOUT = 60;
const TARGET_HIT_RATE = 0.60;

function eligible(row, fromMs, asOfMs) {
  if (!row || typeof row !== "object") return false;
  if (row.result !== "win" && row.result !== "lose") return false;
  if (row.market !== "1X2_H" && row.market !== "1X2_A") return false;
  if (typeof row.home !== "string" || typeof row.away !== "string") return false;
  if (!Number.isFinite(row.odds) || row.odds < 1.8 || row.odds > 3.0) return false;
  if (!Number.isFinite(row.modelProb) || row.modelProb <= 0 || row.modelProb >= 1) return false;
  if (/cl[oô]ture|d[eé]riv[eé]|archive/i.test(String(row.book || ""))) return false;
  const recorded = Date.parse(row.recordedAt);
  const kickoff = Date.parse(row.kickoff);
  return Number.isFinite(recorded) && Number.isFinite(kickoff) &&
    recorded >= fromMs && recorded < kickoff && kickoff < asOfMs;
}

function wilson(wins, n) {
  if (!n) return null;
  const z = 1.959963984540054;
  const p = wins / n;
  const den = 1 + z * z / n;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lower: (p + z * z / (2 * n) - half) / den, upper: (p + z * z / (2 * n) + half) / den };
}

function metrics(rows) {
  const n = rows.length;
  if (!n) return { n: 0, wins: 0, hitRate: null, hitRateWilson95: null, roiFlat: null, brier: null, logLoss: null, marketImpliedBrier: null };
  const wins = rows.filter((r) => r.result === "win").length;
  let payout = 0, brier = 0, logLoss = 0, marketBrier = 0;
  for (const r of rows) {
    const y = r.result === "win" ? 1 : 0;
    if (y) payout += r.odds;
    const p = Math.max(0.000001, Math.min(0.999999, r.modelProb));
    const marketP = 1 / r.odds; // Individual side only; vig is NOT removed.
    brier += (p - y) ** 2;
    marketBrier += (marketP - y) ** 2;
    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return {
    n, wins, hitRate: wins / n, hitRateWilson95: wilson(wins, n),
    roiFlat: (payout - n) / n,
    brier: brier / n,
    logLoss: logLoss / n,
    marketImpliedBrier: marketBrier / n,
  };
}

/** Only forecasts RECORDED after cutoff are judged; no retrospectively chosen fixtures. */
export function evaluateForwardAccuracy(checkpoint, { from, asOf = new Date().toISOString() }) {
  const fromMs = Date.parse(from), asOfMs = Date.parse(asOf);
  if (!Number.isFinite(fromMs) || !Number.isFinite(asOfMs) || fromMs >= asOfMs) throw Error("Invalid forward validation period");
  if (checkpoint?.schema !== "astra-betgpt-runtime-checkpoint/v2" ||
      checkpoint?.refresh?.status !== "PASS" || !Array.isArray(checkpoint.tickets)) {
    throw Error("LIVE_CHECKPOINT_UNVERIFIED: refuse historical or stale evidence");
  }
  const candidates = checkpoint.tickets.filter((r) => eligible(r, fromMs, asOfMs))
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || String(a.id).localeCompare(String(b.id)));
  const unique = new Map();
  for (const row of candidates) {
    const key = [row.home.trim().toLowerCase(), row.away.trim().toLowerCase(), Date.parse(row.kickoff), row.market].join("|");
    if (!unique.has(key)) unique.set(key, row);
  }
  const rows = [...unique.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const overall = metrics(rows);
  const actualBets = metrics(rows.filter((r) => r.kind === "mise" && r.decision === "BET"));
  const status = overall.n < MIN_HOLDOUT
    ? "COLLECTING_FORWARD_MATCHES"
    : overall.hitRate >= TARGET_HIT_RATE && overall.roiFlat > 0
      ? "ABSOLUTE_TARGET_MET_NO_CHAMPION_COMPARISON"
      : "ABSOLUTE_TARGET_NOT_MET";
  return {
    schema: "astra-betgpt-forward-accuracy/v1", generatedAt: asOf,
    from, scope: SCOPE, minHoldoutN: MIN_HOLDOUT, targetHitRate: TARGET_HIT_RATE,
    status, latestSettledKickoff: rows.at(-1)?.kickoff ?? null,
    metrics: overall, actualBets,
    integrity: {
      uniqueFixtureMarkets: rows.length,
      excludedOrDeduplicated: checkpoint.tickets.length - rows.length,
      source: "LIVE_REFRESH_VERIFIED_API_CHECKPOINT",
      outcomeAvailability: "UNVERIFIED_EXACT_SETTLEMENT_TIMESTAMP",
      relativeModelImprovement: "NOT_PROVEN_WITHOUT_FROZEN_PARALLEL_CHAMPION",
      marketBaseline: "SINGLE_SIDE_1_OVER_ODDS_WITHOUT_VIG_REMOVAL_DIAGNOSTIC_ONLY",
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [checkpointPath, from] = process.argv.slice(2);
  if (!checkpointPath || !from) throw Error("usage: node scripts/betgpt-forward-accuracy.mjs <checkpoint.json> <ISO-cutoff>");
  const payload = JSON.parse(readFileSync(resolve(checkpointPath), "utf8"));
  console.log(JSON.stringify(evaluateForwardAccuracy(payload, { from }), null, 2));
}
