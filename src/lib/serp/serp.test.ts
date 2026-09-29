import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MatchInput } from "@/engine/types";
import { answerFirst, featuredSnippetReadiness, hasSpanishSearchLeak, serpDescription, serpTitle, wordCount } from "@/lib/serp/answer";
import { ecosystemCarousel } from "@/lib/serp/carousel";
import { diffScores } from "@/lib/serp/corrections";
import { auditJsonLd } from "@/lib/serp/schema-audit";
import { scoreFreshness, strictStatus } from "@/lib/serp/status";
import { liveBroadcastLd, videoObjectLd, videoRelevance, type CuratedVideo } from "@/lib/serp/video";
import { jsonLd } from "@/lib/seo.ts";

function match(over: Partial<MatchInput> = {}): MatchInput {
  return {
    id: "psg-om",
    league: "L1",
    competition: "Ligue 1",
    kickoff: "2026-09-28T18:45:00.000Z",
    venue: "Parc des Princes",
    home: { id: "160", name: "PSG", short: "PSG", league: "L1", attack: 1, defense: 1, elo: 1, xgFor: 1, xgAgainst: 1, possession: 50, ppda: 10, fieldTilt: 50, progressivePasses: 1, highTurnovers: 1, recoveries: 1, compactness: 1, setPieceXg: 1, duelWin: 1, cardsPerGame: 1, flexibility: 1, pressLine: 1, buildup: 1, depth: 1, formation: "4-3-3", color: "#000" },
    away: { id: "174", name: "Marseille", short: "OM", league: "L1", attack: 1, defense: 1, elo: 1, xgFor: 1, xgAgainst: 1, possession: 50, ppda: 10, fieldTilt: 50, progressivePasses: 1, highTurnovers: 1, recoveries: 1, compactness: 1, setPieceXg: 1, duelWin: 1, cardsPerGame: 1, flexibility: 1, pressLine: 1, buildup: 1, depth: 1, formation: "4-3-3", color: "#fff" },
    restHome: { value: 6, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    restAway: { value: 6, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    travelAwayKm: { value: 1, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    congestionHome: { value: 0, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    congestionAway: { value: 0, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    absencesHome: { value: [], source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    absencesAway: { value: [], source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    importance: { value: 1, source: "t", timestamp: "2026-09-28T10:00:00.000Z", confidence: 1, freshnessHours: 1 },
    opening: { book: "Unibet", home: 1.8, draw: 3.6, away: 4.2, over15: 1.2, over25: 1.8, over35: 3, under25: 2, bttsYes: 1.8, bttsNo: 2 },
    current: [],
    notes: [],
    slug: "psg-marseille-2026-09-28",
    ...over,
  };
}

function video(over: Partial<CuratedVideo> = {}): CuratedVideo {
  return {
    videoId: "abcdefghijk",
    title: "Résumé PSG Marseille",
    description: "Résumé officiel",
    channelName: "Ligue 1",
    publishedAt: "2026-09-28T22:00:00.000Z",
    home: "PSG",
    away: "Marseille",
    kickoffDay: "2026-09-28",
    competition: "Ligue 1",
    kind: "highlights",
    official: true,
    language: "fr",
    ...over,
  };
}

describe("sports serp answer", () => {
  it("keeps one factual sentence per status and never calls a finished match live", () => {
    const scheduled = answerFirst(match({ status: "scheduled" }));
    assert.match(scheduled, /PSG – Marseille débute/);
    assert.ok(wordCount(scheduled) <= 50);
    assert.doesNotMatch(serpTitle(match({ status: "scheduled" })), /en direct/);

    const live = match({ status: "live", scoreHome: 1, scoreAway: 0, clock: "63'" });
    assert.match(answerFirst(live), /1–0/);
    assert.match(answerFirst(live), /actuellement en cours/);
    assert.match(serpTitle(live), /en direct/);
    assert.match(serpDescription(live), /en direct : score 1-0/);

    const done = match({ status: "finished", scoreHome: 2, scoreAway: 1 });
    assert.match(answerFirst(done), /résultat final/);
    assert.doesNotMatch(answerFirst(done), /en direct/);
    assert.doesNotMatch(serpTitle(done), /en direct/);
    assert.match(serpTitle(done), /résultat, buts, statistiques et résumé/);
    const scheduledTitle = serpTitle(match({ status: "scheduled" }));
    assert.match(scheduledTitle, /heure, chaîne, compositions, statistiques et pronostic/);
    assert.equal(hasSpanishSearchLeak(scheduledTitle), false);
    assert.equal(hasSpanishSearchLeak("Villarreal Levante horario"), true);
    const ready = featuredSnippetReadiness({
      answer: answerFirst(done),
      h1: "PSG 2–1 Marseille : résultat",
      home: "PSG",
      away: "Marseille",
      status: "FINISHED",
      hasTable: true,
      canonical: true,
      indexable: true,
      scoreVisible: true,
      aboveFold: true,
    });
    assert.equal(ready.score, 100);
    assert.match(ready.note, /pas une probabilité/);
  });

  it("does not label a stale live score as confirmed live", () => {
    const live = match({ status: "live", scoreHome: 1, scoreAway: 0, clock: "63'" });
    assert.match(serpTitle(live, { stale: true }), /dernier score connu/);
    assert.doesNotMatch(serpTitle(live, { stale: true }), /en direct/);
    assert.equal(strictStatus({ status: "live", clock: "Mi-temps" }), "HALFTIME");
    assert.equal(strictStatus({ status: "finished", clock: "Mi-temps" }), "FINISHED");
    assert.equal(scoreFreshness("2026-09-28T18:00:00.000Z", Date.parse("2026-09-28T18:10:00.000Z")).stale, true);
  });
});

describe("sports video gate", () => {
  it("rejects a previous meeting and a highlights clip before full time", () => {
    const old = video({ kickoffDay: "2025-01-01" });
    assert.equal(videoRelevance(old, match({ status: "finished" })).show, false);
    const early = video({ kind: "highlights" });
    assert.equal(videoRelevance(early, match({ status: "scheduled" })).show, false);
    const ok = videoRelevance(video(), match({ status: "finished" }));
    assert.equal(ok.show, true);
    assert.equal(videoObjectLd(video(), "https://betgpt.live/match/x")?.["@type"], "VideoObject");
    assert.equal(liveBroadcastLd(video()), null);
    assert.equal(liveBroadcastLd(video({ livestream: true }))?.isLiveBroadcast, true);
  });
});

describe("score correction ledger", () => {
  it("records a score change and ignores an identical snapshot", () => {
    const prev = [{ id: "a", status: "live", scoreHome: 0, scoreAway: 0 }];
    const same = diffScores(prev, prev, "2026-09-28T19:00:00.000Z");
    assert.equal(same.length, 0);
    const next = diffScores(prev, [{ id: "a", status: "live", scoreHome: 1, scoreAway: 0 }], "2026-09-28T19:10:00.000Z");
    assert.equal(next[0]?.oldValue, "live|0-0");
    assert.equal(next[0]?.newValue, "live|1-0");
  });
});

describe("schema and carousel claims", () => {
  it("does not put BroadcastEvent on a live score and does not claim Google acceptance", () => {
    const data = jsonLd(match({ status: "live", scoreHome: 1, scoreAway: 0 }), undefined) as { "@graph": Array<Record<string, unknown>> };
    const types = data["@graph"].map((node) => node["@type"]);
    assert.ok(types.includes("SportsEvent"));
    assert.equal(types.includes("BroadcastEvent"), false);
    assert.equal(types.includes("VideoObject"), false);
    const audit = auditJsonLd(data);
    assert.equal(audit.schemaValid, true, audit.errors.join(","));
    assert.equal(audit.eligibility, "GOOGLE_ELIGIBILITY_UNVERIFIED");
    const broken = auditJsonLd({
      "@context": "https://schema.org",
      "@graph": [{ "@type": ["SportsEvent", "BroadcastEvent"], name: "X", startDate: "2026-09-28", homeTeam: { name: "A" }, awayTeam: { name: "B" }, url: "https://betgpt.live/match/x" }],
    });
    assert.equal(broken.schemaValid, false);
    const carousel = ecosystemCarousel();
    assert.equal(carousel.googleDecision, "UNKNOWN");
    assert.notEqual(carousel.googleDecision, "ACCEPTED");
    assert.equal(carousel.readiness, "ELIGIBLE_CANDIDATE");
  });
});
