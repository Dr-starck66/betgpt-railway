import type { EditorialNewsSignal, NewsSourceTier } from "@/lib/editorial/types";
import { jaccard, tokens } from "@/lib/editorial/quality";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3200;
const MAX_SIGNALS = 90;
const MAX_DIRECT_SIGNALS = 240;

// Complement Google News pointers with publisher-owned direct article links.
// Publisher RSS is used only for attribution and short factual leads; never
// reproduce an article's full text or bypass the Gold Standard newsroom gate.
const DIRECT_PUBLISHER_FEEDS = [
  { url: "https://www.lfp.fr/rss", sourceName: "LFP", origin: "https://www.lfp.fr", tier: "OFFICIAL" },
  // French football first-party feeds: official Foot Mercato RSS endpoint and
  // RMC Sport football RSS. Only independent, readable publisher articles may
  // subsequently count as evidence; no syndication or content republishing.
  { url: "https://www.footmercato.net/flux-rss", sourceName: "Foot Mercato", origin: "https://www.footmercato.net", tier: "TIER1" },
  { url: "https://rmcsport.bfmtv.com/rss/football/", sourceName: "RMC Sport", origin: "https://rmcsport.bfmtv.com", tier: "TIER1" },
  // Independent public editorial feeds, verified working on 24 October 2026.
  // Only first-party deep links enter the evidence pipeline; article text still
  // must pass the same host, length, corroboration and Gold Standard checks.
  { url: "https://www.sofoot.com/rss", sourceName: "So Foot", origin: "https://www.sofoot.com", tier: "TIER1" },
  { url: "https://www.football365.com/rss", sourceName: "Football365", origin: "https://www.football365.com", tier: "TIER1" },
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", sourceName: "BBC Sport", origin: "https://www.bbc.com", tier: "TIER1" },
  { url: "https://www.theguardian.com/football/rss", sourceName: "The Guardian", origin: "https://www.theguardian.com", tier: "TIER1" },
  { url: "https://www.skysports.com/rss/11095", sourceName: "Sky Sports", origin: "https://www.skysports.com", tier: "TIER1" },
  // Current first-party RSS feeds verified by independent RSS monitoring,
  // not Google News redirect pointers. Full-text source checks still apply.
  { url: "https://www.nytimes.com/athletic/rss/football/", sourceName: "The Athletic", origin: "https://www.nytimes.com", tier: "TIER1" },
  { url: "https://www.cbssports.com/rss/headlines/", sourceName: "CBS Sports", origin: "https://www.cbssports.com", tier: "TIER1" },
  { url: "https://sports.yahoo.com/rss/", sourceName: "Yahoo Sports", origin: "https://sports.yahoo.com", tier: "TIER1" },
  { url: "https://www.7sur7.be/football/rss.xml", sourceName: "7sur7", origin: "https://www.7sur7.be", tier: "TIER1" },
  { url: "https://www.espn.com/espn/rss/soccer/news", sourceName: "ESPN", origin: "https://www.espn.com", tier: "TIER1" },
  { url: "https://www.franceinfo.fr/sports/foot.rss", sourceName: "Franceinfo", origin: "https://www.franceinfo.fr", tier: "TIER1" },
  { url: "https://france3-regions.franceinfo.fr/sport/football/ligue-1/rss", sourceName: "France 3 Régions", origin: "https://france3-regions.franceinfo.fr", tier: "TIER1" },
] as const;

const GOOGLE_NEWS_QUERIES = [
  "football France when:1d",
  '"Ligue 1" football when:1d',
  'PSG OR Marseille OR Lyon OR Monaco OR Lens football when:1d',
  '"équipe de France" football when:1d',
  '"Ligue des champions" football when:1d',
  'PSG "Ligue des champions féminine" OR "Women\'s Champions League" when:1d',
  '"France Espoirs" OR "France U21" football when:1d',
  '"Kylian Mbappé" OR "Real Madrid" OR "FC Barcelone" football when:1d',
  '"Cristiano Ronaldo" OR "Lionel Messi" OR "Lamine Yamal" football when:1d',
  'CAN Maroc Algérie Sénégal Nigeria football when:1d',
];

const OFFICIAL_HOSTS = [
  "fff.fr",
  "lfp.fr",
  "uefa.com",
  "fifa.com",
  "cafonline.com",
  "psg.fr",
  "om.fr",
  "ol.fr",
  "asmonaco.com",
  "losc.fr",
  "rclens.fr",
  "staderennais.com",
  "fcbarcelona.com",
  "realmadrid.com",
  "mancity.com",
  "liverpoolfc.com",
  "arsenal.com",
  "chelseafc.com",
  "juventus.com",
  "inter.it",
  "acmilan.com",
  "fcbayern.com",
];

const TIER1_HOSTS = [
  "lequipe.fr",
  "rmcsport.bfmtv.com",
  "eurosport.fr",
  "franceinfo.fr",
  "francebleu.fr",
  "footmercato.net",
  "sofoot.com",
  "20minutes.fr",
  "leparisien.fr",
  "ouest-france.fr",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
];

const ENTITY_PATTERNS: [RegExp, string][] = [
  [/\bfrance\b/i, "France"],
  [/\bparis saint[- ]germain\b|\bpsg\b/i, "PSG"],
  [/\bolympique de marseille\b|\bom\b|\bmarseille\b/i, "Marseille"],
  [/\bolympique lyonnais\b|\bol\b|\blyon\b/i, "Lyon"],
  [/\bas monaco\b|\bmonaco\b/i, "Monaco"],
  [/\blens\b/i, "Lens"],
  [/\blille\b|\blosc\b/i, "Lille"],
  [/\brennes\b/i, "Rennes"],
  [/\breal madrid\b/i, "Real Madrid"],
  [/\bbarcelone\b|\bbarcelona\b/i, "Barcelone"],
  [/\bmanchester city\b/i, "Manchester City"],
  [/\bliverpool\b/i, "Liverpool"],
  [/\barsenal\b/i, "Arsenal"],
  [/\bchelsea\b/i, "Chelsea"],
  [/\bbayern\b/i, "Bayern Munich"],
  [/\bjuventus\b/i, "Juventus"],
  [/\binter\b/i, "Inter"],
  [/\bmilan\b/i, "AC Milan"],
  [/\bmaroc\b/i, "Maroc"],
  [/\balg[ée]rie\b/i, "Algérie"],
  [/\bs[ée]n[ée]gal\b/i, "Sénégal"],
  [/\bnigeria\b|\bnigéria\b/i, "Nigeria"],
  [/\bmbapp[ée]\b/i, "Kylian Mbappé"],
  [/\bdemb[ée]l[ée]\b/i, "Ousmane Dembélé"],
  [/\bcristiano ronaldo\b|\bronaldo\b/i, "Cristiano Ronaldo"],
  [/\blionel messi\b|\bmessi\b/i, "Lionel Messi"],
  [/\blamine yamal\b|\byamal\b/i, "Lamine Yamal"],
  [/\bportugal\b/i, "Portugal"],
  [/\bdanemark\b|\bdenmark\b/i, "Danemark"],
];


const MATERIAL_DEVELOPMENT =
  /\b(finalement|autorisé|autorisee?|autorisation|accord(?:é|e)?|confirmé|confirmee?|démenti?|dément|refusé|refusee?|refus|officiel(?:lement)?|verdict|décision|annonce|renonce|annulé|annulee?|suspendu|forfait confirmé|opéré|operation)\b/i;

export function isMaterialDevelopment(text: string): boolean {
  return MATERIAL_DEVELOPMENT.test(text);
}

const NEWSWORTHY = /blessure|blessé|forfait|absent|suspendu|transfert|mercato|accord|signature|prolong|licenci|limog|entra[iî]neur|coach|composition|compo|titulaire|banc|record|qualification|qualifié|élimin|victoire|défaite|exploit|retour|sanction|décision|communiqué|officiel|annonce|nommé|nomination|rupture|contrat|derby|classique|finale/i;

const EVENT_FAMILIES: [RegExp, string][] = [
  [/blessure|blessé|forfait|absent|indisponible/i, "availability"],
  [/transfert|mercato|accord|signature|prolong|contrat/i, "transfer"],
  [/licenci|limog|entra[iî]neur|coach|nommé|nomination/i, "coach"],
  [/composition|compo|titulaire|banc|groupe|sélection/i, "lineup"],
  [/record|exploit|historique/i, "record"],
  [/qualification|qualifié|élimin/i, "qualification"],
  [/sanction|suspendu|décision|communiqué|officiel|annonce|autorisé|autorisee?|autorisation|accord(?:é|e)?|refusé|refusee?|refus|verdict/i, "official-decision"],
  [/victoire|défaite|score|résultat|retour|remontée/i, "result"],
  [/retraite|retirer|fin de carrière|adieux/i, "retirement"],
  [/rupture|tension|brouille|conflit|désaccord|polémique|controverse|débat/i, "relationship"],
  [/portrait|grands moments|carrière|rétrospective|hommage/i, "profile"],
];

function eventFamilies(text: string): string[] {
  return EVENT_FAMILIES.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

let cache: { at: number; signals: EditorialNewsSignal[] } | null = null;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const hit = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return hit ? decodeXml(hit[1] ?? "").trim() : "";
}

function sourceNode(block: string): { name: string; url?: string } {
  const hit = block.match(/<source(?:\s+url="([^"]+)")?[^>]*>([\s\S]*?)<\/source>/i);
  if (!hit) return { name: "Source inconnue" };
  return { name: stripHtml(hit[2] ?? "Source inconnue"), url: hit[1] ? decodeXml(hit[1]) : undefined };
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
  return list.some((item) => host === item || host.endsWith(`.${item}`));
}

export function sourceTier(sourceUrl?: string, sourceName = ""): NewsSourceTier {
  const host = hostname(sourceUrl);
  if (hostMatches(host, OFFICIAL_HOSTS)) return "OFFICIAL";
  if (hostMatches(host, TIER1_HOSTS)) return "TIER1";
  const normalized = sourceName.toLowerCase();
  if (/fédération|fifa|uefa|caf|ligue de football professionnel|site officiel/i.test(normalized)) return "OFFICIAL";
  if (/l['’]?équipe|rmc sport|eurosport|franceinfo|france bleu|foot mercato|so foot|le parisien|ouest-france/i.test(normalized)) return "TIER1";
  return "OTHER";
}

export function detectEntities(text: string): string[] {
  const found: string[] = [];
  for (const [pattern, label] of ENTITY_PATTERNS) if (pattern.test(text)) found.push(label);
  return [...new Set(found)];
}

function signalId(title: string, source: string, publishedAt: string): string {
  const raw = `${title}|${source}|${publishedAt}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `news-${(h >>> 0).toString(16)}`;
}

export function parseGoogleNewsRss(xml: string, now = new Date()): EditorialNewsSignal[] {
  const out: EditorialNewsSignal[] = [];
  const nowMs = now.getTime();
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
    const title = stripHtml(tag(item, "title"));
    const link = stripHtml(tag(item, "link"));
    const publishedRaw = stripHtml(tag(item, "pubDate"));
    const description = stripHtml(tag(item, "description"));
    const source = sourceNode(item);
    const published = Date.parse(publishedRaw);
    if (!title || !link || !Number.isFinite(published)) continue;
    if (published > nowMs + 5 * 60 * 1000 || nowMs - published > MAX_AGE_MS) continue;
    const tier = sourceTier(source.url, source.name);
    const entities = detectEntities(`${title} ${description}`);
    out.push({
      id: signalId(title, source.name, new Date(published).toISOString()),
      title,
      url: link,
      sourceName: source.name,
      sourceUrl: source.url,
      publishedAt: new Date(published).toISOString(),
      description: description || undefined,
      sourceTier: tier,
      entities,
      language: "fr",
    });
  }
  return out;
}

/** Publisher RSS has genuine article links, unlike news.google.com RSS pointers.
 * Reject any off-publisher or home-page link before counting a source. */
export function parsePublisherRss(
  xml: string,
  now: Date,
  publisher: { sourceName: string; origin: string; tier: NewsSourceTier },
): EditorialNewsSignal[] {
  const out: EditorialNewsSignal[] = [];
  const ageLimit = now.getTime() - MAX_AGE_MS;
  const publisherHost = hostname(publisher.origin);
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
    const title = stripHtml(tag(item, "title"));
    const link = stripHtml(tag(item, "link"));
    const rawDate = stripHtml(tag(item, "pubDate") || tag(item, "dc:date"));
    const published = Date.parse(rawDate);
    if (!title || !link || !Number.isFinite(published)) continue;
    if (published < ageLimit || published > now.getTime() + 5 * 60_000) continue;
    let clean: URL;
    try { clean = new URL(link); } catch { continue; }
    // BBC syndicates its official sport articles across bbc.com and bbc.co.uk.
    // Explicit publisher-owned alternate only; never accept arbitrary off-site redirects.
    const allowedPublisherHosts = publisherHost === "bbc.com" || publisherHost === "bbc.co.uk"
      ? ["bbc.com", "bbc.co.uk"] : [publisherHost];
    if (clean.protocol !== "https:" || !hostMatches(clean.hostname.toLowerCase(), allowedPublisherHosts)) continue;
    if (clean.pathname === "/" || clean.pathname.length < 6) continue;
    const description = stripHtml(tag(item, "description")).slice(0, 900);
    // content:encoded is a full-text body made PUBLIC by the original publisher
    // over the configured HTTPS RSS endpoint. Description is NOT sufficient.
    const fullBody = stripHtml(tag(item, "content:encoded")).slice(0, 10000);
    const publisherRssBody = fullBody.length >= 750 ? fullBody : undefined;
    out.push({
      id: signalId(title, publisher.sourceName, new Date(published).toISOString()),
      title,
      url: clean.href,
      sourceName: publisher.sourceName,
      sourceUrl: publisher.origin,
      publishedAt: new Date(published).toISOString(),
      description: description || undefined,
      ...(publisherRssBody ? { publisherRssBody } : {}),
      sourceTier: publisher.tier,
      entities: detectEntities(title + " " + description),
      language: "fr",
    });
  }
  return out;
}

function queryUrl(query: string): string {
  const qs = new URLSearchParams({ q: query, hl: "fr", gl: "FR", ceid: "FR:fr" });
  return `https://news.google.com/rss/search?${qs.toString()}`;
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "BetGPT-News-Scout/1.0 (+https://betgpt.live)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqSignals(signals: EditorialNewsSignal[], limit = MAX_SIGNALS): EditorialNewsSignal[] {
  const seen = new Set<string>();
  return signals
    .slice()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((signal) => {
      const key = `${signal.sourceName.toLowerCase()}|${tokens(signal.title).slice(0, 10).join("-")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export type NewsCluster = {
  id: string;
  signals: EditorialNewsSignal[];
  title: string;
  entities: string[];
  official: boolean;
  distinctSources: number;
  publishedAt: string;
  newsworthy: boolean;
};

export function clusterSignals(signals: EditorialNewsSignal[]): NewsCluster[] {
  const clusters: NewsCluster[] = [];
  for (const signal of signals) {
    let best: NewsCluster | null = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = jaccard(signal.title, cluster.title);
      const entityOverlap = signal.entities.some((entity) => cluster.entities.includes(entity));
      const familiesA = eventFamilies(`${signal.title} ${signal.description ?? ""}`);
      const familiesB = eventFamilies(cluster.signals.map((row) => `${row.title} ${row.description ?? ""}`).join(" "));
      const familyOverlap = familiesA.some((family) => familiesB.includes(family));
      const familyConflict =
        familiesA.length > 0 &&
        familiesB.length > 0 &&
        !familyOverlap;
      const deltaHours = Math.abs(Date.parse(signal.publishedAt) - Date.parse(cluster.publishedAt)) / 36e5;
      const incomingMaterial = isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`);
      const clusterMaterial = cluster.signals.some((row) =>
        isMaterialDevelopment(`${row.title} ${row.description ?? ""}`),
      );
      // A later confirmation / denial / authorization / official decision is a new editorial development,
      // not merely another corroborating mention of the earlier rumor or controversy.
      const materialStateChange =
        entityOverlap &&
        incomingMaterial &&
        !clusterMaterial &&
        deltaHours >= 0.35;
      const sameStory =
        !materialStateChange &&
        !familyConflict &&
        (score >= 0.4 ||
          (entityOverlap && familyOverlap && score >= 0.2 && deltaHours <= 12) ||
          (entityOverlap && familyOverlap && deltaHours <= 4));
      if (sameStory && (score > bestScore || (best == null && familyOverlap))) {
        best = cluster;
        bestScore = Math.max(score, familyOverlap ? 0.25 : score);
      }
    }
    if (!best) {
      clusters.push({
        id: `cluster-${signal.id}`,
        signals: [signal],
        title: signal.title,
        entities: [...signal.entities],
        official: signal.sourceTier === "OFFICIAL",
        distinctSources: 1,
        publishedAt: signal.publishedAt,
        newsworthy: NEWSWORTHY.test(`${signal.title} ${signal.description ?? ""}`),
      });
      continue;
    }
    best.signals.push(signal);
    best.entities = [...new Set([...best.entities, ...signal.entities])];
    best.official = best.official || signal.sourceTier === "OFFICIAL";
    best.distinctSources = new Set(best.signals.map((row) => row.sourceName.toLowerCase())).size;
    if (signal.publishedAt > best.publishedAt) best.publishedAt = signal.publishedAt;
    best.newsworthy = best.newsworthy || NEWSWORTHY.test(`${signal.title} ${signal.description ?? ""}`);
    const stronger = best.signals
      .slice()
      .sort((a, b) => {
        const tier = (x: EditorialNewsSignal) => (x.sourceTier === "OFFICIAL" ? 3 : x.sourceTier === "TIER1" ? 2 : 1);
        return tier(b) - tier(a) || b.publishedAt.localeCompare(a.publishedAt);
      })[0];
    if (stronger) best.title = stronger.title;
  }
  return clusters.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function autoPublishableCluster(cluster: NewsCluster): boolean {
  const material = cluster.signals.some((signal) =>
    isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`),
  );
  if (!cluster.newsworthy && !material) return false;
  if (cluster.official) return true;
  const strong = cluster.signals.filter((signal) => signal.sourceTier === "TIER1" || signal.sourceTier === "OFFICIAL");
  return cluster.distinctSources >= 2 && new Set(strong.map((signal) => signal.sourceName.toLowerCase())).size >= 2;
}


/** Bounded, deterministic independent-publisher sampling; never weakens the
 * direct-link, deep-page or editorial evidence gate. */
export function fairPublisherSignals(
  pools: EditorialNewsSignal[][],
  limit = MAX_SIGNALS,
  perPublisherLimit = 16,
): EditorialNewsSignal[] {
  const unique = pools.map((pool) => uniqSignals(pool).slice(0,perPublisherLimit));
  const seenUrls = new Set<string>();
  const selected: EditorialNewsSignal[] = [];
  for (let rank = 0; rank < perPublisherLimit && selected.length < limit; rank++) {
    for (const pool of unique) {
      const signal = pool[rank];
      if (!signal || seenUrls.has(signal.url)) continue;
      seenUrls.add(signal.url);
      selected.push(signal);
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

export async function collectFootballNewsSignals(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<EditorialNewsSignal[]> {
  if (cache && now.getTime() - cache.at < CACHE_TTL_MS) return cache.signals;
  const custom = (process.env.BETGPT_NEWS_RSS_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^https:\/\//i.test(value));
  const urls = custom.length ? custom : GOOGLE_NEWS_QUERIES.map(queryUrl);
  const fetched = await Promise.allSettled([
    ...urls.map(async (url) => parseGoogleNewsRss(await fetchText(url, fetchImpl), now)),
    ...DIRECT_PUBLISHER_FEEDS.map(async (feed) =>
      parsePublisherRss(await fetchText(feed.url, fetchImpl), now, {
        sourceName: feed.sourceName, origin: feed.origin, tier: feed.tier,
      })),
  ]);
  // Preserve first-party publisher articles independently of the high-volume
  // Google News discovery pointers. Previously the global newest-90 cutoff
  // silently discarded direct publisher proof and made three-source reporting
  // structurally impossible despite available first-party feeds.
  const results = fetched.map((result) => result.status === "fulfilled" ? result.value : []);
  const google = uniqSignals(results.slice(0, urls.length).flat());
  // Fairly preserve independent publisher evidence: the old flattened cap
  // filled 90 slots from the first feeds before late sources could contribute.
  // One item per publisher per round prevents this silent publisher starvation.
  const publisher = fairPublisherSignals(results.slice(urls.length), MAX_DIRECT_SIGNALS);
  const signals = [...publisher, ...google].slice(0, MAX_DIRECT_SIGNALS + MAX_SIGNALS);
  console.info("ASTRA_EDITORIAL_EVIDENCE_RSS", JSON.stringify({
    directPublisherSignals: publisher.length,
    googleDiscoverySignals: google.length,
    usableSignals: signals.length,
    directPublisherBreakdown: [...new Set(publisher.map((s) => s.sourceName))].map((name) => ({
      publisher: name,
      articles: publisher.filter((s) => s.sourceName === name).length,
    })),
    configuredPublisherFeeds: DIRECT_PUBLISHER_FEEDS.length,
  }));
  cache = { at: now.getTime(), signals };
  return signals;
}

export function resetNewsScoutCacheForTests(): void {
  cache = null;
}
