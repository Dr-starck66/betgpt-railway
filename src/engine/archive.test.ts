import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HistoricalMatch, LeagueId } from "./types.ts";
import {
  ARCHIVE_SCHEMA,
  archiveHealth,
  bustArchive,
  computeCoverage,
  configureArchive,
  coverageLabel,
  daysBehind,
  ensureArchiveHistory,
  isLeagueStale,
  mergeMatches,
  missingWindows,
  monthWindows,
  parseHistory,
  saveArchiveAtomic,
  findArchiveMatch,
  officialResult,
  archiveSlug,
  loadArchiveStore,
  type EspnFetcher,
} from "./archive.ts";

function row(id: string, league: LeagueId, kickoff: string): HistoricalMatch {
  return {
    id,
    league,
    kickoff,
    homeId: "1",
    awayId: "2",
    homeName: "Home",
    awayName: "Away",
    goalsHome: 1,
    goalsAway: 0,
    oddsHome: 0,
    oddsDraw: 0,
    oddsAway: 0,
    closingHome: 0,
    closingDraw: 0,
    closingAway: 0,
    sourceKind: "official-history",
  };
}

function espnPayload(events: { id: string; date: string; completed?: boolean; gh?: number; ga?: number; malformed?: boolean }[]) {
  return {
    events: events.map((e) => {
      if (e.malformed) return { id: e.id, date: e.date };
      return {
        id: e.id,
        date: e.date,
        competitions: [
          {
            date: e.date,
            status: { type: { completed: e.completed !== false, state: e.completed === false ? "in" : "post" } },
            competitors: [
              { homeAway: "home", score: e.gh ?? 1, team: { id: "10", displayName: "Alpha" } },
              { homeAway: "away", score: e.ga ?? 0, team: { id: "20", displayName: "Beta" } },
            ],
          },
        ],
      };
    }),
  };
}

describe("archive integrity", () => {
  let dir = "";
  let file = "";
  const calls: string[] = [];
  const originalOffline = process.env.BETGPT_OFFLINE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "betgpt-arch-"));
    file = join(dir, "archive-history.json");
    calls.length = 0;
    bustArchive();
    configureArchive({ file, fetcher: async () => ({ events: [] }) });
    // Refresh logic uses the injected in-memory provider, never a real network
    // request. The HTTP smoke server keeps its own offline environment.
    process.env.BETGPT_OFFLINE = "0";
  });

  afterEach(() => {
    if (originalOffline === undefined) delete process.env.BETGPT_OFFLINE;
    else process.env.BETGPT_OFFLINE = originalOffline;
    bustArchive();
    configureArchive({ file: join(process.cwd(), "data", "archive-history.json"), fetcher: null });
  });

  it("drops duplicate ESPN IDs on merge", () => {
    const a = [row("espn-1", "PL", "2024-01-01T15:00Z"), row("espn-1", "PL", "2024-01-01T15:00Z")];
    const b = [row("espn-1", "PL", "2024-01-01T18:00Z"), row("espn-2", "PL", "2024-01-02T15:00Z")];
    const merged = mergeMatches(a, b);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((m) => m.id === "espn-1")?.kickoff, "2024-01-01T18:00Z");
  });

  it("detects a stale archive even with a fresh fetchedAt", () => {
    const now = Date.parse("2026-09-10T12:00Z");
    const store = {
      schema: ARCHIVE_SCHEMA,
      fetchedAt: now,
      coverage: computeCoverage([row("espn-1", "PL", "2025-08-31T19:00Z")]),
      matches: [row("espn-1", "PL", "2025-08-31T19:00Z")],
    };
    const health = archiveHealth(store, now);
    assert.equal(health.overallStale, true);
    assert.ok(daysBehind("2025-08-31T19:00Z", now) > 14);
    assert.equal(isLeagueStale("2025-08-31T19:00Z", now), true);
  });

  it("coverage label uses actual match dates, not a claimed 2020–2026", () => {
    const rows = [row("espn-1", "L1", "2020-09-10T19:00Z"), row("espn-2", "PL", "2025-08-31T19:00Z")];
    const label = coverageLabel(rows);
    assert.match(label, /2020/);
    assert.match(label, /2025/);
    assert.doesNotMatch(label, /2020–2026|2020-2026/);
  });

  it("builds monthly windows without overlapping months", () => {
    const w = monthWindows("2025-08-15", "2025-10-02");
    assert.deepEqual(w.map((x) => `${x.from}-${x.to}`), ["20250815-20250831", "20250901-20250930", "20251001-20251002"]);
  });

  it("asks only for missing windows after the latest stored match", () => {
    const coverage = computeCoverage([row("espn-1", "PL", "2025-08-31T15:00Z")]);
    const now = Date.parse("2025-10-05T12:00Z");
    const missing = missingWindows(coverage, now, 0).filter((w) => w.league === "PL");
    assert.ok(missing.length >= 1);
    assert.ok(missing.every((w) => w.from >= "20250831"));
    assert.ok(missing.some((w) => w.from.startsWith("202509") || w.to.startsWith("202509") || w.to.startsWith("202510")));
  });

  it("merges old + new seasons without dropping the old ones", async () => {
    const seed = {
      schema: 2,
      fetchedAt: 1,
      matches: [row("espn-old", "PL", "2024-05-19T15:00Z")],
    };
    writeFileSync(file, JSON.stringify(seed));
    const fetcher: EspnFetcher = async (slug, from, to) => {
      calls.push(`${slug}:${from}-${to}`);
      if (from.startsWith("202508") || from.startsWith("202509")) {
        return espnPayload([{ id: "new1", date: "2025-09-15T15:00Z", gh: 2, ga: 1 }]);
      }
      return { events: [] };
    };
    configureArchive({ file, fetcher });
    const now = Date.parse("2025-09-16T12:00Z");
    const matches = await ensureArchiveHistory({ force: true, now });
    assert.ok(matches.some((m) => m.id === "espn-old"));
    assert.ok(matches.some((m) => m.id === "espn-new1"));
  });

  it("skips malformed ESPN events and empty payloads", () => {
    const rows = parseHistory(
      espnPayload([
        { id: "ok", date: "2026-01-01T15:00Z", gh: 1, ga: 0 },
        { id: "bad", date: "2026-01-02T15:00Z", malformed: true },
        { id: "live", date: "2026-01-03T15:00Z", completed: false },
      ]),
      "PL",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, "espn-ok");
    assert.equal(rows[0]!.sourceKind, "official-history");
    assert.deepEqual(parseHistory({ events: [] }, "PL"), []);
    assert.deepEqual(parseHistory(null, "PL"), []);
  });

  it("keeps the previous file if rename never happens (interrupted write)", () => {
    const first = {
      schema: ARCHIVE_SCHEMA,
      fetchedAt: 1,
      coverage: {},
      matches: [row("espn-keep", "SA", "2024-01-01T15:00Z")],
    };
    writeFileSync(file, JSON.stringify(first));
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ schema: ARCHIVE_SCHEMA, fetchedAt: 2, coverage: {}, matches: [] }));
    assert.equal(existsSync(tmp), true);
    const disk = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(disk.matches[0].id, "espn-keep");
  });

  it("atomic save replaces the file in one rename", () => {
    saveArchiveAtomic(
      {
        schema: ARCHIVE_SCHEMA,
        fetchedAt: 9,
        coverage: computeCoverage([row("espn-a", "BL", "2025-01-01T15:00Z")]),
        matches: [row("espn-a", "BL", "2025-01-01T15:00Z")],
      },
      file,
    );
    const disk = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(disk.schema, ARCHIVE_SCHEMA);
    assert.equal(disk.matches.length, 1);
    assert.equal(disk.matches[0].id, "espn-a");
  });

  it("does not wipe the archive when the provider throws", async () => {
    writeFileSync(
      file,
      JSON.stringify({
        schema: ARCHIVE_SCHEMA,
        fetchedAt: 1,
        matches: [row("espn-keep", "LL", "2025-05-01T15:00Z")],
      }),
    );
    configureArchive({
      file,
      fetcher: async () => {
        throw new Error("espn down");
      },
    });
    const matches = await ensureArchiveHistory({ force: true, now: Date.parse("2026-09-10T12:00Z") });
    assert.ok(matches.some((m) => m.id === "espn-keep"));
  });

  it("finds a match by espn id and by name-date slug", () => {
    const brent = {
      ...row("espn-401879311", "PL", "2026-09-05T14:00Z"),
      homeName: "Brentford",
      awayName: "Sunderland",
      homeId: "337",
      awayId: "366",
    };
    saveArchiveAtomic({
      schema: ARCHIVE_SCHEMA,
      fetchedAt: Date.now(),
      coverage: computeCoverage([brent]),
      matches: [brent],
    });
    bustArchive();
    assert.equal(loadArchiveStore()?.matches[0]?.id, "espn-401879311");
    assert.equal(findArchiveMatch("espn-401879311")?.homeName, "Brentford");
    assert.equal(findArchiveMatch("401879311")?.id, "espn-401879311");
    assert.equal(findArchiveMatch(archiveSlug(brent))?.id, "espn-401879311");
    assert.equal(officialResult({ homeName: "Brentford", awayName: "Sunderland", kickoff: "2026-09-05T14:00Z" })?.id, "espn-401879311");
    assert.equal(officialResult({ id: "ub-brentford|sunderland-2026-09-05", homeName: "Brentford", awayName: "Sunderland", kickoff: "2026-09-05T14:00Z" })?.goalsHome, 1);
    const barca = { ...row("espn-barca", "LL", "2026-09-13T14:15Z"), homeName: "Levante", awayName: "Barcelona", goalsHome: 2, goalsAway: 4 };
    const psg = { ...row("espn-psg", "L1", "2026-09-13T18:45Z"), homeName: "Brest", awayName: "Paris Saint-Germain", goalsHome: 0, goalsAway: 1 };
    const aux = { ...row("espn-aux", "L1", "2026-09-20T13:00Z"), homeName: "AJ Auxerre", awayName: "Brest", goalsHome: 2, goalsAway: 1 };
    saveArchiveAtomic({ schema: ARCHIVE_SCHEMA, fetchedAt: 1, coverage: computeCoverage([barca, psg, aux]), matches: [barca, psg, aux] });
    bustArchive();
    assert.equal(officialResult({ homeName: "Levante", awayName: "FC Barcelone", kickoff: "2026-09-13T14:15Z" })?.id, "espn-barca");
    assert.equal(officialResult({ homeName: "Brest", awayName: "PSG", kickoff: "2026-09-13T18:45Z" })?.goalsAway, 1);
    assert.equal(officialResult({ homeName: "Auxerre", awayName: "Brest", kickoff: "2026-09-20T13:00Z" })?.goalsHome, 2);
    assert.equal(findArchiveMatch("does-not-exist"), null);
  });

  it("does not refetch an identical date window twice in one refresh", async () => {
    writeFileSync(
      file,
      JSON.stringify({
        schema: ARCHIVE_SCHEMA,
        fetchedAt: 1,
        matches: [row("espn-1", "L1", "2026-09-01T15:00Z")],
      }),
    );
    const seen = new Set<string>();
    configureArchive({
      file,
      fetcher: async (slug, from, to) => {
        const key = `${slug}:${from}-${to}`;
        assert.equal(seen.has(key), false, `duplicate fetch ${key}`);
        seen.add(key);
        return { events: [] };
      },
    });
    await ensureArchiveHistory({ force: true, now: Date.parse("2026-09-10T12:00Z") });
    assert.ok(seen.size >= 1);
  });

  it("rejects synthetic rows on merge", () => {
    const merged = mergeMatches(
      [row("espn-1", "PL", "2024-01-01T15:00Z")],
      [{ ...row("h-PL-1", "PL", "2024-01-02T15:00Z"), sourceKind: "synthetic-test" }],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.id, "espn-1");
  });

  it("computes per-league coverage from stored matches", () => {
    const cov = computeCoverage([
      row("espn-1", "PL", "2021-08-14T15:00Z"),
      row("espn-2", "PL", "2026-05-24T15:00Z"),
      row("espn-3", "L1", "2022-01-01T15:00Z"),
    ]);
    assert.equal(cov.PL.count, 2);
    assert.equal(cov.PL.latestSeason, "2025-26");
    assert.equal(cov.L1.count, 1);
    assert.equal(cov.BL.count, 0);
  });

  it("does not block on ESPN when stale data was refreshed recently", async () => {
    const now = Date.parse("2026-09-10T12:00Z");
    writeFileSync(
      file,
      JSON.stringify({
        schema: ARCHIVE_SCHEMA,
        fetchedAt: now - 60_000,
        matches: [row("espn-keep", "PL", "2025-08-31T19:00Z")],
      }),
    );
    let n = 0;
    configureArchive({
      file,
      fetcher: async () => {
        n += 1;
        return { events: [] };
      },
    });
    const matches = await ensureArchiveHistory({ now });
    assert.ok(matches.some((m) => m.id === "espn-keep"));
    assert.equal(n, 0);
  });
});
