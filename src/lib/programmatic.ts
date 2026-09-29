import type { LeagueId } from "@/engine/types";

export const SITE_URL = "https://betgpt.live";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export const LEAGUE_HUBS: {
  league: LeagueId;
  path: string;
  title: string;
  queries: string;
}[] = [
  { league: "L1", path: "/ligue-1", title: "Ligue 1", queries: "pronostic Ligue 1, score Ligue 1, analyse Ligue 1" },
  { league: "PL", path: "/premier-league", title: "Premier League", queries: "pronostic Premier League, score Premier League" },
  { league: "LL", path: "/la-liga", title: "La Liga", queries: "pronostic Liga, score Liga" },
  { league: "BL", path: "/bundesliga", title: "Bundesliga", queries: "pronostic Bundesliga, score Bundesliga" },
  { league: "SA", path: "/serie-a", title: "Serie A", queries: "pronostic Serie A, score Serie A" },
  { league: "ER", path: "/scores-en-direct", title: "Eredivisie", queries: "pronostic Eredivisie, score Eredivisie" },
  { league: "PT", path: "/scores-en-direct", title: "Primeira Liga", queries: "pronostic Primeira Liga, score Liga Portugal" },
  { league: "SC", path: "/scores-en-direct", title: "Premiership écossaise", queries: "pronostic Premiership écossaise, score Ecosse" },
  { league: "TR", path: "/scores-en-direct", title: "Süper Lig", queries: "pronostic Süper Lig, score Turquie" },
  { league: "CL", path: "/ligue-des-champions", title: "Ligue des champions", queries: "pronostic Ligue des champions, score C1" },
  { league: "EL", path: "/ligue-europa", title: "Ligue Europa", queries: "pronostic Ligue Europa, score Europa League" },
  { league: "NL", path: "/calendrier/ligue-des-nations", title: "Ligue des nations", queries: "pronostic Ligue des nations, qualifs CAN" },
];

export function hubByLeague(league: LeagueId) {
  return LEAGUE_HUBS.find((h) => h.league === league) ?? LEAGUE_HUBS[0]!;
}

export function teamPath(name: string): string {
  return `/equipe/${slugify(name)}`;
}

export function itemListJsonLd(name: string, url: string, items: { name: string; url: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    url,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

export function collectionJsonLd(name: string, url: string, description: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    description,
    isPartOf: { "@type": "WebSite", name: "BetGPT", url: SITE_URL },
    inLanguage: "fr-FR",
  };
}

export function leagueHead(path: string, title: string) {
  const url = `${SITE_URL}${path}`;
  const full = `${title} : pronostic, analyse et score en direct | BetGPT`;
  const desc = `${title} — pronostic et analyse de chaque match, score en direct, cotes FR. ${title} ce week-end.`;
  return {
    meta: [
      { title: full },
      { name: "description", content: desc },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: full },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg` },
      { property: "og:image:alt", content: "BetGPT — bureau de pronostics football, cotes France et scores en direct" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: `${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg` },
      { name: "twitter:image:alt", content: "BetGPT — bureau de pronostics football, cotes France et scores en direct" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
