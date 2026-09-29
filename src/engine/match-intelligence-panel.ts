import { clamp } from "./math.ts";
import type { MatchInput, PredictionRecord, ScenarioResult } from "./types.ts";

export type ConfidenceBand = "Faible" | "Modérée" | "Élevée";

export type IntelligenceMetric = {
  key: "data" | "freshness" | "sources" | "models" | "lineups" | "market" | "calibration";
  label: string;
  value: number;
};

export type IntelligenceScenario = ScenarioResult & {
  dominant: "1" | "N" | "2";
  dominantProbability: number;
};

export type MatchIntelligencePanel = {
  confidence10: number;
  confidenceBand: ConfidenceBand;
  metrics: IntelligenceMetric[];
  expectedGoals: { home: number; away: number };
  likelyScores: { score: string; p: number }[];
  unknown: string[];
  evidence: string[];
  scenarios: IntelligenceScenario[];
  probabilitySum: number;
  calibrated: { home: number; draw: number; away: number; over25: number; bttsYes: number };
};

function band(score10: number): ConfidenceBand {
  if (score10 >= 7.5) return "Élevée";
  if (score10 >= 5) return "Modérée";
  return "Faible";
}

function safe01(value: number | null | undefined, fallback: number): number {
  return clamp(Number.isFinite(value) ? (value as number) : fallback, 0, 1);
}

function uniqueClean(values: Array<string | null | undefined>, max = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function scenarioView(s: ScenarioResult): IntelligenceScenario {
  const rows = [
    { side: "1" as const, p: s.home },
    { side: "N" as const, p: s.draw },
    { side: "2" as const, p: s.away },
  ].sort((a, b) => b.p - a.p);
  return { ...s, dominant: rows[0]!.side, dominantProbability: rows[0]!.p };
}

/**
 * Presentation-only view model for the public Match Intelligence panel.
 * It never invents observed xG, scenario likelihoods or source coverage.
 * Expected goals here are model outputs; scenario values are conditional 1N2 views.
 */
export function buildMatchIntelligencePanel(
  match: MatchInput,
  prediction: PredictionRecord,
): MatchIntelligencePanel {
  const live = prediction.live;
  const c = live?.components;
  const rawConfidence = live?.confidence10 ?? (prediction.intelligence.confidenceScore ?? 0.5) * 10;
  const confidence10 = Math.round(clamp(rawConfidence, 0, 10) * 10) / 10;

  const metrics: IntelligenceMetric[] = [
    { key: "data", label: "Données disponibles", value: safe01(c?.dataCompleteness, prediction.intelligence.dataQuality ?? 0.5) },
    { key: "freshness", label: "Fraîcheur", value: safe01(c?.dataFreshness, 0.35) },
    { key: "sources", label: "Accord des sources", value: safe01(c?.sourceAgreement, 0.5) },
    { key: "models", label: "Accord des modèles", value: safe01(c?.modelAgreement, 1 - (prediction.intelligence.modelDisagreement ?? 0.3)) },
    { key: "lineups", label: "Certitude compositions", value: safe01(c?.lineupCertainty, match.home.formation && match.away.formation ? 0.3 : 0.15) },
    { key: "market", label: "Stabilité du marché", value: safe01(c?.marketStability, 0.45) },
    { key: "calibration", label: "Calibration historique", value: safe01(c?.historicalCalibration, prediction.intelligence.dataQuality ?? 0.5) },
  ];

  const evidenceFromFeatures = (prediction.features ?? []).map((f) => `${f.key} — ${f.source}`);
  const evidence = uniqueClean([...(prediction.availableInformation ?? []), ...evidenceFromFeatures], 10);
  const unknown = uniqueClean([...(live?.unknown ?? []), ...(live?.uncertainty ?? [])], 8);
  const scenarios = (prediction.scenarios ?? []).map(scenarioView).slice(0, 6);

  const home = safe01(prediction.calibrated.home, 0);
  const draw = safe01(prediction.calibrated.draw, 0);
  const away = safe01(prediction.calibrated.away, 0);

  return {
    confidence10,
    confidenceBand: band(confidence10),
    metrics,
    expectedGoals: {
      home: live?.expectedGoals.home ?? prediction.ensemble.lambdaHome,
      away: live?.expectedGoals.away ?? prediction.ensemble.lambdaAway,
    },
    likelyScores: live?.likelyScores ?? [],
    unknown,
    evidence,
    scenarios,
    probabilitySum: home + draw + away,
    calibrated: {
      home,
      draw,
      away,
      over25: safe01(prediction.calibrated.over25, 0),
      bttsYes: safe01(prediction.calibrated.bttsYes, 0),
    },
  };
}
