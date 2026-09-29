import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { HistoricalMatch, LeagueId } from "./types.ts";
import {
  bttsFreq,
  currentSeason,
  filterHistory,
  lastNCompleteSeasons,
  officialHistory,
  overFreq,
  previousCompleteSeason,
  provenanceOf,
  sampleConfidence,
  scoreCounts,
  scoreFreq,
  seasonStartYear,
  shrinkToMid,
  uniqueMatches,
  zeroZeroByLeague,
  zeroZeroByTeam,
} from "./stats.ts";

function m(
  id: string,
  league: LeagueId,
  kickoff: string,
  homeId: string,
  awayId: string,
  gh: number,
  ga: number,
  homeName?: string,
  awayName?: string,
): HistoricalMatch {
  return {
    id,
    league,
    kickoff,
    homeId,
    awayId,
    homeName,
    awayName,
    goalsHome: gh,
    goalsAway: ga,
    oddsHome: 0,
    oddsDraw: 0,
    oddsAway: 0,
    closingHome: 0,
    closingDraw: 0,
    closingAway: 0,
  };
}

describe("stats engine", () => {
  it("drops duplicate match ids", () => {
    const rows = [
      m("a", "PL", "2024-01-01T12:00Z", "1", "2", 1, 0, "A", "B"),
      m("a", "PL", "2024-01-01T12:00Z", "1", "2", 9, 9, "A", "B"),
      m("b", "PL", "2024-01-02T12:00Z", "1", "3", 0, 0, "A", "C"),
    ];
    const uniq = uniqueMatches(rows);
    assert.equal(uniq.length, 2);
    assert.equal(scoreFreq(uniq, 9, 9).n, 0);
    assert.equal(scoreFreq(uniq, 0, 0).n, 1);
  });

  it("computes exact-score frequencies from real counts", () => {
    const rows = [
      m("1", "BL", "2023-09-01T12:00Z", "h", "a", 2, 1, "H", "A"),
      m("2", "BL", "2023-09-08T12:00Z", "h", "a", 2, 1, "H", "A"),
      m("3", "BL", "2023-09-15T12:00Z", "h", "a", 0, 0, "H", "A"),
      m("4", "BL", "2023-09-22T12:00Z", "h", "a", 1, 1, "H", "A"),
    ];
    const top = scoreCounts(rows);
    assert.equal(top[0]?.score, "2-1");
    assert.equal(top[0]?.n, 2);
    assert.equal(top[0]?.freq, 0.5);
    assert.equal(scoreFreq(rows, 0, 0).freq, 0.25);
    assert.equal(overFreq(rows, 3).n, 2);
    assert.equal(bttsFreq(rows, true).n, 3);
  });

  it("cuts seasons on 1 August", () => {
    assert.equal(seasonStartYear("2024-08-01T00:00Z"), 2024);
    assert.equal(seasonStartYear("2024-07-31T23:00Z"), 2023);
    assert.equal(seasonStartYear("2025-05-20T18:00Z"), 2024);
    const rows = [
      m("1", "L1", "2024-07-31T20:00Z", "1", "2", 0, 0, "A", "B"),
      m("2", "L1", "2024-08-01T20:00Z", "1", "2", 1, 0, "A", "B"),
      m("3", "L1", "2025-05-01T20:00Z", "1", "2", 2, 1, "A", "B"),
    ];
    const prev = filterHistory(rows, { season: "prev", now: Date.parse("2026-09-10T12:00Z") });
    // current season start 2026 → prev = 2025-26 (fromYear 2025). none of these.
    assert.equal(prev.length, 0);
    const last5 = filterHistory(rows, { season: "last-5", now: Date.parse("2026-09-10T12:00Z") });
    assert.equal(last5.length, 3);
    const s24 = last5.filter((x) => seasonStartYear(x.kickoff) === 2024);
    assert.equal(s24.length, 2);
    const s23 = last5.filter((x) => seasonStartYear(x.kickoff) === 2023);
    assert.equal(s23.length, 1);
  });

  it("ranks 0-0 by league with sample size", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => m(`p${i}`, "PL", "2023-10-01T12:00Z", "1", "2", 0, 0, "A", "B")),
      ...Array.from({ length: 10 }, (_, i) => m(`l${i}`, "L1", "2023-10-01T12:00Z", "3", "4", i === 0 ? 0 : 1, 1, "C", "D")),
    ];
    const board = zeroZeroByLeague(rows);
    const pl = board.find((x) => x.league === "PL")!;
    const l1 = board.find((x) => x.league === "L1")!;
    assert.ok(pl.freq > l1.freq);
    assert.equal(pl.n, 10);
    assert.equal(l1.n00, 0);
  });

  it("omits teams below the minimum sample", () => {
    const rows = [
      m("1", "SA", "2023-01-01T12:00Z", "t1", "t2", 0, 0, "Tiny", "Other"),
      ...Array.from({ length: 20 }, (_, i) =>
        m(`x${i}`, "SA", "2023-02-01T12:00Z", "big", "t2", 0, 0, "Big", "Other"),
      ),
    ];
    const teams = zeroZeroByTeam(rows, 20);
    assert.ok(teams.some((t) => t.name === "Big"));
    assert.ok(!teams.some((t) => t.name === "Tiny"));
  });

  it("shrinks low-confidence scores toward 50", () => {
    const high = sampleConfidence(200, 30, 30);
    const low = sampleConfidence(4, 2, 1);
    assert.ok(high > low);
    const raw = 90;
    const a = shrinkToMid(raw, high);
    const b = shrinkToMid(raw, low);
    assert.ok(Math.abs(b - 50) < Math.abs(a - 50));
  });

  it("tracks provenance n", () => {
    const rows = [m("1", "CL", "2022-09-01T12:00Z", "1", "2", 1, 0, "A", "B")];
    const p = provenanceOf(rows, Date.parse("2026-09-10T12:00Z"));
    assert.equal(p.n, 1);
    assert.equal(p.from, "2022-09-01");
    assert.match(p.source, /ESPN/);
  });

  it("treats 31 July 2026 as 2025-26 still in progress", () => {
    const jul = Date.parse("2026-07-31T12:00:00Z");
    const aug = Date.parse("2026-08-01T12:00:00Z");
    assert.equal(currentSeason(jul).startYear, 2025);
    assert.equal(currentSeason(jul).label, "2025-26");
    assert.equal(previousCompleteSeason(jul).startYear, 2024);
    const last5Jul = lastNCompleteSeasons(5, jul);
    assert.deepEqual(last5Jul.startYears, [2020, 2021, 2022, 2023, 2024]);
    assert.ok(!last5Jul.startYears.includes(2025));

    assert.equal(currentSeason(aug).startYear, 2026);
    assert.equal(currentSeason(aug).label, "2026-27");
    assert.equal(previousCompleteSeason(aug).startYear, 2025);
    const last5Aug = lastNCompleteSeasons(5, aug);
    assert.deepEqual(last5Aug.startYears, [2021, 2022, 2023, 2024, 2025]);
    assert.ok(!last5Aug.startYears.includes(2026));
    const last3 = lastNCompleteSeasons(3, aug);
    assert.deepEqual(last3.startYears, [2023, 2024, 2025]);
  });

  it("officialHistory drops synthetic-test and h-* ids", () => {
    const rows = [
      m("espn-1", "PL", "2024-01-01T12:00Z", "1", "2", 1, 0, "A", "B"),
      { ...m("h-PL-1", "PL", "2024-01-02T12:00Z", "1", "2", 9, 9, "A", "B"), sourceKind: "synthetic-test" as const },
      m("h-LL-9", "LL", "2024-01-03T12:00Z", "3", "4", 0, 0, "C", "D"),
    ];
    const clean = officialHistory(rows);
    assert.equal(clean.length, 1);
    assert.equal(clean[0]!.id, "espn-1");
  });

  it("provenance n ignores synthetic rows", () => {
    const rows = [
      m("espn-1", "PL", "2024-01-01T12:00Z", "1", "2", 1, 0, "A", "B"),
      { ...m("h-PL-1", "PL", "2024-01-02T12:00Z", "1", "2", 0, 0, "A", "B"), sourceKind: "synthetic-test" as const },
    ];
    const p = provenanceOf(rows);
    assert.equal(p.n, 1);
    assert.equal(p.from, "2024-01-01");
  });

  it("scoreCounts sum equals number of analyzed matches", () => {
    const rows = [
      m("1", "BL", "2023-09-01T12:00Z", "h", "a", 2, 1, "H", "A"),
      m("2", "BL", "2023-09-08T12:00Z", "h", "a", 2, 1, "H", "A"),
      m("3", "BL", "2023-09-15T12:00Z", "h", "a", 0, 0, "H", "A"),
      m("4", "BL", "2023-09-22T12:00Z", "h", "a", 1, 1, "H", "A"),
    ];
    const top = scoreCounts(rows);
    assert.equal(top.reduce((s, c) => s + c.n, 0), rows.length);
  });
});
