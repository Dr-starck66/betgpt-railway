import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMatchIntelligencePanel } from "./match-intelligence-panel.ts";
import type { MatchInput, PredictionRecord } from "./types.ts";

function fixture() {
  const match = {
    id: "m1",
    kickoff: "2026-09-27T18:00:00Z",
    league: "L1",
    competition: "Ligue 1",
    venue: "Stade test",
    status: "scheduled",
    home: { id: "h", name: "Home", short: "HOM", formation: "4-3-3" },
    away: { id: "a", name: "Away", short: "AWY", formation: "4-2-3-1" },
    current: [],
    absencesHome: { value: [], source: "test", timestamp: "2026-09-27T10:00:00Z", confidence: 0.5 },
    absencesAway: { value: [], source: "test", timestamp: "2026-09-27T10:00:00Z", confidence: 0.5 },
    restHome: { value: 5, source: "test", timestamp: "2026-09-27T10:00:00Z", confidence: 0.5 },
    restAway: { value: 5, source: "test", timestamp: "2026-09-27T10:00:00Z", confidence: 0.5 },
  } as unknown as MatchInput;

  const prediction = {
    matchId: "m1",
    engineVersion: "test",
    tacticalVersion: "test",
    kickoff: match.kickoff,
    league: "L1",
    competition: "Ligue 1",
    venue: match.venue,
    home: match.home,
    away: match.away,
    calibrated: {
      home: 0.51,
      draw: 0.27,
      away: 0.22,
      over15: 0.72,
      over25: 0.54,
      over35: 0.31,
      under25: 0.46,
      bttsYes: 0.57,
      bttsNo: 0.43,
      method: "platt",
      version: "v-test",
    },
    ensemble: { lambdaHome: 1.62, lambdaAway: 1.04, matrix: [] },
    intelligence: { modelDisagreement: 0.11, confidenceScore: 0.74, dataQuality: 0.7 },
    features: [{ key: "forme", value: 0.2, source: "ESPN", timestamp: "2026-09-27T10:00:00Z", confidence: 0.8, freshnessHours: 2, version: "1" }],
    availableInformation: ["Forme récente", "Cotes marché"],
    scenarios: [{ id: "favorite_scores_first", label: "Favori marque d'abord", description: "Lecture conditionnelle", home: 0.66, draw: 0.2, away: 0.14, over25: 0.62, bttsYes: 0.48 }],
    live: {
      confidence10: 7.8,
      freshnessMinutes: 20,
      freshnessLabel: "20 min",
      valueDelta: null,
      consensus: null,
      consensusStatus: "UNKNOWN",
      oddsConflicts: [],
      uncertainty: ["Composition officielle non observée"],
      unknown: ["Composition officielle non observée"],
      likelyScores: [{ score: "1-0", p: 0.16 }],
      expectedGoals: { home: 1.62, away: 1.04 },
      components: {
        score10: 7.8,
        dataCompleteness: 0.81,
        dataFreshness: 0.85,
        sourceAgreement: 0.74,
        modelAgreement: 0.89,
        lineupCertainty: 0.3,
        marketStability: 0.7,
        historicalCalibration: 0.66,
      },
    },
  } as unknown as PredictionRecord;
  return { match, prediction };
}

describe("match intelligence panel", () => {
  it("uses audited confidence components and calibrated probabilities", () => {
    const { match, prediction } = fixture();
    const view = buildMatchIntelligencePanel(match, prediction);
    assert.equal(view.confidence10, 7.8);
    assert.equal(view.confidenceBand, "Élevée");
    assert.equal(view.metrics.find((m) => m.key === "data")?.value, 0.81);
    assert.ok(Math.abs(view.probabilitySum - 1) < 1e-9);
  });

  it("does not turn a conditional scenario into a scenario probability", () => {
    const { match, prediction } = fixture();
    const view = buildMatchIntelligencePanel(match, prediction);
    assert.equal(view.scenarios[0]?.dominant, "1");
    assert.equal(view.scenarios[0]?.dominantProbability, 0.66);
  });

  it("deduplicates unknowns and evidence", () => {
    const { match, prediction } = fixture();
    prediction.live!.uncertainty.push("Composition officielle non observée");
    prediction.availableInformation.push("Forme récente");
    const view = buildMatchIntelligencePanel(match, prediction);
    assert.equal(view.unknown.length, 1);
    assert.equal(view.evidence.filter((x) => x === "Forme récente").length, 1);
  });
});
