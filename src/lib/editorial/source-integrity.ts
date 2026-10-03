import type { EditorialArticle, EditorialSource } from "./types.ts";

export type EditorialSourceRole =
  | "NEWS_SOURCE"
  | "OFFICIAL_SOURCE"
  | "SCHEDULE_SOURCE"
  | "BROADCASTER"
  | "CONTEXT_ONLY";

export type SourceIntegrityReport = {
  pass: boolean;
  reasons: string[];
  roles: Record<string, EditorialSourceRole>;
  corroboratingSourceIds: string[];
};

const MEDIA_HOSTS = [
  "lequipe.fr",
  "leparisien.fr",
  "lefigaro.fr",
  "letelegramme.fr",
  "ouest-france.fr",
  "rmcsport.bfmtv.com",
  "eurosport.fr",
  "franceinfo.fr",
  "francebleu.fr",
  "footmercato.net",
  "sofoot.com",
  "20minutes.fr",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
];

const STOPWORDS = new Set([
  "avec","afin","ainsi","alors","apres","avant","cette","comme","contre","dans","depuis","des","deux","donc","elle","elles",
  "encore","entre","est","etait","fait","faire","fois","football","france","groupe","information","les","leur","leurs","mais",
  "match","media","meme","moins","nouveau","nouvelle","par","pas","plus","pour","publie","publication","que","qui","sans",
  "selon","ses","son","source","sources","sport","sur","une","vers","aux","coup","envoi","ligue","equipe",
]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hostname(value?: string): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((item) => host === item || host.endsWith("." + item));
}

export function classifyEditorialSource(source: EditorialSource): EditorialSourceRole {
  const explicit = (source as EditorialSource & { role?: EditorialSourceRole }).role;
  if (explicit) return explicit;

  const text = fold(source.label + " " + source.note);
  const host = hostname(source.url);

  if (/\b(calendrier|horaire|coup d envoi|fixture|schedule|programme des matches)\b/.test(text)) {
    return "SCHEDULE_SOURCE";
  }
  if (/\b(diffusion|diffuseur|diffuse|retransmission|chaine tv|television|streaming)\b/.test(text)) {
    return "BROADCASTER";
  }
  if (source.status === "OFFICIAL") return "OFFICIAL_SOURCE";
  if (
    hostMatches(host, MEDIA_HOSTS) ||
    /\b(l equipe|le parisien|le figaro|le telegramme|rmc sport|eurosport|reuters|bbc|foot mercato|so foot)\b/.test(text)
  ) {
    return "NEWS_SOURCE";
  }
  return "CONTEXT_ONLY";
}

function citedSourceIds(article: EditorialArticle): Set<string> {
  const ids = new Set<string>();
  const add = (values?: string[]) => values?.forEach((id) => ids.add(id));
  for (const part of article.paragraphs) {
    add(part.sourceIds);
    for (const subsection of part.subsections ?? []) {
      add(subsection.sourceIds);
      for (const detail of subsection.subsections ?? []) add(detail.sourceIds);
    }
  }
  return ids;
}

function publicTexts(article: EditorialArticle): string[] {
  return [
    article.title,
    article.h1,
    article.lead,
    ...article.paragraphs.flatMap((part) => [
      part.h2,
      part.body,
      ...(part.subsections ?? []).flatMap((subsection) => [
        subsection.h3,
        subsection.body,
        ...(subsection.subsections ?? []).flatMap((detail) => [detail.h4, detail.body]),
      ]),
    ]),
  ];
}

function keywordSet(value: string): Set<string> {
  return new Set(
    fold(value)
      .split(" ")
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token) && !/^\d+$/.test(token)),
  );
}

function sourceRelevance(article: EditorialArticle, source: EditorialSource): { overlap: number; ratio: number } {
  const core = keywordSet(article.h1 + " " + article.lead + " " + article.teams.join(" ") + " " + article.competition);
  const evidence = keywordSet(source.label + " " + source.note);
  let overlap = 0;
  for (const token of evidence) if (core.has(token)) overlap += 1;
  return { overlap, ratio: evidence.size ? overlap / evidence.size : 0 };
}

function normalizedBlock(value: string): string {
  return fold(value).replace(/\b\d{1,2} h \d{2}\b/g, " ");
}

function duplicateReason(article: EditorialArticle): string | null {
  const blocks = [article.lead, ...article.paragraphs.map((part) => part.body)]
    .map(normalizedBlock)
    .filter((value) => value.length >= 120);
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i]!;
      const b = blocks[j]!;
      if (a === b || (a.length > 180 && b.length > 180 && (a.includes(b) || b.includes(a)))) {
        return "contenu dupliqué entre blocs " + (i + 1) + " et " + (j + 1);
      }
    }
  }
  return null;
}

export function sourceIntegrityGate(article: EditorialArticle): SourceIntegrityReport {
  const reasons: string[] = [];
  const roles: Record<string, EditorialSourceRole> = {};
  const cited = citedSourceIds(article);
  const ids = new Set<string>();

  for (const source of article.sources) {
    if (ids.has(source.id)) reasons.push("source dupliquée: " + source.id);
    ids.add(source.id);
    roles[source.id] = classifyEditorialSource(source);
  }

  if (publicTexts(article).some((value) => /&nbsp;|&#160;|<\/?[a-z][^>]*>/i.test(value))) {
    reasons.push("artefact HTML visible dans le contenu public");
  }

  const duplicate = duplicateReason(article);
  if (duplicate) reasons.push(duplicate);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    reasons.push("slug invalide ou non normalisé");
  }
  if (article.slug.length > 120) reasons.push("slug trop long (>120 caractères)");

  for (const source of article.sources) {
    const role = roles[source.id]!;
    if (!cited.has(source.id) && role !== "CONTEXT_ONLY") {
      reasons.push("source non utilisée dans le corps: " + source.label);
    }
    if (role === "NEWS_SOURCE") {
      const relevance = sourceRelevance(article, source);
      if (relevance.overlap < 2 || relevance.ratio < 0.16) {
        reasons.push(
          "source journalistique sémantiquement hors sujet: " +
            source.label +
            " (overlap=" +
            relevance.overlap +
            ", ratio=" +
            relevance.ratio.toFixed(2) +
            ")",
        );
      }
    }
  }

  const corroboratingSourceIds = article.sources
    .filter((source) => {
      const role = roles[source.id]!;
      if (role !== "NEWS_SOURCE" && role !== "OFFICIAL_SOURCE") return false;
      return source.status === "OFFICIAL" || source.status === "HIGH_CONFIDENCE" || source.status === "CORROBORATED";
    })
    .map((source) => source.id);

  if (article.articleType === "news") {
    const officialCount = article.sources.filter(
      (source) => roles[source.id] === "OFFICIAL_SOURCE" && source.status === "OFFICIAL",
    ).length;
    const newsSources = new Set(
      article.sources
        .filter((source) => roles[source.id] === "NEWS_SOURCE" && corroboratingSourceIds.includes(source.id))
        .map((source) => fold(source.label)),
    );
    if (officialCount === 0 && newsSources.size < 2) {
      reasons.push(
        "corroboration insuffisante: exiger une source officielle ou deux sources journalistiques fortes réellement pertinentes",
      );
    }
  }

  return { pass: reasons.length === 0, reasons, roles, corroboratingSourceIds };
}
