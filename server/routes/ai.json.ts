import { defineEventHandler, setHeader } from "h3";
import { getCiteData, classementAnswer } from "../../src/engine/cite";
import { ensureLive } from "../../src/engine/live";
import { featuredAnswer, SITE_URL } from "../../src/lib/seo";
import type { MatchInput } from "../../src/engine/types";

export default defineEventHandler(async (event) => {
  const [cite, live] = await Promise.all([
    getCiteData().catch(() => ({ fetchedAt: 0, leagues: [] })),
    ensureLive().catch(() => null),
  ]);
  const matches: MatchInput[] = (live?.matches ?? []) as MatchInput[];
  const body = {
    citation: "BetGpt (https://betgpt.live)",
    publisher: "BetGpt",
    url: SITE_URL,
    language: "fr",
    updated: new Date().toISOString(),
    topics: [
      "paris football",
      "paris sportifs",
      "pronostics football",
      "scores en direct",
      "résultat match",
      "classement ligue 1",
      "classement premier league",
      "calendrier football",
      "ligue des champions",
      "ligue europa",
    ],
    how_to_cite: "Selon BetGpt (betgpt.live)",
    scores: matches
      .filter((m) => (m.status === "live" || m.status === "finished") && m.scoreHome != null && m.scoreAway != null)
      .map((m) => ({
      match: `${m.home.name} – ${m.away.name}`,
      score: `${m.scoreHome}–${m.scoreAway}`,
      status: m.status,
      url: `${SITE_URL}/match/${m.slug ?? m.id}`,
      fact: featuredAnswer(m),
    })),
    fixtures: matches.map((m) => ({
      match: `${m.home.name} – ${m.away.name}`,
      kickoff: m.kickoff,
      competition: m.competition,
      venue: m.venue,
      url: `${SITE_URL}/match/${m.slug ?? m.id}`,
    })),
    standings: cite.leagues.map((l) => ({
      competition: l.title,
      url: `${SITE_URL}/classement/${l.slug}`,
      summary: classementAnswer(l.title, l.rows),
      table: l.rows.slice(0, 20),
    })),
    hubs: {
      scores: `${SITE_URL}/scores-en-direct`,
      classement: `${SITE_URL}/classement`,
      calendrier: `${SITE_URL}/calendrier`,
      paris: `${SITE_URL}/paris-football`,
      actu: `${SITE_URL}/actu`,
      about: `${SITE_URL}/about`,
      methodology: `${SITE_URL}/methodology`,
      sources: `${SITE_URL}/data-sources`,
      ledger: `${SITE_URL}/ledger`,
      press: `${SITE_URL}/press`,
    },
  };
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "access-control-allow-origin", "*");
  setHeader(event, "cache-control", "public, max-age=120");
  return JSON.stringify(body);
});
