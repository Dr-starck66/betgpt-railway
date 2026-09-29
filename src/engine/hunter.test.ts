import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goalMatrix } from "./math.ts";
import type { HistoricalMatch, LeagueId } from "./types.ts";
import {
  HUNTER_RANKING,
  HUNTER_SCENARIOS,
  hasMatrix,
  hunterEvidenceOf,
  modelScenarioP,
  rankScenario,
  scenarioBySlug,
  type HunterMatch,
} from "./hunter.ts";

function hist(
  id: string,
  league: LeagueId,
  kickoff: string,
  homeId: string,
  awayId: string,
  gh: number,
  ga: number,
  homeName = homeId,
  awayName = awayId,
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

function fixture(
  id: string,
  league: LeagueId,
  home: string,
  away: string,
  lh: number,
  la: number,
): HunterMatch {
  const g = goalMatrix(lh, la);
  return {
    id,
    slug: id,
    league,
    competition: league,
    kickoff: "2026-09-12T19:00:00Z",
    status: "scheduled",
    home: { id: home, name: home, short: home.slice(0, 3).toUpperCase() },
    away: { id: away, name: away, short: away.slice(0, 3).toUpperCase() },
    matrix: g.matrix,
    over15: g.over15,
    over25: g.over25,
    over35: g.over35,
    bttsYes: g.bttsYes,
  };
}

const sc21 = scenarioBySlug("2-1")!;
const sc00 = scenarioBySlug("0-0")!;
const scOver = scenarioBySlug("over-2-5")!;
const scBtts = scenarioBySlug("btts")!;
const scLow = scenarioBySlug("low-0-0")!;

describe("score hunter ranking", () => {
  it("exposes every advertised scenario", () => {
    const slugs = HUNTER_SCENARIOS.map((s) => s.slug);
    for (const s of [
      "0-0",
      "low-0-0",
      "1-0",
      "0-1",
      "1-1",
      "2-0",
      "0-2",
      "2-1",
      "1-2",
      "2-2",
      "3-1",
      "1-3",
      "over-1-5",
      "over-2-5",
      "over-3-5",
      "btts",
      "btts-no",
    ]) {
      assert.ok(slugs.includes(s), s);
    }
  });

  it("ranks the higher model 2-1 probability first", () => {
    const a = fixture("hi", "PL", "arsenal", "villa", 2.1, 1.05);
    const b = fixture("lo", "PL", "everton", "palace", 0.9, 0.8);
    const pHi = modelScenarioP(sc21, a)!;
    const pLo = modelScenarioP(sc21, b)!;
    assert.ok(pHi > pLo);
    const history = Array.from({ length: 80 }, (_, i) =>
      hist(`h${i}`, "PL", `2023-09-${String((i % 27) + 1).padStart(2, "0")}T12:00Z`, "x", "y", i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 1 : 0),
    );
    const { rows } = rankScenario(sc21, [b, a], history);
    assert.equal(rows[0]?.matchId, "hi");
    assert.ok(rows[0]!.score > rows[1]!.score);
    assert.ok(rows[0]!.modelP > rows[1]!.modelP);
  });

  it("reads 0-0 from the Poisson matrix", () => {
    const g = goalMatrix(1.2, 1.1);
    const m = fixture("z", "L1", "lens", "nantes", 1.2, 1.1);
    const p = modelScenarioP(sc00, m)!;
    assert.ok(Math.abs(p - g.matrix[0]![0]!) < 1e-12);
    assert.ok(p > 0 && p < 0.3);
  });

  it("computes over 2.5 and BTTS from the same matrix", () => {
    const m = fixture("o", "BL", "bayern", "dortmund", 2.4, 1.8);
    const over = modelScenarioP(scOver, m)!;
    const btts = modelScenarioP(scBtts, m)!;
    const g = goalMatrix(2.4, 1.8);
    assert.ok(Math.abs(over - g.over25) < 1e-9);
    assert.ok(Math.abs(btts - g.bttsYes) < 1e-9);
    assert.ok(over > 0.6);
  });

  it("low-0-0 is the complement of 0-0", () => {
    const m = fixture("c", "SA", "inter", "roma", 1.7, 1.2);
    const a = modelScenarioP(sc00, m)!;
    const b = modelScenarioP(scLow, m)!;
    assert.ok(Math.abs(a + b - 1) < 1e-9);
  });

  it("downweights tiny league samples toward 50", () => {
    const match = fixture("s", "EL", "alpha", "beta", 2.2, 1.1);
    const tiny = [hist("1", "EL", "2024-01-01T12:00Z", "alpha", "beta", 2, 1, "alpha", "beta")];
    const fat = Array.from({ length: 120 }, (_, i) =>
      hist(`f${i}`, "EL", `2023-10-01T12:00Z`, i % 2 ? "alpha" : "q", i % 2 ? "beta" : "w", 2, 1, i % 2 ? "alpha" : "q", i % 2 ? "beta" : "w"),
    );
    const small = rankScenario(sc21, [match], tiny).rows[0]!;
    const big = rankScenario(sc21, [match], fat).rows[0]!;
    assert.ok(small.nLeague < 30);
    assert.ok(big.nLeague >= 80);
    assert.ok(Math.abs(small.score - 50) <= Math.abs(big.score - 50));
    assert.match(small.sampleNote, /petit|limité/i);
  });

  it("skips matches without a matrix for exact scores", () => {
    const broken: HunterMatch = {
      ...fixture("ok", "LL", "barca", "sevilla", 1.6, 1.1),
      id: "no-matrix",
      matrix: [],
      over15: 0,
      over25: 0,
      over35: 0,
      bttsYes: 0,
    };
    assert.equal(hasMatrix(broken.matrix), false);
    assert.equal(modelScenarioP(sc21, broken), null);
    const { rows } = rankScenario(sc21, [broken], []);
    assert.equal(rows.length, 0);
  });

  it("ignores finished matches", () => {
    const live = fixture("live", "PL", "a", "b", 1.5, 1.2);
    const done = { ...fixture("done", "PL", "c", "d", 2.8, 0.6), status: "finished" as const };
    const history = Array.from({ length: 40 }, (_, i) => hist(`h${i}`, "PL", "2023-01-01T12:00Z", "x", "y", 1, 1));
    const { rows } = rankScenario(sc21, [done, live], history);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.matchId, "live");
  });

  it("does not invent implied probabilities when books are missing", () => {
    const m = fixture("n", "CL", "ajax", "porto", 1.4, 1.3);
    const history = Array.from({ length: 40 }, (_, i) => hist(`h${i}`, "CL", "2023-01-01T12:00Z", "x", "y", 1, 0));
    const row = rankScenario(sc21, [m], history).rows[0]!;
    assert.equal(row.impliedP, null);
    assert.equal(row.impliedNoVigP, null);
    assert.ok(row.why.every((w) => w.layer !== "market"));
  });

  it("shows raw 1/odds and no-vig only when both sides are listed", () => {
    const history = Array.from({ length: 40 }, (_, i) => hist(`h${i}`, "PL", "2023-01-01T12:00Z", "x", "y", 1, 0));
    const over = {
      ...fixture("o", "PL", "arsenal", "city", 2.2, 1.4),
      implied: { over25: 1.7, under25: 2.2 },
      impliedBook: "Unibet",
    };
    const row = rankScenario(scOver, [over], history).rows[0]!;
    assert.ok(Math.abs((row.impliedP ?? 0) - 1 / 1.7) < 1e-9);
    const novig = (1 / 1.7) / (1 / 1.7 + 1 / 2.2);
    assert.ok(Math.abs((row.impliedNoVigP ?? 0) - novig) < 1e-9);
    assert.ok(row.why.some((w) => w.layer === "market" && w.label.includes("no-vig")));

    const oneSide = {
      ...fixture("p", "PL", "arsenal", "city", 2.2, 1.4),
      implied: { over25: 1.7 },
      impliedBook: "Unibet",
    };
    const rawOnly = rankScenario(scOver, [oneSide], history).rows[0]!;
    assert.ok(Math.abs((rawOnly.impliedP ?? 0) - 1 / 1.7) < 1e-9);
    assert.equal(rawOnly.impliedNoVigP, null);
    assert.ok(rawOnly.why.some((w) => w.layer === "market"));
    assert.ok(rawOnly.why.every((w) => !w.label.includes("no-vig")));
  });

  it("keeps the published ranking weights", () => {
    assert.deepEqual(HUNTER_RANKING, { model: 0.7, league: 0.2, team: 0.1 });
  });

  it("evidence blob echoes the computed row and does not add a source", () => {
    const history = Array.from({ length: 40 }, (_, i) => hist(`h${i}`, "PL", "2023-01-01T12:00Z", "x", "y", 1, 0));
    const row = rankScenario(sc21, [fixture("e", "PL", "arsenal", "villa", 1.8, 1.1)], history).rows[0]!;
    const ev = hunterEvidenceOf(row, sc21);
    assert.equal(ev.provenance, "DERIVED_FROM_REAL_DATA");
    assert.equal(ev.hunterScenario, "2-1");
    assert.equal(ev.hunterIndex, row.score);
    assert.equal(ev.sampleSize, row.nLeague);
    assert.equal(ev.nH2h, row.nH2h);
    assert.equal(ev.marketRawImplied, null);
  });

  it("counts head-to-head by id or folded name, not the reverse fixture", () => {
    const history = [
      hist("1", "PL", "2024-01-01T12:00Z", "id-h", "id-a", 2, 1, "Arsenal FC", "Aston Villa"),
      hist("2", "PL", "2024-02-01T12:00Z", "other", "other2", 0, 0, "Arsenal", "Aston Villa"),
      hist("3", "PL", "2024-03-01T12:00Z", "id-h", "chelsea", 1, 1, "Arsenal FC", "Chelsea"),
      hist("4", "PL", "2024-04-01T12:00Z", "villa", "id-h", 1, 0, "Aston Villa", "Arsenal"),
    ];
    const m = fixture("m", "PL", "Arsenal FC", "Aston Villa", 1.8, 1.1);
    m.home.id = "id-h";
    m.away.id = "id-a";
    const row = rankScenario(sc21, [m], history).rows[0]!;
    assert.equal(row.nH2h, 2);
  });
});
