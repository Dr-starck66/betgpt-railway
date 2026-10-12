import type { ArticleType, EditorialArticle, EditorialParagraph, EditorialSource } from "@/lib/editorial/types";

/**
 * ASTRA EDITORIAL GOLD STANDARD Ω · future publication gate.
 *
 * User-approved reference (12 October 2026):
 * /actualites/manchester-city-18-points-verdict-financier-appel-sanctions-2026-10-12
 *
 * Applied ONLY to newly generated candidates, not a retrospective rewrite of historical URLs.
 * When the evidence is insufficient, SKIP publication. Never pad to meet a word count.
 * Passing structural checks does not guarantee inclusion in Google Discover or News.
 */
export const GOLD_STANDARD_REFERENCE_SLUG =
  "manchester-city-18-points-verdict-financier-appel-sanctions-2026-10-12";

export const GOLD_STANDARD_MIN_WORDS = 1500;
export const GOLD_STANDARD_MIN_SECTIONS = 7;

type GoldStandardDraft = Pick<
  EditorialArticle,
  "articleType" | "h1" | "lead" | "paragraphs" | "sources" | "image"
>;

function textOf(part: EditorialParagraph): string {
  return [
    part.body,
    ...(part.subsections ?? []).flatMap((item) => [
      item.body,
      ...(item.subsections ?? []).map((detail) => detail.body),
    ]),
  ].filter(Boolean).join(" ");
}

function citedIds(part: EditorialParagraph): string[] {
  return [
    ...(part.sourceIds ?? []),
    ...(part.subsections ?? []).flatMap((item) => [
      ...(item.sourceIds ?? []),
      ...(item.subsections ?? []).flatMap((detail) => detail.sourceIds ?? []),
    ]),
  ];
}

function independentHosts(sources: EditorialSource[]): Set<string> {
  const out = new Set<string>();
  for (const source of sources) {
    if (!source.url || source.status === "UNKNOWN" || source.status === "UNCONFIRMED") continue;
    try {
      const u = new URL(source.url);
      if (u.protocol === "https:" || u.protocol === "http:") {
        const host = u.hostname.toLowerCase().replace(/^www\./, "");
        if (host) out.add(host);
      }
    } catch {
      // Invalid URLs are not independent evidence.
    }
  }
  return out;
}

export function editorialGoldStandardGate(article: GoldStandardDraft): {
  pass: boolean;
  reasons: string[];
  words: number;
  sections: number;
  independentlySourcedSections: number;
} {
  const reasons: string[] = [];
  const texts = article.paragraphs.map(textOf);
  const all = [article.lead, ...texts].join(" ").trim();
  const words = all ? all.split(/\s+/u).filter(Boolean).length : 0;
  const sections = article.paragraphs.length;
  const sourceIds = new Set(article.sources.map((s) => s.id));
  const independentlySourcedSections = article.paragraphs.filter((p) =>
    citedIds(p).some((id) => sourceIds.has(id)),
  ).length;
  const hosts = independentHosts(article.sources);
  const strong = article.sources.filter((s) => s.url && ["OFFICIAL", "CORROBORATED", "HIGH_CONFIDENCE"].includes(s.status));
  const official = strong.some((s) => s.status === "OFFICIAL");

  if (words < GOLD_STANDARD_MIN_WORDS) reasons.push(`référence éditoriale : ${words} mots, minimum ${GOLD_STANDARD_MIN_WORDS} sans remplissage`);
  if (sections < GOLD_STANDARD_MIN_SECTIONS) reasons.push(`référence éditoriale : ${sections} sections, minimum ${GOLD_STANDARD_MIN_SECTIONS}`);
  if (hosts.size < 3 || strong.length < 3) reasons.push("référence éditoriale : moins de trois sources indépendantes et vérifiables");
  if (!official && hosts.size < 4) reasons.push("référence éditoriale : aucune source officielle ni faisceau élargi de confirmations journalistiques");
  if (sections > 0 && independentlySourcedSections / sections < 0.8) reasons.push("référence éditoriale : moins de 80 % des sections rattachées à des sources identifiables");
  if (!article.image?.src || article.image.width < 1200 || article.image.height < 675 || !article.image.alt?.trim() || !article.image.credit?.trim()) {
    reasons.push("référence éditoriale : grande image pertinente et créditée indisponible");
  }

  const forbidden = /\b(?:le cluster contient|les entités explicitement détectées|le desk observe|signal desk|score interne|la chronologie des publications|pourquoi BetGPT ne force pas un contexte de match|ce qui peut encore évoluer juste avant le coup d.envoi)\b/i;
  if (forbidden.test(`${article.h1} ${all} ${article.paragraphs.map((p) => p.h2).join(" ")}`)) {
    reasons.push("référence éditoriale : jargon de générateur, plan passe-partout ou recyclage de dépêche");
  }

  // Preserve a real editorial angle: the headline should name a concrete situation.
  if (article.h1.trim().length < 38) reasons.push("référence éditoriale : titre sans angle journalistique assez précis");
  return { pass: reasons.length === 0, reasons, words, sections, independentlySourcedSections };
}
