#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ORIGIN = new URL(process.env.ASTRA_PUBLIC_ORIGIN || "https://betgpt.live").origin;
const SAMPLE_SIZE = Math.max(20, Math.min(120, Number(process.env.ASTRA_SITEMAP_SAMPLE_SIZE || 80)));
const TIMEOUT_MS = Number(process.env.ASTRA_SITEMAP_SAMPLE_TIMEOUT_MS || 20000);
const OUT = process.env.ASTRA_SITEMAP_SAMPLE_REPORT || "artifacts/seo/sitemap-runtime-sample.json";

const failures = [];
const report = {
  schema: "astra-sitemap-runtime-sample/v1",
  checkedAt: new Date().toISOString(),
  origin: ORIGIN,
  sitemapCount: 0,
  sampleSize: 0,
  checked: [],
  failures,
  status: "UNVERIFIED",
};

function fail(code, detail = "") {
  failures.push(detail ? `${code}: ${detail}` : code);
}
function normalize(value) {
  try {
    const u = new URL(value, ORIGIN);
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return "";
  }
}
async function fetchText(url, accept = "*/*") {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "ASTRA-SITEMAP-RUNTIME-SAMPLE/1.0",
      accept,
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  return {
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    finalUrl: res.url,
    contentType: res.headers.get("content-type") || "",
    text,
  };
}
function xmlLocs(text) {
  return [...text.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((m) => m[1].replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}
function canonicalFromHtml(text) {
  return [...text.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)]
    .map((tag) => tag[0].match(/href=["']([^"']+)["']/i)?.[1] || "")
    .filter(Boolean);
}
function robotsMeta(text) {
  return [...text.matchAll(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*>/gi)]
    .map((tag) => (tag[0].match(/content=["']([^"']+)["']/i)?.[1] || "").toLowerCase());
}
function deterministicSample(urls, n) {
  if (urls.length <= n) return [...urls];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (urls.length - 1)) / (n - 1));
    const url = urls[idx];
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

try {
  const [sitemapRes, newsRes] = await Promise.all([
    fetchText(`${ORIGIN}/sitemap.xml`, "application/xml,text/xml"),
    fetchText(`${ORIGIN}/news-sitemap.xml`, "application/xml,text/xml"),
  ]);
  if (!sitemapRes.ok) throw new Error(`sitemap HTTP ${sitemapRes.status}`);
  if (!newsRes.ok) throw new Error(`news sitemap HTTP ${newsRes.status}`);

  const sitemapLocs = xmlLocs(sitemapRes.text);
  const newsLocs = xmlLocs(newsRes.text);
  report.sitemapCount = sitemapLocs.length;

  const sample = deterministicSample(sitemapLocs, SAMPLE_SIZE);
  for (const url of newsLocs) if (!sample.includes(url)) sample.push(url);
  report.sampleSize = sample.length;

  const checked = await mapLimit(sample, 10, async (url) => {
    const row = { url, status: 0, finalUrl: "", redirected: false, canonical: "", noindex: false, contentType: "", pass: false };
    try {
      const res = await fetchText(url, "text/html");
      row.status = res.status;
      row.finalUrl = res.finalUrl;
      row.redirected = res.redirected;
      row.contentType = res.contentType;

      const canonicals = canonicalFromHtml(res.text).map(normalize);
      const metas = robotsMeta(res.text);
      row.canonical = canonicals[0] || "";
      row.noindex = metas.some((x) => /\bnoindex\b/.test(x));

      const expected = normalize(url);
      const finalNorm = normalize(res.finalUrl);
      const reasons = [];
      if (!res.ok) reasons.push(`http-${res.status}`);
      if (!/text\/html/i.test(res.contentType)) reasons.push("not-html");
      if (finalNorm !== expected) reasons.push(`final-url-mismatch:${finalNorm}`);
      if (canonicals.length !== 1) reasons.push(`canonical-count:${canonicals.length}`);
      if (canonicals[0] && canonicals[0] !== expected) reasons.push(`canonical-mismatch:${canonicals[0]}`);
      if (row.noindex) reasons.push("noindex");
      row.pass = reasons.length === 0;
      row.reasons = reasons;
    } catch (error) {
      row.reasons = [`exception:${error instanceof Error ? error.message : String(error)}`];
    }
    return row;
  });

  report.checked = checked;
  for (const row of checked) {
    if (!row.pass) fail("sample-url-fail", `${row.url} :: ${row.reasons.join("|")}`);
  }
  report.status = failures.length ? "FAIL" : "PASS";
} catch (error) {
  fail("gate-exception", error instanceof Error ? error.message : String(error));
  report.status = "FAIL";
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
console.log("ASTRA_SITEMAP_RUNTIME_SAMPLE", JSON.stringify({
  status: report.status,
  sitemapCount: report.sitemapCount,
  sampleSize: report.sampleSize,
  failed: failures.length,
  failures: failures.slice(0, 20),
}));
if (report.status !== "PASS") process.exit(1);
console.log("ASTRA_SITEMAP_RUNTIME_SAMPLE_PASS");
