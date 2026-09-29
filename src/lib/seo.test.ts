import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { robotsTxt } from "./robots.ts";
import { sitemapDate } from "./sitemap-metadata.ts";
import { jsonLd, matchTitle, articleDates, matchHead } from "./seo.ts";
import type { MatchInput, PredictionRecord, TeamProfile } from "../engine/types.ts";

function team(name: string, id: string): TeamProfile {
  return {
    id,
    name,
    short: name.slice(0, 3).toUpperCase(),
    league: "BL",
    attack: 1.5,
    defense: 1,
    elo: 1800,
    xgFor: 1.5,
    xgAgainst: 1,
    possession: 55,
    ppda: 9,
    fieldTilt: 55,
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
    color: "#111",
  };
}

function point<T>(value: T) {
  return { value, source: "t", timestamp: "2026-09-14T10:00:00.000Z", confidence: 0.5, freshnessHours: 2 };
}

describe("robots.txt contract", () => {
  it("omits unknown, malformed and future sitemap modification dates", () => {
    const now = Date.parse("2026-09-22T12:00:00Z");
    assert.equal(sitemapDate(undefined, now), "");
    assert.equal(sitemapDate("invalid", now), "");
    assert.equal(sitemapDate("2026-10-01", now), "");
    assert.equal(sitemapDate("2026-09-21", now), "2026-09-21T00:00:00.000Z");
  });
  it("blocks private paths and leaves football SEO crawlable", () => {
    const t = robotsTxt();
    assert.match(t, /Disallow: \/admin/);
    assert.match(t, /Disallow: \/api\//);
    assert.match(t, /Disallow: \/go/);
    assert.match(t, /Disallow: \/lab/);
    assert.doesNotMatch(t, /Disallow: \/chat/);
    assert.doesNotMatch(t, /Disallow: \/championship/);
    assert.doesNotMatch(t, /Disallow: \/prono/);
    assert.doesNotMatch(t, /Disallow: \/score\//);
    assert.doesNotMatch(t, /Disallow: \/match/);
    assert.match(t, /Sitemap: https:\/\/betgpt\.live\/sitemap\.xml/);
  });
});

describe("match JSON-LD", () => {
  it("emits one BreadcrumbList, a NewsArticle with a real articleBody, and a frozen dateModified", () => {
    const match: MatchInput = {
      id: "m1",
      league: "BL",
      competition: "Bundesliga",
      kickoff: "2026-09-18T18:30:00.000Z",
      venue: "Allianz Arena",
      home: team("Bayern Munich", "132"),
      away: team("1. FC Union Berlin", "598"),
      restHome: point(6),
      restAway: point(6),
      travelAwayKm: point(200),
      congestionHome: point(0.2),
      congestionAway: point(0.2),
      absencesHome: point([]),
      absencesAway: point([]),
      importance: point(0.7),
      opening: {
        book: "Unibet",
        home: 1.2,
        draw: 6,
        away: 10,
        over15: 1.1,
        over25: 1.5,
        over35: 2.2,
        under25: 2.5,
        bttsYes: 1.8,
        bttsNo: 2,
      },
      current: [],
      notes: [],
      status: "scheduled",
      formHome: "WWWWW",
      formAway: "LLDLD",
      slug: "bayern-munich-1-fc-union-berlin-2026-09-18",
    };
    const prediction = {
      matchId: match.id,
      engineVersion: "t",
      tacticalVersion: "t",
      kickoff: match.kickoff,
      league: match.league,
      competition: match.competition,
      venue: match.venue,
      home: { id: match.home.id, name: match.home.name, short: match.home.short, formation: match.home.formation },
      away: { id: match.away.id, name: match.away.name, short: match.away.short, formation: match.away.formation },
      models: [],
      ensemble: {
        lambdaHome: 2.2,
        lambdaAway: 0.7,
        home: 0.79,
        draw: 0.12,
        away: 0.09,
        over15: 0.8,
        over25: 0.55,
        over35: 0.3,
        under25: 0.45,
        bttsYes: 0.45,
        bttsNo: 0.55,
        matrix: [[0.1]],
        weights: { poisson: 1, dixonColes: 0, elo: 0, xg: 0, glm: 0, market: 0 },
        disagreement: 0.1,
      },
      calibrated: {
        home: 0.79,
        draw: 0.12,
        away: 0.09,
        over15: 0.8,
        over25: 0.55,
        over35: 0.3,
        under25: 0.45,
        bttsYes: 0.45,
        bttsNo: 0.55,
        method: "platt",
        version: "t",
      },
      intelligence: { modelDisagreement: 0.1, confidenceScore: 0.58, dataQuality: 0.7 },
      coaches: [],
      agentWeights: {
        POSSESSION_STRUCTURAL: 1,
        PRESSING_TRANSITION: 1,
        ADAPTATION_GAME_MANAGEMENT: 1,
        DEFENSIVE_COUNTER: 1,
        COMPETITIVE_DISCIPLINE: 1,
      },
      consensus: {
        home: 0.79,
        draw: 0.12,
        away: 0.09,
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
        blended: { home: 0.79, draw: 0.12, away: 0.09 },
      },
      features: [],
      scenarios: [],
      markets: [],
      bookLinks: [],
      dailyBestCandidate: false,
      notes: [],
      availableInformation: [],
      timestamp: "2026-09-14T16:42:35.266Z",
    } as unknown as PredictionRecord;
    const data = jsonLd(match, prediction) as { "@graph": Array<Record<string, unknown>> };
    const types = data["@graph"].map((x) => x["@type"]);
    assert.equal(types.filter((t) => t === "BreadcrumbList").length, 1);
    assert.ok(types.includes("SportsEvent"));
    assert.ok(types.includes("NewsArticle"));
    assert.ok(types.includes("FAQPage"));
    const article = data["@graph"].find((x) => x["@type"] === "NewsArticle")!;
    assert.equal(article.dateModified, "2026-09-14T16:42:35.266Z");
    assert.ok(String(article.articleBody).length > 400);
    assert.doesNotMatch(String(article.articleBody), /\bPPDA\b/);
    assert.match(matchTitle(match, prediction), /heure, chaîne, compositions, statistiques et pronostic/);
    assert.equal(types.filter((t) => t === "BroadcastEvent").length, 0);
    const head = matchHead(match, prediction, { publishedAt: "2026-09-14T16:42:35.266Z", modifiedAt: "2026-09-14T16:42:35.266Z" });
    const raw = String(head.scripts?.[0]?.children ?? "");
    assert.match(raw, /SportsEvent/);
    assert.match(raw, /SportsTeam/);
    assert.match(raw, /BreadcrumbList/);
    assert.match(raw, /FAQPage/);
    assert.doesNotMatch(raw, /VideoObject/);
    const graph = JSON.parse(raw) as { "@graph": Array<Record<string, unknown>> };
    const event = graph["@graph"].find((n) => n["@type"] === "SportsEvent");
    const news = graph["@graph"].find((n) => n["@type"] === "NewsArticle");
    assert.equal(event?.startDate, match.kickoff);
    assert.notEqual(news?.datePublished, match.kickoff);
  });

  it("never fabricates a publication date relative to kickoff", () => {
    const match: MatchInput = {
      id: "m1",
      league: "BL",
      competition: "Bundesliga",
      kickoff: "2026-09-18T18:30:00.000Z",
      venue: "Allianz Arena",
      home: team("Bayern Munich", "132"),
      away: team("1. FC Union Berlin", "598"),
      restHome: point(6),
      restAway: point(6),
      travelAwayKm: point(200),
      congestionHome: point(0.2),
      congestionAway: point(0.2),
      absencesHome: point([]),
      absencesAway: point([]),
      importance: point(0.7),
      opening: {
        book: "Unibet",
        home: 1.2,
        draw: 6,
        away: 10,
        over15: 1.1,
        over25: 1.5,
        over35: 2.2,
        under25: 2.5,
        bttsYes: 1.8,
        bttsNo: 2,
      },
      current: [],
      notes: [],
      status: "scheduled",
      formHome: "WWWWW",
      formAway: "LLDLD",
      slug: "bayern-munich-1-fc-union-berlin-2026-09-18",
    };
    const timestamp = new Date(Date.now() - 1000).toISOString();
    const live = articleDates(match, { timestamp } as PredictionRecord);
    assert.equal(live.modified, timestamp);
    assert.equal(live.published, timestamp);
    const again = articleDates(match, { timestamp } as PredictionRecord);
    assert.equal(again.modified, live.modified);
    assert.equal(articleDates(match).published, undefined);
    assert.equal(articleDates(match, { timestamp: "2099-01-01T00:00:00Z" } as PredictionRecord).published, undefined);
  });
});
