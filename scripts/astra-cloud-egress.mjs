#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { performance } from "node:perf_hooks";

const argv = process.argv.slice(2);
const validateOnly = argv.includes("--validate-config");
const configArg = argv.find((arg) => !arg.startsWith("--"));
const configPath =
  configArg ||
  process.env.ASTRA_CLOUD_EGRESS_CONFIG ||
  "config/astra-cloud-egress.json";
const evidenceDir =
  process.env.ASTRA_CLOUD_EGRESS_EVIDENCE_DIR ||
  "artifacts/cloud-egress";

function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  const errors = [];
  if (!config.name) errors.push("name is required");
  if (!Array.isArray(config.targets) || !config.targets.length) errors.push("at least one target is required");
  if (!Array.isArray(config.probes) || !config.probes.length) errors.push("at least one probe is required");
  for (const target of config.targets ?? []) {
    if (!target.id) errors.push("target.id is required");
    try {
      const url = new URL(target.url);
      if (!["https:", "http:"].includes(url.protocol)) errors.push(`unsupported protocol for ${target.id}`);
    } catch {
      errors.push(`invalid target URL for ${target.id}`);
    }
  }
  for (const probe of config.probes ?? []) {
    if (!probe.id) errors.push("probe.id is required");
    if (!String(probe.path ?? "/").startsWith("/")) errors.push(`probe.path must start with / for ${probe.id}`);
  }
  if (errors.length) {
    console.error("ASTRA_CLOUD_EGRESS_CONFIG_FAIL");
    for (const error of errors) console.error("- " + error);
    process.exit(2);
  }
  return config;
}

const config = loadConfig();
if (validateOnly) {
  console.log("ASTRA_CLOUD_EGRESS_CONFIG_PASS");
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value ?? "").replaceAll("’", "'").toLowerCase();
}

function textFailures(value, rule = {}) {
  const normalized = normalize(value);
  const failures = [];
  for (const fragment of rule.requireAll ?? []) {
    if (!normalized.includes(normalize(fragment))) failures.push(`missing: ${fragment}`);
  }
  if (rule.requireAny?.length && !rule.requireAny.some((fragment) => normalized.includes(normalize(fragment)))) {
    failures.push(`missing any: ${rule.requireAny.join(" | ")}`);
  }
  for (const fragment of rule.forbid ?? []) {
    if (normalized.includes(normalize(fragment))) failures.push(`forbidden: ${fragment}`);
  }
  return failures;
}

function getPath(value, dotted) {
  if (!dotted) return value;
  return String(dotted)
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
}


function htmlDecode(value = "") {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function htmlTags(html, name) {
  return [...String(html).matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function htmlAttr(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? htmlDecode(match[1]) : "";
}

function metaContent(html, key, value) {
  for (const tag of htmlTags(html, "meta")) {
    if (htmlAttr(tag, key).toLowerCase() === String(value).toLowerCase()) return htmlAttr(tag, "content");
  }
  return "";
}

function linkHref(html, rel) {
  for (const tag of htmlTags(html, "link")) {
    const rels = htmlAttr(tag, "rel").toLowerCase().split(/\s+/).filter(Boolean);
    if (rels.includes(String(rel).toLowerCase())) return htmlAttr(tag, "href");
  }
  return "";
}

function htmlTitle(html) {
  return htmlDecode(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function jsonLdTypes(html) {
  const out = new Set();
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(match[1]);
      const walk = (value) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          for (const item of value) walk(item);
          return;
        }
        const type = value["@type"];
        if (typeof type === "string") out.add(type);
        else if (Array.isArray(type)) {
          for (const item of type) if (typeof item === "string") out.add(item);
        }
        if (Array.isArray(value["@graph"])) {
          for (const item of value["@graph"]) walk(item);
        }
      };
      walk(root);
    } catch {
      // Invalid JSON-LD is reported indirectly through missing required types.
    }
  }
  return out;
}

function xmlLocs(xml) {
  return [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => htmlDecode(match[1]));
}

function normalizedUrlPath(value) {
  try {
    const pathname = new URL(value).pathname;
    return decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

async function inspectSerpPage(target, absoluteUrl, kind) {
  const timeoutMs = Number(config.defaults?.timeoutMs ?? 25000);
  const response = await fetchWithTimeout(
    absoluteUrl,
    {
      headers: {
        "user-agent": "ASTRA-SERP-DOMINATOR/1.0",
        accept: "text/html,application/xhtml+xml,*/*",
        "cache-control": "no-cache",
      },
    },
    timeoutMs,
  );
  const html = await response.text();
  const failures = [];
  const title = htmlTitle(html);
  const description = metaContent(html, "name", "description");
  const robots = metaContent(html, "name", "robots").toLowerCase();
  const canonical = linkHref(html, "canonical");
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const requestedPath = normalizedUrlPath(absoluteUrl);
  const canonicalPath = canonical ? normalizedUrlPath(new URL(canonical, target.url).toString()) : "";
  const types = jsonLdTypes(html);
  const minDescription = Number(config.serp?.metaDescriptionMin ?? 40);

  if (response.status !== 200) failures.push(`HTTP ${response.status}`);
  if (!title) failures.push("title absent");
  if (description.length < minDescription) failures.push(`meta description ${description.length}<${minDescription}`);
  if (h1Count !== 1) failures.push(`H1=${h1Count}`);
  if (/noindex/.test(robots)) failures.push("noindex");
  if (!canonical || canonicalPath !== requestedPath) failures.push(`canonical ${canonical || "absente"}`);

  if (kind === "article") {
    if (![...types].some((type) => ["Article", "NewsArticle", "BlogPosting"].includes(type))) {
      failures.push("Article JSON-LD absent");
    }
    if (!types.has("BreadcrumbList")) failures.push("BreadcrumbList absent");
    const image = metaContent(html, "property", "og:image");
    const width = Number(metaContent(html, "property", "og:image:width") || 0);
    const minWidth = Number(config.serp?.articleMinImageWidth ?? 1200);
    if (!image) failures.push("og:image absent");
    if (width < minWidth) failures.push(`og:image width ${width || "inconnue"}<${minWidth}`);
    if (!/max-image-preview:large/.test(robots)) failures.push("max-image-preview:large absent");
  }

  if (kind === "match") {
    if (!types.has("SportsEvent")) failures.push("SportsEvent absent");
    if (![...types].some((type) => ["NewsArticle", "LiveBlogPosting"].includes(type))) {
      failures.push("Article match absent");
    }
    if (!types.has("BreadcrumbList")) failures.push("BreadcrumbList absent");
  }

  if (kind === "prediction") {
    if (!types.has("WebPage")) failures.push("WebPage JSON-LD absent");
    if (!types.has("SportsEvent")) failures.push("SportsEvent JSON-LD absent");
    if (!types.has("BreadcrumbList")) failures.push("BreadcrumbList absent");
  }

  return {
    kind,
    url: absoluteUrl,
    status: response.status,
    pass: failures.length === 0,
    failures,
    title,
    descriptionLength: description.length,
    robots,
    canonical,
    h1Count,
    schemaTypes: [...types].sort(),
  };
}

async function runSerpAudit(target) {
  if (!config.serp?.enabled) return null;
  const timeoutMs = Number(config.defaults?.timeoutMs ?? 25000);
  const getXml = async (pathname) => {
    const url = new URL(pathname, target.url).toString();
    const response = await fetchWithTimeout(
      url,
      { headers: { "user-agent": "ASTRA-SERP-DOMINATOR/1.0", accept: "application/xml,text/xml,*/*" } },
      timeoutMs,
    );
    return { url, status: response.status, text: await response.text() };
  };

  const [sitemap, newsSitemap] = await Promise.all([
    getXml(config.serp.sitemapPath || "/sitemap.xml"),
    getXml(config.serp.newsSitemapPath || "/news-sitemap.xml"),
  ]);
  const sitemapLocs = xmlLocs(sitemap.text);
  const newsLocs = xmlLocs(newsSitemap.text);
  const failures = [];
  if (sitemap.status !== 200 || !sitemapLocs.length) failures.push("sitemap vide/FAIL");
  if (newsSitemap.status !== 200 || !newsLocs.length) failures.push("news sitemap vide/FAIL");

  const targets = (config.serp.staticPages ?? []).map((pathname) => ({
    kind: "page",
    url: new URL(pathname, target.url).toString(),
  }));
  const matchUrl = sitemapLocs.find((url) => normalizedUrlPath(url).startsWith("/match/"));
  const predictionUrl = sitemapLocs.find((url) => normalizedUrlPath(url).startsWith("/prediction/"));
  const articleUrl = newsLocs.find((url) => normalizedUrlPath(url).startsWith("/actualites/"));

  if (matchUrl) targets.push({ kind: "match", url: new URL(normalizedUrlPath(matchUrl), target.url).toString() });
  else failures.push("aucune fiche match dans sitemap");
  if (predictionUrl) targets.push({ kind: "prediction", url: new URL(normalizedUrlPath(predictionUrl), target.url).toString() });
  else failures.push("aucune preuve prediction dans sitemap");
  if (articleUrl) targets.push({ kind: "article", url: new URL(normalizedUrlPath(articleUrl), target.url).toString() });
  else failures.push("aucun article recent /actualites/ dans news sitemap");

  const pages = [];
  for (const item of targets) {
    try {
      const page = await inspectSerpPage(target, item.url, item.kind);
      pages.push(page);
      for (const failure of page.failures) failures.push(`${normalizedUrlPath(page.url)}: ${failure}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pages.push({ kind: item.kind, url: item.url, status: 0, pass: false, failures: [message] });
      failures.push(`${normalizedUrlPath(item.url)}: ${message}`);
    }
  }

  return {
    schema: "astra-serp-dominator/evidence-v1",
    pass: failures.length === 0,
    sitemap: { status: sitemap.status, urlCount: sitemapLocs.length },
    newsSitemap: { status: newsSitemap.status, urlCount: newsLocs.length },
    pages,
    failures,
  };
}

async function cloudDns(hostname) {
  const started = performance.now();
  const result = { hostname, a: [], aaaa: [], cname: [], ns: [], pass: false, latencyMs: 0, errors: [] };
  try {
    result.a = await dns.resolve4(hostname);
  } catch (error) {
    result.errors.push(`A: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    result.aaaa = await dns.resolve6(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND/i.test(message)) result.errors.push(`AAAA: ${message}`);
  }
  try {
    result.cname = await dns.resolveCname(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND|ENOTIMP/i.test(message)) result.errors.push(`CNAME: ${message}`);
  }
  try {
    result.ns = await dns.resolveNs(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND|ENOTIMP/i.test(message)) result.errors.push(`NS: ${message}`);
  }
  result.latencyMs = Math.round(performance.now() - started);
  result.pass = result.a.length > 0 || result.aaaa.length > 0;
  return result;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function runProbe(target, probe) {
  const retries = Number(probe.retries ?? config.defaults?.retries ?? 3);
  const retryDelayMs = Number(probe.retryDelayMs ?? config.defaults?.retryDelayMs ?? 2500);
  const timeoutMs = Number(probe.timeoutMs ?? config.defaults?.timeoutMs ?? 25000);
  const expectedStatuses = probe.expect?.statuses ?? [200];
  let last;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const url = new URL(probe.path || "/", target.url).toString();
    const started = performance.now();
    const failures = [];
    let status = 0;
    let body = "";
    let responseUrl = url;
    let headers = {};
    let error = null;

    try {
      const init = {
        method: probe.method || "GET",
        headers: {
          "user-agent": "ASTRA-CLOUD-EGRESS/2.0",
          accept: "application/json,text/html,text/plain,*/*",
          ...(probe.headers ?? {}),
        },
      };
      if (probe.body !== undefined) {
        init.body = typeof probe.body === "string" ? probe.body : JSON.stringify(probe.body);
        init.headers["content-type"] ||= "application/json";
      }
      const response = await fetchWithTimeout(url, init, timeoutMs);
      status = response.status;
      responseUrl = response.url;
      body = await response.text();
      headers = {
        server: response.headers.get("server"),
        via: response.headers.get("via"),
        railwayRequestId: response.headers.get("x-railway-request-id"),
        vercelId: response.headers.get("x-vercel-id"),
        netlifyRequestId: response.headers.get("x-nf-request-id"),
        cache: response.headers.get("x-cache") || response.headers.get("cf-cache-status"),
        astraPublicRevision: response.headers.get("x-astra-public-revision"),
      };

      if (!expectedStatuses.includes(status)) {
        failures.push(`HTTP ${status}; expected ${expectedStatuses.join(",")}`);
      }
      if (probe.expect?.text) failures.push(...textFailures(body, probe.expect.text));
      if (probe.expect?.jsonText || probe.expect?.jsonPath) {
        try {
          const parsed = JSON.parse(body);
          const selected = getPath(parsed, probe.expect.jsonPath || "text");
          failures.push(...textFailures(selected, probe.expect.jsonText ?? {}));
        } catch (parseError) {
          failures.push(`invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      failures.push(error);
    }

    last = {
      id: probe.id,
      method: probe.method || "GET",
      url,
      responseUrl,
      attempt,
      status,
      pass: failures.length === 0,
      latencyMs: Math.round(performance.now() - started),
      failures,
      headers,
      error,
      excerpt: body.slice(0, Number(config.defaults?.excerptChars ?? 1200)),
    };

    if (last.pass) break;
    if (attempt < retries) await sleep(retryDelayMs);
  }

  return last;
}

async function runTarget(target) {
  const parsed = new URL(target.url);
  const dnsEvidence = await cloudDns(parsed.hostname);
  const probes = [];
  for (const probe of config.probes) probes.push(await runProbe(target, probe));
  const serp = await runSerpAudit(target);
  return {
    id: target.id,
    provider: target.provider || "unknown",
    url: target.url,
    priority: Number(target.priority ?? 100),
    fallback: Boolean(target.fallback),
    dns: dnsEvidence,
    pass: dnsEvidence.pass && probes.every((probe) => probe.pass) && (!serp || serp.pass),
    probes,
    serp,
  };
}

const targets = [...config.targets].sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));
const results = [];
for (const target of targets) {
  console.log(`ASTRA_CLOUD_EGRESS target=${target.id} url=${target.url}`);
  results.push(await runTarget(target));
}

const primary = results.find((target) => target.pass && !target.fallback);
const fallback = results.find((target) => target.pass && target.fallback);
const selected = primary ?? fallback ?? null;
const status = selected ? (selected.fallback ? "PARTIAL" : "PASS") : "FAIL";

const evidence = {
  schema: "astra-cloud-egress/evidence-v3",
  generatedAt: new Date().toISOString(),
  configName: config.name,
  verificationRevision: config.verificationRevision ?? null,
  status,
  execution: "remote-cloud-runner",
  selectedTarget: selected
    ? { id: selected.id, provider: selected.provider, url: selected.url, fallback: selected.fallback }
    : null,
  targets: results,
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2));

const summary = [
  "# ASTRA CLOUD EGRESS Ω — Evidence",
  "",
  `- Status: **${status}**`,
  `- Execution: **remote-cloud-runner**`,
  `- Revision: ${evidence.verificationRevision ?? "n/a"}`,
  `- Selected target: ${selected ? `${selected.id} · ${selected.provider}${selected.fallback ? " · FALLBACK" : ""}` : "NONE"}`,
  "",
  ...results.flatMap((target) => [
    `## ${target.pass ? "✅" : "❌"} ${target.id} — ${target.provider}`,
    `- DNS cloud: ${target.dns.pass ? "PASS" : "FAIL"} · A=${target.dns.a.join(",") || "—"} · AAAA=${target.dns.aaaa.join(",") || "—"} · CNAME=${target.dns.cname.join(",") || "—"} · NS=${target.dns.ns.join(",") || "—"} · ${target.dns.latencyMs}ms`,
    ...target.probes.map(
      (probe) =>
        `- ${probe.pass ? "PASS" : "FAIL"} · ${probe.method} ${new URL(probe.url).pathname} · HTTP ${probe.status || "ERR"} · ${probe.latencyMs}ms · server=${probe.headers.server || "—"} · via=${probe.headers.via || "—"} · railway=${probe.headers.railwayRequestId || "—"} · vercel=${probe.headers.vercelId || "—"} · netlify=${probe.headers.netlifyRequestId || "—"} · revision=${probe.headers.astraPublicRevision || "—"}${probe.failures.length ? ` · ${probe.failures.join("; ")}` : ""}`,
    ),
    ...(target.serp
      ? [
          `- SERP DOMINATOR: ${target.serp.pass ? "PASS" : "FAIL"} · sitemap=${target.serp.sitemap.urlCount} · news=${target.serp.newsSitemap.urlCount}`,
          ...target.serp.pages.map(
            (page) =>
              `  - ${page.pass ? "PASS" : "FAIL"} · ${page.kind} ${normalizedUrlPath(page.url)} · HTTP ${page.status || "ERR"}${page.failures?.length ? ` · ${page.failures.join("; ")}` : ""}`,
          ),
        ]
      : []),
    "",
  ]),
].join("\n");

fs.writeFileSync(path.join(evidenceDir, "summary.md"), summary);
console.log(summary);

if (!selected) process.exit(1);
