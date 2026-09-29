import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MatchInput, PredictionRecord, TeamProfile } from "./types.ts";
import { compileArticle, jaccard, hasBannedFiller, hasMainJargon, articlePlainText } from "./article.ts";

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

function point<T>(value: T) {
  return { value, source: "test", timestamp: "2026-09-14T10:00:00.000Z", confidence: 0.5, freshnessHours: 2 };
}

function match(over: Partial<MatchInput> = {}): MatchInput {
  const home = over.home ?? team({ id: "96", name: "Alavés", xgFor: 1.47, xgAgainst: 1.05, possession: 54 });
  const away = over.away ?? team({ id: "94", name: "Valencia", xgFor: 0.91, xgAgainst: 1.82, possession: 46 });
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
    formHome: "WWDWL",
    formAway: "LLDLD",
    oddsSource: "Unibet",
  };
  return { ...base, ...over, home: over.home ?? home, away: over.away ?? away };
}

function pred(m: MatchInput, over: Partial<PredictionRecord> = {}): PredictionRecord {
  const cal = over.calibrated;
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
      lambdaHome: 1.47,
      lambdaAway: 0.91,
      home: 0.51,
      draw: 0.28,
      away: 0.21,
      over15: 0.7,
      over25: 0.42,
      over35: 0.18,
      under25: 0.58,
      bttsYes: 0.44,
      bttsNo: 0.56,
      matrix: [
        [0.1, 0.08, 0.04],
        [0.14, 0.12, 0.05],
        [0.1, 0.07, 0.04],
      ],
      weights: { poisson: 0.3, dixonColes: 0.3, elo: 0.15, xg: 0.15, glm: 0.05, market: 0.05 },
      disagreement: 0.12,
    },
    calibrated: cal ?? {
      home: 0.51,
      draw: 0.28,
      away: 0.21,
      over15: 0.7,
      over25: 0.42,
      over35: 0.18,
      under25: 0.58,
      bttsYes: 0.44,
      bttsNo: 0.56,
      method: "platt",
      version: "t",
    },
    intelligence: { modelDisagreement: 0.12, confidenceScore: 0.72, dataQuality: 0.7 },
    coaches: [],
    agentWeights: {
      POSSESSION_STRUCTURAL: 1,
      PRESSING_TRANSITION: 1,
      ADAPTATION_GAME_MANAGEMENT: 1,
      DEFENSIVE_COUNTER: 1,
      COMPETITIVE_DISCIPLINE: 1,
    },
    consensus: {
      home: 0.51,
      draw: 0.28,
      away: 0.21,
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
      blended: { home: 0.51, draw: 0.28, away: 0.21 },
    },
    features: [],
    scenarios: [],
    markets: [],
    bookLinks: [],
    dailyBestCandidate: false,
    notes: [],
    availableInformation: ["forme récente listée"],
    timestamp: "2026-09-15T14:42:00.000Z",
    live: {
      confidence10: 7.2,
      freshnessMinutes: 12,
      freshnessLabel: "12 min",
      valueDelta: { home: 0.05, draw: -0.02, away: -0.03 },
      consensus: { home: 0.46, draw: 0.28, away: 0.26 },
      consensusStatus: "VERIFIED",
      oddsConflicts: [],
      uncertainty: ["entraîneur inconnu"],
      unknown: ["XI"],
      likelyScores: [
        { score: "1-0", p: 0.14 },
        { score: "1-1", p: 0.12 },
        { score: "2-0", p: 0.1 },
      ],
      expectedGoals: { home: 1.47, away: 0.91 },
    },
    ...over,
  };
}

function body(a: ReturnType<typeof compileArticle>): string {
  return articlePlainText(a);
}

describe("human-first match article", () => {
  it("does not invent a defeat in an unbeaten sequence", () => {
    const m = match({ formHome: "WWWWW" });
    const text = body(compileArticle(m, pred(m)));
    assert.match(text, /5 victoires, 0 nul et 0 défaite/);
    assert.doesNotMatch(text, /Une seule défaite/);
  });
  it("team punctuation cannot break the article quality check", () => {
    const m = match({ home: team({ id: "special", name: "Club [A" }) });
    assert.doesNotThrow(() => compileArticle(m, pred(m)));
  });
  it("Alavés–Valencia: slight favorite, explains 51 %, no jargon, no invented injury", () => {
    const m = match();
    const a = compileArticle(m, pred(m));
    const t = body(a);
    assert.match(a.h1, /Alavés – Valencia : heure, chaîne, compositions, statistiques et pronostic/);
    assert.match(a.title, /heure, chaîne, compositions, statistiques et pronostic/);
    assert.doesNotMatch(a.title, /en direct/);
    assert.match(a.verdictLabel, /légèrement favori/i);
    assert.match(a.lead, /51 %/);
    assert.match(a.lead, /28 %/);
    assert.match(a.lead, /21 %/);
    assert.match(t, /pas au point|pas une certitude|parmi trois/i);
    assert.equal(a.likelyScore, "1-0");
    assert.match(t, /14 %/);
    assert.equal(hasMainJargon(t), false);
    assert.equal(hasBannedFiller(t), false);
    assert.doesNotMatch(t, /Diakhaby|PPDA|field tilt|coefficient/i);
    assert.match(t, /Aucun forfait n’est listé|n’invente pas de feuille/i);
    assert.ok(a.quality.min >= 8, `quality ${JSON.stringify(a.quality)}`);
  });

  it("clear home favorite does not use the slight-favorite phrasing", () => {
    const m = match({
      id: "psg-nantes",
      home: team({ id: "160", name: "Paris Saint-Germain", xgFor: 2.2, possession: 64 }),
      away: team({ id: "165", name: "Nantes", xgFor: 0.8, possession: 36 }),
      formHome: "WWWWW",
      formAway: "LLLLD",
    });
    const a = compileArticle(
      m,
      pred(m, {
        calibrated: {
          home: 0.72,
          draw: 0.18,
          away: 0.1,
          over15: 0.82,
          over25: 0.64,
          over35: 0.35,
          under25: 0.36,
          bttsYes: 0.48,
          bttsNo: 0.52,
          method: "platt",
          version: "t",
        },
        live: {
          ...pred(m).live!,
          likelyScores: [
            { score: "2-0", p: 0.13 },
            { score: "3-0", p: 0.1 },
            { score: "2-1", p: 0.09 },
          ],
        },
      }),
    );
    assert.match(a.verdictLabel, /favori assez net/);
    assert.match(a.lead, /72 %/);
    assert.doesNotMatch(a.lead, /légèrement favori/);
    assert.match(body(a), /écart avec les deux autres scénarios est important/);
  });

  it("balanced match refuses a fake favorite", () => {
    const m = match({
      id: "brighton-palace",
      home: team({ id: "331", name: "Brighton", xgFor: 1.3, possession: 51 }),
      away: team({ id: "384", name: "Crystal Palace", xgFor: 1.25, possession: 49 }),
      formHome: "WDWLD",
      formAway: "DWLWD",
    });
    const a = compileArticle(
      m,
      pred(m, {
        calibrated: {
          home: 0.35,
          draw: 0.32,
          away: 0.33,
          over15: 0.7,
          over25: 0.5,
          over35: 0.24,
          under25: 0.5,
          bttsYes: 0.55,
          bttsNo: 0.45,
          method: "platt",
          version: "t",
        },
      }),
    );
    assert.match(a.verdictLabel, /Aucun favori net/);
    assert.match(a.lead, /pratiquement aucun favori|trois issues sont proches/);
    assert.doesNotMatch(a.lead, /favori assez net|victoire acquise/);
  });

  it("away favorite names the visitors, not the home side", () => {
    const m = match({
      id: "cadiz-real",
      home: team({ id: "264", name: "Cádiz", xgFor: 0.9, possession: 38 }),
      away: team({ id: "86", name: "Real Madrid", xgFor: 2.1, possession: 62 }),
      formHome: "LLDLW",
      formAway: "WWWDW",
    });
    const a = compileArticle(
      m,
      pred(m, {
        calibrated: {
          home: 0.14,
          draw: 0.2,
          away: 0.66,
          over15: 0.8,
          over25: 0.6,
          over35: 0.32,
          under25: 0.4,
          bttsYes: 0.5,
          bttsNo: 0.5,
          method: "platt",
          version: "t",
        },
      }),
    );
    assert.match(a.verdictLabel, /Real Madrid/);
    assert.doesNotMatch(a.verdictLabel, /Cádiz, favori|Cádiz légèrement/);
    assert.match(a.lead, /66 %/);
  });

  it("high-scoring vs low-scoring articles are not the same story", () => {
    const high = match({
      id: "bayern-frankfurt",
      home: team({ id: "132", name: "Bayern Munich", xgFor: 2.4, possession: 63 }),
      away: team({ id: "122", name: "Eintracht Francfort", xgFor: 1.8, possession: 48 }),
      formHome: "WWWWW",
      formAway: "WWLWW",
    });
    const low = match({
      id: "getafe-leganes",
      home: team({ id: "2922", name: "Getafe", xgFor: 0.9, xgAgainst: 0.95, possession: 44 }),
      away: team({ id: "537", name: "Leganés", xgFor: 0.85, xgAgainst: 1.0, possession: 43 }),
      formHome: "DDWDL",
      formAway: "DLDWD",
    });
    const aHigh = compileArticle(
      high,
      pred(high, {
        calibrated: {
          home: 0.58,
          draw: 0.22,
          away: 0.2,
          over15: 0.88,
          over25: 0.68,
          over35: 0.42,
          under25: 0.32,
          bttsYes: 0.62,
          bttsNo: 0.38,
          method: "platt",
          version: "t",
        },
        live: {
          ...pred(high).live!,
          likelyScores: [
            { score: "2-1", p: 0.11 },
            { score: "3-1", p: 0.09 },
            { score: "2-0", p: 0.08 },
          ],
          expectedGoals: { home: 2.2, away: 1.3 },
        },
      }),
    );
    const aLow = compileArticle(
      low,
      pred(low, {
        calibrated: {
          home: 0.38,
          draw: 0.34,
          away: 0.28,
          over15: 0.55,
          over25: 0.32,
          over35: 0.12,
          under25: 0.68,
          bttsYes: 0.36,
          bttsNo: 0.64,
          method: "platt",
          version: "t",
        },
        live: {
          ...pred(low).live!,
          likelyScores: [
            { score: "1-0", p: 0.16 },
            { score: "0-0", p: 0.14 },
            { score: "1-1", p: 0.12 },
          ],
          expectedGoals: { home: 1.05, away: 0.9 },
        },
      }),
    );
    assert.match(body(aHigh), /s’ouvrir|score peut bouger|plus ouvert/i);
    assert.match(body(aLow), /fermé|nul longtemps|0-0/i);
    const sim = jaccard(aHigh.fingerprint, aLow.fingerprint);
    assert.ok(sim < 0.45, `similarity too high: ${sim}`);
  });

  it("confirmed absence is named; empty feed does not invent one", () => {
    const named = match({
      absencesAway: point([
        { player: "Mouctar Diakhaby", role: "starter", reason: "injury", importance: 0.8 },
      ]),
    });
    const withAbs = compileArticle(named, pred(named));
    assert.match(body(withAbs), /Mouctar Diakhaby/);
    const empty = compileArticle(match(), pred(match()));
    assert.doesNotMatch(body(empty), /Diakhaby/);
  });

  it("SEO title and meta are unique and not stuffed", () => {
    const a = compileArticle(match(), pred(match()));
    assert.equal((a.title.match(/pronostic/gi) ?? []).length, 1);
    assert.doesNotMatch(a.metaDescription, /meilleur pronostic football gratuit/i);
    assert.ok(a.metaDescription.length <= 170);
    assert.ok(a.faq.some((f) => /favori/i.test(f.q)));
    assert.ok(a.faq.some((f) => /score prévoir/i.test(f.q)));
  });

  it("articles for five different scenarios stay distinct", () => {
    const homeClear = match({
      id: "home-clear",
      home: team({ id: "i", name: "Inter", xgFor: 2.1, possession: 62 }),
      away: team({ id: "c", name: "Cagliari", xgFor: 0.8, possession: 38 }),
      formHome: "WWWWW",
      formAway: "LLLLL",
      restAway: point(2),
    });
    const awayClear = match({
      id: "away-clear",
      home: team({ id: "b", name: "Bournemouth", xgFor: 1.0, possession: 41 }),
      away: team({ id: "ar", name: "Arsenal", xgFor: 2.0, possession: 59 }),
      formHome: "LLDLD",
      formAway: "WWWDW",
      absencesHome: point([{ player: "Kerkez", role: "starter", reason: "suspension", importance: 0.6 }]),
    });
    const open = match({
      id: "open",
      home: team({ id: "t", name: "Torino", xgFor: 1.2, possession: 50 }),
      away: team({ id: "g", name: "Genoa", xgFor: 1.2, possession: 50 }),
      formHome: "DWDWD",
      formAway: "WDWDW",
    });
    const high = match({
      id: "high",
      home: team({ id: "d", name: "Dortmund", xgFor: 2.3, possession: 58 }),
      away: team({ id: "l", name: "Leverkusen", xgFor: 2.1, possession: 55 }),
      formHome: "WWLWW",
      formAway: "WLWWW",
    });
    const low = match({
      id: "low",
      home: team({ id: "bu", name: "Burnley", xgFor: 0.85, possession: 42 }),
      away: team({ id: "w", name: "Wolverhampton", xgFor: 0.9, possession: 44 }),
      formHome: "DDDLD",
      formAway: "DLDDD",
    });
    const pack: [MatchInput, number, number, number, number][] = [
      [homeClear, 0.7, 0.2, 0.1, 0.4],
      [awayClear, 0.16, 0.22, 0.62, 0.48],
      [open, 0.34, 0.33, 0.33, 0.5],
      [high, 0.48, 0.22, 0.3, 0.68],
      [low, 0.4, 0.32, 0.28, 0.3],
    ];
    const arts = pack.map(([m, ph, pd, pa, over]) =>
      compileArticle(
        m,
        pred(m, {
          calibrated: {
            home: ph,
            draw: pd,
            away: pa,
            over15: over + 0.2,
            over25: over,
            over35: Math.max(0.1, over - 0.2),
            under25: 1 - over,
            bttsYes: over > 0.55 ? 0.6 : 0.38,
            bttsNo: over > 0.55 ? 0.4 : 0.62,
            method: "platt",
            version: "t",
          },
          live: {
            ...pred(m).live!,
            likelyScores:
              over > 0.6
                ? [
                    { score: "2-1", p: 0.11 },
                    { score: "3-1", p: 0.09 },
                    { score: "2-2", p: 0.08 },
                  ]
                : over < 0.35
                  ? [
                      { score: "0-0", p: 0.15 },
                      { score: "1-0", p: 0.14 },
                      { score: "0-1", p: 0.1 },
                    ]
                  : pred(m).live!.likelyScores,
            expectedGoals: { home: m.home.xgFor, away: m.away.xgFor },
          },
        }),
      ),
    );
    for (const a of arts) {
      assert.equal(hasBannedFiller(body(a)), false);
      assert.equal(hasMainJargon(body(a)), false);
      assert.ok(a.quality.min >= 7, `${a.h1} quality ${a.quality.min} ${a.quality.flags.join(",")}`);
    }
    for (let i = 0; i < arts.length; i++) {
      for (let j = i + 1; j < arts.length; j++) {
        const sim = jaccard(arts[i]!.fingerprint, arts[j]!.fingerprint);
        assert.ok(sim < 0.55, `pair ${i}-${j} similar ${sim}`);
      }
    }
  });
});
