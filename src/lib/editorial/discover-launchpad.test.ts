import test from "node:test";
import assert from "node:assert/strict";
import { discoverLaunchpadStaticAudit } from "./discover-launchpad";
import type { EditorialArticle } from "./types";

function article(overrides: Partial<EditorialArticle> = {}): EditorialArticle {
  const base = {
    id: "discover-test",
    slug: "psg-test-discover-2026-10-01",
    slot: "noon",
    articleType: "news",
    status: "PUBLISHED",
    title: "PSG : une décision officielle change la préparation du prochain match",
    h1: "PSG : une décision officielle change la préparation du prochain match",
    lead:
      "Le PSG a publié une décision qui modifie concrètement la préparation de son prochain match. Les éléments ci-dessous distinguent le fait officiel, ses conséquences sportives immédiates et ce qui reste encore à confirmer.",
    paragraphs: Array.from({ length: 5 }, (_, i) => ({
      h2: `Section éditoriale ${i + 1}`,
      body:
        "Cette section développe un élément distinct avec un contexte précis, une conséquence concrète pour l'équipe et une attribution claire aux sources disponibles. ".repeat(5),
      sourceIds: ["official"],
    })),
    createdAt: "2026-10-01T18:00:00.000Z",
    publishedAt: "2026-10-01T20:00:00.000Z",
    modifiedAt: null,
    parisDate: "2026-10-01",
    scheduledTime: "20:00",
    category: "Football",
    section: "actualites",
    league: "L1",
    teams: ["PSG"],
    matchId: null,
    competition: "Ligue 1",
    sources: [
      {
        id: "official",
        label: "Paris Saint-Germain",
        status: "OFFICIAL",
        note: "Communiqué officiel du club.",
        url: "https://www.psg.fr/",
      },
    ],
    newsworthiness: 90,
    discoverOpportunity: {
      freshness: 20,
      frenchInterest: 20,
      entityStrength: 15,
      novelty: 15,
      visual: 10,
      sourceQuality: 10,
      editorialAngle: 10,
      total: 100,
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
    image: {
      src: "/blog/discover/inline-crowd.jpg",
      alt: "Tribunes d'un stade de football pendant une rencontre du PSG",
      width: 1200,
      height: 675,
      credit: "Illustration football sous licence.",
    },
    links: [{ href: "/ligue-1", label: "Ligue 1" }],
    related: [],
    quality: { pass: true, reasons: [] },
    duplicateScore: 0.1,
    corrections: [],
    sourceChanges: [],
    factHash: "abc",
    keywords: "PSG, Ligue 1, football",
  } as EditorialArticle;
  return { ...base, ...overrides };
}

test("Discover Launchpad passes a compliant recent article", () => {
  const report = discoverLaunchpadStaticAudit(article(), new Date("2026-10-01T21:00:00.000Z"));
  assert.equal(report.hardPass, true);
  assert.equal(report.verdict, "PASS");
  assert.equal(report.newsSitemapEligible, true);
});

test("Discover Launchpad fails closed on an undersized image", () => {
  const report = discoverLaunchpadStaticAudit(
    article({ image: { src: "/small.jpg", alt: "PSG", width: 800, height: 450, credit: "test" } }),
    new Date("2026-10-01T21:00:00.000Z"),
  );
  assert.equal(report.hardPass, false);
  assert.ok(report.failures.includes("IMAGE_WIDTH_1200"));
});

test("Discover Launchpad treats age as a warning, not a fake eligibility failure", () => {
  const report = discoverLaunchpadStaticAudit(
    article({ publishedAt: "2026-09-30T08:00:00.000Z" }),
    new Date("2026-10-01T21:00:00.000Z"),
  );
  assert.equal(report.hardPass, true);
  assert.equal(report.verdict, "REVIEW");
  assert.ok(report.warnings.includes("TIMELY_24H"));
});
