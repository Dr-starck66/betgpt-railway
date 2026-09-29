import type { LeagueId, MatchInput } from "./types";
import { lookupBookPages, type BookPageIndex } from "./book-pages";

export type AffiliateBook = {
  id: string;
  name: string;
  region: string;
  accessible: "EU" | "FR" | "UK";
  affiliate: boolean;
};

export const AFFILIATE_BOOKS: Record<string, AffiliateBook> = {
  bet365: { id: "bet365", name: "Bet365", region: "UK/EU", accessible: "EU", affiliate: true },
  unibet: { id: "unibet", name: "Unibet", region: "FR/EU", accessible: "FR", affiliate: true },
  betclic: { id: "betclic", name: "Betclic", region: "FR", accessible: "FR", affiliate: true },
  winamax: { id: "winamax", name: "Winamax", region: "FR", accessible: "FR", affiliate: true },
  pmu: { id: "pmu", name: "PMU", region: "FR", accessible: "FR", affiliate: true },
  bwin: { id: "bwin", name: "Bwin", region: "FR", accessible: "FR", affiliate: true },
  netbet: { id: "netbet", name: "NetBet", region: "FR", accessible: "FR", affiliate: true },
  vbet: { id: "vbet", name: "Vbet", region: "FR", accessible: "FR", affiliate: true },
  parionssport: { id: "parionssport", name: "Parions Sport", region: "FR", accessible: "FR", affiliate: true },
  zebet: { id: "zebet", name: "ZEbet", region: "FR", accessible: "FR", affiliate: true },
};

export const FR_BOOK_RE =
  /unibet|betclic|winamax|pmu|bwin|netbet|parions|zebet|genybet|france.?pari|vbet|feelingbet/i;

export function isUsOnlyBook(name: string): boolean {
  return /draftkings|fanduel|betmgm|caesars|espn bet|fanatics|bovada/i.test(name);
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

const TEAM_SLUG: [RegExp, string][] = [
  [/paris saint germain|paris sg|^psg$/, "parissg"],
  [/paris fc/, "parisfc"],
  [/manchester united|man utd|man united/, "manunited"],
  [/manchester city|man city/, "mancity"],
  [/nottingham forest/, "nottinghamf"],
  [/brighton/, "brightonhove"],
  [/tottenham/, "tottenham"],
  [/west ham/, "westham"],
  [/newcastle/, "newcastle"],
  [/crystal palace/, "crystalpalace"],
  [/bournemouth/, "bournemouth"],
  [/wolverhampton|^wolves$/, "wolves"],
  [/leicester/, "leicester"],
  [/aston villa/, "astonvilla"],
  [/sheffield/, "sheffieldutd"],
  [/real madrid/, "realmadrid"],
  [/atletico/, "atletico"],
  [/athletic/, "athleticbilbao"],
  [/barcelona|barcelone/, "barcelone"],
  [/bayern/, "bayernmunich"],
  [/borussia dortmund|^dortmund$/, "dortmund"],
  [/borussia monchengladbach|mgladbach|gladbach/, "mgladbach"],
  [/bayer leverkusen|leverkusen/, "leverkusen"],
  [/rb leipzig|leipzig/, "rbleipzig"],
  [/eintracht/, "einfrancfort"],
  [/mainz|mayence/, "mayence"],
  [/werder/, "werderbreme"],
  [/union berlin/, "unionberlin"],
  [/ac milan|^milan$/, "milan"],
  [/^inter|inter milan/, "inter"],
  [/juventus/, "juventus"],
  [/olympique de marseille|^marseille$/, "marseille"],
  [/olympique lyonnais|^lyon$/, "lyon"],
  [/le havre/, "lehavre"],
  [/ipswich/, "ipswich"],
  [/sunderland/, "sunderland"],
  [/brentford/, "brentford"],
  [/fulham/, "fulham"],
  [/arsenal/, "arsenal"],
  [/chelsea/, "chelsea"],
  [/liverpool/, "liverpool"],
  [/everton/, "everton"],
  [/leeds/, "leeds"],
  [/burnley/, "burnley"],
  [/rayo/, "rayovallecano"],
  [/alaves/, "alaves"],
  [/osasuna/, "osasuna"],
  [/girona/, "girona"],
  [/seville|sevilla/, "seville"],
  [/valence|valencia/, "valence"],
  [/villarreal/, "villarreal"],
  [/getafe/, "getafe"],
  [/celta/, "celtavigo"],
  [/real sociedad/, "realsociedad"],
  [/real betis|betis/, "betis"],
  [/espanyol/, "espanyol"],
  [/mallorca/, "majorque"],
  [/osasuna/, "osasuna"],
  [/como/, "como"],
  [/genoa/, "genoa"],
  [/atalanta/, "atalanta"],
  [/napoli|naples/, "naples"],
  [/roma/, "roma"],
  [/lazio/, "lazio"],
  [/fiorentina/, "fiorentina"],
  [/lorient/, "lorient"],
  [/toulouse/, "toulouse"],
  [/strasbourg/, "strasbourg"],
  [/lille/, "lille"],
  [/lens/, "lens"],
  [/nice/, "nice"],
  [/rennes/, "rennes"],
  [/brest/, "brest"],
  [/angers/, "angers"],
  [/auxerre/, "auxerre"],
  [/monaco/, "monaco"],
  [/cologne|koln|fc cologne/, "cologne"],
  [/stuttgart/, "stuttgart"],
  [/hambourg|hamburg/, "hambourg"],
  [/fribourg|freiburg/, "fribourg"],
  [/hoffenheim/, "hoffenheim"],
  [/augsburg|augsbourg/, "augsbourg"],
  [/heidenheim/, "heidenheim"],
  [/racing/, "racingsantander"],
];

function teamSlug(name: string): string {
  const n = fold(name);
  for (const [re, slug] of TEAM_SLUG) if (re.test(n)) return slug;
  return n.replace(/\b(fc|cf|afc|sc|ac|as|rc|ud|cd)\b/g, "").replace(/\s+/g, "");
}

const LEAGUE_SEO: Record<LeagueId, string> = {
  PL: "premierleague",
  LL: "laliga",
  BL: "bundesliga",
  SA: "seriea",
  L1: "ligue1",
  ER: "eredivisie",
  PT: "ligaportugal",
  SC: "premiership",
  TR: "superlig",
  CL: "liguedeschampions",
  EL: "ligueeuropa",
  NL: "liguedesnations",
};

const LEAGUE_PAGE: Record<LeagueId, string> = {
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

function bet365MatchUrl(home: string, away: string): string {
  const q = encodeURIComponent(`${home} v ${away}`).replace(/%20/g, "%20");
  return `https://www.bet365.com/#/AX/K^${q}/`;
}

function unibetMatchUrl(league: LeagueId, home: string, away: string): string {
  const seo = `https://www.unibet.fr/paris-sportifs/${LEAGUE_SEO[league]}-${teamSlug(home)}-${teamSlug(away)}`;
  return seo;
}

export function bookMatchUrl(book: string, match: { league: LeagueId; home: { name: string }; away: { name: string } }): string {
  const n = book.toLowerCase();
  if (n.includes("365")) return bet365MatchUrl(match.home.name, match.away.name);
  if (n.includes("unibet")) return unibetMatchUrl(match.league, match.home.name, match.away.name);
  return LEAGUE_PAGE[match.league] ?? "https://www.unibet.fr/paris-football";
}

export function applyAffiliateUrls(match: MatchInput, pages?: BookPageIndex): void {
  const found = pages ? lookupBookPages(pages, match.home.name, match.away.name) : [];
  const links: { book: string; url: string }[] = [];
  for (const p of found) {
    if (!FR_BOOK_RE.test(p.book)) continue;
    if (!p.url || !/^https:\/\//i.test(p.url)) continue;
    if (links.some((l) => l.book === p.book)) continue;
    links.push({ book: p.book, url: p.url });
  }
  const byBook = new Map(links.map((p) => [p.book.toLowerCase(), p.url]));
  for (const b of match.current) {
    if (isUsOnlyBook(b.book) || b.book === "Modèle" || b.book === "Opening") continue;
    if (!FR_BOOK_RE.test(b.book)) continue;
    const key = b.book.toLowerCase();
    const url =
      [...byBook.entries()].find(([k]) => key.includes(k) || k.includes(key.split(" ")[0]!))?.[1] ?? b.url;
    if (url && /^https:\/\//i.test(url)) {
      b.url = url;
      b.homeUrl = url;
      b.drawUrl = url;
      b.awayUrl = url;
      if (!links.some((l) => l.book === b.book)) links.push({ book: b.book, url });
    } else {
      b.url = undefined;
      b.homeUrl = undefined;
      b.drawUrl = undefined;
      b.awayUrl = undefined;
    }
  }
  match.ticketLinks = links;
}

export function bookMeta(name: string): AffiliateBook | undefined {
  const n = name.toLowerCase().replace(/\s+/g, "");
  if (n.includes("365")) return AFFILIATE_BOOKS.bet365;
  if (n.includes("unibet")) return AFFILIATE_BOOKS.unibet;
  if (n.includes("betclic")) return AFFILIATE_BOOKS.betclic;
  if (n.includes("winamax")) return AFFILIATE_BOOKS.winamax;
  if (n.includes("pmu")) return AFFILIATE_BOOKS.pmu;
  if (n.includes("bwin")) return AFFILIATE_BOOKS.bwin;
  if (n.includes("netbet")) return AFFILIATE_BOOKS.netbet;
  if (n.includes("vbet")) return AFFILIATE_BOOKS.vbet;
  if (n.includes("parions")) return AFFILIATE_BOOKS.parionssport;
  if (n.includes("zebet")) return AFFILIATE_BOOKS.zebet;
  return undefined;
}
