import test from "node:test";
import assert from "node:assert/strict";
import { durableForumLeague } from "./forum-durability";
import { MIN_POSTS, padToTen, type ForumPost } from "./forum";
import { buildSitemapUrls } from "@/lib/sitemap-urls";
import { shouldShedForumAiRefresh } from "./forum-ia";

test("every supported BetGPT league gets a durable forum", () => {
  for (const league of ["PL", "LL", "BL", "SA", "L1", "ER", "PT", "SC", "TR", "CL", "EL", "NL"]) {
    assert.equal(durableForumLeague(league), true, league);
  }
  for (const league of ["", "UNKNOWN", "MLS", "XX"]) {
    assert.equal(durableForumLeague(league), false, league);
  }
});

test("sitemap exposes forum leaves across supported competitions", () => {
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const mk = (league: string, slug: string, home: string, away: string) => ({
    id: slug,
    slug,
    league,
    status: "scheduled",
    kickoff: `${day}T19:00:00.000Z`,
    home: { name: home, id: `${slug}-h` },
    away: { name: away, id: `${slug}-a` },
  });

  const rows = [
    ["PL", `arsenal-chelsea-${day}`, "Arsenal", "Chelsea"],
    ["ER", `feyenoord-psv-${day}`, "Feyenoord", "PSV Eindhoven"],
    ["PT", `benfica-porto-${day}`, "Benfica", "Porto"],
    ["SC", `celtic-rangers-${day}`, "Celtic", "Rangers"],
    ["TR", `galatasaray-fenerbahce-${day}`, "Galatasaray", "Fenerbahçe"],
    ["NL", `cyprus-armenia-${day}`, "Cyprus", "Armenia"],
  ] as const;

  const urls = buildSitemapUrls({
    matches: rows.map(([league, slug, home, away]) => mk(league, slug, home, away)),
    asOf: new Date().toISOString(),
  });
  const paths = new Set(urls.map((x) => x.path));

  for (const [, slug] of rows) {
    assert.equal(paths.has(`/match/${slug}`), true, slug);
    assert.equal(paths.has(`/forum/${slug}`), true, slug);
  }
});

test("agent-first forum density gate requires a real conversation", () => {
  assert.ok(MIN_POSTS >= 30, `expected dense thread, got MIN_POSTS=${MIN_POSTS}`);
  const posts: ForumPost[] = [];
  padToTen(posts, "proof", Date.now(), [
    "Structure : argument de preuve distinct.",
    "Pressing : réponse contradictoire distincte.",
    "Avocat du diable : contre-argument distinct.",
  ]);
  assert.equal(posts.length, MIN_POSTS);
  assert.ok(posts.filter((p) => p.replyTo).length >= MIN_POSTS - 1);
  assert.ok(posts.some((p) => p.tone === "challenge"));
  assert.ok(posts.some((p) => p.tone === "banter"));
});


test("forum AI load shedding keeps the one-slot local model bounded", () => {
  assert.equal(shouldShedForumAiRefresh(0, 0, 10_000), false);
  assert.equal(shouldShedForumAiRefresh(1, 0, 10_000), true);
  assert.equal(shouldShedForumAiRefresh(8, 0, 10_000), true);
  assert.equal(shouldShedForumAiRefresh(0, 10_001, 10_000), true);
  assert.equal(shouldShedForumAiRefresh(0, 10_000, 10_000), false);
});
