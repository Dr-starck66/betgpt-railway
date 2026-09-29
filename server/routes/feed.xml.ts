import { defineEventHandler, setHeader } from "h3";
import { ensureLive } from "../../src/engine/live";
import { featuredAnswer, SITE_URL } from "../../src/lib/seo";
import type { MatchInput } from "../../src/engine/types";

export default defineEventHandler(async (event) => {
  let matches: MatchInput[] = [];
  try {
    matches = (await ensureLive()).matches;
  } catch {
    matches = [];
  }
  const items = matches
    .slice()
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((m) => {
      const loc = `${SITE_URL}/match/${m.slug ?? m.id}`;
      const title = `${m.home.name} – ${m.away.name} : pronostic et analyse du match`;
      return `  <item>
    <title>${esc(title)}</title>
    <link>${loc}</link>
    <guid isPermaLink="true">${loc}</guid>
    <pubDate>${new Date(m.kickoff).toUTCString()}</pubDate>
    <category>Football</category>
    <description>${esc(featuredAnswer(m))}</description>
    <enclosure url="${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg" type="image/jpeg" />
    <media:content url="${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg" medium="image" width="1200" height="630" />
  </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>BetGpt — actu football</title>
  <link>${SITE_URL}</link>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Résultats, pronostics et scores en direct. Publié en continu sur betgpt.live.</description>
  <language>fr</language>
  <ttl>60</ttl>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <copyright>BetGpt ${SITE_URL}</copyright>
  <image>
    <url>${SITE_URL}/og-betgpt-pronostics-cotes-football.jpg</url>
    <title>BetGpt</title>
    <link>${SITE_URL}</link>
    <width>1200</width>
    <height>630</height>
  </image>
${items}
</channel>
</rss>
`;
  setHeader(event, "content-type", "application/rss+xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=180");
  return xml;
});

function esc(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
