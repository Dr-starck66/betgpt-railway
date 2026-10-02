import test from "node:test";
import assert from "node:assert/strict";
import { durableForumLeague } from "./forum-durability";
import { buildSitemapUrls } from "@/lib/sitemap-urls";

test("durable forum league allowlist matches persisted archive coverage", () => {
  for (const league of ["PL", "LL", "BL", "SA", "L1", "CL", "EL"]) {
    assert.equal(durableForumLeague(league), true, league);
  }
  for (const league of ["ER", "PT", "SC", "TR", "NL", "", "UNKNOWN"]) {
    assert.equal(durableForumLeague(league), false, league);
  }
});

test("sitemap never promises a forum leaf for a live-only league", () => {
  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const mk = (league, slug, home, away) => ({
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
  const urls = buildSitemapUrls({
    matches: [
      mk("PL", pl, "Arsenal", "Chelsea"),
      mk("ER", er, "Feyenoord", "PSV Eindhoven"),
    ],
    asOf: new Date().toISOString(),
  });
  const paths = new Set(urls.map((x) => x.path));

  assert.equal(paths.has(`/match/${pl}`), true);
  assert.equal(paths.has(`/forum/${pl}`), true);
  assert.equal(paths.has(`/match/${er}`), true);
  assert.equal(paths.has(`/forum/${er}`), false);
});
