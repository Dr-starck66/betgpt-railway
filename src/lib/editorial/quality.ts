import type { DiscoverCheck, EditorialArticle, EditorialSource } from "@/lib/editorial/types";

const CLICKBAIT =
  /incroyable|vous n['’]allez jamais|ne ratez pas|à ne pas manquer|urgent|scandale|dernier moment|dingue|immanquable|!!!/i;

const HALLUCINATION =
  /composition officielle (est|a été|publiée|annoncée)|a signé\b|transfert (est )?confirmé|forfait officiel|source proche/i;

const TIPSTER = /mise conseillée|à jouer|pronostic sûr|gain garanti|certitude de victoire|pariez\b/i;
const INTERNAL_JARGON = /desk BetGPT|score interne|créneau ouvert|créneau pas encore ouvert|pas un pronostic inventé|signal desk|déjà ingéré|pipeline|dans ce cluster|le moteur classe|le moteur conserve|source officielle n['’]est pas ajoutée artificiellement/i;
const SPANISH_PUBLIC_COPY = /\b(horario|alineaciones?|resultado|dónde ver|clasificación)\b/i;
const GENERIC_EDITORIAL_FILLER =
  /voici ce qui est confirmé par les sources disponibles|ce que cela peut changer|les prochains éléments à surveiller|la prochaine étape est une confirmation ou une précision|ce rendez-vous donne un contexte immédiat au sujet|les éléments ci-dessous restent limités à ce qui est effectivement annoncé|\brequête\b[^.]{0,80}\b(?:pronostic|seo|mot[- ]?clé)\b/i;

const STOP = new Set([
  "betgpt",
  "match",
  "football",
  "paris",
  "europe",
  "cette",
  "dans",
  "pour",
  "avec",
  "plus",
  "sans",
  "comme",
  "page",
  "signal",
  "cote",
  "cotes",
  "score",
  "statut",
  "coupe",
  "africaine",
  "nations",
  "qualification",
  "matchs",
  "programme",
  "bookmaker",
  "estimation",
  "observee",
  "observe",
  "horaire",
  "contexte",
  "donnees",
  "disponibles",
  "rencontre",
  "rencontres",
  "informations",
  "equipe",
  "equipes",
  "source",
  "sources",
  "probabilite",
  "composition",
  "compositions",
  "forfait",
  "fiable",
  "publie",
  "publiee",
  "calendrier",
  "suivre",
  "avant",
  "pendant",
  "apres",
  "coup",
  "envoi",
  "affronte",
  "prevu",
  "prevue",
  "disponible",
  "complete",
  "completer",
  "manquantes",
]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP.has(word));
}

export function jaccard(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let inter = 0;
  for (const word of left) if (right.has(word)) inter += 1;
  return inter / (left.size + right.size - inter);
}

function sentenceKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+(?:[.,]\d+)?/g, "#")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function internalDuplication(text: string): { duplicateInstances: number; maxRepeats: number } {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentenceKey)
    .filter((sentence) => sentence.length >= 55);
  const counts = new Map<string, number>();
  for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  let duplicateInstances = 0;
  let maxRepeats = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicateInstances += count - 1;
    maxRepeats = Math.max(maxRepeats, count);
  }
  return { duplicateInstances, maxRepeats };
}

export function nearDuplicateParagraphs(paragraphs: { body: string }[]): number {
  let collisions = 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    for (let j = i + 1; j < paragraphs.length; j += 1) {
      if (jaccard(paragraphs[i]!.body, paragraphs[j]!.body) >= 0.82) collisions += 1;
    }
  }
  return collisions;
}

export function factHash(parts: string[]): string {
  const raw = parts.join("|");
  let h = 5381;
  for (let i = 0; i < raw.length; i += 1) h = (h * 33) ^ raw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function sourceStrength(source: EditorialSource): number {
  if (source.status === "OFFICIAL") return 10;
  if (source.status === "CORROBORATED") return 8;
  if (source.status === "HIGH_CONFIDENCE" && !/desk BetGPT|modèle BetGPT/i.test(source.label)) return 6;
  if (source.status === "HIGH_CONFIDENCE") return 4;
  if (source.status === "UNCONFIRMED") return 2;
  return 0;
}

export function sourceQualityScore(sources: EditorialSource[]): number {
  if (!sources.length) return 0;
  const best = Math.max(...sources.map(sourceStrength));
  const corroborationBonus = sources.filter((source) => sourceStrength(source) >= 6).length >= 2 ? 2 : 0;
  return Math.min(10, best + corroborationBonus);
}

export function qualityGate(
  article: Pick<EditorialArticle, "articleType" | "title" | "h1" | "lead" | "paragraphs" | "sources" | "image" | "links" | "teams" | "competition">,
  priorTexts: string[],
): { pass: boolean; reasons: string[]; duplicateScore: number } {
  const reasons: string[] = [];
  const body = article.paragraphs.map((p) => p.body).join("\n");
  const all = `${article.title}\n${article.h1}\n${article.lead}\n${body}`;
  if (article.articleType === "slate") reasons.push("article programme générique interdit en Discover auto");
  if (article.h1.trim().length < 20 || article.h1.length > 120) reasons.push("titre hors longueur");
  if (article.lead.trim().length < 90) reasons.push("chapô trop court");
  if (article.paragraphs.length < 3) reasons.push("moins de trois parties");
  if (article.paragraphs.some((p) => p.body.trim().length < 140)) reasons.push("partie trop mince");
  if (!article.sources.length) reasons.push("aucune source");
  if (sourceQualityScore(article.sources) < 4) reasons.push("sources trop faibles");
  if (article.sources.some((s) => s.status === "UNKNOWN" && /confirmé|officiellement/i.test(s.note))) {
    reasons.push("fait inconnu écrit comme confirmé");
  }
  if (!article.image?.src || (article.image.width ?? 0) < 1200) reasons.push("image absente ou trop petite");
  if (CLICKBAIT.test(all)) reasons.push("titre ou texte clickbait");
  if (HALLUCINATION.test(all)) reasons.push("formulation de fait non sourcé");
  if (TIPSTER.test(all)) reasons.push("consigne de mise");
  if (INTERNAL_JARGON.test(all)) reasons.push("jargon interne exposé au lecteur");
  if (SPANISH_PUBLIC_COPY.test(all)) reasons.push("vocabulaire public non fr-FR");
  const repetition = internalDuplication(all);
  if (repetition.duplicateInstances >= 2 || repetition.maxRepeats >= 3) {
    reasons.push("répétitions internes excessives");
  }
  if (nearDuplicateParagraphs(article.paragraphs) >= 2) reasons.push("paragraphes trop similaires");
  if (GENERIC_EDITORIAL_FILLER.test(all)) reasons.push("remplissage éditorial générique détecté");
  const entity = [...article.teams, article.competition].filter(Boolean).map((x) => x.toLowerCase());
  if (
    entity.length &&
    !entity.some(
      (name) =>
        article.h1.toLowerCase().includes(name.slice(0, 6).toLowerCase()) || article.h1.toLowerCase().includes(name.toLowerCase()),
    )
  ) {
    const loose = entity.some((name) =>
      name
        .split(/\s+/)
        .some((bit) => bit.length > 3 && article.h1.toLowerCase().includes(bit.toLowerCase())),
    );
    if (!loose) reasons.push("le titre ne nomme pas le sujet");
  }
  if (
    !article.links.some(
      (link) =>
        link.href.startsWith("/match/") ||
        link.href.startsWith("/scores") ||
        link.href.startsWith("/resultats") ||
        link.href.startsWith("/ligue") ||
        link.href.startsWith("/premier") ||
        link.href.startsWith("/la-liga") ||
        link.href.startsWith("/bundesliga") ||
        link.href.startsWith("/serie") ||
        link.href.startsWith("/calendrier"),
    )
  ) {
    reasons.push("pas de lien interne football utile");
  }
  let duplicateScore = 0;
  const probe = `${article.h1} ${article.lead}`;
  for (const prev of priorTexts) duplicateScore = Math.max(duplicateScore, jaccard(probe, prev));
  if (duplicateScore >= 0.66) reasons.push("trop proche d'un article déjà retenu");
  return { pass: reasons.length === 0, reasons, duplicateScore };
}

export function discoverChecks(article: EditorialArticle): Record<DiscoverCheck, boolean> {
  const body = article.paragraphs.map((p) => p.body).join(" ");
  return {
    INDEXABLE: article.quality.pass && (article.status === "PUBLISHED" || article.status === "UPDATED"),
    LARGE_IMAGE: article.image.width >= 1200,
    IMAGE_GE_1200: article.image.width >= 1200 && article.image.height >= 675,
    MAX_IMAGE_PREVIEW_LARGE: true,
    HELPFUL_CONTENT: article.quality.pass && body.length >= 650,
    NON_CLICKBAIT_TITLE: !CLICKBAIT.test(article.h1),
    ORIGINAL_VALUE: article.quality.pass && article.duplicateScore < 0.66 && article.links.length > 0,
    MOBILE_TEMPLATE: true,
  };
}

export function readinessScore(checks: Record<DiscoverCheck, boolean>): number {
  const values = Object.values(checks);
  const ok = values.filter(Boolean).length;
  return Math.round((ok / values.length) * 100);
}
