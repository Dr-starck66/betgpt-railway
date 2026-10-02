import test from "node:test";
import assert from "node:assert/strict";
import { durableForumLeague } from "./forum-durability";
import { MIN_POSTS, padToTen, type ForumPost } from "./forum";
import { buildSitemapUrls } from "@/lib/sitemap-urls";

test("durable forum league allowlist matches persisted archive coverage", () => {
  for (const league of ["PL", "LL", "BL", "SA", "L1", "CL", "EL", "NL"]) {
    assert.equal(durableForumLeague(league), true, league);
  }
  for (const league of ["ER", "PT", "SC", "TR", "", "UNKNOWN"]) {
    assert.equal(durableForumLeague(league), false, league);
  }
});

test("sitemap never promises a forum leaf for a live-only league", () => {
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

  const pl = `arsenal-chelsea-${day}`;
  const er = `feyenoord-psv-${day}`;
  const nl = `cyprus-armenia-${day}`;
  const urls = buildSitemapUrls({
    matches: [
      mk("PL", pl, "Arsenal", "Chelsea"),
      mk("ER", er, "Feyenoord", "PSV Eindhoven"),
      mk("NL", nl, "Cyprus", "Armenia"),
    ],
    asOf: new Date().toISOString(),
  });
  const paths = new Set(urls.map((x) => x.path));

  assert.equal(paths.has(`/match/${pl}`), true);
  assert.equal(paths.has(`/forum/${pl}`), true);
  assert.equal(paths.has(`/match/${er}`), true);
  assert.equal(paths.has(`/forum/${er}`), false);
  assert.equal(paths.has(`/forum/${nl}`), true);
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
