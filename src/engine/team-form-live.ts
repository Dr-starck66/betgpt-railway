import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MatchInput } from "./types.ts";
import { clubKey, lettersFromLines, linesBefore, parseSchedule, type RecentLine } from "./team-form.ts";

const TTL_MS = 6 * 60 * 60 * 1000;
const FILE = join(process.cwd(), "data", "team-form-cache.json");

type Entry = { at: number; name: string; lines: RecentLine[] };
type Cache = { teams: Record<string, Entry> };

const memory: Cache = { teams: {} };
let loaded = false;

function load(): Cache {
  if (loaded) return memory;
  loaded = true;
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Cache;
    if (raw?.teams) Object.assign(memory.teams, raw.teams);
  } catch {
    /* empty cache */
  }
  return memory;
}

function save(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(memory));
  } catch {
    /* cache optional */
  }
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchLines(name: string): Promise<RecentLine[] | null> {
  const q = encodeURIComponent(name);
  const search = (await getJson(
    `https://site.web.api.espn.com/apis/common/v3/search?query=${q}&limit=6&type=team`,
  )) as { items?: { displayName?: string; id?: string; sport?: string; defaultLeagueSlug?: string }[] } | null;
  const want = clubKey(name);
  const hit = (search?.items ?? []).find(
    (item) => item.sport === "soccer" && item.id && item.defaultLeagueSlug && clubKey(item.displayName || "") === want,
  );
  if (!hit?.id || !hit.defaultLeagueSlug) return null;
  const schedule = await getJson(
    `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${hit.defaultLeagueSlug}/teams/${hit.id}/schedule`,
  );
  if (!schedule) return null;
  return parseSchedule(hit.displayName || name, schedule);
}

function apply(match: MatchInput, entry: Entry | undefined, side: "home" | "away"): void {
  if (!entry?.lines.length) return;
  const recent = linesBefore(entry.lines, match.kickoff, 5);
  if (!recent.length) return;
  if (side === "home") {
    match.recentHome = recent;
    match.formHome = lettersFromLines(recent);
  } else {
    match.recentAway = recent;
    match.formAway = lettersFromLines(recent);
  }
}

/** Attach observed ESPN results. Never invents a score. Safe to call with a cold cache. */
export async function hydrateMatchForm(matches: MatchInput[], opts?: { limit?: number }): Promise<void> {
  if (process.env.BETGPT_OFFLINE === "1" || !matches.length) return;
  const cache = load();
  const now = Date.now();
  const limit = opts?.limit ?? 36;
  const soon = [...matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const names: string[] = [];
  for (const m of soon) {
    for (const name of [m.home.name, m.away.name]) {
      if (!names.includes(name)) names.push(name);
      if (names.length >= limit) break;
    }
    if (names.length >= limit) break;
  }
  let dirty = false;
  await Promise.all(
    names.map(async (name) => {
      const key = clubKey(name);
      if (!key) return;
      const hit = cache.teams[key];
      if (!hit || now - hit.at > TTL_MS) {
        const lines = await fetchLines(name);
        if (lines) {
          cache.teams[key] = { at: now, name, lines };
          dirty = true;
        }
      }
    }),
  );
  if (dirty) save();
  for (const match of matches) {
    apply(match, cache.teams[clubKey(match.home.name)], "home");
    apply(match, cache.teams[clubKey(match.away.name)], "away");
  }
}
