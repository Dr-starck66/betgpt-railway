import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorialArticle } from "@/lib/editorial/types";
import { buildHashtags, buildXPublication, fitXPost, trackedArticleUrl, xIntentUrl } from "./content.ts";

function article(overrides: Partial<EditorialArticle> = {}): EditorialArticle {
  return {
    id: "article-1",
    slug: "psg-om-composition",
    slot: "evening",
    articleType: "news",
    status: "PUBLISHED",
    title: "PSG – Marseille : les dernières informations",
    h1: "PSG – Marseille : les dernières informations avant le Classique",
    lead: "Le contexte du match évolue avant le coup d’envoi, avec plusieurs éléments factuels à surveiller.",
    paragraphs: [],
    createdAt: "2026-10-01T15:00:00.000Z",
    publishedAt: "2026-10-01T15:05:00.000Z",
    modifiedAt: null,
    parisDate: "2026-10-01",
    scheduledTime: "18:15",
    category: "Football",
    section: "football",
    league: "L1",
    teams: ["PSG", "Marseille"],
    matchId: "psg-om",
    competition: "Ligue 1",
    sources: [],
    newsworthiness: 90,
    discoverOpportunity: {
      freshness: 90,
      frenchInterest: 90,
      entityStrength: 90,
      novelty: 80,
      visual: 80,
      sourceQuality: 80,
      editorialAngle: 80,
      total: 86,
      decision: "PUBLISH",
      reasons: [],
    },
    discoverChecks: {
      INDEXABLE: true,
      LARGE_IMAGE: true,
      IMAGE_GE_1200: true,
      MAX_IMAGE_PREVIEW_LARGE: true,
      HELPFUL_CONTENT: true,
      NON_CLICKBAIT_TITLE: true,
      ORIGINAL_VALUE: true,
      MOBILE_TEMPLATE: true,
    },
    discoverReadiness: 100,
    topStories: "TOP_STORIES_ELIGIBILITY_READY",
    image: { src: "/blog/discover/psg-om.jpg", alt: "PSG et Marseille", width: 1280, height: 720, credit: "BetGPT" },
    links: [],
    related: [],
    quality: { pass: true, reasons: [] },
    duplicateScore: 0,
    corrections: [],
    sourceChanges: [],
    factHash: "abc",
    keywords: "PSG, Marseille, Ligue 1",
    ...overrides,
  };
}

describe("ASTRA SOCIAL", () => {
  it("builds precise de-duplicated hashtags", () => {
    assert.deepEqual(buildHashtags(article()), ["#PSG", "#Marseille", "#Ligue1"]);
  });

  it("adds social UTM without changing the canonical article URL", () => {
    const row = article();
    const tracked = new URL(trackedArticleUrl(row));
    assert.equal(tracked.origin + tracked.pathname, "https://betgpt.live/actualites/psg-om-composition");
    assert.equal(tracked.searchParams.get("utm_source"), "x");
    assert.equal(tracked.searchParams.get("utm_medium"), "social");
    assert.equal(tracked.searchParams.get("utm_campaign"), "editorial_auto");
    assert.equal(tracked.searchParams.get("utm_content"), row.slug);
  });

  it("keeps generated X text at or below the standard limit", () => {
    const fitted = fitXPost({
      headline: "🔴 " + "Une information vérifiée ".repeat(20),
      detail: "Contexte ".repeat(80),
      url: "https://betgpt.live/a?utm_source=x&utm_medium=social",
      hashtags: ["#PSG", "#OM", "#Ligue1"],
    });
    assert.ok(fitted.text.length <= 280);
    assert.match(fitted.text, /https:\/\/betgpt\.live/);
  });

  it("uses a deterministic idempotency key per article", () => {
    const a = buildXPublication(article(), new Date("2026-10-01T15:06:00.000Z"));
    const b = buildXPublication(article(), new Date("2026-10-01T15:07:00.000Z"));
    assert.equal(a.id, "x:article-1:v1");
    assert.equal(a.id, b.id);
    assert.equal(a.status, "READY_TO_X");
    assert.match(xIntentUrl(a), /^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  });
});
