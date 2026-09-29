import { clamp } from "./math.ts";
import type { HistoricalMatch, LeagueId } from "./types.ts";

export type SeasonWindowId = "all" | "current" | "prev" | "last-3" | "last-5";

export type ScoreCount = {
  score: string;
  home: number;
  away: number;
  n: number;
  freq: number;
};

export type Provenance = {
  provider: "ESPN";
  source: string;
  sourceKind: "official-history";
  n: number;
  from: string;
  to: string;
  computedAt: string;
};

export type TeamRates = {
  id: string;
  name: string;
  nHome: number;
  nAway: number;
  nAll: number;
  gfHome: number;
  gaHome: number;
  gfAway: number;
  gaAway: number;
  scoredHome: number;
  scoredAway: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  failedToScoreHome: number;
  failedToScoreAway: number;
  bttsHome: number;
  bttsAway: number;
  over25Home: number;
  over25Away: number;
  zeroZeroHome: number;
  zeroZeroAway: number;
  exactHome: Map<string, number>;
  exactAway: Map<string, number>;
};

export const ARCHIVE_SOURCE = "ESPN";

export function archiveRangeLabel(rows: HistoricalMatch[]): string {
  let from = "";
  let to = "";
  for (const m of rows) {
    if (!from || m.kickoff < from) from = m.kickoff;
    if (!to || m.kickoff > to) to = m.kickoff;
  }
  if (!from || !to) return "Archive ESPN (couverture inconnue)";
  const fmt = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return iso.slice(0, 10);
    return new Date(t).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `Archive ESPN — ${fmt(from)} → ${fmt(to)}`;
}

export const LEAGUE_FR: Record<LeagueId, string> = {
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

export const LEAGUE_COUNTRY: Record<LeagueId, string> = {
  PL: "Angleterre",
  LL: "Espagne",
  BL: "Allemagne",
  SA: "Italie",
  L1: "France",
  ER: "Pays-Bas",
  PT: "Portugal",
  SC: "Écosse",
  TR: "Turquie",
  CL: "Europe",
  EL: "Europe",
  NL: "International",
};

export const LEAGUE_SLUG: Record<LeagueId, string> = {
  L1: "ligue-1",
  PL: "premier-league",
  LL: "la-liga",
  BL: "bundesliga",
  SA: "serie-a",
  ER: "eredivisie",
  PT: "primeira-liga",
  SC: "premiership-ecossaise",
  TR: "super-lig",
  CL: "ligue-des-champions",
  EL: "ligue-europa",
  NL: "ligue-des-nations",
};

export const SLUG_LEAGUE: Record<string, LeagueId> = {
  "ligue-1": "L1",
  "premier-league": "PL",
  "la-liga": "LL",
  bundesliga: "BL",
  "serie-a": "SA",
  eredivisie: "ER",
  "primeira-liga": "PT",
  "premiership-ecossaise": "SC",
  "super-lig": "TR",
  "ligue-des-champions": "CL",
  "ligue-europa": "EL",
  "ligue-des-nations": "NL",
};

export function foldName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|afc|sc|ac|rc|ud|cd|ss|calcio|as|fk|sk|rb)\b/g, "")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, "");
}

export function scoreKey(h: number, a: number): string {
  return `${h}-${a}`;
}

/** Season start year: Aug–Jul. 2024-08-01 → 2024 (2024-25). 2024-07-31 → 2023. */
export function seasonStartYear(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 7 ? y : y - 1;
}

export function currentSeasonStartYear(now = Date.now()): number {
  const d = new Date(now);
  return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function seasonLabelYears(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function currentSeason(now = Date.now()): { startYear: number; label: string } {
  const startYear = currentSeasonStartYear(now);
  return { startYear, label: seasonLabelYears(startYear) };
}

export function previousCompleteSeason(now = Date.now()): { startYear: number; label: string } {
  const startYear = currentSeasonStartYear(now) - 1;
  return { startYear, label: seasonLabelYears(startYear) };
}

export function lastNCompleteSeasons(n: number, now = Date.now()): { startYears: number[]; fromYear: number; toYear: number } {
  const cur = currentSeasonStartYear(now);
  const toYear = cur - 1;
  const fromYear = toYear - Math.max(1, n) + 1;
  const startYears: number[] = [];
  for (let y = fromYear; y <= toYear; y++) startYears.push(y);
  return { startYears, fromYear, toYear };
}

export function seasonWindow(id: SeasonWindowId, now = Date.now()): { fromYear: number; toYear: number } {
  const cur = currentSeasonStartYear(now);
  if (id === "current") return { fromYear: cur, toYear: cur };
  if (id === "prev") {
    const p = previousCompleteSeason(now);
    return { fromYear: p.startYear, toYear: p.startYear };
  }
  if (id === "last-3") {
    const w = lastNCompleteSeasons(3, now);
    return { fromYear: w.fromYear, toYear: w.toYear };
  }
  if (id === "last-5") {
    const w = lastNCompleteSeasons(5, now);
    return { fromYear: w.fromYear, toYear: w.toYear };
  }
  return { fromYear: 2015, toYear: cur };
}

export function seasonLabel(id: SeasonWindowId, now = Date.now()): string {
  const w = seasonWindow(id, now);
  const one = (y: number) => `${y}-${String(y + 1).slice(2)}`;
  if (id === "current") return `Saison ${one(w.fromYear)}`;
  if (id === "prev") return `Saison ${one(w.fromYear)}`;
  if (id === "last-3") return "3 saisons complètes";
  if (id === "last-5") return "5 saisons complètes";
  return "Toutes saisons disponibles";
}

export function uniqueMatches(rows: HistoricalMatch[]): HistoricalMatch[] {
  const seen = new Set<string>();
  const out: HistoricalMatch[] = [];
  for (const m of rows) {
    if (!m?.id || seen.has(m.id)) continue;
    if (!Number.isFinite(m.goalsHome) || !Number.isFinite(m.goalsAway)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** Public stats: drop synthetic fixtures (`h-…` / sourceKind). Tests may still pass unmarked rows. */
export function officialHistory(rows: HistoricalMatch[]): HistoricalMatch[] {
  return uniqueMatches(rows).filter((m) => {
    if (m.sourceKind === "synthetic-test") return false;
    if (String(m.id).startsWith("h-")) return false;
    return true;
  });
}

export function filterHistory(
  rows: HistoricalMatch[],
  opts: {
    league?: LeagueId;
    country?: string;
    season?: SeasonWindowId;
    now?: number;
    lastN?: number;
    teamId?: string;
    teamName?: string;
  } = {},
): HistoricalMatch[] {
  const uniq = uniqueMatches(rows);
  const now = opts.now ?? Date.now();
  const win = opts.season ? seasonWindow(opts.season, now) : null;
  const wantTeam = opts.teamId || opts.teamName;
  const fold = opts.teamName ? foldName(opts.teamName) : "";
  let out = uniq.filter((m) => {
    if (opts.league && m.league !== opts.league) return false;
    if (opts.country) {
      const c = LEAGUE_COUNTRY[m.league];
      if (c !== opts.country) return false;
    }
    if (win) {
      const y = seasonStartYear(m.kickoff);
      if (y < win.fromYear || y > win.toYear) return false;
    }
    if (wantTeam && !teamInMatch(m, opts.teamId ?? "", fold || (opts.teamName ?? ""))) return false;
    return true;
  });
  out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (opts.lastN && opts.lastN > 0 && out.length > opts.lastN) out = out.slice(-opts.lastN);
  return out;
}

export function teamInMatch(m: HistoricalMatch, id: string, name: string): boolean {
  if (id && (m.homeId === id || m.awayId === id)) return true;
  const fold = foldName(name);
  if (!fold) return false;
  if (m.homeName && foldName(m.homeName) === fold) return true;
  if (m.awayName && foldName(m.awayName) === fold) return true;
  return false;
}

export function teamIsHome(m: HistoricalMatch, id: string, name: string): boolean {
  if (id && m.homeId === id) return true;
  const fold = foldName(name);
  return Boolean(fold && m.homeName && foldName(m.homeName) === fold);
}

export function provenanceOf(rows: HistoricalMatch[], now = Date.now()): Provenance {
  const clean = officialHistory(rows);
  let from = "";
  let to = "";
  for (const m of clean) {
    if (!from || m.kickoff < from) from = m.kickoff;
    if (!to || m.kickoff > to) to = m.kickoff;
  }
  return {
    provider: "ESPN",
    source: archiveRangeLabel(clean),
    sourceKind: "official-history",
    n: clean.length,
    from: from.slice(0, 10),
    to: to.slice(0, 10),
    computedAt: new Date(now).toISOString(),
  };
}

export function scoreCounts(rows: HistoricalMatch[]): ScoreCount[] {
  const map = new Map<string, ScoreCount>();
  for (const m of rows) {
    const h = m.goalsHome;
    const a = m.goalsAway;
    const key = scoreKey(h, a);
    const cur = map.get(key) ?? { score: key, home: h, away: a, n: 0, freq: 0 };
    cur.n += 1;
    map.set(key, cur);
  }
  const n = rows.length || 1;
  return [...map.values()]
    .map((r) => ({ ...r, freq: r.n / n }))
    .sort((a, b) => b.n - a.n || a.score.localeCompare(b.score));
}

export function scoreFreq(rows: HistoricalMatch[], home: number, away: number): { n: number; freq: number } {
  let k = 0;
  for (const m of rows) if (m.goalsHome === home && m.goalsAway === away) k += 1;
  return { n: k, freq: rows.length ? k / rows.length : 0 };
}

export function overFreq(rows: HistoricalMatch[], minGoals: number): { n: number; freq: number } {
  let k = 0;
  for (const m of rows) if (m.goalsHome + m.goalsAway >= minGoals) k += 1;
  return { n: k, freq: rows.length ? k / rows.length : 0 };
}

export function bttsFreq(rows: HistoricalMatch[], yes: boolean): { n: number; freq: number } {
  let k = 0;
  for (const m of rows) {
    const both = m.goalsHome > 0 && m.goalsAway > 0;
    if (both === yes) k += 1;
  }
  return { n: k, freq: rows.length ? k / rows.length : 0 };
}

export function zeroZeroByLeague(rows: HistoricalMatch[]): {
  league: LeagueId;
  label: string;
  n: number;
  n00: number;
  freq: number;
  from: string;
  to: string;
}[] {
  const map = new Map<LeagueId, { n: number; n00: number; from: string; to: string }>();
  for (const m of rows) {
    const cur = map.get(m.league) ?? { n: 0, n00: 0, from: m.kickoff, to: m.kickoff };
    cur.n += 1;
    if (m.goalsHome === 0 && m.goalsAway === 0) cur.n00 += 1;
    if (m.kickoff < cur.from) cur.from = m.kickoff;
    if (m.kickoff > cur.to) cur.to = m.kickoff;
    map.set(m.league, cur);
  }
  return [...map.entries()]
    .map(([league, v]) => ({
      league,
      label: LEAGUE_FR[league],
      n: v.n,
      n00: v.n00,
      freq: v.n ? v.n00 / v.n : 0,
      from: v.from.slice(0, 10),
      to: v.to.slice(0, 10),
    }))
    .sort((a, b) => a.freq - b.freq);
}

export function zeroZeroByTeam(
  rows: HistoricalMatch[],
  minN = 20,
): {
  id: string;
  name: string;
  n: number;
  n00: number;
  freq: number;
  nHome: number;
  n00Home: number;
  nAway: number;
  n00Away: number;
}[] {
  type Acc = {
    id: string;
    name: string;
    n: number;
    n00: number;
    nHome: number;
    n00Home: number;
    nAway: number;
    n00Away: number;
  };
  const map = new Map<string, Acc>();
  const get = (id: string, name: string): Acc | null => {
    if (!id && !name) return null;
    const key = id || foldName(name);
    let cur = map.get(key);
    if (!cur) {
      cur = { id: id || key, name, n: 0, n00: 0, nHome: 0, n00Home: 0, nAway: 0, n00Away: 0 };
      map.set(key, cur);
    }
    if (name) cur.name = name;
    if (id) cur.id = id;
    return cur;
  };
  for (const m of rows) {
    const is00 = m.goalsHome === 0 && m.goalsAway === 0;
    const home = get(m.homeId, m.homeName ?? m.homeId);
    const away = get(m.awayId, m.awayName ?? m.awayId);
    if (home) {
      home.n += 1;
      home.nHome += 1;
      if (is00) {
        home.n00 += 1;
        home.n00Home += 1;
      }
    }
    if (away) {
      away.n += 1;
      away.nAway += 1;
      if (is00) {
        away.n00 += 1;
        away.n00Away += 1;
      }
    }
  }
  return [...map.values()]
    .filter((t) => t.n >= minN)
    .map((t) => ({ ...t, freq: t.n00 / t.n }))
    .sort((a, b) => a.freq - b.freq);
}

export function indexTeamRates(rows: HistoricalMatch[]): Map<string, TeamRates> {
  const map = new Map<string, TeamRates>();
  const get = (id: string, name: string) => {
    const key = id || foldName(name);
    let r = map.get(key);
    if (!r) {
      r = emptyRates(id || key, name || key);
      map.set(key, r);
      const fold = foldName(name);
      if (fold && fold !== key) map.set(fold, r);
    } else {
      if (name) r.name = name;
      if (id) r.id = id;
    }
    return r;
  };
  const bump = (r: TeamRates, home: boolean, gh: number, ga: number) => {
    const gf = home ? gh : ga;
    const gaSide = home ? ga : gh;
    const key = scoreKey(gh, ga);
    r.nAll += 1;
    if (home) {
      r.nHome += 1;
      r.gfHome += gf;
      r.gaHome += gaSide;
      if (gf > 0) r.scoredHome += 1;
      else r.failedToScoreHome += 1;
      if (gaSide === 0) r.cleanSheetHome += 1;
      if (gf > 0 && gaSide > 0) r.bttsHome += 1;
      if (gf + gaSide >= 3) r.over25Home += 1;
      if (gf === 0 && gaSide === 0) r.zeroZeroHome += 1;
      r.exactHome.set(key, (r.exactHome.get(key) ?? 0) + 1);
    } else {
      r.nAway += 1;
      r.gfAway += gf;
      r.gaAway += gaSide;
      if (gf > 0) r.scoredAway += 1;
      else r.failedToScoreAway += 1;
      if (gaSide === 0) r.cleanSheetAway += 1;
      if (gf > 0 && gaSide > 0) r.bttsAway += 1;
      if (gf + gaSide >= 3) r.over25Away += 1;
      if (gf === 0 && gaSide === 0) r.zeroZeroAway += 1;
      r.exactAway.set(key, (r.exactAway.get(key) ?? 0) + 1);
    }
  };
  for (const m of rows) {
    bump(get(m.homeId, m.homeName ?? m.homeId), true, m.goalsHome, m.goalsAway);
    bump(get(m.awayId, m.awayName ?? m.awayId), false, m.goalsHome, m.goalsAway);
  }
  return map;
}

export function lookupRates(index: Map<string, TeamRates>, id: string, name: string): TeamRates {
  return index.get(id) ?? index.get(foldName(name)) ?? emptyRates(id, name);
}

export function emptyRates(id: string, name: string): TeamRates {
  return {
    id,
    name,
    nHome: 0,
    nAway: 0,
    nAll: 0,
    gfHome: 0,
    gaHome: 0,
    gfAway: 0,
    gaAway: 0,
    scoredHome: 0,
    scoredAway: 0,
    cleanSheetHome: 0,
    cleanSheetAway: 0,
    failedToScoreHome: 0,
    failedToScoreAway: 0,
    bttsHome: 0,
    bttsAway: 0,
    over25Home: 0,
    over25Away: 0,
    zeroZeroHome: 0,
    zeroZeroAway: 0,
    exactHome: new Map(),
    exactAway: new Map(),
  };
}

export function teamRates(rows: HistoricalMatch[], id: string, name: string): TeamRates {
  const r = emptyRates(id, name);
  for (const m of rows) {
    if (!teamInMatch(m, id, name)) continue;
    const home = teamIsHome(m, id, name);
    const gf = home ? m.goalsHome : m.goalsAway;
    const ga = home ? m.goalsAway : m.goalsHome;
    const key = scoreKey(m.goalsHome, m.goalsAway);
    r.nAll += 1;
    if (home) {
      r.nHome += 1;
      r.gfHome += gf;
      r.gaHome += ga;
      if (gf > 0) r.scoredHome += 1;
      else r.failedToScoreHome += 1;
      if (ga === 0) r.cleanSheetHome += 1;
      if (gf > 0 && ga > 0) r.bttsHome += 1;
      if (gf + ga >= 3) r.over25Home += 1;
      if (gf === 0 && ga === 0) r.zeroZeroHome += 1;
      r.exactHome.set(key, (r.exactHome.get(key) ?? 0) + 1);
    } else {
      r.nAway += 1;
      r.gfAway += gf;
      r.gaAway += ga;
      if (gf > 0) r.scoredAway += 1;
      else r.failedToScoreAway += 1;
      if (ga === 0) r.cleanSheetAway += 1;
      if (gf > 0 && ga > 0) r.bttsAway += 1;
      if (gf + ga >= 3) r.over25Away += 1;
      if (gf === 0 && ga === 0) r.zeroZeroAway += 1;
      r.exactAway.set(key, (r.exactAway.get(key) ?? 0) + 1);
    }
  }
  return r;
}

export function rate(num: number, den: number): number {
  return den > 0 ? num / den : 0;
}

export function avg(sum: number, den: number): number {
  return den > 0 ? sum / den : 0;
}

export function sampleConfidence(nLeague: number, nHome: number, nAway: number): number {
  const league = nLeague >= 80 ? 1 : nLeague >= 30 ? 0.72 : nLeague >= 10 ? 0.42 : nLeague > 0 ? 0.22 : 0.12;
  const team = clamp((nHome + nAway) / 24, 0, 1);
  return clamp(0.55 * league + 0.45 * team, 0.12, 1);
}

export function shrinkToMid(raw: number, conf: number): number {
  return 50 + (raw - 50) * (0.32 + 0.68 * clamp(conf, 0, 1));
}
