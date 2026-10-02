import test from "node:test";
import assert from "node:assert/strict";
import type { MatchInput, PredictionRecord } from "./types";
import { buildMatchSpecificBanter, textShingleSimilarity } from "./forum-diversity";

function fakeMatch(id: string, home: string, away: string, homeFormation: string, awayFormation: string, note: string): MatchInput {
  return {
    id,
    league: "SA",
    competition: "Serie A",
    kickoff: "2026-10-18T18:45:00.000Z",
    venue: "Test",
    home: { id: home.toLowerCase(), name: home, short: home.slice(0, 3), league: "SA", attack: 0, defense: 0, elo: 0, xgFor: 0, xgAgainst: 0, possession: 0, ppda: 0, fieldTilt: 0, progressivePasses: 0, highTurnovers: 0, recoveries: 0, compactness: 0, setPieceXg: 0, duelWin: 0, cardsPerGame: 0, flexibility: 0, pressLine: 0, buildup: 0, depth: 0, formation: homeFormation, color: "" },
    away: { id: away.toLowerCase(), name: away, short: away.slice(0, 3), league: "SA", attack: 0, defense: 0, elo: 0, xgFor: 0, xgAgainst: 0, possession: 0, ppda: 0, fieldTilt: 0, progressivePasses: 0, highTurnovers: 0, recoveries: 0, compactness: 0, setPieceXg: 0, duelWin: 0, cardsPerGame: 0, flexibility: 0, pressLine: 0, buildup: 0, depth: 0, formation: awayFormation, color: "" },
    restHome: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    restAway: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    travelAwayKm: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    congestionHome: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    congestionAway: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    absencesHome: { value: [], source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    absencesAway: { value: [], source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    importance: { value: 0, source: "", timestamp: "", confidence: 0, freshnessHours: 0 },
    opening: { book: "", home: 0, draw: 0, away: 0, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0 },
    current: [],
    notes: [note],
  };
}

function fakePrediction(match: MatchInput, reasonA: string, reasonB: string, risk: string, scenario: string): PredictionRecord {
  return {
    matchId: match.id,
    engineVersion: "test",
    tacticalVersion: "test",
    kickoff: match.kickoff,
    league: match.league,
    competition: match.competition,
    venue: match.venue,
    home: match.home,
    away: match.away,
    models: [],
    ensemble: { lambdaHome: 0, lambdaAway: 0, home: 0, draw: 0, away: 0, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0, matrix: [], weights: { poisson: 0, dixonColes: 0, elo: 0, xg: 0, glm: 0, market: 0 }, disagreement: 0 },
    calibrated: { home: 0.51, draw: 0.27, away: 0.22, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0, method: "none", version: "test" },
    intelligence: { modelDisagreement: 0, confidenceScore: 0, dataQuality: 0 },
    coaches: [{
      agent: "POSSESSION_STRUCTURAL",
      matchId: match.id,
      analysisTimestamp: match.kickoff,
      signals: {},
      marketImplications: { home: 0, draw: 0, away: 0 },
      confidence: 0.6,
      keyReasons: [reasonA, reasonB],
      contradictions: ["contre-argument " + risk],
      missingInformation: [],
      dataQuality: 0.7,
      weight: 1,
    }],
    agentWeights: { POSSESSION_STRUCTURAL: 1, PRESSING_TRANSITION: 0, ADAPTATION_GAME_MANAGEMENT: 0, DEFENSIVE_COUNTER: 0, COMPETITIVE_DISCIPLINE: 0 },
    consensus: { home: 0.51, draw: 0.27, away: 0.22, disagreement: 0.1, conflictScore: 0.2, directionalAgreement: 0.68, marketAgreement: 0.6, statisticalAgreement: 0.6, confidenceWeighted: true },
    devil: { predictionChallengeScore: 0.4, riskFactors: [risk, "second risque " + match.away.name], alternativeScenario: "alternative " + scenario, confidenceReduction: 0.1 },
    meta: { tacticalAdjustment: { home: 0, draw: 0, away: 0 }, tacticalReliability: 0.5, blended: { home: 0.51, draw: 0.27, away: 0.22 } },
    features: [],
    scenarios: [{ id: "early_goal", label: scenario, description: "description " + scenario, home: 0.4, draw: 0.3, away: 0.3, over25: 0.5, bttsYes: 0.5 }],
    markets: [],
    bookLinks: [],
    dailyBestCandidate: false,
    notes: [],
    availableInformation: [],
    timestamp: match.kickoff,
  };
}

test("match forum generator is match-specific rather than a shared copy block", () => {
  const aMatch = fakeMatch("milan-atalanta", "AC Milan", "Atalanta", "4-3-3", "3-4-2-1", "Milan construit plus bas");
  const bMatch = fakeMatch("union-frankfurt", "Union Berlin", "Eintracht Frankfurt", "3-5-2", "4-2-3-1", "Union cherche les seconds ballons");
  const a = buildMatchSpecificBanter(aMatch, fakePrediction(aMatch, "largeur milanaise", "sortie sous pression", "espace derrière les latéraux", "but précoce milanais"), { label: "AC Milan", bestOdds: 2.05, bestBook: "Book A", edge: 0.06, decision: "BET" }, "AC Milan");
  const b = buildMatchSpecificBanter(bMatch, fakePrediction(bMatch, "jeu direct berlinois", "duels axiaux", "transitions de Francfort", "Union mené au score"), { label: "Eintracht Frankfurt", bestOdds: 2.45, bestBook: "Book B", edge: 0.03, decision: "WATCH" }, "Eintracht Frankfurt");

  assert.equal(a.length, 18);
  assert.equal(b.length, 18);
  assert.ok(a.filter((p) => /AC Milan|Atalanta/.test(p.body)).length >= 12);
  assert.ok(b.filter((p) => /Union Berlin|Eintracht Frankfurt/.test(p.body)).length >= 12);

  const aText = a.map((p) => p.body).join(" ");
  const bText = b.map((p) => p.body).join(" ");
  const similarity = textShingleSimilarity(aText, bText, 4);
  assert.ok(similarity < 0.45, "cross-match 4-gram similarity too high: " + similarity.toFixed(3));
  assert.ok(textShingleSimilarity(aText, aText, 4) > 0.99, "similarity gate must detect deliberate copy-paste");
});
