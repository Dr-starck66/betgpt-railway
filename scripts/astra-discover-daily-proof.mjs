#!/usr/bin/env node
/**
 * ASTRA Discover daily publication proof.
 * Proves source inventory + live HTTP/canonical/robots/news-sitemap, NOT Google indexing
 * or guaranteed display in Discover. A manual article never counts as auto-publication.
 * No paid API; read-only checks. Run after the last editorial slot each Paris day.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ORIGIN = "https://betgpt.live";
const SLOTS = ["morning", "noon", "evening"];
const flags = new Set(process.argv.slice(2));
const todayArg = process.argv.find((item) => item.startsWith("--day="))?.slice(6);
const selfTest = flags.has("--self-test");
const reportOnly = flags.has("--report-only");

function parisDay(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
function closedParisDay(now = new Date()) {
  // At 00:35 UTC (01:35 winter, 02:35 summer Paris), previous UTC day is
  // also the preceding completed calendar day in Paris, including DST changes.
  return parisDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}
function textWords(article) {
  const chunks = [article.lead ?? ""];
  for (const p of article.paragraphs ?? []) {
    chunks.push(p.body ?? "");
    for (const sub of p.subsections ?? []) {
      chunks.push(sub.body ?? "");
      for (const inner of sub.subsections ?? []) chunks.push(inner.body ?? "");
    }
  }
  return chunks.join(" ").trim().split(/\s+/u).filter(Boolean).length;
}
function strongHosts(article) {
  const hosts = new Set();
  for (const s of article.sources ?? []) {
    if (!["OFFICIAL", "HIGH_CONFIDENCE", "CORROBORATED"].includes(s.status)) continue;
    try {
      const url = new URL(s.url);
      if (url.protocol === "https:") hosts.add(url.hostname.toLowerCase().replace(/^www\./, ""));
    } catch { /* Ignore invalid external evidence. */ }
  }
  return hosts.size;
}
// Canonical seven-model-call evidence is required; slot-shaped IDs are not proof.
function hasNativeGenerationProof(article, day) {
  const proof = article?.generationProof;
  return article?.id === `ed-${day}-${article.slot}` &&
    article?.parisDate === day &&
    Boolean(article?.publishedAt) &&
    Number.isFinite(Date.parse(article.publishedAt)) &&
    parisDay(new Date(article.publishedAt)) === day &&
    ["PUBLISHED", "UPDATED"].includes(article?.status) &&
    article?.quality?.pass === true &&
    proof?.generator === "astra-auto-reporter-v2" &&
    typeof proof?.runId === "string" && proof.runId.length > 0 &&
    ["scheduler", "cron-api"].includes(proof?.trigger) &&
    proof?.modelRequests === 7 &&
    Number.isFinite(Date.parse(proof?.generatedAt ?? ""));
}
function articleFailures(article, day) {
  const failed = [];
  if (!article || !["PUBLISHED", "UPDATED"].includes(article.status)) failed.push("NOT_PUBLIC");
  const timestamp = new Date(article?.publishedAt ?? "");
  if (!Number.isFinite(timestamp.getTime()) || parisDay(timestamp) !== day) failed.push("WRONG_PUBLICATION_DATE");
  if (article.parisDate !== day) failed.push("WRONG_EDITORIAL_DATE");
  if (article.quality?.pass !== true) failed.push("QUALITY_GATE");
  if (!hasNativeGenerationProof(article, day)) failed.push("NATIVE_GENERATION_PROOF");
  if ((article.paragraphs ?? []).length < 7 || textWords(article) < 1500) failed.push("GOLD_STANDARD_STRUCTURE");
  if (strongHosts(article) < 3) failed.push("INDEPENDENT_SOURCES");
  if (!article.image?.src || article.image.width < 1200 || article.image.height < 675 || !article.image.credit?.trim()) failed.push("LARGE_LICENSED_IMAGE");
  if (!article.discoverChecks?.MAX_IMAGE_PREVIEW_LARGE || !article.discoverChecks?.INDEXABLE) failed.push("DISCOVER_STATIC");
  return failed;
}
function analyze(ledger, day) {
  const rows = ledger.filter((a) => a && a.publishedAt && Number.isFinite(Date.parse(a.publishedAt)) &&
    parisDay(new Date(a.publishedAt)) === day && ["PUBLISHED", "UPDATED"].includes(a.status));
  const claimedAuto = rows.filter((a) => /^ed-\d{4}-\d{2}-\d{2}-(morning|noon|evening)$/.test(a.id) && a.parisDate === day);
  const auto = claimedAuto.filter((a) => hasNativeGenerationProof(a, day));
  const bySlot = new Map(SLOTS.map((slot) => [slot, auto.filter((a) => a.slot === slot)]));
  const missingSlots = SLOTS.filter((slot) => (bySlot.get(slot) ?? []).length !== 1);
  const violations = claimedAuto.flatMap((a) => articleFailures(a, day).map((reason) => ({ slug: a.slug, reason })));
  const verdict = missingSlots.length ? "FAIL_DAILY_AUTOMATION_MISSING_SLOTS"
    : violations.length ? "FAIL_EDITORIAL_QUALITY" : "PASS_LEDGER";
  return {
    day, goal: "three qualified auto-generated articles each Paris day",
    totalPublished: rows.length,
    manuallyPublished: rows.filter((a) => !auto.includes(a)).map((a) => a.slug),
    automaticallyPublished: auto.map((a) => ({ id: a.id, slug: a.slug, slot: a.slot })),
    missingSlots, violations, status: verdict,
  };
}
async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: "follow", signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "ASTRA-DAILY-DISCOVER-PROOF/1.0", "cache-control": "no-cache" },
  });
  return { status: response.status, url: response.url, body: await response.text() };
}
function attr(tag, name) {
  return tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"))?.[2] ?? "";
}
async function verifyLive(report) {
  const failures = [];
  let news = null;
  try {
    news = await fetchPage(ORIGIN + "/news-sitemap.xml");
    if (news.status !== 200 || !/<urlset\b/.test(news.body)) failures.push("NEWS_SITEMAP_HTTP_OR_XML");
  } catch (error) { failures.push("NEWS_SITEMAP_FETCH: " + String(error)); }
  for (const a of report.automaticallyPublished) {
    const url = ORIGIN + "/actualites/" + encodeURIComponent(a.slug);
    try {
      const page = await fetchPage(url);
      if (page.status !== 200) failures.push(a.slug + ":HTTP_" + page.status);
      if (page.url.replace(/\/$/, "") !== url) failures.push(a.slug + ":REDIRECT_OR_URL_MISMATCH");
      const canonical = [...page.body.matchAll(/<link\b[^>]*>/gi)]
        .filter((m) => attr(m[0], "rel").toLowerCase() === "canonical")
        .map((m) => attr(m[0], "href"));
      if (canonical.length !== 1 || canonical[0] !== url) failures.push(a.slug + ":CANONICAL");
      const robots = [...page.body.matchAll(/<meta\b[^>]*>/gi)]
        .filter((m) => attr(m[0], "name").toLowerCase() === "robots")
        .map((m) => attr(m[0], "content").toLowerCase());
      if (robots.some((x) => x.includes("noindex")) || !robots.some((x) => x.includes("max-image-preview:large"))) failures.push(a.slug + ":ROBOTS_OR_IMAGE_PREVIEW");
      if (news?.status === 200 && !news.body.includes("/actualites/" + a.slug)) failures.push(a.slug + ":NOT_IN_NEWS_SITEMAP");
    } catch (error) { failures.push(a.slug + ":FETCH: " + String(error)); }
  }
  return failures;
}
function testContract() {
  assert.equal(parisDay(new Date("2026-10-23T22:15:00.000Z")), "2026-10-24");
  assert.equal(closedParisDay(new Date("2026-10-24T00:35:00.000Z")), "2026-10-23");
  assert.equal(closedParisDay(new Date("2026-10-26T00:35:00.000Z")), "2026-10-25");
  const day = "2026-10-22";
  const base = (slot) => ({
    id: "ed-" + day + "-" + slot, slug: "fixture-" + slot, slot, status: "PUBLISHED",
    publishedAt: "2026-10-22T19:15:00Z", parisDate: day,
    lead: "Preuve de validation",
    paragraphs: Array.from({ length: 7 }, (_, i) => ({ h2: "Section " + i, body: ("mot utile ").repeat(110) })),
    quality: { pass: true },
    generationProof: { generator: "astra-auto-reporter-v2", runId: "test-native-7-calls", trigger: "cron-api", modelRequests: 7, generatedAt: "2026-10-22T19:14:00Z" },
    sources: ["example.org", "example.net", "example.edu"].map((host) => ({ url: "https://" + host + "/report", status: "OFFICIAL" })),
    image: { src: "/report.jpg", width: 1200, height: 675, credit: "Auteur et licence" },
    discoverChecks: { INDEXABLE: true, MAX_IMAGE_PREVIEW_LARGE: true },
  });
  assert.equal(analyze([], day).status, "FAIL_DAILY_AUTOMATION_MISSING_SLOTS");
  assert.equal(analyze([base("morning")], day).status, "FAIL_DAILY_AUTOMATION_MISSING_SLOTS");
  assert.equal(analyze([base("morning"),base("noon"),base("evening")], day).status, "PASS_LEDGER");
  assert.equal(analyze([base("morning"),base("noon"),{ ...base("evening"), generationProof: undefined }], day).status, "FAIL_DAILY_AUTOMATION_MISSING_SLOTS");
  assert.equal(analyze([base("morning"),base("noon"),{ ...base("evening"), generationProof: { ...base("evening").generationProof, trigger: "operator-catchup" } }], day).status, "FAIL_DAILY_AUTOMATION_MISSING_SLOTS");
  assert.equal(analyze([base("morning"),base("noon"),{ ...base("evening"), generationProof: { ...base("evening").generationProof, modelRequests: 0 } }], day).status, "FAIL_DAILY_AUTOMATION_MISSING_SLOTS");
  assert.equal(analyze([{ ...base("morning"), id: "manual-report" }], day).automaticallyPublished.length, 0);
  assert.equal(analyze([base("morning"),base("noon"),{ ...base("evening"), quality: { pass: false } }],day).status,"FAIL_EDITORIAL_QUALITY");
  console.log("ASTRA_DISCOVER_DAILY_PROOF_CONTRACT_PASS: zero days fail; manual/agent/zero-model does not count; 3 native quality slots pass; bad quality fails; Paris DST passes");
}
if (selfTest) {
  testContract();
} else {
  const target = todayArg || closedParisDay();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw Error("Invalid --day value");
  const parsed = JSON.parse(readFileSync(new URL("../data/editorial/ledger.json", import.meta.url), "utf8"));
  if (!Array.isArray(parsed)) throw Error("Invalid editorial ledger");
  const report = analyze(parsed, target);
  if (report.status === "PASS_LEDGER" && !reportOnly) {
    const liveFailures = await verifyLive(report);
    report.liveFailures = liveFailures;
    report.status = liveFailures.length ? "FAIL_LIVE_PROOF" : "PASS_LIVE";
  }
  console.log("ASTRA_DISCOVER_DAILY_PUBLICATION_PROOF " + JSON.stringify(report));
  if (!report.status.startsWith("PASS")) {
    const notice = "BetGPT automatic editorial publication failed for " + target + ": " + report.status +
      "; generated " + report.automaticallyPublished.length + "/3; missing " + report.missingSlots.join(",");
    console.error((reportOnly ? "::warning::" : "::error::") + notice);
    if (!reportOnly) process.exitCode = 1;
  }
}
