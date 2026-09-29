import { defineEventHandler, setHeader } from "h3";
import { ensureLive } from "../../src/engine/live";
import { featuredAnswer, matchTitle, SITE_URL } from "../../src/lib/seo";
import type { MatchInput } from "../../src/engine/types";

export default defineEventHandler(async (event) => {
  let matches: MatchInput[] = [];
  try {
    matches = (await ensureLive()).matches;
  } catch {
    matches = [];
  }
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "BetGpt — actu football",
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.json`,
    language: "fr",
    icon: `${SITE_URL}/logo-betgpt-pronostics-football.png`,
    items: matches.map((m) => ({
      id: `${SITE_URL}/match/${m.slug ?? m.id}`,
      url: `${SITE_URL}/match/${m.slug ?? m.id}`,
      title: matchTitle(m),
      content_text: featuredAnswer(m),
      date_published: m.kickoff,
      date_modified: new Date().toISOString(),
      tags: [m.competition, "football", "pronostic"],
      image: `${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg`,
    })),
  };
  setHeader(event, "content-type", "application/feed+json; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=120");
  return JSON.stringify(feed);
});
