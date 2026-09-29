import type { LeagueId } from "./types";

export type BookPage = {
  book: string;
  url: string;
  home: string;
  away: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
};

export const UNIBET_LEAGUE: Record<LeagueId, string> = {
  PL: "https://www.unibet.fr/paris-football/angleterre/premier-league",
  LL: "https://www.unibet.fr/paris-football/espagne/laliga",
  BL: "https://www.unibet.fr/paris-football/allemagne/bundesliga-1",
  SA: "https://www.unibet.fr/paris-football/italie/serie-a",
  L1: "https://www.unibet.fr/paris-football/france/ligue-1-mcdonalds",
  ER: "https://www.unibet.fr/paris-football/pays-bas/d1-pays-bas",
  PT: "https://www.unibet.fr/paris-football/portugal/liga-portugal",
  SC: "https://www.unibet.fr/paris-football/ecosse/d1-ecosse",
  TR: "https://www.unibet.fr/paris-football/turquie",
  CL: "https://www.unibet.fr/paris-football/coupes-d-europe/ligue-des-champions",
  EL: "https://www.unibet.fr/paris-football/coupes-d-europe/ligue-europa",
  NL: "https://www.unibet.fr/paris-football/international/ligue-des-nations",
};

export const BETCLIC_LEAGUE: Partial<Record<LeagueId, string>> = {
  PL: "https://www.betclic.fr/football-sfootball/angl-premier-league-c3",
  LL: "https://www.betclic.fr/football-sfootball/espagne-laliga-c7",
  BL: "https://www.betclic.fr/football-sfootball/allemagne-bundesliga-c5",
  SA: "https://www.betclic.fr/football-sfootball/italie-serie-a-c6",
  L1: "https://www.betclic.fr/football-sfootball/ligue-1-mcdonald-s-c4",
  CL: "https://www.betclic.fr/football-sfootball/ligue-des-champions-c8",
  EL: "https://www.betclic.fr/football-sfootball/ligue-europa-c9",
  NL: "https://www.betclic.fr/football-sfootball",
};

export const NETBET_LEAGUE: Partial<Record<LeagueId, string>> = {
  PL: "https://www.netbet.fr/football/angleterre/premier-league",
  LL: "https://www.netbet.fr/football/espagne/laliga",
  BL: "https://www.netbet.fr/football/allemagne/bundesliga",
  SA: "https://www.netbet.fr/football/italie/serie-a",
  L1: "https://www.netbet.fr/football/france/ligue-1-mcdonald-s-r",
  CL: "https://www.netbet.fr/football/ligue-des-champions/ligue-des-champions",
  EL: "https://www.netbet.fr/football/ligue-europa/ligue-europa",
  NL: "https://www.netbet.fr/football",
};

function decodeJsStr(s: string): string {
  return s
    .replace(/\\u002F/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u2019/gi, "'")
    .replace(/\\"/g, '"')
    .trim();
}

function parseNetBet(html: string): BookPage[] {
  const out: BookPage[] = [];
  const seen = new Set<string>();
  const re =
    /label:"([^"]+?)\\u002F([^"]+?)",url:"\\u002Fevenement\\u002F(\d+-[a-z0-9-]+)"([\s\S]{0,2400})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[3]!;
    if (seen.has(slug)) continue;
    if (/vainqueur|buteur|relegue|maintien|paris-fun|top-\d|2026-2027/.test(slug)) continue;
    const home = decodeJsStr(m[1]!);
    const away = decodeJsStr(m[2]!);
    if (!home || !away || home.length > 42 || away.length > 42) continue;
    const odds = [...(m[4] ?? "").matchAll(/oddsDisplay:"([0-9.]+)"/g)]
      .map((x) => Number(x[1]))
      .filter((n) => Number.isFinite(n) && n > 1.01 && n < 80)
      .slice(0, 3);
    seen.add(slug);
    out.push({
      book: "NetBet",
      home,
      away,
      url: `https://www.netbet.fr/evenement/${slug}`,
      homeOdds: odds[0],
      drawOdds: odds[1],
      awayOdds: odds[2],
    });
  }
  return out;
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CANON: [RegExp, string][] = [
  [/manchester city|man city|mancity|man city/, "mancity"],
  [/manchester united|man united|man utd|manunited/, "manutd"],
  [/paris saint germain|paris sg|parissg|^psg$/, "psg"],
  [/nottingham forest|nottingham f/, "nottingham"],
  [/brighton( hove| and hove albion)?/, "brighton"],
  [/tottenham( hotspur)?/, "tottenham"],
  [/west ham( united)?/, "westham"],
  [/newcastle( united)?/, "newcastle"],
  [/leeds( united| utd)?/, "leeds"],
  [/hull( city)?/, "hull"],
  [/crystal palace/, "crystalpalace"],
  [/aston villa/, "astonvilla"],
  [/atletico( madrid)?|atl madrid/, "atletico"],
  [/athletic( club| bilbao)?|ath bilbao|bilbao/, "athletic"],
  [/real madrid/, "realmadrid"],
  [/rayo( vallecano)?/, "rayo"],
  [/racing( santander)?|santander/, "santander"],
  [/bayern( munich| munchen)?/, "bayern"],
  [/borussia dortmund|^dortmund$/, "dortmund"],
  [/augsburg|augsbourg/, "augsburg"],
  [/bayer leverkusen|leverkusen/, "leverkusen"],
  [/union berlin/, "unionberlin"],
  [/inter( milan)?/, "inter"],
  [/ac milan|^milan$/, "milan"],
  [/como( 1907)?|^come$/, "como"],
  [/koln|cologne|fc cologne/, "cologne"],
  [/stuttgart|vfb stuttgart/, "stuttgart"],
  [/auxerre|aj auxerre/, "auxerre"],
  [/lyon|olympique lyonnais/, "lyon"],
  [/marseille|olympique de marseille/, "marseille"],
  [/wolverhampton|wolves/, "wolves"],
  [/bournemouth/, "bournemouth"],
  [/ipswich( town)?/, "ipswich"],
  [/coventry/, "coventry"],
  [/sunderland/, "sunderland"],
  [/monaco/, "monaco"],
  [/fc porto|^porto$/, "porto"],
  [/club brugge|club bruges|brugge/, "brugge"],
  [/aek( athens| athene)?/, "aek"],
  [/lask( linz)?/, "lask"],
  [/real betis|^betis$|betis seville|betis/, "betis"],
  [/villarreal/, "villarreal"],
  [/internazionale|^inter$|inter milan/, "inter"],
  [/barcelon[ae]|^barca$/, "barca"],
  [/napoli|naples/, "napoli"],
  [/slovan|bratislava/, "slovan"],
  [/viking/, "viking"],
  [/feyenoord/, "feyenoord"],
  [/galatasaray/, "galatasaray"],
  [/sporting( lisbon| lisboa| cp)?/, "sporting"],
  [/bruges|brugge/, "brugge"],
  [/man city|mancity/, "mancity"],
];

export function canonName(name: string): string {
  let s = fold(name);
  s = s.replace(/\b(fc|cf|afc|sc|ac|as|rc|ud|cd|vfb|tsg|rb|aj|ss|calcio|the|1)\b/g, " ");
  s = fold(s);
  for (const [re, to] of CANON) {
    if (re.test(s)) return to;
  }
  return s.replace(/\s+/g, "");
}

export function pageKey(home: string, away: string): string {
  return `${canonName(home)}|${canonName(away)}`;
}

async function getHtml(url: string, referer: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6500),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,*/*",
        "Accept-Language": "fr-FR,fr;q=0.9",
        Referer: referer,
      },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function frOdd(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(String(s).replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n) || n < 1.01 || n > 80) return undefined;
  return n;
}

function parseUnibet(html: string): BookPage[] {
  const out: BookPage[] = [];
  const seen = new Set<string>();
  const re =
    /title="Voir plus de paris pour le match : ([^"|]+?) vs ([^"|]+?)\s*\|[^"]*" href="(\/paris-football\/[^"]+)"([\s\S]{0,4000}?)<\/psel-event-main>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = `https://www.unibet.fr${m[3]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const block = m[4] ?? "";
    const odds = [...block.matchAll(/psel-outcome__data">(\d+,\d{2})/g)].map((x) => frOdd(x[1]));
    out.push({
      book: "Unibet",
      home: m[1]!.trim(),
      away: m[2]!.trim(),
      url,
      homeOdds: odds[0],
      drawOdds: odds[1],
      awayOdds: odds[2],
    });
  }
  if (out.length) return out;
  const hrefs = html.matchAll(/href="(\/paris-football\/[^"]+\/\d+\/([^"/]+))"/g);
  for (const h of hrefs) {
    const slug = h[2] ?? "";
    const parts = slug.split("-vs-");
    if (parts.length !== 2) continue;
    out.push({
      book: "Unibet",
      home: parts[0]!.replace(/-/g, " "),
      away: parts[1]!.replace(/-/g, " "),
      url: `https://www.unibet.fr${h[1]}`,
    });
  }
  return out;
}

function parseBetclicJson(html: string, leagueUrl: string): BookPage[] {
  const out: BookPage[] = [];
  const scripts = html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
  const matches: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const collect = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) collect(x);
      return;
    }
    const o = node as Record<string, unknown>;
    const list = o.matches;
    if (Array.isArray(list) && list[0] && typeof list[0] === "object" && "matchId" in (list[0] as object)) {
      for (const row of list as Record<string, unknown>[]) matches.push(row);
      return;
    }
    for (const v of Object.values(o)) collect(v);
  };
  for (const s of scripts) {
    try {
      collect(JSON.parse(s[1]!));
    } catch {
      /* skip */
    }
  }
  const slug = (s: string) =>
    fold(s)
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const base = leagueUrl.replace(/\/$/, "");
  for (const m of matches) {
    const id = String(m.matchId ?? "");
    const contestants = (m.contestants as { name?: string }[] | undefined) ?? [];
    const home = contestants[0]?.name?.trim();
    const away = contestants[1]?.name?.trim();
    if (!id || !home || !away) continue;
    const url = `${base}/${slug(home)}-${slug(away)}-m${id}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const sels = ((m.market as { mainSelections?: { odds?: number }[] } | undefined)?.mainSelections ?? []).map(
      (x) => x.odds,
    );
    out.push({
      book: "Betclic",
      home,
      away,
      url,
      homeOdds: typeof sels[0] === "number" && sels[0] > 1.01 ? sels[0] : undefined,
      drawOdds: typeof sels[1] === "number" && sels[1] > 1.01 ? sels[1] : undefined,
      awayOdds: typeof sels[2] === "number" && sels[2] > 1.01 ? sels[2] : undefined,
    });
  }
  return out;
}

function parseBetclic(html: string, leagueUrl?: string): BookPage[] {
  const out: BookPage[] = [];
  const seen = new Set<string>();
  const re =
    /aria-label="([^"]+?)\s[-–]\s([^"]+?)"[^>]*href="(\/football-sfootball\/[^"]+-m\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const path = m[3]!;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({
      book: "Betclic",
      home: m[1]!.trim(),
      away: m[2]!.trim(),
      url: `https://www.betclic.fr${path}`,
    });
  }
  if (out.length) return out;
  const cards = html.split(/aria-label="/);
  for (const card of cards) {
    const head = card.match(/^([^"]+?)\s[-–]\s([^"]+?)"[^>]*href="(\/football-sfootball\/[^"]+-m\d+)"/);
    if (!head) continue;
    const path = head[3]!;
    if (seen.has(path)) continue;
    seen.add(path);
    const odds = [...card.slice(0, 8000).matchAll(/bcdk-bet-button-odds-animated[^>]*>(\d+,\d{2})</g)]
      .map((x) => frOdd(x[1]))
      .filter((n): n is number => n != null)
      .slice(0, 3);
    out.push({
      book: "Betclic",
      home: head[1]!.trim(),
      away: head[2]!.trim(),
      url: `https://www.betclic.fr${path}`,
      homeOdds: odds[0],
      drawOdds: odds[1],
      awayOdds: odds[2],
    });
  }
  return out;
}

export type BookPageIndex = Map<string, BookPage[]>;

function indexPages(pages: BookPage[]): BookPageIndex {
  const map: BookPageIndex = new Map();
  for (const p of pages) {
    const keys = p.away
      ? [pageKey(p.home, p.away), pageKey(p.away, p.home)]
      : [];
    if (!keys.length && p.home) keys.push(canonName(p.home));
    for (const k of keys) {
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
  }
  return map;
}

export async function fetchBookPages(): Promise<BookPageIndex> {
  const jobs = [
    ...Object.values(UNIBET_LEAGUE).map((u) => getHtml(u, "https://www.unibet.fr/").then(parseUnibet)),
    ...Object.entries(BETCLIC_LEAGUE).map(([, u]) =>
      getHtml(u, "https://www.betclic.fr/").then((html) => {
        const json = parseBetclicJson(html, u);
        return json.length ? json : parseBetclic(html, u);
      }),
    ),
    ...Object.values(NETBET_LEAGUE).map((u) => getHtml(u, "https://www.netbet.fr/").then(parseNetBet)),
    getHtml("https://www.netbet.fr/football", "https://www.netbet.fr/").then(parseNetBet),
  ];
  const parts = await Promise.allSettled(jobs);
  const pages: BookPage[] = [];
  for (const p of parts) {
    if (p.status === "fulfilled") pages.push(...p.value);
  }
  return indexPages(pages);
}

function sameish(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

export function lookupBookPages(
  index: BookPageIndex,
  home: string,
  away: string,
): BookPage[] {
  const direct = index.get(pageKey(home, away)) ?? index.get(pageKey(away, home)) ?? [];
  const uniq = (list: BookPage[]) => {
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.book)) return false;
      seen.add(p.book);
      return true;
    });
  };
  if (direct.length) return uniq(direct);
  const h = canonName(home);
  const a = canonName(away);
  const found: BookPage[] = [];
  const seen = new Set<string>();
  for (const [key, list] of index) {
    if (!key.includes("|")) continue;
    const [kh, ka] = key.split("|");
    if (!kh || !ka) continue;
    const ok = (sameish(kh, h) && sameish(ka, a)) || (sameish(kh, a) && sameish(ka, h));
    if (!ok) continue;
    for (const p of list) {
      if (seen.has(p.book)) continue;
      seen.add(p.book);
      found.push(p);
    }
  }
  return found;
}
