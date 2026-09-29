import { clamp } from "./math.ts";
import type { MatchInput, PredictionRecord } from "./types.ts";
import type { OddsConsensus } from "./odds-consensus.ts";

export type ConfidenceBreakdown = {
  score10: number;
  dataCompleteness: number;
  dataFreshness: number;
  sourceAgreement: number;
  modelAgreement: number;
  lineupCertainty: number;
  marketStability: number;
  historicalCalibration: number;
};

function completeness(match: MatchInput): number {
  let n = 0;
  let ok = 0;
  const mark = (yes: boolean) => {
    n += 1;
    if (yes) ok += 1;
  };
  mark(Boolean(match.formHome));
  mark(Boolean(match.formAway));
  mark(Boolean(match.venue && match.venue !== "Stade" && match.venue !== "n/a"));
  mark((match.current ?? []).some((b) => b.home >= 1.05));
  mark(Boolean(match.oddsSource && match.oddsSource !== "modèle"));
  mark(Boolean(match.home.formation));
  mark(match.absencesHome.value.length + match.absencesAway.value.length > 0);
  mark(match.restHome.confidence >= 0.4);
  return n ? ok / n : 0;
}

function freshnessScore(minutes: number | null): number {
  if (minutes == null) return 0.35;
  if (minutes <= 15) return 1;
  if (minutes <= 60) return 0.85;
  if (minutes <= 360) return 0.6;
  if (minutes <= 1440) return 0.35;
  return 0.15;
}

function lineupScore(match: MatchInput): number {
  const abs = (match.absencesHome.value?.length ?? 0) + (match.absencesAway.value?.length ?? 0);
  const form = Boolean(match.home.formation && match.away.formation);
  if (abs > 0 && form) return 0.55;
  if (form) return 0.3;
  return 0.15;
}

function stability(match: MatchInput): number {
  const cur = (match.current ?? []).find((b) => b.home >= 1.05);
  const open = match.opening;
  if (!cur || !open || open.home < 1.05) return 0.45;
  const dh = Math.abs(Math.log(cur.home / open.home));
  return clamp(1 - dh * 2.2, 0.15, 1);
}

export function confidenceBreakdown(input: {
  match: MatchInput;
  prediction: PredictionRecord;
  consensus: OddsConsensus;
  freshnessMinutes: number | null;
}): ConfidenceBreakdown {
  const dataCompleteness = completeness(input.match);
  const dataFreshness = freshnessScore(input.freshnessMinutes);
  const sourceAgreement =
    input.consensus.status === "VERIFIED"
      ? 0.9
      : input.consensus.status === "CONFLICT"
        ? 0.25
        : input.consensus.status === "UNVERIFIED"
          ? 0.55
          : 0.2;
  const modelAgreement = clamp(1 - (input.prediction.intelligence.modelDisagreement ?? 0.3), 0.1, 1);
  const lineupCertainty = lineupScore(input.match);
  const marketStability = stability(input.match);
  const historicalCalibration = clamp(input.prediction.intelligence.dataQuality ?? 0.5, 0.2, 0.85);
  const mixed =
    0.22 * dataCompleteness +
    0.14 * dataFreshness +
    0.16 * sourceAgreement +
    0.18 * modelAgreement +
    0.12 * lineupCertainty +
    0.1 * marketStability +
    0.08 * historicalCalibration;
  return {
    score10: Math.round(clamp(mixed, 0.05, 0.98) * 100) / 10,
    dataCompleteness,
    dataFreshness,
    sourceAgreement,
    modelAgreement,
    lineupCertainty,
    marketStability,
    historicalCalibration,
  };
}
