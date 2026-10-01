import { CITE_LEAGUES } from "@/engine/cite-public";
import { ensureLive } from "@/engine/live";
import { archiveSlug, loadArchiveHistory } from "@/engine/archive";
import { loadTickets, stablePublicEvidenceTickets } from "@/engine/ticket-log";
import { HUNTER_SCENARIOS } from "@/engine/hunter";
import { LEAGUE_FR, LEAGUE_SLUG } from "@/engine/stats";
import { BLOG } from "@/lib/blog";
import { blogCover, blogInline } from "@/lib/blog-rich";
import { BRAND_LOGO, BRAND_OG, absImg, crestSeo } from "@/lib/image-seo";
import { LEAGUE_HUBS, SITE_URL, teamPath } from "@/lib/programmatic";
import { sitemapDate } from "@/lib/sitemap-metadata";
import { GEO_PAGES } from "@/lib/geo/entity";
import { moneySitemapPaths } from "@/lib/seo/money-map";
import { fixtureIndexable, sitemapAllowed } from "@/lib/geo/quality";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { SERP_COMPETITIONS } from "@/lib/serp/leagues";
import { loadResultsBoardData } from "@/lib/serp/results.functions";
import { bucketResults } from "@/lib/serp/results";
import { parisDay, parisOffsetDay } from "@/lib/seo/money-map";
import type { MatchInput } from "@/engine/types";
import { buildEdition } from "@/lib/editorial/engine";
import { readLedgerDurable } from "@/lib/editorial/ledger-store";
import { classicNewsPaths, renderNewsSitemap } from "@/lib/editorial/feed";
import { ASTRA_SELF_HEAL_SITEMAP_ROUTES } from "@/lib/seo/astra-self-heal-sitemap";

export type SitemapImage = { loc: string; title?: string; caption?: string };
export type SitemapUrl = {
  loc: string;
  path: string;
  title: string;
  group: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  image?: string;
  imageTitle?: string;
  images?: SitemapImage[];
};

function brandOg(): SitemapImage {
  return { loc: absImg(BRAND_OG.src), title: BRAND_OG.title, caption: BRAND_OG.description };
}

function brandLogo(): SitemapImage {
  return { loc: absImg(BRAND_LOGO.src), title: BRAND_LOGO.title, caption: BRAND_LOGO.description };
}

function crestImg(name: string, competition?: string): SitemapImage | null {
  const seo = crestSeo(name, { competition });
  if (!seo.src) return null;
  return { loc: seo.src, title: seo.title, caption: seo.description };
}

export async function loadSitemapUrls(): Promise<SitemapUrl[]> {
  const live = await ensureLive().catch(() => null);
  const liveMatches = live?.matches ?? [];
  const seen = new Set(liveMatches.map((m: { id: string }) => m.id));
  const tickets = loadTickets();
  const ticketIds = new Set(tickets.map((t) => t.matchId));
  const extra = loadArchiveHistory()
    .filter((h) => ticketIds.has(h.id) && !seen.has(h.id))
    .map((h) => ({
      id: h.id,
      slug: archiveSlug(h),
      status: "finished" as const,
      kickoff: h.kickoff,
      league: h.league,
      home: { name: h.homeName, id: h.homeId },
      away: { name: h.awayName, id: h.awayId },
      scoreHome: h.goalsHome,
      scoreAway: h.goalsAway,
    }));
  let urls = buildSitemapUrls({
    matches: [...liveMatches, ...extra],
    asOf: sitemapDate(live?.fetchedAt),
    standingsAsOf: sitemapDate(live?.fetchedAt),
  });

  // Result leaf pages must use the exact same evidence as their public loaders.
  // If that evidence is unavailable or empty, fail closed by omitting the leaf
  // from the sitemap rather than publishing a sitemap URL that renders noindex.
  const resultLeafPaths = new Set<string>();
  try {
    const resultBoard = await loadResultsBoardData();
    for (const comp of SERP_COMPETITIONS) {
      if (resultBoard.rows.some((row) => row.league === comp.league)) {
        resultLeafPaths.add(comp.resultsPath);
      }
    }
    const buckets = bucketResults(resultBoard.rows);
    if (buckets.today.length) resultLeafPaths.add("/resultats-football/aujourdhui");
    if (buckets.yesterday.length) resultLeafPaths.add("/resultats-football/hier");
  } catch {
    // Fail closed: only the result hub remains in the sitemap.
  }
  urls = urls.filter(
    (url) =>
      url.path === "/resultats-football" ||
      !url.path.startsWith("/resultats-football/") ||
      resultLeafPaths.has(url.path),
  );
  const edition = buildEdition({ now: new Date(), matches: liveMatches as MatchInput[], frozen: await readLedgerDurable() });
  for (const row of stablePublicEvidenceTickets(tickets)) {
    if (!row.id || !row.home || !row.away || !row.recordedAt) continue;
    const encoded = encodeURIComponent(row.id);
    const path = `/prediction/${encoded}`;
    if (!sitemapAllowed(path) || urls.some((url) => url.path === path)) continue;
    urls.push({
      loc: `${SITE_URL}${path}`,
      path,
      title: `Vérification pronostic · ${row.home} – ${row.away}`,
      group: "Preuves",
      lastmod: sitemapDate(row.recordedAt),
      changefreq: row.result ? "weekly" : "hourly",
      priority: row.result ? "0.55" : "0.65",
    });
  }
  for (const page of classicNewsPaths(edition)) {
    if (!sitemapAllowed(page.path)) continue;
    if (urls.some((url) => url.path === page.path)) continue;
    urls.push({
      loc: `${SITE_URL}${page.path}`,
      path: page.path,
      title: page.title,
      group: "Actualités",
      lastmod: page.lastmod,
      changefreq: "hourly",
      priority: page.path === "/actualites" ? "0.8" : "0.7",
      image: page.image,
    });
  }
  return urls;
}

export function buildSitemapUrls(input: {
  matches: {
    slug?: string;
    id: string;
    status?: string;
    kickoff?: string;
    league?: string;
    home?: { name: string; id?: string; logo?: string; short?: string; league?: string };
    away?: { name: string; id?: string; logo?: string; short?: string; league?: string };
    scoreHome?: number;
    scoreAway?: number;
  }[];
  asOf?: string;
  standingsAsOf?: string;
}): SitemapUrl[] {
  const now = sitemapDate(input.asOf);
  const standings = sitemapDate(input.standingsAsOf) || now;
  const today = new Date().toISOString().slice(0, 10);
  const teams = new Set<string>();
  for (const m of input.matches) {
    if (m.home?.name) teams.add(m.home.name);
    if (m.away?.name) teams.add(m.away.name);
  }
  const out: SitemapUrl[] = [
    { loc: SITE_URL, path: "/", title: "Bureau BetGPT", group: "Hubs", lastmod: now, changefreq: "always", priority: "1.0", images: [brandOg(), brandLogo()] },
    { loc: `${SITE_URL}/actu`, path: "/actu", title: "Actu football", group: "Hubs", lastmod: now, changefreq: "always", priority: "1.0" },
    { loc: `${SITE_URL}/about`, path: "/about", title: "À propos de BetGPT", group: "Confiance", lastmod: "", changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/auteurs/betgpt-editorial`, path: "/auteurs/betgpt-editorial", title: "BetGPT Editorial", group: "Actualités", lastmod: "", changefreq: "monthly", priority: "0.4" },
    { loc: `${SITE_URL}/changelog`, path: "/changelog", title: "Changelog BetGPT", group: "Confiance", lastmod: "", changefreq: "weekly", priority: "0.4" },
    { loc: `${SITE_URL}/comparer-cotes`, path: "/comparer-cotes", title: "Comparer les cotes football", group: "Conversion", lastmod: now, changefreq: "hourly", priority: "0.85" },
    { loc: `${SITE_URL}/data-sources`, path: "/data-sources", title: "Sources des données BetGPT", group: "Confiance", lastmod: "", changefreq: "monthly", priority: "0.6" },
    { loc: `${SITE_URL}/editorial-policy`, path: "/editorial-policy", title: "Politique éditoriale BetGPT", group: "Confiance", lastmod: "", changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/methodology`, path: "/methodology", title: "Méthodologie BetGPT", group: "Preuves", lastmod: "", changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE_URL}/prediction-history`, path: "/prediction-history", title: "Historique des prédictions", group: "Preuves", lastmod: now, changefreq: "daily", priority: "0.7" },
    { loc: `${SITE_URL}/press`, path: "/press", title: "Presse BetGPT", group: "Confiance", lastmod: "", changefreq: "monthly", priority: "0.4" },
    { loc: `${SITE_URL}/score-data-methodology`, path: "/score-data-methodology", title: "Méthodologie des scores et résultats", group: "Preuves", lastmod: "", changefreq: "monthly", priority: "0.6" },
    { loc: `${SITE_URL}/forum`, path: "/forum", title: "Forum agents", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.8" },
    { loc: `${SITE_URL}/blog`, path: "/blog", title: "Blog football", group: "Hubs", lastmod: now, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE_URL}/actu/${today}`, path: `/actu/${today}`, title: `Édition du ${today}`, group: "Hubs", lastmod: now, changefreq: "always", priority: "0.95" },
    { loc: `${SITE_URL}/scores-en-direct`, path: "/scores-en-direct", title: "Scores en direct", group: "Hubs", lastmod: now, changefreq: "always", priority: "1.0" },
    { loc: `${SITE_URL}/resultats-football`, path: "/resultats-football", title: "Résultats football", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}/pronos-football`, path: "/pronos-football", title: "Pronos football", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}/opportunities`, path: "/opportunities", title: "Value bets", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.85" },
    { loc: `${SITE_URL}/pari-du-jour`, path: "/pari-du-jour", title: "Pari du jour", group: "Conversion", lastmod: now, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}/meilleures-cotes`, path: "/meilleures-cotes", title: "Meilleures cotes", group: "Conversion", lastmod: now, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}/pari-en-direct`, path: "/pari-en-direct", title: "Pari en direct", group: "Conversion", lastmod: now, changefreq: "always", priority: "0.95" },
    { loc: `${SITE_URL}/ledger`, path: "/ledger", title: "Bilan vérifié", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE_URL}/rapports/precision`, path: "/rapports/precision", title: "Précision des pronostics football", group: "Preuves", lastmod: now, changefreq: "daily", priority: "0.8" },
    { loc: `${SITE_URL}/calculateur-mise`, path: "/calculateur-mise", title: "Calculateur de mise", group: "Conversion", lastmod: now, changefreq: "daily", priority: "0.7" },
    { loc: `${SITE_URL}/paris-football`, path: "/paris-football", title: "Paris football", group: "Hubs", lastmod: now, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE_URL}/classement`, path: "/classement", title: "Classement football", group: "Classements", lastmod: standings, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE_URL}/calendrier`, path: "/calendrier", title: "Calendrier football", group: "Calendriers", lastmod: now, changefreq: "hourly", priority: "0.9" },
    { loc: `${SITE_URL}/redaction`, path: "/redaction", title: "Rédaction", group: "Site", lastmod: now, changefreq: "monthly", priority: "0.3" },
    { loc: `${SITE_URL}/contact`, path: "/contact", title: "Contact", group: "Site", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/mentions-legales`, path: "/mentions-legales", title: "Mentions légales", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/cgu`, path: "/cgu", title: "CGU", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/confidentialite`, path: "/confidentialite", title: "Confidentialité", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/cookies`, path: "/cookies", title: "Cookies", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/jeu-responsable`, path: "/jeu-responsable", title: "Jeu responsable", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE_URL}/politique-publicite`, path: "/politique-publicite", title: "Politique publicitaire", group: "Légal", lastmod: now, changefreq: "yearly", priority: "0.2" },
    { loc: `${SITE_URL}/score-hunter`, path: "/score-hunter", title: "Score Hunter", group: "Hunter", lastmod: now, changefreq: "hourly", priority: "0.95" },
    { loc: `${SITE_URL}/statistics`, path: "/statistics", title: "Statistiques football", group: "Stats", lastmod: now, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE_URL}/statistics/most-common-scores`, path: "/statistics/most-common-scores", title: "Scores les plus fréquents", group: "Stats", lastmod: now, changefreq: "daily", priority: "0.85" },
    { loc: `${SITE_URL}/statistics/leagues/lowest-0-0`, path: "/statistics/leagues/lowest-0-0", title: "Ligues les moins 0-0", group: "Stats", lastmod: now, changefreq: "weekly", priority: "0.8" },
    { loc: `${SITE_URL}/statistics/leagues/highest-0-0`, path: "/statistics/leagues/highest-0-0", title: "Ligues les plus 0-0", group: "Stats", lastmod: now, changefreq: "weekly", priority: "0.8" },
    { loc: `${SITE_URL}/sitemap`, path: "/sitemap", title: "Plan du site", group: "Site", lastmod: now, changefreq: "hourly", priority: "0.4" },
  ];
  for (const page of ASTRA_SELF_HEAL_SITEMAP_ROUTES) {
    out.push({
      loc: `${SITE_URL}${page.path}`,
      path: page.path,
      title: page.title,
      group: page.group,
      lastmod: "",
      changefreq: page.changefreq,
      priority: page.priority,
    });
  }
  for (const page of moneySitemapPaths(input.matches)) {
    out.push({
      loc: `${SITE_URL}${page.path}`,
      path: page.path,
      title: page.title,
      group: "Pronostics",
      lastmod: now,
      changefreq: "hourly",
      priority: page.path === "/pronostics-sportifs" ? "0.95" : "0.8",
    });
  }
  for (const page of GEO_PAGES) {
    if (!page.indexable || !sitemapAllowed(page.path)) continue;
    out.push({
      loc: `${SITE_URL}${page.path}`,
      path: page.path,
      title: page.h1,
      group: "Entité",
      lastmod: page.updated,
      changefreq: "monthly",
      priority: "0.55",
    });
  }
  for (const a of BLOG) {
    const cover = blogCover(a);
    const inline = blogInline(a);
    out.push({
      loc: `${SITE_URL}/blog/${a.slug}`,
      path: `/blog/${a.slug}`,
      title: a.h1,
      group: "Blog",
      lastmod: a.published,
      changefreq: "weekly",
      priority: "0.8",
      image: `${SITE_URL}${cover.src}`,
      imageTitle: cover.alt,
      images: [
        { loc: `${SITE_URL}${cover.src}`, title: cover.title, caption: cover.description },
        { loc: `${SITE_URL}${inline.src}`, title: inline.title, caption: inline.description },
      ],
    });
  }
  for (const h of LEAGUE_HUBS) {
    out.push({ loc: `${SITE_URL}${h.path}`, path: h.path, title: h.title, group: "Compétitions", lastmod: now, changefreq: "hourly", priority: "0.9" });
  }
  for (const sc of HUNTER_SCENARIOS) {
    out.push({
      loc: `${SITE_URL}/score-hunter/${sc.slug}`,
      path: `/score-hunter/${sc.slug}`,
      title: sc.label,
      group: "Hunter",
      lastmod: now,
      changefreq: "hourly",
      priority: "0.8",
    });
  }
  for (const id of Object.keys(LEAGUE_SLUG) as (keyof typeof LEAGUE_SLUG)[]) {
    const slug = LEAGUE_SLUG[id];
    out.push({
      loc: `${SITE_URL}/statistics/${slug}/most-common-scores`,
      path: `/statistics/${slug}/most-common-scores`,
      title: `Scores fréquents ${LEAGUE_FR[id]}`,
      group: "Stats",
      lastmod: now,
      changefreq: "weekly",
      priority: "0.75",
    });
  }
  for (const l of CITE_LEAGUES) {
    out.push({ loc: `${SITE_URL}/classement/${l.slug}`, path: `/classement/${l.slug}`, title: `Classement ${l.title}`, group: "Classements", lastmod: standings, changefreq: "hourly", priority: "0.8" });
    out.push({ loc: `${SITE_URL}/calendrier/${l.slug}`, path: `/calendrier/${l.slug}`, title: `Calendrier ${l.title}`, group: "Calendriers", lastmod: now, changefreq: "hourly", priority: "0.8" });
  }
  for (const name of teams) {
    const crest = crestImg(name);
    out.push({
      loc: `${SITE_URL}${teamPath(name)}`,
      path: teamPath(name),
      title: name,
      group: "Équipes",
      lastmod: now,
      changefreq: "hourly",
      priority: "0.6",
      images: crest ? [crest] : [brandOg()],
    });
  }
  for (const m of input.matches) {
    if (!fixtureIndexable({ home: m.home, away: m.away, kickoff: m.kickoff }).index) continue;
    const slug = m.slug ?? m.id;
    const live = m.status === "live";
    const done = m.status === "finished";
    const title = m.home?.name && m.away?.name ? `${m.home.name} – ${m.away.name}` : slug;
    const crests = [m.home?.name ? crestImg(m.home.name) : null, m.away?.name ? crestImg(m.away.name) : null].filter(
      (x): x is SitemapImage => Boolean(x),
    );
    out.push({
      loc: `${SITE_URL}/match/${slug}`,
      path: `/match/${slug}`,
      title,
      group: "Matchs",
      lastmod: now,
      changefreq: live ? "always" : "hourly",
      priority: live ? "1.0" : done ? "0.85" : "0.8",
      images: crests.length ? crests : [brandOg()],
    });
    const frenchEurope =
      (m.league === "CL" || m.league === "EL") &&
      m.home?.name &&
      m.away?.name &&
      skipEuropeFrenchProno({
        league: m.league,
        home: m.home,
        away: m.away,
      });
    if (!frenchEurope) {
      out.push({
        loc: `${SITE_URL}/forum/${slug}`,
        path: `/forum/${slug}`,
        title: `${title} : table ronde, pronostic et analyse`,
        group: "Forum",
        lastmod: now,
        changefreq: live ? "always" : "hourly",
        priority: live ? "0.9" : "0.7",
      });
    }
    if (!done) {
      out.push({
        loc: `${SITE_URL}/cotes/${slug}`,
        path: `/cotes/${slug}`,
        title: `Cote ${title}`,
        group: "Cotes",
        lastmod: now,
        changefreq: "hourly",
        priority: "0.75",
      });
    }
  }
  for (const comp of SERP_COMPETITIONS) {
    const rows = input.matches.filter((m) => m.league === comp.league && m.home?.name && m.away?.name);
    if (!rows.length) continue;
    out.push({
      loc: `${SITE_URL}${comp.scoresPath}`,
      path: comp.scoresPath,
      title: `Scores en direct ${comp.title}`,
      group: "Scores",
      lastmod: now,
      changefreq: "always",
      priority: "0.9",
    });
    if (rows.some((m) => m.status === "finished")) {
      out.push({
        loc: `${SITE_URL}${comp.resultsPath}`,
        path: comp.resultsPath,
        title: `Résultats ${comp.title}`,
        group: "Résultats",
        lastmod: now,
        changefreq: "hourly",
        priority: "0.85",
      });
    }
  }
  const days = new Set(input.matches.map((m) => (m.kickoff ? parisDay(m.kickoff) : "")).filter(Boolean));
  if (days.has(parisOffsetDay(0))) {
    out.push({
      loc: `${SITE_URL}/pronostics-football/aujourdhui`,
      path: "/pronostics-football/aujourdhui",
      title: "Pronostics football aujourd’hui",
      group: "Pronostics",
      lastmod: now,
      changefreq: "hourly",
      priority: "0.9",
    });
  }
  if (days.has(parisOffsetDay(1))) {
    out.push({
      loc: `${SITE_URL}/pronostics-football/demain`,
      path: "/pronostics-football/demain",
      title: "Pronostics football demain",
      group: "Pronostics",
      lastmod: now,
      changefreq: "hourly",
      priority: "0.85",
    });
  }
  if (days.has(parisOffsetDay(0))) {
    out.push({
      loc: `${SITE_URL}/resultats-football/aujourdhui`,
      path: "/resultats-football/aujourdhui",
      title: "Résultats football aujourd’hui",
      group: "Résultats",
      lastmod: now,
      changefreq: "hourly",
      priority: "0.8",
    });
  }
  if (days.has(parisOffsetDay(-1))) {
    out.push({
      loc: `${SITE_URL}/resultats-football/hier`,
      path: "/resultats-football/hier",
      title: "Résultats football hier",
      group: "Résultats",
      lastmod: now,
      changefreq: "daily",
      priority: "0.7",
    });
  }
  // Static pages have no recorded modification date; snapshot refreshes do not
  // mean their editorial content changed. Canonical URLs appear only once.
  const unique = new Map<string, SitemapUrl>();
  for (const url of out) {
    if (["Site", "Légal"].includes(url.group)) url.lastmod = "";
    url.lastmod = sitemapDate(url.lastmod);
    if (!sitemapAllowed(url.path)) continue;
    if (!unique.has(url.loc)) unique.set(url.loc, url);
  }
  return [...unique.values()];
}

export function sitemapXml(urls: SitemapUrl[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map((u) => {
    const imgs = collectImages(u);
    const imgXml = imgs
      .map(
        (im) => `
    <image:image>
      <image:loc>${escXml(im.loc)}</image:loc>
      ${im.title ? `<image:title>${escXml(im.title)}</image:title>` : ""}
      ${im.caption ? `<image:caption>${escXml(im.caption)}</image:caption>` : ""}
    </image:image>`,
      )
      .join("");
    return `  <url>
    <loc>${escXml(u.loc)}</loc>
    ${sitemapDate(u.lastmod) ? `<lastmod>${escXml(sitemapDate(u.lastmod))}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${imgXml}
  </url>`;
  })
  .join("\n")}
</urlset>
`;
}

function collectImages(u: SitemapUrl): SitemapImage[] {
  const seen = new Set<string>();
  const out: SitemapImage[] = [];
  const add = (im?: SitemapImage | null) => {
    if (!im?.loc || seen.has(im.loc)) return;
    seen.add(im.loc);
    out.push(im);
  };
  if (u.image) add({ loc: u.image, title: u.imageTitle });
  for (const im of u.images ?? []) add(im);
  return out;
}

export function sitemapImagesXml(urls: SitemapUrl[]): string {
  const withImg = urls.filter((u) => collectImages(u).length > 0);
  return sitemapXml(withImg);
}

/** Google News accepts only genuinely recent articles (normally the last 48h). */
export function newsSitemapXml(
  now = Date.now(),
  extra: { loc: string; title: string; published: string; keywords: string; image?: string; imageTitle?: string }[] = [],
): string {
  const cutoff = now - 48 * 60 * 60 * 1000;
  const blogUrls = BLOG.filter((a) => {
    const published = Date.parse(a.published);
    return a.isNews === true && Number.isFinite(published) && published >= cutoff && published <= now;
  }).map((a) => {
    const cover = blogCover(a);
    return {
      loc: `${SITE_URL}/blog/${a.slug}`,
      title: a.h1,
      published: a.published,
      keywords: a.keywords,
      image: `${SITE_URL}${cover.src}`,
      imageTitle: cover.alt,
    };
  });
  const seen = new Set<string>();
  const urls = [...blogUrls, ...extra].filter((item) => {
    const published = Date.parse(item.published);
    if (!Number.isFinite(published) || published < cutoff || published > now + 60_000) return false;
    if (seen.has(item.loc)) return false;
    seen.add(item.loc);
    return true;
  });
  return renderNewsSitemap(urls);
}

function escXml(s: string): string {
  return s.replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;").replace(/"/g, "\u0026quot;");
}

export function sitemapHtml(urls: SitemapUrl[]): string {
  const groups = new Map<string, SitemapUrl[]>();
  for (const u of urls) {
    const g = groups.get(u.group) ?? [];
    g.push(u);
    groups.set(u.group, g);
  }
  const sections = [...groups.entries()]
    .map(([name, list]) => {
      const items = list
    .map((u) => `      <li><a href="${esc(u.loc)}">${esc(u.title)}</a> — <code>${esc(u.path)}</code></li>`)
        .join("\n");
      return `    <h2>${esc(name)}</h2>\n    <ul>\n${items}\n    </ul>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Plan du site — BetGPT (betgpt.live)</title>
  <meta name="description" content="Sitemap HTML BetGPT. Toutes les pages scores, pronos, classements, calendriers, matchs."/>
  <link rel="canonical" href="${SITE_URL}/sitemap"/>
  <style>
    body{font:16px/1.5 system-ui,sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}
    a{color:#0a7}
    code{font-size:12px;color:#666}
    h1{font-size:1.6rem}
    h2{margin-top:2rem;font-size:1.15rem}
  </style>
</head>
<body>
  <h1>Plan du site BetGPT</h1>
  <p>Publication <strong>https://betgpt.live</strong>. XML : <a href="${SITE_URL}/sitemap.xml">sitemap.xml</a> · Images : <a href="${SITE_URL}/sitemap-images.xml">sitemap-images.xml</a> · News : <a href="${SITE_URL}/news-sitemap.xml">news-sitemap.xml</a>.</p>
${sections}
</body>
</html>
`;
}

function esc(s: string): string {
  return s.replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;").replace(/"/g, "\u0026quot;");
}
