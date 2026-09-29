import type { LeagueId, MatchInput, PredictionRecord } from "@/engine/types";
import { articlePlainText, compileArticle } from "@/engine/article";
import { marketHits } from "@/engine/settle";
import { BRAND_HERO, BRAND_LOGO, BRAND_OG, crestSeo, imageHeadTags, imageObjectLd } from "@/lib/image-seo";
import { betMarket, headlineMarket, pronoVsStake } from "@/lib/markets";
import { hubByLeague, SITE_URL, slugify, teamPath } from "@/lib/programmatic";
import { fixtureIndexable } from "@/lib/geo/quality";
import { fmtOdds } from "@/lib/utils";
import { answerFirst, serpDescription, serpTitle } from "@/lib/serp/answer";
import { competitionByLeague } from "@/lib/serp/leagues";
import { hasScore, strictStatus } from "@/lib/serp/status";
import { liveBroadcastLd, videoObjectLd, videoRelevance, type CuratedVideo } from "@/lib/serp/video";
import { ld } from "@/lib/ld";

export { SITE_URL, slugify };

/** Only actual, non-future timestamps may be exposed as publication dates. */
function knownStamp(iso?: string): string | undefined {
  const ms = Date.parse(iso ?? "");
  return Number.isFinite(ms) && ms <= Date.now() ? new Date(ms).toISOString() : undefined;
}

export function competitionPath(league: LeagueId): string {
  return hubByLeague(league).path;
}

export function matchSlug(match: { home: { name: string }; away: { name: string }; kickoff: string; id: string }): string {
  const day = match.kickoff.slice(0, 10);
  return `${slugify(match.home.name)}-${slugify(match.away.name)}-${day}`;
}

export function matchPath(match: { slug?: string; id: string }): string {
  return `/match/${match.slug ?? match.id}`;
}

export function scoreLine(match: MatchInput): string | null {
  if (match.scoreHome == null || match.scoreAway == null) return null;
  if (match.status !== "live" && match.status !== "finished") return null;
  return `${match.scoreHome}–${match.scoreAway}`;
}

function marketPhrase(
  match: MatchInput,
  pick: ReturnType<typeof headlineMarket>,
): { label: string; odds: string; book: string; pct: number } {
  const label =
    pick.market === "1X2_H"
      ? `victoire de ${match.home.name}`
      : pick.market === "1X2_A"
        ? `victoire de ${match.away.name}`
        : pick.market === "1X2_D"
          ? `match nul`
          : pick.label;
  return {
    label,
    odds: fmtOdds(pick.bestOdds),
    book: pick.bestBook.replace(/\s·\s.*$/, ""),
    pct: Math.round(pick.modelProb * 100),
  };
}

function pickPhrase(match: MatchInput, prediction?: PredictionRecord): { label: string; odds: string; book: string; pct: number } | null {
  if (!prediction) return null;
  const pick = betMarket(prediction.markets);
  if (!pick?.listed || pick.bestOdds < 1.8) return null;
  return marketPhrase(match, pick);
}

function stakePhrase(match: MatchInput, prediction?: PredictionRecord): string {
  if (!prediction) return "";
  const { prono, stake, split } = pronoVsStake(prediction.markets);
  if (!split || !stake || !stake.listed || stake.bestOdds < 1.8) return "";
  const s = marketPhrase(match, stake);
  const p = marketPhrase(match, prono);
  return ` Mise value distincte du pronostic : ${s.label} (${s.pct} %, cote ${s.odds} chez ${s.book}). Ce n’est pas le résultat le plus probable (${p.label} ${p.pct} %).`;
}

export function scorersLine(match: MatchInput): string {
  const goals = (match.incidents ?? []).filter((i) => i.kind === "goal" || i.kind === "penalty" || i.kind === "own_goal");
  if (!goals.length) return "";
  const fmt = (side: "home" | "away") =>
    goals
      .filter((g) => g.side === side)
      .map((g) => `${g.player}${g.minute ? ` ${g.minute}` : ""}`)
      .join(", ");
  const h = fmt("home");
  const a = fmt("away");
  const bits: string[] = [];
  if (h) bits.push(`${match.home.name} : ${h}`);
  if (a) bits.push(`${match.away.name} : ${a}`);
  return bits.length ? `Buteurs : ${bits.join(" · ")}.` : "";
}

export function liveRecap(match: MatchInput): string {
  const vs = `${match.home.name} – ${match.away.name}`;
  const score = scoreLine(match) ?? `${match.scoreHome ?? 0}–${match.scoreAway ?? 0}`;
  const clock = match.clock ? ` (${match.clock})` : "";
  const prefix =
    match.status === "live"
      ? `Résumé en direct ${vs} : ${score}${clock}.`
      : `Résumé ${vs} : score final ${score}.`;
  const scorers = scorersLine(match);
  const last = [...(match.incidents ?? [])].reverse().find((i) => i.kind === "goal" || i.kind === "penalty" || i.kind === "own_goal" || i.kind === "red");
  const lastTxt = last
    ? ` Dernière action : ${last.label} ${last.player}${last.minute ? ` ${last.minute}` : ""}.`
    : "";
  return `${prefix} ${scorers}${lastTxt}`.replace(/\s+/g, " ").trim();
}

export function featuredAnswer(match: MatchInput, prediction?: PredictionRecord): string {
  return compileArticle(match, prediction).lead;
}

function winnerLine(match: MatchInput): string {
  const gh = match.scoreHome ?? 0;
  const ga = match.scoreAway ?? 0;
  const vs = `${match.home.name} – ${match.away.name}`;
  if (gh > ga) return `${match.home.name} a battu ${match.away.name} (${gh}–${ga}).`;
  if (ga > gh) return `${match.away.name} s'est imposé ${ga}–${gh} à l'extérieur contre ${match.home.name}.`;
  return `${vs} se termine sur un match nul ${gh}–${ga}.`;
}

function pickVerdictLine(
  match: MatchInput,
  prediction: PredictionRecord,
  pick: { label: string; odds: string; book: string },
): string {
  const gh = match.scoreHome ?? 0;
  const ga = match.scoreAway ?? 0;
  const market = headlineMarket(prediction.markets);
  const hit = marketHits(market.market, gh, ga);
  const word = hit === "win" ? "GAGNANT" : hit === "lose" ? "PERDANT" : "REMBOURSÉ";
  return `Pronostic BetGPT : ${pick.label} (cote ${pick.odds} chez ${pick.book}) — ${word}.`;
}

export function resultatRecap(match: MatchInput, prediction?: PredictionRecord): string {
  const gh = match.scoreHome ?? 0;
  const ga = match.scoreAway ?? 0;
  const score = `${gh}–${ga}`;
  const vs = `${match.home.name} – ${match.away.name}`;
  const pick = pickPhrase(match, prediction);
  const advised = prediction ? betMarket(prediction.markets) : null;
  const hit = advised ? marketHits(advised.market, gh, ga) : null;
  const word = hit === "win" ? "GAGNANT" : hit === "lose" ? "PERDANT" : hit === "void" ? "REMBOURSÉ" : null;
  return [
    `Le résultat de ${vs} est ${score}. ${winnerLine(match)} Score final ${score}, ${match.competition}, ${match.venue}.`,
    `Résultat ${match.home.name} ${match.away.name} : ${score}. ${match.home.name} ${gh}, ${match.away.name} ${ga}.`,
    pick
      ? `Pronostic BetGPT : ${pick.label} (cote ${pick.odds}) — ${word ?? "en attente"}.`
      : `Analyse du résultat ${vs} : score final ${score}.`,
    `Analyse ${vs} : ${match.home.name} en ${match.home.formation} contre ${match.away.name} en ${match.away.formation}. Le résultat ${score} clôt le match.`,
  ].join("\n\n");
}

export function pronosticLead(match: MatchInput, prediction?: PredictionRecord): string {
  const article = compileArticle(match, prediction);
  return article.lead;
}

export function matchTitle(match: MatchInput, prediction?: PredictionRecord): string {
  return compileArticle(match, prediction).title;
}

export function matchDescription(match: MatchInput, prediction?: PredictionRecord): string {
  return compileArticle(match, prediction).metaDescription;
}

export function matchFaq(match: MatchInput, prediction?: PredictionRecord): { q: string; a: string }[] {
  return compileArticle(match, prediction).faq;
}

export function siteJsonLd(): object {
  const orgId = `${SITE_URL}/#org`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsMediaOrganization",
        "@id": orgId,
        name: "BetGPT",
        url: SITE_URL,
        logo: imageObjectLd(BRAND_LOGO, SITE_URL),
        publishingPrinciples: `${SITE_URL}/redaction`,
        areaServed: { "@type": "Country", name: "France" },
        inLanguage: "fr-FR",
        knowsAbout: ["Football", "Ligue 1", "Ligue des champions", "pronostic", "score en direct"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "BetGPT",
        publisher: { "@id": orgId },
        inLanguage: "fr-FR",
      },
    ],
  };
}

export function articleDates(
  _match: MatchInput,
  prediction?: PredictionRecord,
  extra?: { publishedAt?: string; modifiedAt?: string },
): { published?: string; modified?: string } {
  const published = knownStamp(extra?.publishedAt) ?? knownStamp(prediction?.timestamp);
  const candidate = knownStamp(extra?.modifiedAt) ?? knownStamp(prediction?.timestamp) ?? published;
  const modified = published && candidate && candidate < published ? published : candidate;
  return { published, modified };
}

export function datesFromVersions(
  versions?: { timestamp?: string }[] | null,
  fallback?: string,
): { publishedAt?: string; modifiedAt?: string } {
  const first = versions?.[0]?.timestamp;
  const last = versions?.length ? versions[versions.length - 1]?.timestamp : first;
  return { publishedAt: first || fallback, modifiedAt: last || first || fallback };
}

export function jsonLd(
  match: MatchInput,
  prediction?: PredictionRecord,
  extra?: { publishedAt?: string; modifiedAt?: string; video?: CuratedVideo | null; scoreStale?: boolean },
): object {
  const score = scoreLine(match);
  const url = `${SITE_URL}${matchPath(match)}`;
  const doc = compileArticle(match, prediction);
  const answer = answerFirst(match, { stale: extra?.scoreStale });
  const { published, modified } = articleDates(match, prediction, extra);
  const orgId = `${SITE_URL}/#org`;
  const eventId = `${url}#event`;
  const homeId = `${SITE_URL}${teamPath(match.home.name)}#team`;
  const awayId = `${SITE_URL}${teamPath(match.away.name)}#team`;
  const state = strictStatus(match);
  const event: Record<string, unknown> = {
    "@type": "SportsEvent",
    "@id": eventId,
    name: score ? `${match.home.name} ${score} ${match.away.name}` : `${match.home.name} vs ${match.away.name}`,
    headline: serpTitle(match, { stale: extra?.scoreStale }),
    description: answer,
    url,
    image: imageObjectLd(BRAND_OG, url),
    startDate: match.kickoff,
    eventStatus:
      state === "CANCELLED"
        ? "https://schema.org/EventCancelled"
        : state === "POSTPONED"
          ? "https://schema.org/EventPostponed"
          : state === "FINISHED"
            ? "https://schema.org/EventCompleted"
            : state === "LIVE" || state === "HALFTIME" || state === "SUSPENDED"
              ? "https://schema.org/EventLive"
              : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: match.venue, address: match.venue },
    homeTeam: {
      "@type": "SportsTeam",
      "@id": homeId,
      name: match.home.name,
      url: `${SITE_URL}${teamPath(match.home.name)}`,
      logo: crestSeo(match.home.name, {
        competition: match.competition,
        id: match.home.id,
        logo: match.home.logo,
      }).src
        ? imageObjectLd(
            crestSeo(match.home.name, { competition: match.competition, id: match.home.id, logo: match.home.logo }),
            `${SITE_URL}${teamPath(match.home.name)}`,
          )
        : undefined,
    },
    awayTeam: {
      "@type": "SportsTeam",
      "@id": awayId,
      name: match.away.name,
      url: `${SITE_URL}${teamPath(match.away.name)}`,
      logo: crestSeo(match.away.name, {
        competition: match.competition,
        id: match.away.id,
        logo: match.away.logo,
      }).src
        ? imageObjectLd(
            crestSeo(match.away.name, { competition: match.competition, id: match.away.id, logo: match.away.logo }),
            `${SITE_URL}${teamPath(match.away.name)}`,
          )
        : undefined,
    },
    competitor: [{ "@id": homeId }, { "@id": awayId }],
    sport: "Soccer",
    organizer: { "@type": "Organization", name: match.competition },
    inLanguage: "fr-FR",
    speakable: { "@type": "SpeakableSpecification", cssSelector: [".seo-answer", "h1"] },
  };
  const play = extra?.video && videoRelevance(extra.video, match).show ? extra.video : null;
  const videoLd = play ? videoObjectLd(play, url) : null;
  const broadcast = play ? liveBroadcastLd(play) : null;
  const faq = doc.faq;
  const article: Record<string, unknown> = {
    "@type": match.status === "live" ? "LiveBlogPosting" : "NewsArticle",
    "@id": `${url}#article`,
    headline: serpTitle(match, { stale: extra?.scoreStale }),
    description: answer,
    image: [imageObjectLd(BRAND_OG, url), imageObjectLd(BRAND_HERO, url)],
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: url,
    mainEntity: { "@id": eventId },
    author: { "@id": orgId },
    publisher: { "@id": orgId },
    articleSection: "Football",
    keywords: `${match.home.name}, ${match.away.name}, ${match.competition}, pronostic, analyse, résultat, score`,
    articleBody: articlePlainText(doc),
    inLanguage: "fr-FR",
    isAccessibleForFree: true,
    about: { "@id": eventId },
  };
  if (match.status === "live") {
    article.coverageStartTime = match.kickoff;
    article.liveBlogUpdate = [
      {
        "@type": "BlogPosting",
        headline: hasScore(match)
          ? `${match.home.name} ${match.scoreHome}–${match.scoreAway} ${match.away.name}`
          : answer,
        datePublished: modified,
        articleBody: answer,
      },
    ];
  }
  const section =
    state === "FINISHED" || state === "CANCELLED"
      ? { name: "Résultats football", href: "/resultats-football" }
      : { name: "Scores en direct", href: "/scores-en-direct" };
  const comp = competitionByLeague(match.league);
  const compHref = comp ? (state === "FINISHED" ? comp.resultsPath : comp.scoresPath) : competitionPath(match.league);
  const graph: object[] = [
    event,
    article,
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: section.name, item: `${SITE_URL}${section.href}` },
        { "@type": "ListItem", position: 3, name: comp?.title ?? match.competition, item: `${SITE_URL}${compHref}` },
        { "@type": "ListItem", position: 4, name: `${match.home.name} – ${match.away.name}`, item: url },
      ],
    },
  ];
  if (videoLd) graph.push(videoLd);
  if (broadcast) graph.push(broadcast);
  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function matchHead(
  match: MatchInput,
  prediction?: PredictionRecord,
  extra?: { publishedAt?: string; modifiedAt?: string; scoreStale?: boolean; video?: CuratedVideo | null },
) {
  const title = serpTitle(match, { stale: extra?.scoreStale });
  const description = serpDescription(match, { stale: extra?.scoreStale }).slice(0, 168);
  const url = `${SITE_URL}${matchPath(match)}`;
  const { published, modified } = articleDates(match, prediction, extra);
  const indexable = fixtureIndexable(match).index;
  const robots = indexable
    ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1, indexifembedded"
    : "noindex, follow";
  const score =
    (match.status === "live" || match.status === "finished") && hasScore(match)
      ? `${match.home.name} ${match.scoreHome}–${match.scoreAway} ${match.away.name}`
      : `${match.home.name} vs ${match.away.name}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { name: "googlebot", content: robots },
      { name: "geo.region", content: "FR" },
      { name: "geo.placename", content: "France" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:site_name", content: "BetGPT" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      ...imageHeadTags(BRAND_OG),
      ...(published ? [{ property: "article:published_time", content: published }] : []),
      ...(modified ? [{ property: "article:modified_time", content: modified }] : []),
      { property: "article:section", content: "Football" },
      { property: "article:tag", content: match.home.name },
      { property: "article:tag", content: match.away.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: score },
      { name: "twitter:description", content: description },
      { name: "news_keywords", content: `${match.home.name}, ${match.away.name}, score, prono, cote, ${match.competition}` },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", hrefLang: "fr", href: url },
      { rel: "alternate", hrefLang: "x-default", href: url },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: ld(
          jsonLd(match, prediction, {
            publishedAt: published,
            modifiedAt: modified,
            scoreStale: extra?.scoreStale,
            video: extra?.video,
          }),
        ),
      },
    ],
  };
}
