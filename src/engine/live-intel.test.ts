import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { ChampionshipBoard, MatchInput, PredictionRecord, TeamProfile } from "./types.ts";
import { buildMatchIntelligence, buildLiveView, inputSnapshot, seasonOf } from "./live-intel.ts";
import { consensusFromBooks, detectOddsConflicts, fairFromOdds, valueDelta } from "./odds-consensus.ts";
import { detectChanges, snapshotOf } from "./change-detect.ts";
import { __resetVersionsForTest, recordPredictionVersion, versionsFor } from "./prediction-versions.ts";
import { evaluateClosing, calibrationBucket } from "./post-match.ts";
import { tightenFromLearn, qualityScore, inSweetSpot } from "./quality-pick.ts";
import { scoreboardOf, pickDeployable } from "./benchmark.ts";

function team(over: Partial<TeamProfile> & { name: string; id: string }): TeamProfile {
  return {
    short: over.name.slice(0, 3).toUpperCase(),
    league: "LL",
    attack: 1.2,
    defense: 1.1,
    elo: 1700,
    xgFor: 1.3,
    xgAgainst: 1.2,
    possession: 50,
    ppda: 11,
    fieldTilt: 50,
    progressivePasses: 40,
    highTurnovers: 7,
    recoveries: 46,
    compactness: 0.65,
    setPieceXg: 0.2,
    duelWin: 50,
    cardsPerGame: 2,
    flexibility: 0.55,
    pressLine: 0.55,
    buildup: 0.55,
    depth: 0.6,
    formation: "4-3-3",
    color: "#6b7c6e",
    ...over,
  };
}

function point<T>(value: T, source = "test"): { value: T; source: string; timestamp: string; confidence: number; freshnessHours: number } {
  return { value, source, timestamp: "2026-09-14T10:00:00.000Z", confidence: 0.5, freshnessHours: 2 };
}

function match(over: Partial<MatchInput> = {}): MatchInput {
  const home = over.home ?? team({ id: "96", name: "Alavés" });
  const away = over.away ?? team({ id: "94", name: "Valencia" });
  const opening = over.opening ?? {
    book: "Opening",
    home: 2.2,
    draw: 3.2,
    away: 3.4,
    over15: 1.3,
    over25: 1.9,
    over35: 3.2,
    under25: 1.9,
    bttsYes: 1.85,
    bttsNo: 1.95,
  };
  const base: MatchInput = {
    id: "test-alaves-valencia-2026-09-15",
    league: "LL",
    competition: "La Liga",
    kickoff: "2026-09-15T18:00:00.000Z",
    venue: "Mendizorrotza",
    home,
    away,
    restHome: point(6),
    restAway: point(6),
    travelAwayKm: point(400),
    congestionHome: point(0.2),
    congestionAway: point(0.2),
    absencesHome: point([]),
    absencesAway: point([]),
    importance: point(0.6),
    opening,
    current: [
      { ...opening, book: "Unibet", home: 2.15, draw: 3.25, away: 3.5 },
      { ...opening, book: "Betclic", home: 2.2, draw: 3.2, away: 3.4 },
    ],
    notes: [],
    status: "scheduled",
    formHome: "WDLWW",
    formAway: "LDWDL",
    oddsSource: "Unibet",
  };
  return { ...base, ...over, home: over.home ?? home, away: over.away ?? away };
}

function pred(m: MatchInput, over: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    matchId: m.id,
    engineVersion: "test-engine",
    tacticalVersion: "test-tac",
    kickoff: m.kickoff,
    league: m.league,
    competition: m.competition,
    venue: m.venue,
    home: { id: m.home.id, name: m.home.name, short: m.home.short, formation: m.home.formation },
    away: { id: m.away.id, name: m.away.name, short: m.away.short, formation: m.away.formation },
    models: [],
    ensemble: {
      lambdaHome: 1.3,
      lambdaAway: 1.1,
      home: 0.44,
      draw: 0.28,
      away: 0.28,
      over15: 0.75,
      over25: 0.5,
      over35: 0.25,
      under25: 0.5,
      bttsYes: 0.5,
      bttsNo: 0.5,
      matrix: [
        [0.08, 0.07, 0.04],
        [0.09, 0.11, 0.06],
        [0.05, 0.06, 0.04],
      ],
      weights: { poisson: 0.3, dixonColes: 0.3, elo: 0.15, xg: 0.15, glm: 0.05, market: 0.05 },
      disagreement: 0.12,
    },
    calibrated: { home: 0.46, draw: 0.28, away: 0.26, over15: 0.75, over25: 0.5, over35: 0.25, under25: 0.5, bttsYes: 0.5, bttsNo: 0.5, method: "platt", version: "t" },
    intelligence: { modelDisagreement: 0.12, confidenceScore: 0.6, dataQuality: 0.7 },
    coaches: [],
    agentWeights: {
      POSSESSION_STRUCTURAL: 1,
      PRESSING_TRANSITION: 1,
      ADAPTATION_GAME_MANAGEMENT: 1,
      DEFENSIVE_COUNTER: 1,
      COMPETITIVE_DISCIPLINE: 1,
    },
    consensus: {
      home: 0.46,
      draw: 0.28,
      away: 0.26,
      disagreement: 0.1,
      conflictScore: 0.1,
      directionalAgreement: 0.7,
      marketAgreement: 0.6,
      statisticalAgreement: 0.7,
      confidenceWeighted: true,
    },
    devil: { predictionChallengeScore: 0.2, riskFactors: [], alternativeScenario: "", confidenceReduction: 0.05 },
    meta: {
      tacticalAdjustment: { home: 0, draw: 0, away: 0 },
      tacticalReliability: 0.5,
      blended: { home: 0.46, draw: 0.28, away: 0.26 },
    },
    features: [],
    scenarios: [],
    markets: [],
    bookLinks: [],
    dailyBestCandidate: false,
    notes: [],
    availableInformation: [],
    timestamp: "2026-09-14T10:00:00.000Z",
    ...over,
  };
}

describe("live intelligence", () => {
  it("marks missing manager, XI and standings as UNKNOWN", () => {
    const intel = buildMatchIntelligence(match());
    assert.equal(intel.manager.verificationStatus, "UNKNOWN");
    assert.equal(intel.confirmedLineups.verificationStatus, "UNKNOWN");
    assert.equal(intel.standings.verificationStatus, "UNKNOWN");
    assert.equal(intel.manager.value, null);
    assert.ok(intel.uncertainty.some((u) => /entraîneur/i.test(u)));
  });

  it("does not invent injuries when the feed is empty", () => {
    const intel = buildMatchIntelligence(match());
    assert.equal(intel.injuries.value, null);
    assert.equal(intel.injuries.verificationStatus, "UNKNOWN");
  });

  it("labels xG as model estimate, not official goals", () => {
    const intel = buildMatchIntelligence(match());
    assert.match(intel.goalsFor.source, /xG/);
    assert.equal(intel.goalsFor.verificationStatus, "UNVERIFIED");
  });

  it("season follows the kickoff month", () => {
    assert.equal(seasonOf("2026-09-15T18:00:00Z"), "2026-2027");
    assert.equal(seasonOf("2026-03-01T18:00:00Z"), "2025-2026");
  });
});

describe("odds consensus", () => {
  it("devigs listed books and sums to 1", () => {
    const fair = fairFromOdds(2, 3.5, 3.8);
    const s = fair.home + fair.draw + fair.away;
    assert.ok(Math.abs(s - 1) < 1e-9);
  });

  it("records a conflict instead of silently picking a book", () => {
    const books = [
      { book: "A", home: 1.5, draw: 4, away: 6, over15: 1.2, over25: 1.8, over35: 3, under25: 2, bttsYes: 1.8, bttsNo: 2 },
      { book: "B", home: 3.2, draw: 3.3, away: 2.2, over15: 1.2, over25: 1.8, over35: 3, under25: 2, bttsYes: 1.8, bttsNo: 2 },
    ];
    const conflicts = detectOddsConflicts(books);
    assert.ok(conflicts.length >= 1);
    const c = consensusFromBooks(books);
    assert.equal(c.status, "CONFLICT");
    assert.ok(c.fair);
  });

  it("returns UNKNOWN when no odds exist", () => {
    const c = consensusFromBooks([]);
    assert.equal(c.status, "UNKNOWN");
    assert.equal(c.fair, null);
  });

  it("computes value delta as model minus market", () => {
    const d = valueDelta({ home: 0.51, draw: 0.27, away: 0.22 }, { home: 0.46, draw: 0.28, away: 0.26 });
    assert.ok(d);
    assert.ok(Math.abs(d.home - 0.05) < 1e-9);
  });
});

describe("change detection + versions", () => {
  beforeEach(() => __resetVersionsForTest());

  it("does not overwrite v1 when a star is ruled out", () => {
    const m1 = match();
    const p1 = pred(m1, { calibrated: { ...pred(m1).calibrated, home: 0.44, draw: 0.29, away: 0.27 } });
    const v1 = recordPredictionVersion(m1, p1, Date.parse("2026-09-14T10:00:00Z"));
    assert.equal(v1.version, 1);
    const home = v1.homeProbability;

    const m2 = match({
      absencesHome: {
        value: [{ player: "Sivera", role: "star", reason: "injury", importance: 0.9 }],
        source: "feed",
        timestamp: "2026-09-15T16:00:00.000Z",
        confidence: 0.8,
        freshnessHours: 1,
      },
    });
    const p2 = pred(m2, { calibrated: { ...pred(m2).calibrated, home: 0.38, draw: 0.3, away: 0.32 } });
    const v2 = recordPredictionVersion(m2, p2, Date.parse("2026-09-15T16:30:00Z"));
    assert.equal(v2.version, 2);
    const series = versionsFor(m1.id);
    assert.equal(series.length, 2);
    assert.equal(series[0]!.homeProbability, home);
    assert.equal(series[0]!.version, 1);
    assert.match(v2.reasonForChange, /Sivera|indisponible|blessure/i);
  });

  it("freezes versions after kickoff", () => {
    const m = match({ kickoff: "2026-09-15T18:00:00.000Z" });
    recordPredictionVersion(m, pred(m), Date.parse("2026-09-15T10:00:00Z"));
    const later = match({
      kickoff: m.kickoff,
      absencesAway: {
        value: [{ player: "Gaya", role: "starter", reason: "injury", importance: 0.7 }],
        source: "feed",
        timestamp: "2026-09-15T19:00:00.000Z",
        confidence: 0.8,
        freshnessHours: 0,
      },
    });
    const v = recordPredictionVersion(later, pred(later, { calibrated: { ...pred(later).calibrated, away: 0.4, home: 0.35, draw: 0.25 } }), Date.parse("2026-09-15T19:10:00Z"));
    assert.equal(v.version, 1);
    assert.equal(versionsFor(m.id).length, 1);
  });

  it("settles the closing version without rewriting probabilities", () => {
    const m = match({ status: "scheduled" });
    const v1 = recordPredictionVersion(m, pred(m), Date.parse("2026-09-14T12:00:00Z"));
    const done = match({ status: "finished", scoreHome: 1, scoreAway: 1, kickoff: m.kickoff });
    const v = recordPredictionVersion(done, pred(done), Date.parse("2026-09-15T20:00:00Z"));
    assert.equal(v.version, 1);
    assert.equal(v.homeProbability, v1.homeProbability);
    assert.ok(v.evaluation);
    assert.equal(v.evaluation.actualResult, "D");
    assert.equal(v.evaluation.actualScore.home, 1);
  });

  it("detects postponement as CRITICAL", () => {
    const a = match();
    const b = match({ voidReason: "postponed", status: "cancelled" });
    const r = detectChanges(snapshotOf(a), snapshotOf(b));
    assert.equal(r.severity, "CRITICAL");
    assert.equal(r.shouldRecalc, true);
  });

  it("identical snapshots do not create a new version", () => {
    const m = match();
    recordPredictionVersion(m, pred(m), Date.parse("2026-09-14T10:00:00Z"));
    recordPredictionVersion(m, pred(m), Date.parse("2026-09-14T10:05:00Z"));
    assert.equal(versionsFor(m.id).length, 1);
  });
});

describe("Alavés – Valencia uses the generic pipeline", () => {
  beforeEach(() => __resetVersionsForTest());

  it("processes the fixture without a hardcoded match id", () => {
    const m = match({
      id: "ub-alaves|valencia-2026-09-15",
      home: team({ id: "96", name: "Deportivo Alavés" }),
      away: team({ id: "94", name: "Valencia CF" }),
    });
    const intel = buildMatchIntelligence(m);
    assert.equal(intel.homeTeam.name, "Deportivo Alavés");
    assert.equal(intel.competition, "La Liga");
    const view = buildLiveView(m, pred(m));
    if (view.consensus) {
      const s = view.consensus.home + view.consensus.draw + view.consensus.away;
      assert.ok(Math.abs(s - 1) < 0.02);
    }
    const v1 = recordPredictionVersion(m, pred(m), Date.parse("2026-09-14T10:00:00Z"));
    const injured = match({
      id: m.id,
      home: m.home,
      away: m.away,
      absencesHome: {
        value: [{ player: "Guevara", role: "starter", reason: "suspension", importance: 0.7 }],
        source: "feed",
        timestamp: "2026-09-15T12:00:00.000Z",
        confidence: 0.8,
        freshnessHours: 1,
      },
    });
    const v2 = recordPredictionVersion(
      injured,
      pred(injured, { calibrated: { ...pred(injured).calibrated, home: 0.4, draw: 0.3, away: 0.3 } }),
      Date.parse("2026-09-15T12:00:00Z"),
    );
    assert.equal(v1.version, 1);
    assert.equal(v2.version, 2);
    assert.notEqual(v1.predictionId, v2.predictionId);
  });
});

describe("confidence / post-match / quality / benchmark", () => {
  it("scores confidence on 0–10 from measurable parts", () => {
    const view = buildLiveView(match(), pred(match()));
    assert.ok(view.confidence10 >= 0 && view.confidence10 <= 10);
    assert.ok(view.components.dataCompleteness > 0);
  });

  it("keeps probabilities near 100%", () => {
    const p = pred(match()).calibrated;
    assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.02);
  });

  it("evaluates Brier and log loss after the match", () => {
    const ev = evaluateClosing(
      {
        homeProbability: 0.5,
        drawProbability: 0.3,
        awayProbability: 0.2,
        likelyScores: [{ score: "1-1", p: 0.11 }],
        modelVersion: "t",
      },
      1,
      0,
    );
    assert.equal(ev.actualResult, "H");
    assert.ok(ev.brier > 0);
    assert.equal(calibrationBucket(0.5), "40–60 %");
  });

  it("tightens the next pick when hit-rate is under 50%", () => {
    const g = tightenFromLearn({ n: 40, hitRate: 0.41, maxOdds1x2: 4.2, banDrawBet: false, extraMinEv: 0 });
    assert.ok(g.minProb >= 0.34);
    assert.ok(g.maxOdds <= 3.4);
    assert.ok(g.extraMinEv >= 0.02);
  });

  it("prefers the sweet odds band", () => {
    assert.equal(inSweetSpot(2.1), true);
    assert.equal(inSweetSpot(5), false);
    assert.ok(qualityScore(0.5, 2.1) > qualityScore(0.5, 5));
  });

  it("ranks models by Brier, not accuracy", () => {
    const metric = (name: string, brier: number, hit: number): ChampionshipBoard["ensemble"] => ({
      name,
      n: 100,
      brier,
      logLoss: brier,
      accuracy: hit,
      directional: hit,
      clv: 0,
      roi: 0,
      yield: 0,
      ece: 0.05,
      hitRate: hit,
    });
    const board: ChampionshipBoard = {
      models: [metric("poisson", 0.62, 0.55), metric("market", 0.58, 0.48)],
      coaches: [],
      tactical: metric("tactical", 0.6, 0.5),
      ensemble: metric("ensemble", 0.57, 0.51),
      ablation: [
        { name: "BASELINE", brier: 0.61, logLoss: 0.61, ece: 0.05, roi: 0, clv: 0, hitRate: 0.5, n: 100 },
        { name: "TACTICAL", brier: 0.6, logLoss: 0.6, ece: 0.05, roi: 0, clv: 0, hitRate: 0.52, n: 100 },
      ],
      walkForward: [],
      agentLeague: {
        POSSESSION_STRUCTURAL: {},
        PRESSING_TRANSITION: {},
        ADAPTATION_GAME_MANAGEMENT: {},
        DEFENSIVE_COUNTER: {},
        COMPETITIVE_DISCIPLINE: {},
      },
    };
    const s = scoreboardOf(board);
    assert.equal(s.ranked[0]!.name, "ensemble");
    assert.equal(s.primary, "brier");
    assert.match(pickDeployable(board).reason, /Brier/);
    assert.match(s.roiLabel, /pas un gain client/i);
  });

  it("input snapshot is stable for the same match", () => {
    const a = inputSnapshot(match());
    const b = inputSnapshot(match());
    assert.equal(a, b);
  });
});
