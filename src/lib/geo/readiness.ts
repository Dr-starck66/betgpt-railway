/**
 * Internal editorial checklist. This is not a probability of being cited
 * by any AI product.
 */
export type ReadinessInput = {
  title: string;
  description: string;
  h1: string;
  canonical: string;
  updated: string;
  body: string;
  jsonLd: boolean;
  indexable: boolean;
  internalLinks: number;
  hasSourceNote: boolean;
};

export type ReadinessCheck = { id: string; pass: boolean; note: string };

export type Readiness = { score: number; checks: ReadinessCheck[] };

export function citationReadiness(page: ReadinessInput): Readiness {
  const checks: ReadinessCheck[] = [
    { id: "title", pass: page.title.trim().length >= 12 && !/^betgpt$/i.test(page.title.trim()), note: "titre descriptif" },
    { id: "h1", pass: page.h1.trim().length >= 8, note: "H1 unique fourni" },
    { id: "canonical", pass: page.canonical.startsWith("https://betgpt.live/"), note: "canonical sur le domaine" },
    { id: "description", pass: page.description.trim().length >= 40, note: "description propre" },
    { id: "updated", pass: /^\d{4}-\d{2}-\d{2}/.test(page.updated), note: "date de révision" },
    { id: "body", pass: page.body.trim().length >= 280, note: "contenu principal identifiable" },
    { id: "unique", pass: !/lorem ipsum|texte seo générique/i.test(page.body), note: "pas de remplissage vide" },
    { id: "jsonld", pass: page.jsonLd, note: "données structurées prévues" },
    { id: "indexable", pass: page.indexable, note: "page indexable" },
    { id: "links", pass: page.internalLinks >= 2, note: "liens internes" },
    { id: "source", pass: page.hasSourceNote, note: "source ou limite explicite" },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}
