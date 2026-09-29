import type { LeagueId, MatchInput } from "@/engine/types";
import { CITE_LEAGUES } from "@/engine/cite-public";
import { BLOG, CLUSTERS } from "@/lib/blog";
import { hubByLeague, LEAGUE_HUBS, teamPath } from "@/lib/programmatic";
import { matchPath } from "@/lib/seo";
import { PRONO_LEAGUES } from "@/lib/seo/money-map";

export type CoconLink = { href: string; anchor: string; rel: "parent" | "sister" | "child" };

export const COCON_MERES: { path: string; title: string; intent: string }[] = [
  { path: "/pronostics-sportifs", title: "Pronostics sportifs", intent: "prono" },
  { path: "/pronostics-football", title: "Pronostics football", intent: "prono" },
  { path: "/score-hunter", title: "Score Hunter", intent: "stats" },
  { path: "/statistics", title: "Statistiques", intent: "stats" },
  { path: "/scores-en-direct", title: "Scores en direct", intent: "score" },
  { path: "/resultats-football", title: "Résultats football", intent: "score" },
  { path: "/pronos-football", title: "Pronostics football", intent: "prono" },
  { path: "/opportunities", title: "Opportunités value", intent: "cote" },
  { path: "/pari-du-jour", title: "Pari du jour", intent: "conversion" },
  { path: "/meilleures-cotes", title: "Meilleures cotes", intent: "cote" },
  { path: "/paris-football", title: "Paris football", intent: "cote" },
  { path: "/comparer-cotes", title: "Comparer les cotes", intent: "cote" },
  { path: "/classement", title: "Classements", intent: "classement" },
  { path: "/calendrier", title: "Calendrier", intent: "calendrier" },
  { path: "/actu", title: "Actu football", intent: "actu" },
  { path: "/forum", title: "Forum agents", intent: "forum" },
  { path: "/blog", title: "Blog football", intent: "blog" },
];

export const COCON_PILIERS: { path: string; title: string }[] = [
  { path: "/blog/pronostic-football-gratuit", title: "Pronostic football gratuit" },
  { path: "/blog/meilleur-site-paris-sportif-en-ligne", title: "Meilleur site de paris sportifs" },
  { path: "/blog/xg-football-cest-quoi", title: "xG football" },
  { path: "/ligue-des-champions", title: "Pronostic Ligue des champions" },
  { path: "/ligue-europa", title: "Pronostic Ligue Europa" },
  { path: "/ligue-1", title: "Pronostic Ligue 1" },
];

const LEAGUE_BLOG: Partial<Record<LeagueId, { href: string; anchor: string }>> = {
  L1: { href: "/blog/pronostic-ligue-1-gratuit", anchor: "Pronostic Ligue 1 gratuit" },
  CL: { href: "/blog/pronostic-ligue-des-champions", anchor: "Pronostic Ligue des champions" },
  EL: { href: "/blog/pronostic-ligue-europa", anchor: "Pronostic Ligue Europa" },
  PL: { href: "/blog/pronostic-football-gratuit", anchor: "Pronostic football gratuit" },
};

export function leagueBlog(league: LeagueId): CoconLink | null {
  const row = LEAGUE_BLOG[league];
  return row ? { href: row.href, anchor: row.anchor, rel: "sister" } : null;
}

export function classementPath(league: LeagueId): string {
  const row = CITE_LEAGUES.find((l) => l.league === league);
  return row ? `/classement/${row.slug}` : "/classement";
}

export function calendrierPath(league: LeagueId): string {
  const row = CITE_LEAGUES.find((l) => l.league === league);
  return row ? `/calendrier/${row.slug}` : "/calendrier";
}

export function breadcrumbJsonLd(crumbs: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `https://betgpt.live${c.href === "/" ? "" : c.href}`,
    })),
  };
}

export function meshMatch(match: MatchInput, sisters: MatchInput[]): {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
} {
  const hub = hubByLeague(match.league);
  const slug = match.slug ?? match.id;
  const vs = `${match.home.name} – ${match.away.name}`;
  const sibMatches = sisters
    .filter((m) => m.league === match.league && m.id !== match.id)
    .slice(0, 4)
    .map((m) => ({
      href: matchPath(m),
      anchor:
        m.status === "live"
          ? `Score en direct ${m.home.name} – ${m.away.name}`
          : m.status === "finished"
            ? `Résultat ${m.home.name} – ${m.away.name}`
            : `Pronostic ${m.home.name} – ${m.away.name}`,
      rel: "sister" as const,
    }));
  const sisterHubs = LEAGUE_HUBS.filter((h) => h.league !== match.league)
    .slice(0, 2)
    .map((h) => ({ href: h.path, anchor: `Pronostic ${h.title}`, rel: "sister" as const }));
  const blog = leagueBlog(match.league);
  const pronoLeague = PRONO_LEAGUES.find((league) => league.league === match.league);
  return {
    crumbs: [
      { name: "BetGPT", href: "/" },
      { name: hub.title, href: hub.path },
      { name: vs, href: matchPath(match) },
    ],
    parent: { href: hub.path, anchor: `Pronostic et scores ${hub.title}`, rel: "parent" },
    sisters: [
      ...sibMatches,
      { href: classementPath(match.league), anchor: `Classement ${hub.title}`, rel: "sister" },
      { href: calendrierPath(match.league), anchor: `Calendrier ${hub.title}`, rel: "sister" },
      ...(blog ? [blog] : []),
      ...sisterHubs,
    ],
    children: [
      { href: "/pronostics-sportifs", anchor: "Pronostics sportifs", rel: "child" },
      { href: "/pronostics-football", anchor: "Pronostics football", rel: "child" },
      ...(pronoLeague
        ? [{ href: `/pronostics-football/${pronoLeague.slug}`, anchor: `Pronostics ${hub.title}`, rel: "child" as const }]
        : []),
      { href: "/pronostics-football/aujourdhui", anchor: "Pronostics du jour", rel: "child" },
      { href: "/rapports/precision", anchor: "Rapport de précision", rel: "child" },
      { href: `/cotes/${slug}`, anchor: `Cotes ${vs}`, rel: "child" },
      { href: `/forum/${slug}`, anchor: `Forum ${vs}`, rel: "child" },
      { href: teamPath(match.home.name), anchor: `Pronostic ${match.home.name}`, rel: "child" },
      { href: teamPath(match.away.name), anchor: `Pronostic ${match.away.name}`, rel: "child" },
      { href: "/pronos-football", anchor: "Tous les pronostics football", rel: "child" },
      { href: "/ledger", anchor: "Bilan vérifié BetGPT", rel: "child" },
      { href: "/score-hunter", anchor: "Score Hunter", rel: "child" },
      { href: "/statistics/most-common-scores", anchor: "Scores les plus fréquents", rel: "child" },
      { href: "/scores-en-direct", anchor: "Tous les scores en direct", rel: "child" },
      { href: "/opportunities", anchor: `Value bet ${hub.title}`, rel: "child" },
      { href: "/pari-du-jour", anchor: "Pari du jour football", rel: "child" },
    ],
  };
}

export function meshLeague(league: LeagueId, matches: MatchInput[]): {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
} {
  const hub = hubByLeague(league);
  const teams = new Map<string, string>();
  for (const m of matches) {
    teams.set(m.home.name, teamPath(m.home.name));
    teams.set(m.away.name, teamPath(m.away.name));
  }
  const blog = leagueBlog(league);
  return {
    crumbs: [
      { name: "BetGPT", href: "/" },
      { name: "Pronostics football", href: "/pronos-football" },
      { name: hub.title, href: hub.path },
    ],
    parent: { href: "/pronos-football", anchor: "Pronostics football du jour", rel: "parent" },
    sisters: [
      { href: "/scores-en-direct", anchor: `Scores en direct ${hub.title}`, rel: "sister" },
      { href: classementPath(league), anchor: `Classement ${hub.title}`, rel: "sister" },
      { href: calendrierPath(league), anchor: `Calendrier ${hub.title}`, rel: "sister" },
      { href: "/opportunities", anchor: `Value bets ${hub.title}`, rel: "sister" },
      { href: "/meilleures-cotes", anchor: `Meilleures cotes ${hub.title}`, rel: "sister" },
      ...(blog ? [blog] : []),
      ...LEAGUE_HUBS.filter((h) => h.league !== league)
        .slice(0, 3)
        .map((h) => ({ href: h.path, anchor: `Pronostic ${h.title}`, rel: "sister" as const })),
    ],
    children: [
      ...matches.slice(0, 6).map((m) => ({
        href: matchPath(m),
        anchor:
          m.status === "live"
            ? `Score ${m.home.name} – ${m.away.name} en direct`
            : `Pronostic ${m.home.name} – ${m.away.name}`,
        rel: "child" as const,
      })),
      ...[...teams.entries()].slice(0, 8).map(([name, href]) => ({
        href,
        anchor: `Analyse ${name}`,
        rel: "child" as const,
      })),
    ],
  };
}

export function meshHub(
  path: string,
  title: string,
  matches: MatchInput[],
  intent: "score" | "prono" | "cote",
): {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
} {
  const live = matches.filter((m) => m.status === "live");
  const leagues = [...new Set(matches.map((m) => m.league))];
  const pick = intent === "score" ? live.slice(0, 8) : matches.filter((m) => m.status !== "finished").slice(0, 8);
  return {
    crumbs: [
      { name: "BetGPT", href: "/" },
      { name: title, href: path },
    ],
    parent: { href: "/", anchor: "Scores, pronostics et classements", rel: "parent" },
    sisters: [
      ...COCON_MERES.filter((m) => m.path !== path).map((m) => ({
        href: m.path,
        anchor: m.title,
        rel: "sister" as const,
      })),
      ...COCON_PILIERS.filter((p) => p.path !== path).slice(0, 3).map((p) => ({
        href: p.path,
        anchor: p.title,
        rel: "sister" as const,
      })),
    ],
    children: [
      ...leagues.map((id) => {
        const h = hubByLeague(id);
        return {
          href: h.path,
          anchor: intent === "score" ? `Scores ${h.title}` : `Pronostic ${h.title}`,
          rel: "child" as const,
        };
      }),
      ...pick.map((m) => ({
        href: matchPath(m),
        anchor:
          m.status === "live"
            ? `Score en direct ${m.home.name} – ${m.away.name}`
            : `Pronostic ${m.home.name} – ${m.away.name}`,
        rel: "child" as const,
      })),
    ],
  };
}

export function meshTeam(
  name: string,
  league: LeagueId,
  matches: MatchInput[],
): {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
} {
  const hub = hubByLeague(league);
  const others = new Map<string, string>();
  for (const m of matches) {
    if (m.home.name !== name) others.set(m.home.name, teamPath(m.home.name));
    if (m.away.name !== name) others.set(m.away.name, teamPath(m.away.name));
  }
  const blog = leagueBlog(league);
  return {
    crumbs: [
      { name: "BetGPT", href: "/" },
      { name: hub.title, href: hub.path },
      { name, href: teamPath(name) },
    ],
    parent: { href: hub.path, anchor: `Pronostic ${hub.title}`, rel: "parent" },
    sisters: [
      { href: classementPath(league), anchor: `Classement ${hub.title}`, rel: "sister" },
      { href: calendrierPath(league), anchor: `Calendrier ${hub.title}`, rel: "sister" },
      { href: "/scores-en-direct", anchor: `Scores en direct ${name}`, rel: "sister" },
      { href: "/opportunities", anchor: `Value bet ${name}`, rel: "sister" },
      ...(blog ? [blog] : []),
      ...[...others.entries()].slice(0, 4).map(([n, href]) => ({
        href,
        anchor: `Pronostic ${n}`,
        rel: "sister" as const,
      })),
    ],
    children: matches.slice(0, 8).map((m) => ({
      href: matchPath(m),
      anchor: `Pronostic ${m.home.name} – ${m.away.name}`,
      rel: "child" as const,
    })),
  };
}

export function meshBlogArticle(slug: string, h1: string, cluster?: string, outbound: CoconLink[] = []): {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
} {
  const meta = cluster ? CLUSTERS[cluster] : undefined;
  const isChild = Boolean(meta && slug !== meta.pillar);
  const siblings = BLOG.filter((a) => a.slug !== slug && (!cluster || a.cluster === cluster)).slice(0, 8);
  const pillars = Object.values(CLUSTERS)
    .filter((c) => c.pillar !== slug && c.pillar !== meta?.pillar)
    .map((c) => ({ href: `/blog/${c.pillar}`, anchor: c.pillarH1, rel: "sister" as const }));
  return {
    crumbs: [
      { name: "BetGPT", href: "/" },
      { name: "Blog", href: "/blog" },
      ...(isChild && meta ? [{ name: meta.pillarH1, href: `/blog/${meta.pillar}` }] : []),
      { name: h1, href: `/blog/${slug}` },
    ],
    parent:
      isChild && meta
        ? { href: `/blog/${meta.pillar}`, anchor: meta.pillarH1, rel: "parent" }
        : { href: "/blog", anchor: "Blog football BetGPT", rel: "parent" },
    sisters: [
      ...siblings.map((x) => ({ href: `/blog/${x.slug}`, anchor: x.h1, rel: "sister" as const })),
      ...pillars,
    ],
    children: [
      ...outbound,
      { href: "/opportunities", anchor: "Opportunités value du jour", rel: "child" },
      { href: "/pari-du-jour", anchor: "Pari du jour", rel: "child" },
      { href: "/pronos-football", anchor: "Pronostics football", rel: "child" },
    ],
  };
}
