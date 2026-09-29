import { clamp } from "./math";
import type { BookOdds, LeagueId } from "./types";

const KAMBI = "https://eu-offering-api.kambicdn.com/offering/v2018/ub/listView";
const PATHS: { league: LeagueId; path: string }[] = [
  { league: "NL", path: "football/uefa_nations_league" },
  { league: "NL", path: "football/africa_cup_of_nations_qualification" },
  { league: "CL", path: "football/champions_league" },
  { league: "EL", path: "football/europa_league" },
  { league: "L1", path: "football/france/ligue_1" },
  { league: "PL", path: "football/england/premier_league" },
  { league: "LL", path: "football/spain/la_liga" },
  { league: "BL", path: "football/germany/bundesliga" },
  { league: "SA", path: "football/italy/serie_a" },
];

export const EMPTY_TOTALS = {
  over15: 0,
  over25: 0,
  over35: 0,
  under25: 0,
  bttsYes: 0,
  bttsNo: 0,
};

export function oddsKey(home: string, away: string): string {
  return `${normName(home)}|${normName(away)}`;
}

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/\b(fc|cf|afc|sc|ac|as|rc|ud|cd|ss|sk|fk|rb|calcio|the|stade)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** French book names and English calendars for the same national team. */
const TEAM_ALIAS: Record<string, string> = {
  autriche: "austria",
  grece: "greece",
  serbie: "serbia",
  paysbas: "netherlands",
  hollande: "netherlands",
  allemagne: "germany",
  lituanie: "lithuania",
  republiquedirlande: "ireland",
  republicofireland: "ireland",
  irlande: "ireland",
  paysdegalles: "wales",
  galles: "wales",
  norvege: "norway",
  danemark: "denmark",
  israel: "israel",
  georgie: "georgia",
  irlandedunord: "nireland",
  northernireland: "nireland",
  armenie: "armenia",
  lettonie: "latvia",
  suede: "sweden",
  roumanie: "romania",
  pologne: "poland",
  bosnieherzegovine: "bosnia",
  bosniaherzegovina: "bosnia",
  turquie: "turkey",
  turkiye: "turkey",
  montenegro: "montenegro",
  chypre: "cyprus",
  hongrie: "hungary",
  italie: "italy",
  belgique: "belgium",
  slovenie: "slovenia",
  ecosse: "scotland",
  bulgarie: "bulgaria",
  islande: "iceland",
  estonie: "estonia",
  ilesferoe: "faroe",
  faroeislands: "faroe",
  albanie: "albania",
  bielorussie: "belarus",
  macedoinedunord: "nmacedonia",
  northmacedonia: "nmacedonia",
  suisse: "switzerland",
  angleterre: "england",
  espagne: "spain",
  tchequie: "czechia",
  czechrepublic: "czechia",
  croatie: "croatia",
  slovaquie: "slovakia",
  moldavie: "moldova",
  azerbaidjan: "azerbaijan",
  andorre: "andorra",
  saintmarin: "sanmarino",
  sanmarino: "sanmarino",
  finlande: "finland",
  cotedivoire: "ivorycoast",
  ivorycoast: "ivorycoast",
  tunisie: "tunisia",
  ouganda: "uganda",
  cameroun: "cameroon",
  comores: "comoros",
  guineebissau: "guineabissau",
  guinee: "guinea",
  senegal: "senegal",
  nigeria: "nigeria",
  egypte: "egypt",
  maroc: "morocco",
  algerie: "algeria",
  afriquedusud: "southafrica",
  capvert: "capeverde",
  burkinafaso: "burkina",
};

function canonName(s: string): string {
  const n = normName(s);
  return TEAM_ALIAS[n] ?? n;
}

function closeName(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

/** Loose home/away identity so "AS Roma" matches "Roma", "Sabah FK" matches "Sabah". */
export function sameFixture(h1: string, a1: string, h2: string, a2: string): boolean {
  const x1 = canonName(h1);
  const y1 = canonName(a1);
  const x2 = canonName(h2);
  const y2 = canonName(a2);
  return (closeName(x1, x2) && closeName(y1, y2)) || (closeName(x1, y2) && closeName(y1, x2));
}

export function lookupUniBook(
  books: Map<string, BookOdds>,
  home: string,
  away: string,
): BookOdds | undefined {
  const exact = books.get(oddsKey(home, away));
  if (exact) return exact;
  for (const [k, b] of books) {
    const [h, a] = k.split("|");
    if (h && a && sameFixture(h, a, home, away)) return b;
  }
  return undefined;
}

type UniEvent = {
  event?: {
    id?: number;
    homeName?: string;
    awayName?: string;
    englishName?: string;
    start?: string;
    state?: string;
    group?: string;
  };
  betOffers?: {
    betOfferType?: { name?: string };
    criterion?: { label?: string };
    outcomes?: { type?: string; label?: string; odds?: number; line?: number }[];
  }[];
};

function kambiDec(odds?: number, max = 80): number | null {
  if (!odds || odds < 1000) return null;
  return clamp(odds / 1000, 1.05, max);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json",
      Referer: "https://www.unibet.com/",
      Origin: "https://www.unibet.com",
    },
  });
  if (!res.ok) throw new Error(`Unibet ${res.status}`);
  return res.json();
}

function parseUni(
  ev: UniEvent,
): { key: string; id?: number; start?: string; home: string; away: string; book: BookOdds; competition?: string } | null {
  const homeName = ev.event?.homeName;
  const awayName = ev.event?.awayName;
  if (!homeName || !awayName) return null;
  const state = (ev.event?.state ?? "").toUpperCase();
  const startMs = ev.event?.start ? Date.parse(ev.event.start) : NaN;
  // In-play Match 1X2 (ex. Fener 11.50 / Roma 1.32 à 0-1) n'est pas une cote listée.
  if (state && state !== "NOT_STARTED") return null;
  if (Number.isFinite(startMs) && Date.now() >= startMs) return null;
  const match = (ev.betOffers ?? []).find((b) => (b.betOfferType?.name ?? "") === "Match");
  const outs = match?.outcomes ?? [];
  const o1 = kambiDec(outs.find((o) => o.type === "OT_ONE")?.odds);
  const ox = kambiDec(outs.find((o) => o.type === "OT_CROSS")?.odds);
  const o2 = kambiDec(outs.find((o) => o.type === "OT_TWO")?.odds);
  if (!o1 || !ox || !o2) return null;
  return {
    key: oddsKey(homeName, awayName),
    id: ev.event?.id,
    start: ev.event?.start,
    home: homeName,
    away: awayName,
    competition: ev.event?.group,
    book: {
      book: "Unibet",
      home: o1,
      draw: ox,
      away: o2,
      ...EMPTY_TOTALS,
      observedAt: new Date().toISOString(),
    },
  };
}

type EventExtras = {
  cs: Record<string, number>;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
};

function isHalfTime(label: string): boolean {
  return /mi-temps|1ere|1ère|half|1st half/.test(label);
}

async function fetchEventExtras(eventId: number): Promise<EventExtras> {
  const empty: EventExtras = { cs: {}, ...EMPTY_TOTALS };
  try {
    const raw = (await fetchJson(
      `https://eu-offering-api.kambicdn.com/offering/v2018/ub/betoffer/event/${eventId}.json?lang=fr_FR&market=FR`,
    )) as {
      betOffers?: {
        betOfferType?: { name?: string };
        criterion?: { label?: string };
        outcomes?: { type?: string; label?: string; odds?: number; line?: number }[];
      }[];
    };
    const extras: EventExtras = { cs: {}, ...EMPTY_TOTALS };
    for (const b of raw.betOffers ?? []) {
      const type = (b.betOfferType?.name ?? "").toLowerCase();
      const label = (b.criterion?.label ?? "").toLowerCase();
      if (isHalfTime(label)) continue;
      if (type.includes("correct") || label === "score exact" || label.includes("correct score")) {
        for (const o of b.outcomes ?? []) {
          const lab = String(o.label ?? "")
            .trim()
            .replace(/\s+/g, "")
            .replace("–", "-")
            .replace("—", "-");
          if (!/^\d+-\d+$/.test(lab)) continue;
          const dec = kambiDec(o.odds, 80);
          if (dec && dec >= 4) extras.cs[lab] = dec;
        }
        continue;
      }
      if (type.includes("plus de") && label === "nombre total de buts") {
        for (const o of b.outcomes ?? []) {
          const line = (o.line ?? 0) / 1000;
          const dec = kambiDec(o.odds);
          if (!dec) continue;
          const over = (o.type ?? "").includes("OVER") || /plus/i.test(o.label ?? "");
          if (Math.abs(line - 1.5) < 0.05 && over) extras.over15 = dec;
          if (Math.abs(line - 2.5) < 0.05 && over) extras.over25 = dec;
          if (Math.abs(line - 2.5) < 0.05 && !over) extras.under25 = dec;
          if (Math.abs(line - 3.5) < 0.05 && over) extras.over35 = dec;
        }
        continue;
      }
      if (type.includes("oui") && label === "les deux équipes marquent") {
        for (const o of b.outcomes ?? []) {
          const dec = kambiDec(o.odds);
          if (!dec) continue;
          if ((o.type ?? "").includes("YES") || /^oui$/i.test(o.label ?? "")) extras.bttsYes = dec;
          if ((o.type ?? "").includes("NO") || /^non$/i.test(o.label ?? "")) extras.bttsNo = dec;
        }
      }
    }
    return extras;
  } catch {
    return empty;
  }
}

async function fillExtras(parsed: { key: string; id?: number; start?: string; book: BookOdds }[]): Promise<void> {
  const now = Date.now();
  const withId = parsed
    .filter((p) => p.id)
    .sort((a, b) => {
      const ta = a.start ? new Date(a.start).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.start ? new Date(b.start).getTime() : Number.POSITIVE_INFINITY;
      return Math.abs(ta - now) - Math.abs(tb - now);
    })
    .slice(0, 12);
  const deadline = Date.now() + 8000;
  for (let i = 0; i < withId.length; i += 6) {
    if (Date.now() > deadline) break;
    const chunk = withId.slice(i, i + 6);
    const got = await Promise.all(chunk.map((p) => fetchEventExtras(p.id!)));
    chunk.forEach((p, j) => {
      const ex = got[j];
      if (!ex) return;
      if (Object.keys(ex.cs).length) {
        p.book.cs = ex.cs;
        if (ex.cs["1-1"]) p.book.cs11 = ex.cs["1-1"];
      }
      if (ex.over15) p.book.over15 = ex.over15;
      if (ex.over25) p.book.over25 = ex.over25;
      if (ex.over35) p.book.over35 = ex.over35;
      if (ex.under25) p.book.under25 = ex.under25;
      if (ex.bttsYes) p.book.bttsYes = ex.bttsYes;
      if (ex.bttsNo) p.book.bttsNo = ex.bttsNo;
    });
  }
}

export type UnibetFixture = {
  key: string;
  league: LeagueId;
  start: string;
  home: string;
  away: string;
  book: BookOdds;
  competition?: string;
};

export async function fetchUnibetBooks(): Promise<{ books: Map<string, BookOdds>; fixtures: UnibetFixture[] }> {
  const books = new Map<string, BookOdds>();
  const fixtures: UnibetFixture[] = [];
  const parts = await Promise.allSettled(
    PATHS.map(({ path }) => fetchJson(`${KAMBI}/${path}.json?lang=fr_FR&market=FR`)),
  );
  const parsed: { key: string; id?: number; start?: string; home: string; away: string; league: LeagueId; book: BookOdds; competition?: string }[] = [];
  parts.forEach((part, i) => {
    if (part.status !== "fulfilled") return;
    const league = PATHS[i]!.league;
    const events = ((part.value as { events?: UniEvent[] }).events ?? []) as UniEvent[];
    for (const ev of events) {
      const row = parseUni(ev);
      if (!row?.start) continue;
      parsed.push({ ...row, league, start: row.start as string });
    }
  });
  await Promise.race([fillExtras(parsed), new Promise<void>((r) => setTimeout(r, 8500))]);
  for (const row of parsed) {
    books.set(row.key, row.book);
    fixtures.push({
      key: row.key,
      league: row.league,
      start: row.start ?? "",
      home: row.home,
      away: row.away,
      book: row.book,
      competition: row.competition,
    });
  }
  return { books, fixtures };
}
