#!/usr/bin/env node
/* ASTRA BetGPT production proof: zero paid APIs, fail-closed on wrong revision, HTTP status or meta. */
const origin = "https://betgpt.live";
const articlePath = "/actualites/psg-lyon-reporte-lundi-26-octobre-2026";
const expectedSha = "9ad54202497028b977cf234bf1148a36094fcfdd";
const revisionUrl = origin + "/astra-revision.json";
async function get(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
    headers: { "user-agent": "ASTRA-BETGPT-CANONICAL-PROOF/1.0", "cache-control": "no-cache", "accept": "text/html,application/json" }
  });
  return { status: response.status, finalUrl: response.url, body: await response.text(), contentType: response.headers.get("content-type") || "" };
}
try {
  const revision = await get(revisionUrl);
  if (revision.status !== 200) throw Error("REVISION_NOT_200 status=" + revision.status);
  const current = JSON.parse(revision.body);
  if (current.sourceSha !== expectedSha) throw Error("NOT_PROMOTED expected=" + expectedSha + " got=" + current.sourceSha);
  const page = await get(origin + articlePath);
  const articleUrl = origin + articlePath;
  if (page.status !== 200) throw Error("ARTICLE_NOT_200 status=" + page.status);
  if (page.finalUrl.replace(/\\/$/,"") !== articleUrl) throw Error("CANONICAL_ROUTE_REDIRECT " + page.finalUrl);
  if (!page.contentType.includes("text/html")) throw Error("BAD_CONTENT_TYPE " + page.contentType);
  if (!page.body.includes("PSG") || !page.body.includes("Lyon")) throw Error("EXPECTED_ARTICLE_ABSENT");
  const canonicalLinks = [...page.body.matchAll(/<link\\b[^>]*rel=[\"']canonical[\"'][^>]*>/gi)];
  if (canonicalLinks.length !== 1 || !canonicalLinks[0][0].includes(articleUrl)) throw Error("CANONICAL_INVALID");
  const metaRobots = [...page.body.matchAll(/<meta\\b[^>]*name=[\"']robots[\"'][^>]*>/gi)].map(x=>x[0]);
  if (metaRobots.some(x=>/noindex/i.test(x))) throw Error("ARTICLE_NOINDEX");
  if (!metaRobots.some(x=>/max-image-preview:large/i.test(x))) throw Error("DISCOVER_LARGE_IMAGE_META_MISSING");
  console.log("ASTRA_BETGPT_LIVE_ARTICLE_HTTP200_PASS", JSON.stringify({article:articleUrl,status:page.status,revision:current.sourceSha,canonical:true,indexable:true}));
} catch (error) {
  console.error("ASTRA_BETGPT_LIVE_ARTICLE_FAIL",String(error));
  process.exitCode=1;
}
