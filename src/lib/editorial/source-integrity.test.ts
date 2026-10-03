import assert from "node:assert/strict";
import test from "node:test";
import { classifyEditorialSource, sourceIntegrityGate } from "./source-integrity.ts";
import type { EditorialArticle, EditorialSource } from "./types.ts";

const base = {
  id: "news-test",
  slug: "dayot-upamecano-quitte-les-bleus",
  slot: "morning",
  articleType: "news",
  status: "PUBLISHED",
  title: "Dayot Upamecano quitte les Bleus avant France-Belgique | BetGPT",
  h1: "Dayot Upamecano quitte les Bleus avant France-Belgique",
  lead: "Suspendu pour France-Belgique, Dayot Upamecano quitte le groupe de l'équipe de France et rentre à Munich.",
  paragraphs: [
    {
      h2: "Le fait confirmé",
      body: "Dayot Upamecano a quitté le rassemblement français avant France-Belgique et est rentré à Munich.",
      sourceIds: ["lequipe", "parisien"],
    },
    {
      h2: "Le repère calendrier",
      body: "France-Belgique est programmé le 5 octobre 2026.",
      sourceIds: ["calendar"],
    },
  ],
  createdAt: "2026-10-03T10:00:00.000Z",
  publishedAt: "2026-10-03T10:00:00.000Z",
  modifiedAt: null,
  parisDate: "2026-10-03",
  scheduledTime: "08:00",
  category: "Actualité football",
  section: "football",
  league: "NL",
  teams: ["France"],
  matchId: null,
  competition: "Ligue des nations",
  sources: [
    { id: "lequipe", label: "L'Équipe", status: "CORROBORATED", note: "Dayot Upamecano quitte le groupe de l'équipe de France et rentre à Munich.", url: "https://www.lequipe.fr/" },
    { id: "parisien", label: "Le Parisien", status: "CORROBORATED", note: "Suspendu face à la Belgique, Dayot Upamecano quitte le rassemblement des Bleus.", url: "https://www.leparisien.fr/" },
    { id: "calendar", label: "Calendrier desk BetGPT", status: "HIGH_CONFIDENCE", note: "France - Belgique, coup d'envoi le 5 octobre 2026." },
  ],
  newsworthiness: 90,
  discoverOpportunity: { freshness: 20, frenchInterest: 20, entityStrength: 15, novelty: 10, visual: 10, sourceQuality: 10, editorialAngle: 10, total: 95, decision: "PUBLISH", reasons: [] },
  discoverChecks: { INDEXABLE: true, LARGE_IMAGE: true, IMAGE_GE_1200: true, MAX_IMAGE_PREVIEW_LARGE: true, HELPFUL_CONTENT: true, NON_CLICKBAIT_TITLE: true, ORIGINAL_VALUE: true, MOBILE_TEMPLATE: true },
  discoverReadiness: 100,
  topStories: "TOP_STORIES_ELIGIBILITY_READY",
  image: { src: "/img.jpg", alt: "France", width: 1200, height: 675, credit: "BetGPT" },
  links: [{ href: "/actualites", label: "Actualités" }],
  related: [],
  quality: { pass: true, reasons: [] },
  duplicateScore: 0,
  corrections: [],
  sourceChanges: [],
  factHash: "x",
  keywords: "Dayot Upamecano, France Belgique",
} as EditorialArticle;

test("classifie le calendrier sans le compter comme corroboration journalistique", () => {
  const calendar = base.sources.find((source) => source.id === "calendar") as EditorialSource;
  assert.equal(classifyEditorialSource(calendar), "SCHEDULE_SOURCE");
  const report = sourceIntegrityGate(base);
  assert.equal(report.pass, true);
  assert.deepEqual(report.corroboratingSourceIds.sort(), ["lequipe", "parisien"]);
});

test("bloque une source hors sujet même si elle parle de la même sélection", () => {
  const bad: EditorialSource = {
    id: "jacquet",
    label: "Le Télégramme",
    status: "UNCONFIRMED",
    note: "Jérémy Jacquet raconte ses deux premières sélections et explique qu'il ne se met pas de pression avec l'équipe de France.",
    url: "https://www.letelegramme.fr/",
  };
  const article = {
    ...base,
    sources: [...base.sources, bad],
    paragraphs: [
      ...base.paragraphs,
      { h2: "Autre source", body: "Une source supplémentaire est affichée.", sourceIds: ["jacquet"] },
    ],
  } as EditorialArticle;
  const report = sourceIntegrityGate(article);
  assert.equal(report.pass, false);
  assert.match(report.reasons.join(" | "), /sémantiquement hors sujet: Le Télégramme/);
});

test("bloque les artefacts HTML visibles", () => {
  const report = sourceIntegrityGate({ ...base, lead: base.lead + " &nbsp;&nbsp; L'Équipe" });
  assert.equal(report.pass, false);
  assert.ok(report.reasons.includes("artefact HTML visible dans le contenu public"));
});

test("ne compte pas une source calendrier comme deuxième corroboration", () => {
  const article = {
    ...base,
    sources: base.sources.filter((source) => source.id !== "parisien"),
    paragraphs: base.paragraphs.map((part) => ({
      ...part,
      sourceIds: part.sourceIds?.filter((id) => id !== "parisien"),
    })),
  } as EditorialArticle;
  const report = sourceIntegrityGate(article);
  assert.equal(report.pass, false);
  assert.match(report.reasons.join(" | "), /corroboration insuffisante/);
});
