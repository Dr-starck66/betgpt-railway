import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { seasonStartYear } from "./stats.ts";
import type { HistoricalMatch, LeagueId } from "./types.ts";
import { slugify } from "@/lib/programmatic.ts";

export const ARCHIVE_SCHEMA = 3;
const FILE_DEFAULT = join(process.cwd(), "data", "archive-history.json");

export const ARCHIVE_LEAGUES: { id: LeagueId; slug: string }[] = [
  { id: "CL", slug: "uefa.champions" },
  { id: "EL", slug: "uefa.europa" },
  { id: "PL", slug: "eng.1" },
  { id: "LL", slug: "esp.1" },
  { id: "BL", slug: "ger.1" },
  { id: "SA", slug: "ita.1" },
  { id: "L1", slug: "fra.1" },
  { id: "ER", slug: "ned.1" },
  { id: "PT", slug: "por.1" },
  { id: "SC", slug: "sco.1" },
  { id: "TR", slug: "tur.1" },
];

export type LeagueCoverage = {
  earliestMatch: string;
  latestMatch: string;
  count: number;
  latestSeason: string;
};

export type ArchiveStore = {
  schema: number;
  fetchedAt: number;
  coverage: Partial<Record<LeagueId, LeagueCoverage>>;
  matches: HistoricalMatch[];
};

export type LeagueHealth = {
  league: LeagueId;
  label: string;
  n: number;
  earliest: string;
  latest: string;
  latestSeason: string;
  daysBehind: number;
  lastRefresh: string;
  stale: boolean;
};

export type ArchiveHealth = {
  n: number;
  earliest: string;
  latest: string;
  fetchedAt: number;
  label: string;
  overallStale: boolean;
  leagues: LeagueHealth[];
};

export type EspnFetcher = (slug: string, fromYmd: string, toYmd: string) => Promise<unknown>;

const LEAGUE_LABEL: Record<LeagueId, string> = {
  PL: "Premier League",
  LL: "La Liga",
  BL: "Bundesliga",
  SA: "Serie A",
  L1: "Ligue 1",
  ER: "Eredivisie",
  PT: "Primeira Liga",
  SC: "Premiership écossaise",
  TR: "Süper Lig",
  CL: "Ligue des champions",
  EL: "Ligue Europa",
  NL: "Internationaux",
};

let FILE = FILE_DEFAULT;
let MEM: ArchiveStore | null = null;
let INFLIGHT: Promise<HistoricalMatch[]> | null = null;
let fetcher: EspnFetcher = defaultEspnFetch;

export function configureArchive(opts: { file?: string; fetcher?: EspnFetcher | null }): void {
  if (opts.file) FILE = opts.file;
  if (opts.fetcher === null) fetcher = defaultEspnFetch;
  else if (opts.fetcher) fetcher = opts.fetcher;
}

export function bustArchive(): void {
  MEM = null;
  INFLIGHT = null;
  INDEX = null;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function eachYmd(from: string, to: string): string[] {
  const start = Date.parse(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [from];
  const out: string[] = [];
  for (let t = start; t <= end && out.length < 40; t += 86400000) out.push(ymd(new Date(t)));
  return out;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthWindows(fromIso: string, toIso: string): { from: string; to: string }[] {
  const start = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const out: { from: string; to: string }[] = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur.getTime() <= last.getTime()) {
    const chunkStart = new Date(cur);
    const nextMonth = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    const chunkEnd = new Date(Math.min(nextMonth.getTime() - 86400000, last.getTime()));
    out.push({ from: ymd(chunkStart), to: ymd(chunkEnd) });
    cur = nextMonth;
  }
  return out;
}

export function parseHistory(payload: unknown, league: LeagueId): HistoricalMatch[] {
  const events = (payload as { events?: Record<string, unknown>[] })?.events ?? [];
  const out: HistoricalMatch[] = [];
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const comp = ((e.competitions as Record<string, unknown>[] | undefined) ?? [])[0];
    if (!comp) continue;
    const status =
      ((comp.status as { type?: { completed?: boolean; state?: string } } | undefined)?.type ??
        (e.status as { type?: { completed?: boolean; state?: string } } | undefined)?.type) ?? {};
    if (!status.completed && status.state !== "post") continue;
    const comps =
      (comp.competitors as {
        homeAway?: string;
        score?: string | number;
        team?: { id?: string; displayName?: string };
      }[]) ?? [];
    const homeC = comps.find((c) => c.homeAway === "home");
    const awayC = comps.find((c) => c.homeAway === "away");
    const gh = Number(homeC?.score);
    const ga = Number(awayC?.score);
    const eid = e.id;
    if (eid == null || eid === "") continue;
    if (!homeC?.team?.id || !awayC?.team?.id || !Number.isFinite(gh) || !Number.isFinite(ga)) continue;
    if (gh < 0 || ga < 0 || gh > 30 || ga > 30) continue;
    const kickoff = String(comp.date ?? e.date ?? "");
    if (!kickoff || !Number.isFinite(Date.parse(kickoff))) continue;
    out.push({
      id: `espn-${eid}`,
      league,
      kickoff,
      homeId: String(homeC.team.id),
      awayId: String(awayC.team.id),
      homeName: homeC.team.displayName,
      awayName: awayC.team.displayName,
      goalsHome: gh,
      goalsAway: ga,
      oddsHome: 0,
      oddsDraw: 0,
      oddsAway: 0,
      closingHome: 0,
      closingDraw: 0,
      closingAway: 0,
      sourceKind: "official-history",
    });
  }
  return out;
}

export function mergeMatches(existing: HistoricalMatch[], incoming: HistoricalMatch[]): HistoricalMatch[] {
  const map = new Map<string, HistoricalMatch>();
  for (const m of existing) {
    if (!m?.id) continue;
    map.set(m.id, { ...m, sourceKind: m.sourceKind ?? "official-history" });
  }
  for (const m of incoming) {
    if (!m?.id) continue;
    if (m.sourceKind === "synthetic-test") continue;
    map.set(m.id, { ...m, sourceKind: m.sourceKind ?? "official-history" });
  }
  return [...map.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function computeCoverage(matches: HistoricalMatch[]): Record<LeagueId, LeagueCoverage> {
  const empty = (): LeagueCoverage => ({ earliestMatch: "", latestMatch: "", count: 0, latestSeason: "" });
  const map = {} as Record<LeagueId, LeagueCoverage>;
  for (const l of ARCHIVE_LEAGUES) map[l.id] = empty();
  for (const m of matches) {
    const cur = map[m.league] ?? empty();
    cur.count += 1;
    if (!cur.earliestMatch || m.kickoff < cur.earliestMatch) cur.earliestMatch = m.kickoff;
    if (!cur.latestMatch || m.kickoff > cur.latestMatch) cur.latestMatch = m.kickoff;
    map[m.league] = cur;
  }
  for (const l of ARCHIVE_LEAGUES) {
    const cur = map[l.id]!;
    if (cur.latestMatch) {
      const y = seasonStartYear(cur.latestMatch);
      cur.latestSeason = `${y}-${String(y + 1).slice(2)}`;
    }
  }
  return map;
}

function expectedLatestMs(now: number): number {
  const d = new Date(now);
  const month = d.getUTCMonth();
  if (month === 5 || month === 6) {
    return Date.UTC(d.getUTCFullYear(), 4, 31);
  }
  return now - 3 * 86400000;
}

export function daysBehind(latestIso: string, now = Date.now()): number {
  if (!latestIso) return 9999;
  const t = Date.parse(latestIso);
  if (!Number.isFinite(t)) return 9999;
  const expected = expectedLatestMs(now);
  return Math.max(0, Math.round((expected - t) / 86400000));
}

export function isLeagueStale(latestIso: string, now = Date.now(), maxDays = 14): boolean {
  return daysBehind(latestIso, now) > maxDays;
}

function fmtFr(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function coverageLabel(matches: HistoricalMatch[]): string {
  let from = "";
  let to = "";
  for (const m of matches) {
    if (!from || m.kickoff < from) from = m.kickoff;
    if (!to || m.kickoff > to) to = m.kickoff;
  }
  if (!from || !to) return "Archive ESPN (couverture inconnue)";
  return `Archive ESPN — ${fmtFr(from)} → ${fmtFr(to)}`;
}

export function archiveHealth(store: ArchiveStore | null, now = Date.now()): ArchiveHealth {
  const matches = store?.matches ?? [];
  const coverage = store?.coverage ?? computeCoverage(matches);
  const leagues: LeagueHealth[] = ARCHIVE_LEAGUES.map((l) => {
    const c = coverage[l.id];
    const latest = c?.latestMatch ?? "";
    const behind = daysBehind(latest, now);
    return {
      league: l.id,
      label: LEAGUE_LABEL[l.id],
      n: c?.count ?? 0,
      earliest: c?.earliestMatch ?? "",
      latest,
      latestSeason: c?.latestSeason ?? "",
      daysBehind: behind,
      lastRefresh: store?.fetchedAt ? new Date(store.fetchedAt).toISOString() : "",
      stale: isLeagueStale(latest, now),
    };
  });
  let earliest = "";
  let latest = "";
  for (const m of matches) {
    if (!earliest || m.kickoff < earliest) earliest = m.kickoff;
    if (!latest || m.kickoff > latest) latest = m.kickoff;
  }
  return {
    n: matches.length,
    earliest,
    latest,
    fetchedAt: store?.fetchedAt ?? 0,
    label: coverageLabel(matches),
    overallStale: leagues.some((l) => l.stale || l.n === 0),
    leagues,
  };
}

export function missingWindows(
  coverage: Partial<Record<LeagueId, LeagueCoverage>>,
  now = Date.now(),
  overlapDays = 2,
): { league: LeagueId; slug: string; from: string; to: string }[] {
  const today = isoDay(new Date(now));
  const out: { league: LeagueId; slug: string; from: string; to: string }[] = [];
  for (const l of ARCHIVE_LEAGUES) {
    const latest = coverage[l.id]?.latestMatch;
    let fromIso = "2020-09-01";
    if (latest) {
      const t = Date.parse(latest) - overlapDays * 86400000;
      fromIso = isoDay(new Date(Number.isFinite(t) ? t : Date.parse(latest)));
    }
    if (fromIso > today) continue;
    for (const w of monthWindows(fromIso, today)) {
      out.push({ league: l.id, slug: l.slug, from: w.from, to: w.to });
    }
  }
  return out;
}

async function fetchEspnDay(slug: string, day: string): Promise<unknown[] | null> {
  // ESPN rejects dates=YYYYMMDD-YYYYMMDD (HTTP 400). One day per call.
  const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day}&limit=400&lang=en&region=gb`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", "Accept-Language": "en" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { events?: unknown[] };
  return Array.isArray(json?.events) ? json.events : [];
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

async function defaultEspnFetch(slug: string, from: string, to: string): Promise<unknown> {
  const days = from === to ? [from] : eachYmd(from, to);
  const batches = await mapPool(days, 6, async (day) => {
    try {
      return await fetchEspnDay(slug, day);
    } catch {
      return null;
    }
  });
  if (batches.every((batch) => batch == null)) throw new Error(`ESPN ${slug} ${from}-${to}`);
  return { events: batches.flatMap((batch) => batch ?? []) };
}

async function fetchWindow(league: LeagueId, slug: string, from: string, to: string, depth = 0): Promise<HistoricalMatch[]> {
  let payload: unknown = { events: [] };
  try {
    payload = await fetcher(slug, from, to);
  } catch {
    return [];
  }
  const rows = parseHistory(payload, league);
  const nEvents = ((payload as { events?: unknown[] })?.events ?? []).length;
  if (nEvents >= 390 && from !== to && depth < 6) {
    const a = Date.parse(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00:00Z`);
    const b = Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}T00:00:00Z`);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      const mid = new Date(a + Math.floor((b - a) / 2));
      const midYmd = ymd(mid);
      const next = ymd(new Date(mid.getTime() + 86400000));
      const left = await fetchWindow(league, slug, from, midYmd, depth + 1);
      const right = await fetchWindow(league, slug, next, to, depth + 1);
      return mergeMatches(left, right);
    }
  }
  return rows;
}

function loadDisk(): ArchiveStore | null {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as ArchiveStore;
    if (!raw || !Array.isArray(raw.matches) || raw.matches.length < 1) return null;
    if (raw.schema !== 2 && raw.schema !== ARCHIVE_SCHEMA) return null;
    const matches = raw.matches.map((m) => ({ ...m, sourceKind: m.sourceKind ?? ("official-history" as const) }));
    return {
      schema: ARCHIVE_SCHEMA,
      fetchedAt: raw.fetchedAt ?? 0,
      coverage: raw.coverage && Object.keys(raw.coverage).length ? raw.coverage : computeCoverage(matches),
      matches,
    };
  } catch {
    return null;
  }
}

export function saveArchiveAtomic(store: ArchiveStore, file = FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(store));
}

function persist(store: ArchiveStore): void {
  try {
    saveArchiveAtomic(store, FILE);
  } catch {
    /* keep memory */
  }
}

function asStore(matches: HistoricalMatch[], fetchedAt = Date.now()): ArchiveStore {
  return { schema: ARCHIVE_SCHEMA, fetchedAt, coverage: computeCoverage(matches), matches };
}

export function loadArchiveStore(): ArchiveStore | null {
  if (MEM) return MEM;
  MEM = loadDisk();
  return MEM;
}

export function loadArchiveHistory(): HistoricalMatch[] {
  return loadArchiveStore()?.matches ?? [];
}

export function getArchiveHealth(now = Date.now()): ArchiveHealth {
  return archiveHealth(loadArchiveStore(), now);
}

async function refreshIncremental(base: ArchiveStore, now: number): Promise<ArchiveStore> {
  const windows = missingWindows(base.coverage, now);
  if (!windows.length) {
    return { ...base, fetchedAt: now, coverage: computeCoverage(base.matches) };
  }
  let matches = base.matches;
  const byLeague = new Map<LeagueId, { slug: string; windows: { from: string; to: string }[] }>();
  for (const w of windows) {
    const cur = byLeague.get(w.league) ?? { slug: w.slug, windows: [] };
    cur.windows.push({ from: w.from, to: w.to });
    byLeague.set(w.league, cur);
  }
  for (const [league, job] of byLeague) {
    const incoming: HistoricalMatch[] = [];
    for (const w of job.windows) {
      const rows = await fetchWindow(league, job.slug, w.from, w.to);
      incoming.push(...rows);
    }
    if (incoming.length) {
      matches = mergeMatches(matches, incoming);
      const next = asStore(matches, now);
      MEM = next;
      persist(next);
    }
  }
  const final = asStore(matches, now);
  MEM = final;
  persist(final);
  return final;
}

export async function ensureArchiveHistory(opts: { force?: boolean; now?: number } = {}): Promise<HistoricalMatch[]> {
  if (process.env.BETGPT_OFFLINE === "1") return loadArchiveHistory();
  const now = opts.now ?? Date.now();
  const disk = loadArchiveStore();
  if (disk && !opts.force) {
    const health = archiveHealth(disk, now);
    const recentAttempt = now - (disk.fetchedAt || 0) < 6 * 3600000;
    // A fresh fetchedAt can still wrap stale matches — health uses latest kickoff.
    // If we already tried recently, do not hammer ESPN and do not block the caller.
    if (recentAttempt) {
      MEM = disk;
      return disk.matches;
    }
    if (!health.overallStale) {
      MEM = disk;
      if (!INFLIGHT) {
        INFLIGHT = refreshIncremental(disk, now)
          .catch(() => disk)
          .finally(() => {
            INFLIGHT = null;
          })
          .then((s) => s.matches);
      }
      return disk.matches;
    }
  }
  if (INFLIGHT) return INFLIGHT;
  INFLIGHT = (async () => {
    const base = loadArchiveStore() ?? asStore([], 0);
    try {
      const next = await refreshIncremental(base, now);
      return next.matches;
    } catch {
      return base.matches;
    } finally {
      INFLIGHT = null;
    }
  })();
  return INFLIGHT;
}

export function archiveSlug(h: Pick<HistoricalMatch, "homeName" | "awayName" | "kickoff" | "id">): string {
  const day = String(h.kickoff ?? "").slice(0, 10);
  const a = slugify(h.homeName ?? "");
  const b = slugify(h.awayName ?? "");
  if (a && b && day) return `${a}-${b}-${day}`;
  return h.id;
}

function foldId(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(as|fc|cf|ac|rb|fk)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function espnNum(id: string): string {
  const m = String(id ?? "").match(/(\d{5,12})/);
  return m?.[1] ?? "";
}

/** Same club across ESPN and the bookmaker feed (Barcelone/Barcelona, PSG, Hamburger SV…). */
function clubKey(name: string): string {
  const cleaned = String(name ?? "").replace(/\b(aj|sv|fc|sc|cf|ac)\b/gi, " ");
  let s = foldId(cleaned).replace(/^(sv|sc|rc|ud|cd)/, "").replace(/(sv|fc|sc)$/, "");
  if (s === "barcelone" || s === "barca") s = "barcelona";
  if (s === "psg") s = "parissaintgermain";
  if (s === "inter") s = "internazionale";
  if (s === "hamburger") s = "hamburg";
  if (s.startsWith("brighton")) s = "brighton";
  if (s.startsWith("deportivo")) s = "deportivo";
  if (s.startsWith("atletico") && s.includes("madrid")) s = "atleticomadrid";
  if (s === "elversberg") s = "elversberg";
  return s;
}

/** Finished ESPN match by id (`espn-401879311`), raw event id, or name-date slug. */
export function findArchiveMatch(id: string): HistoricalMatch | null {
  const want = String(id ?? "").trim();
  if (!want) return null;
  const idx = archiveIndex();
  const direct = idx.byId.get(want);
  if (direct) return direct;
  const num = espnNum(want);
  if (num) {
    const byNum = idx.byId.get(num);
    if (byNum) return byNum;
  }
  const folded = foldId(want);
  return (folded && idx.bySlug.get(folded)) || null;
}

/** Official final for a fixture already stored in the archive, by id or by teams and day. */
export function officialResult(input: { id?: string; homeName: string; awayName: string; kickoff: string }): HistoricalMatch | null {
  const idx = archiveIndex();
  if (input.id) {
    const byId = idx.byId.get(input.id) ?? idx.byId.get(espnNum(input.id));
    if (byId) return byId;
  }
  const day = String(input.kickoff ?? "").slice(0, 10);
  const home = clubKey(input.homeName);
  const away = clubKey(input.awayName);
  if (!home || !away || day.length < 10) return null;
  return idx.byFixture.get(`${home}|${away}|${day}`) ?? null;
}

type ArchiveIndex = {
  src: HistoricalMatch[];
  byId: Map<string, HistoricalMatch>;
  byFixture: Map<string, HistoricalMatch>;
  bySlug: Map<string, HistoricalMatch>;
};

let INDEX: ArchiveIndex | null = null;

function archiveIndex(): ArchiveIndex {
  const rows = loadArchiveHistory();
  if (INDEX && INDEX.src === rows) return INDEX;
  const byId = new Map<string, HistoricalMatch>();
  const byFixture = new Map<string, HistoricalMatch>();
  const bySlug = new Map<string, HistoricalMatch>();
  for (const m of rows) {
    byId.set(m.id, m);
    const num = espnNum(m.id);
    if (num) byId.set(num, m);
    const day = String(m.kickoff).slice(0, 10);
    bySlug.set(foldId(archiveSlug(m)), m);
    if (m.homeName && m.awayName) {
      byFixture.set(`${clubKey(m.homeName)}|${clubKey(m.awayName)}|${day}`, m);
      bySlug.set(foldId(`${m.homeName}${m.awayName}${day}`), m);
    }
  }
  INDEX = { src: rows, byId, byFixture, bySlug };
  return INDEX;
}
