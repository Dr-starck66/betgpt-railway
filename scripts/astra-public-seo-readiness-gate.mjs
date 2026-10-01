#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ORIGIN = new URL(process.env.ASTRA_PUBLIC_ORIGIN || "https://betgpt.live").origin;
const TIMEOUT_MS = Number(process.env.ASTRA_PUBLIC_SEO_TIMEOUT_MS || 25000);
const OUT = process.env.ASTRA_PUBLIC_SEO_REPORT || "artifacts/seo/public-seo-readiness.json";

const failures = [];
const evidence = {
  schema: "astra-public-seo-readiness/v1",
  checkedAt: new Date().toISOString(),
  origin: ORIGIN,
  status: "UNVERIFIED",
  checks: {},
  failures,
};

function fail(code, detail = "") {
  failures.push(detail ? `${code}: ${detail}` : code);
}
function normalizeUrl(value) {
  try {
    const u = new URL(value, ORIGIN);
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return "";
  }
}
async function get(pathname, accept = "*/*") {
  const url = new URL(pathname, ORIGIN);
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "ASTRA-PUBLIC-SEO-READINESS/1.0",
      accept,
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  return {
    url: url.toString(),
    finalUrl: response.url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type") || "",
    text,
  };
}
function xmlLocs(text) {
  return [...text.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
}
function canonicalFromHtml(text) {
  const matches = [...text.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)];
  return matches.map((tag) => {
    const m = tag[0].match(/href=["']([^"']+)["']/i);
    return m?.[1] || "";
  }).filter(Boolean);
}
function robotsMeta(text) {
  return [...text.matchAll(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*>/gi)]
    .map((tag) => {
      const m = tag[0].match(/content=["']([^"']+)["']/i);
      return (m?.[1] || "").toLowerCase();
    });
}
function checkSameOriginLocs(label, locs) {
  const foreign = [];
  const malformed = [];
  const seen = new Set();
  const duplicates = [];
  for (const loc of locs) {
    try {
      const u = new URL(loc);
      if (u.origin !== ORIGIN) foreign.push(loc);
      if (seen.has(loc)) duplicates.push(loc);
      seen.add(loc);
    } catch {
      malformed.push(loc);
    }
  }
  if (foreign.length) fail(`${label}-foreign-origin`, foreign.slice(0, 5).join(", "));
  if (malformed.length) fail(`${label}-malformed-url`, malformed.slice(0, 5).join(", "));
  if (duplicates.length) fail(`${label}-duplicate-url`, duplicates.slice(0, 5).join(", "));
  return { count: locs.length, foreign: foreign.length, malformed: malformed.length, duplicates: duplicates.length };
}

try {
  const [robots, sitemap, images, news, home, actualites] = await Promise.all([
    get("/robots.txt", "text/plain"),
    get("/sitemap.xml", "application/xml,text/xml"),
    get("/sitemap-images.xml", "application/xml,text/xml"),
    get("/news-sitemap.xml", "application/xml,text/xml"),
    get("/", "text/html"),
    get("/actualites", "text/html"),
  ]);

  evidence.checks.endpoints = {
    robots: { status: robots.status, contentType: robots.contentType },
    sitemap: { status: sitemap.status, contentType: sitemap.contentType },
    images: { status: images.status, contentType: images.contentType },
    news: { status: news.status, contentType: news.contentType },
    home: { status: home.status, contentType: home.contentType },
    actualites: { status: actualites.status, contentType: actualites.contentType },
  };

  for (const [name, res] of Object.entries({ robots, sitemap, images, news, home, actualites })) {
    if (!res.ok) fail(`${name}-http`, String(res.status));
  }

  if (!/text\/plain/i.test(robots.contentType)) fail("robots-content-type", robots.contentType);
  if (!/application\/xml|text\/xml/i.test(sitemap.contentType)) fail("sitemap-content-type", sitemap.contentType);
  if (!/application\/xml|text\/xml/i.test(images.contentType)) fail("images-content-type", images.contentType);
  if (!/application\/xml|text\/xml/i.test(news.contentType)) fail("news-content-type", news.contentType);
  if (!/text\/html/i.test(home.contentType)) fail("home-content-type", home.contentType);
  if (!/text\/html/i.test(actualites.contentType)) fail("actualites-content-type", actualites.contentType);

  const robotsLines = robots.text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const declaredSitemaps = robotsLines
    .filter((x) => /^sitemap:/i.test(x))
    .map((x) => x.replace(/^sitemap:\s*/i, ""));
  const requiredSitemaps = [
    `${ORIGIN}/sitemap.xml`,
    `${ORIGIN}/sitemap-images.xml`,
    `${ORIGIN}/news-sitemap.xml`,
  ];
  if (!/User-agent:\s*Googlebot/i.test(robots.text)) fail("robots-googlebot-missing");
  if (/^Disallow:\s*\/\s*$/im.test(robots.text)) fail("robots-blocks-root");
  for (const required of requiredSitemaps) {
    if (!declaredSitemaps.includes(required)) fail("robots-sitemap-missing", required);
  }
  evidence.checks.robots = { declaredSitemaps };

  for (const [label, res] of [["sitemap", sitemap], ["images", images], ["news", news]]) {
    if (!/^\s*<\?xml/i.test(res.text) || !/<urlset\b/i.test(res.text)) fail(`${label}-invalid-xml-shape`);
  }

  const sitemapLocs = xmlLocs(sitemap.text);
  const imageLocs = xmlLocs(images.text);
  const newsLocs = xmlLocs(news.text);
  evidence.checks.sitemap = checkSameOriginLocs("sitemap", sitemapLocs);
  evidence.checks.images = checkSameOriginLocs("images", imageLocs);
  evidence.checks.news = checkSameOriginLocs("news", newsLocs);

  if (sitemapLocs.length < 25) fail("sitemap-too-small", String(sitemapLocs.length));
  if (sitemapLocs.length > 50000) fail("sitemap-too-large", String(sitemapLocs.length));
  if (imageLocs.length < 1) fail("images-sitemap-empty");
  if (newsLocs.length > 1000) fail("news-sitemap-too-large", String(newsLocs.length));

  const now = Date.now();
  const newsDates = [...news.text.matchAll(/<news:publication_date>([\s\S]*?)<\/news:publication_date>/gi)]
    .map((m) => m[1].trim());
  let staleNews = 0;
  let futureNews = 0;
  let invalidNewsDates = 0;
  for (const raw of newsDates) {
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) invalidNewsDates++;
    else {
      if (ts < now - 48 * 60 * 60 * 1000) staleNews++;
      if (ts > now + 5 * 60 * 1000) futureNews++;
    }
  }
  if (staleNews) fail("news-stale-entry", String(staleNews));
  if (futureNews) fail("news-future-entry", String(futureNews));
  if (invalidNewsDates) fail("news-invalid-date", String(invalidNewsDates));
  if (newsLocs.length !== newsDates.length) fail("news-loc-date-count-mismatch", `${newsLocs.length}/${newsDates.length}`);
  if (newsLocs.length && !/<news:language>fr<\/news:language>/i.test(news.text)) fail("news-language-fr-missing");
  evidence.checks.news = { ...evidence.checks.news, publicationDates: newsDates.length, staleNews, futureNews, invalidNewsDates };

  for (const [label, res, expected] of [
    ["home", home, `${ORIGIN}/`],
    ["actualites", actualites, `${ORIGIN}/actualites`],
  ]) {
    const canonicals = canonicalFromHtml(res.text).map(normalizeUrl);
    const metas = robotsMeta(res.text);
    const expectedNorm = normalizeUrl(expected);
    if (canonicals.length !== 1) fail(`${label}-canonical-count`, String(canonicals.length));
    if (canonicals[0] && canonicals[0] !== expectedNorm) fail(`${label}-canonical-mismatch`, `${canonicals[0]} != ${expectedNorm}`);
    if (metas.some((x) => /\bnoindex\b/.test(x))) fail(`${label}-noindex`);
    if (!metas.some((x) => /max-image-preview:large/.test(x))) fail(`${label}-max-image-preview-large-missing`);
    if (!/<html\b[^>]*lang=["']fr["']/i.test(res.text)) fail(`${label}-lang-fr-missing`);
    evidence.checks[label] = { canonicals, robotsMeta: metas };
  }

  const representative = newsLocs[0] || sitemapLocs.find((u) => /\/actualites\//.test(u)) || sitemapLocs[0];
  if (representative) {
    const page = await get(representative, "text/html");
    const canonicals = canonicalFromHtml(page.text).map(normalizeUrl);
    const metas = robotsMeta(page.text);
    if (!page.ok) fail("representative-http", `${page.status} ${representative}`);
    if (metas.some((x) => /\bnoindex\b/.test(x))) fail("representative-noindex", representative);
    if (canonicals.length !== 1 || canonicals[0] !== normalizeUrl(representative)) {
      fail("representative-canonical-mismatch", `${representative} -> ${canonicals.join(",") || "none"}`);
    }
    evidence.checks.representative = { url: representative, status: page.status, canonicals, robotsMeta: metas };
  }

  evidence.status = failures.length ? "FAIL" : "PASS";
} catch (error) {
  fail("gate-exception", error instanceof Error ? error.message : String(error));
  evidence.status = "FAIL";
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n");
console.log("ASTRA_PUBLIC_SEO_READINESS", JSON.stringify(evidence));
if (evidence.status !== "PASS") process.exit(1);
console.log("ASTRA_PUBLIC_SEO_READINESS_PASS");
