import type { EditorialArticle, EditorialImage } from "@/lib/editorial/types";

const INTERNAL_IMAGE_COPY =
  /(?:libre de droits|unsplash|pexels|recadr(?:ée|e|é)?|bibliothèque betgpt|photo d[’']illustration|ce n[’']est pas une photo|n[’']illustre pas une (?:action|scène)|format discover\s*1200[×x]675)/i;

const TEAM_FR: Record<string, string> = {
  Italy: "Italie",
  Germany: "Allemagne",
  Netherlands: "Pays-Bas",
  Denmark: "Danemark",
  Greece: "Grèce",
  Serbia: "Serbie",
  Slovakia: "Slovaquie",
  Wales: "Pays de Galles",
  Norway: "Norvège",
  Azerbaijan: "Azerbaïdjan",
  "Faroe Islands": "Îles Féroé",
};

const COMPETITION_FR: Record<string, string> = {
  "UEFA Nations League": "Ligue des nations de l’UEFA",
};

function publicTeamName(value: string): string {
  return TEAM_FR[value] ?? value;
}

function publicCompetitionName(value: string): string {
  return COMPETITION_FR[value] ?? value;
}

export function cleanPublicImageAlt(value: string): string {
  const cleaned = String(value || "")
    .replace(/,?\s*photo d[’']illustration(?: libre de droits)?/gi, "")
    .replace(/,?\s*photo libre de droits/gi, "")
    .replace(/\s*\((?:Unsplash|Pexels)(?:\s*(?:\/|ou)\s*(?:Unsplash|Pexels))?\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();

  return cleaned || "Football : actualités et analyses sur BetGPT";
}

export function editorialImageCaption(article: EditorialArticle): string {
  const teams = article.teams.filter(Boolean).slice(0, 2).map(publicTeamName);
  const competition = publicCompetitionName(String(article.competition || "").trim());

  if (teams.length >= 2 && competition) {
    return `${teams[0]} – ${teams[1]} en ${competition} : informations, contexte et analyse du match.`;
  }
  if (teams.length >= 2) {
    return `${teams[0]} – ${teams[1]} : actualité, contexte et analyse du match.`;
  }
  if (teams.length === 1 && competition) {
    return `${teams[0]} en ${competition} : actualités, contexte et analyse football.`;
  }
  if (teams.length === 1) {
    return `${teams[0]} : actualités, contexte et analyse football.`;
  }

  return `${article.h1} — actualité et analyse football sur BetGPT.`;
}

export function publicEditorialImageCopy(
  article: EditorialArticle,
  image: EditorialImage = article.image,
): { alt: string; caption: string } {
  const alt = cleanPublicImageAlt(image.alt);
  return {
    alt,
    caption: editorialImageCaption(article),
  };
}

export function containsInternalImageCopy(value: string): boolean {
  return INTERNAL_IMAGE_COPY.test(String(value || ""));
}
