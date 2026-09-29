import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUIDE_ALIASES,
  GUIDES,
  MONEY_KEYWORDS,
  bankableScore,
  fixtureKeywords,
  moneySitemapPaths,
  parisOffsetDay,
  primaryCollisions,
  siloIndexable,
} from "./money-map.ts";

const BANNED = /gain garanti|pari s[ûu]r|100\s*%\s*fiable|argent facile|revenu assur[ée]/i;

describe("money map", () => {
  it("keeps one primary URL per keyword and does not invent demand", () => {
    assert.deepEqual(primaryCollisions(), []);
    for (const row of MONEY_KEYWORDS) {
      assert.equal(row.volume, "UNKNOWN");
      assert.equal(row.cpc, "UNKNOWN");
      assert.equal(row.currentPosition, "UNKNOWN");
      assert.equal(row.difficulty, "UNKNOWN");
      const scored = bankableScore(row);
      assert.ok(scored.unknowns.includes("volume"));
      assert.ok(scored.score >= 0 && scored.score <= 100);
    }
  });

  it("does not assign a page to markets without data", () => {
    const corners = MONEY_KEYWORDS.find((k) => k.keyword === "pronostic corners");
    const scorer = MONEY_KEYWORDS.find((k) => k.keyword === "pronostic buteur");
    assert.equal(corners?.targetURL, null);
    assert.equal(corners?.status, "no-data");
    assert.equal(scorer?.status, "no-data");
  });

  it("noindexes an empty day or league page and indexes a pillar", () => {
    assert.equal(siloIndexable("day", 0), false);
    assert.equal(siloIndexable("day", 2), true);
    assert.equal(siloIndexable("league", 0), false);
    assert.equal(siloIndexable("league", 1), true);
    assert.equal(siloIndexable("pillar", 0), true);
  });

  it("keeps guide copy free of guaranteed-win claims", () => {
    for (const guide of GUIDES) {
      assert.equal(BANNED.test(guide.paragraphs.join(" ")), false, guide.slug);
    }
  });

  it("lists the pillar in the sitemap set", () => {
    assert.ok(moneySitemapPaths().some((p) => p.path === "/pronostics-sportifs"));
    assert.equal(moneySitemapPaths().some((p) => p.path === "/portefeuille-mots-cles"), false);
    for (const alias of Object.keys(GUIDE_ALIASES)) {
      assert.equal(moneySitemapPaths().some((p) => p.path === `/guides/${alias}`), false);
      assert.ok(GUIDES.some((guide) => guide.slug === GUIDE_ALIASES[alias]));
    }
  });

  it("omits empty competitions and includes a day only when that day has a match", () => {
    const empty = moneySitemapPaths([]);
    assert.equal(empty.some((p) => p.path === "/pronostics-football/ligue-1"), false);
    assert.equal(empty.some((p) => p.path === "/pronostics-football/aujourdhui"), false);
    const old = moneySitemapPaths([{ league: "L1", kickoff: "2020-01-01T15:00:00.000Z", status: "finished" }]);
    assert.equal(old.some((p) => p.path === "/pronostics-football/ligue-1"), false);
    const soon = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const filled = moneySitemapPaths([{ league: "L1", kickoff: soon, status: "scheduled" }]);
    assert.ok(filled.some((p) => p.path === "/pronostics-football/ligue-1"));
    assert.equal(filled.some((p) => p.path === "/pronostics-football/premier-league"), false);
    assert.equal(filled.some((p) => p.path === "/pronostics-football/aujourdhui"), false);
    assert.equal(filled.some((p) => p.path === "/pronostics-football/demain"), false);
  });

  it("binds a derby keyword only when both clubs are on the desk", () => {
    const miss = fixtureKeywords([]);
    assert.equal(miss.find((row) => row.keyword === "pronostic psg marseille")?.status, "no-data");
    const hit = fixtureKeywords([
      {
        id: "m1",
        slug: "psg-om-2026-09-27",
        home: { name: "Paris Saint-Germain", short: "PSG" },
        away: { name: "Olympique de Marseille", short: "OM" },
      },
    ]);
    assert.equal(hit.find((row) => row.keyword === "pronostic psg marseille")?.targetURL, "/match/psg-om-2026-09-27");
    assert.equal(hit.find((row) => row.keyword === "pronostic liverpool arsenal")?.targetURL, null);
  });
});
