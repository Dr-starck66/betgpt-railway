import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { bustArchive, configureArchive, findArchiveMatch, archiveSlug } from "./archive.ts";
import { matchFromHistory, matchMatchesId, foldMatchId } from "./history-match.ts";
import { compileArticle } from "./article.ts";

describe("match dossier resolution", () => {
  afterEach(() => {
    bustArchive();
    configureArchive({ file: join(process.cwd(), "data", "archive-history.json"), fetcher: null });
  });

  it("finds Brentford–Sunderland by ESPN id, raw id and slug", () => {
    bustArchive();
    configureArchive({ file: join(process.cwd(), "data", "archive-history.json"), fetcher: null });
    const byEspn = findArchiveMatch("espn-401879311");
    assert.ok(byEspn);
    assert.equal(byEspn.homeName, "Brentford");
    assert.equal(byEspn.awayName, "Sunderland");
    assert.equal(byEspn.goalsHome, 1);
    assert.equal(byEspn.goalsAway, 1);
    assert.ok(findArchiveMatch("401879311")?.id === "espn-401879311");
    const slug = archiveSlug(byEspn);
    assert.match(slug, /brentford-sunderland-2026-09-05/);
    assert.equal(findArchiveMatch(slug)?.id, "espn-401879311");
  });

  it("matchFromHistory is a finished dossier with crests and slug, not a 404 stub", () => {
    const hist = findArchiveMatch("espn-401879311");
    assert.ok(hist);
    const match = matchFromHistory(hist);
    assert.equal(match.status, "finished");
    assert.equal(match.scoreHome, 1);
    assert.equal(match.scoreAway, 1);
    assert.equal(match.home.name, "Brentford");
    assert.equal(match.away.name, "Sunderland");
    assert.equal(match.competition, "Premier League");
    assert.ok(match.slug?.includes("brentford"));
    assert.ok(match.home.logo);
    assert.ok(match.away.logo);
    const article = compileArticle(match);
    assert.match(article.h1, /Brentford/);
    assert.match(article.lead, /1–1|1-1/);
    assert.ok(!/dossier introuvable/i.test(article.lead));
    assert.ok(matchMatchesId(match, "espn-401879311"));
    assert.ok(matchMatchesId(match, match.slug ?? ""));
    assert.equal(foldMatchId("espn-401879311"), foldMatchId(match.id));
  });

  it("unknown garbage ids stay unresolved (rich 404, never empty dossier)", () => {
    assert.equal(findArchiveMatch("espn-000000000"), null);
    assert.equal(findArchiveMatch("n-importe-quoi-2020-01-01"), null);
  });
});
