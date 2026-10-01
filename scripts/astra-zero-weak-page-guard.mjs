#!/usr/bin/env node
/**
 * ASTRA ZERO-WEAK-PAGE GUARD Ω
 *
 * Generic, config-driven static gate for public web routes.
 * It does not reward keyword stuffing. It checks whether an indexable route has
 * an explicit SEO purpose and enough evidence of a complete implementation.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = process.env.ASTRA_ZERO_WEAK_CONFIG || "config/astra-zero-weak-page-guard.json";
const strict = process.argv.includes("--strict");

const cfg = JSON.parse(await fs.readFile(path.join(root, configPath), "utf8"));
const norm = (p) => p.split(path.sep).join("/");
const rx = (value) => new RegExp(value, "i");
const technicalRx = (cfg.technicalPatterns || []).map(rx);
const headDelegateRx = (cfg.headDelegatePatterns || []).map(rx);
const contentDelegateRx = (cfg.contentDelegatePatterns || []).map(rx);
const ignored = new Set((cfg.ignoreFiles || []).map(norm));

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

function count(re, source) {
  return [...source.matchAll(re)].length;
}

function textSignalBytes(source) {
  const strings = [...source.matchAll(/(?:>|["'`])([^<>"'`]{18,})(?:<|["'`])/g)]
    .map((m) => m[1])
    .filter((s) => /[A-Za-zÀ-ÿ]{4}/.test(s));
  return strings.join(" ").replace(/\s+/g, " ").trim().length;
}

function routeHint(file) {
  const base = path.basename(file).replace(/\.(tsx|ts|jsx|js)$/i, "");
  if (base === "index") return "/";
  return "/" + base
    .replace(/\._/g, "/")
    .replace(/\./g, "/")
    .replace(/\$/g, ":");
}

function normalizeRoutePath(value) {
  if (!value) return "";
  const dynamic = value.replace(/\$([A-Za-z0-9_]+)/g, ":$1");
  if (dynamic === "/") return "/";
  return dynamic.replace(/\/+$/, "");
}

function routePathFromSource(source, rel) {
  const match = source.match(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/i);
  return normalizeRoutePath(match?.[1] || routeHint(rel));
}

function isOutletLayout(source) {
  return /<Outlet\b/i.test(source) &&
    !/<h1\b/i.test(source) &&
    !/\bhead\s*:/i.test(source) &&
    textSignalBytes(source) < 120;
}

function extractFirst(source, patterns) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return "";
}

function quotedRouteInSitemap(source, routePath) {
  if (!source || !routePath || routePath.includes(":")) return false;
  const escaped = routePath.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\function routeHint(file) {
  const base = path.basename(file).replace(/\.(tsx|ts|jsx|js)$/i, "");
  if (base === "index") return "/";
  return "/" + base
    .replace(/\._/g, "/")
    .replace(/\./g, "/")
    .replace(/\$/g, ":");
}
");
  return new RegExp(`["'\\`]${escaped}/?["'\\`]`).test(source);
}

function classify(rel, source) {
  if (isOutletLayout(source)) return "layout";
  if (technicalRx.some((r) => r.test(rel))) return "technical";
  if (/redirect\s*\(/i.test(source)) return "redirect";
  if (/noindex/i.test(source)) return "noindex";
  if (/rapports\.precision|ledger|methodology|data-sources|prediction-history|editorial-policy|press|redaction/i.test(rel)) return "trust";
  if (/mentions-legales|confidentialite|cookies|cgu|jeu-responsable|politique-publicite|contact/i.test(rel)) return "legal";
  if (/comparer-cotes|meilleures-cotes|pari-du-jour|opportunities|calculateur-mise|meilleur-site-pronostic/i.test(rel)) return "commercial";
  if (/actualites|blog|actu/i.test(rel)) return "editorial";
  if (/match|resultat|score|classement|calendrier|statistics|equipe/i.test(rel)) return "entity";
  return "landing";
}

function audit(rel, source, sitemapSource) {
  const routePath = routePathFromSource(source, rel);
  const role = classify(rel, source);
  const layout = role === "layout";
  const redirect = role === "redirect";
  const noindex = /noindex/i.test(source);
  const technical = role === "technical";
  const headDelegated = headDelegateRx.some((r) => r.test(source));
  const contentDelegated = contentDelegateRx.some((r) => r.test(source));
  const hasHead = /\bhead\s*:/i.test(source);
  const title = headDelegated || /\btitle\s*:/i.test(source) || /[{,]\s*title\s*[,}]/i.test(source) || /<title\b/i.test(source);
  const description = headDelegated || /name\s*:\s*["']description["']/i.test(source);
  const canonical = headDelegated || /rel\s*:\s*["']canonical["']/i.test(source);
  const h1Count = count(/<h1\b/gi, source);
  const h1 = contentDelegated || h1Count === 1;
  const internalLinks =
    count(/href\s*=\s*["']\//gi, source) +
    count(/\bto\s*=\s*["']\//gi, source) +
    count(/href\s*:\s*["']\//gi, source);
  const sourceBytes = Buffer.byteLength(source);
  const visibleTextBytes = textSignalBytes(source);
  const content = contentDelegated || visibleTextBytes >= Number(cfg.minVisibleTextBytes || 450);
  const links = contentDelegated || internalLinks >= Number(cfg.minInternalLinks || 2);
  const structured =
    contentDelegated ||
    /application\/ld\+json|jsonLd|geoJsonLd|\bld\s*\(/i.test(source);
  const trust =
    /methodology|data-sources|ledger|evidence|source|preuve|fiabil|jeu-responsable|editorial/i.test(source);
  const sitemapContainsRoute = quotedRouteInSitemap(sitemapSource, routePath);
  const sitemapExcluded = !sitemapContainsRoute;
  const titleLiteral = extractFirst(source, [
    /\btitle\s*:\s*["'`]([^"'`]{3,})["'`]/i,
  ]);
  const descriptionLiteral = extractFirst(source, [
    /name\s*:\s*["']description["'][\s\S]{0,220}?content\s*:\s*["'`]([^"'`]{20,})["'`]/i,
  ]);
  const canonicalLiteral = extractFirst(source, [
    /rel\s*:\s*["']canonical["'][\s\S]{0,180}?href\s*:\s*["'`]([^"'`]+)["'`]/i,
  ]);

  const signals = { hasHead, title, description, canonical, h1, h1Count, content, links, structured, trust, noindex, sitemapContainsRoute };
  let score = 0;
  if (title) score += 12;
  if (description) score += 12;
  if (canonical) score += 12;
  if (h1) score += 16;
  if (content) score += 18;
  if (links) score += 12;
  if (structured) score += 8;
  if (trust) score += 10;

  const criticalMissing = [];
  if (!title) criticalMissing.push("title");
  if (!description) criticalMissing.push("meta-description");
  if (!canonical) criticalMissing.push("canonical");
  if (!h1) criticalMissing.push("h1");
  if (!content) criticalMissing.push("main-content");
  if (!links && role !== "legal") criticalMissing.push("internal-links");

  const failures = [];
  if (layout) {
    // Route-tree wrapper only: the child index route owns the public document.
  } else if (technical || noindex) {
    if (technical && !noindex) failures.push("technical-route-must-be-noindex");
    if (!sitemapExcluded) failures.push("nonindexable-route-found-in-sitemap-source");
  } else if (!redirect) {
    if (!hasHead) failures.push("missing-route-head");
    if (!contentDelegated && h1Count > 1) failures.push(`multiple-h1:${h1Count}`);
    if (criticalMissing.length) failures.push(`critical:${criticalMissing.join(",")}`);
    const roleMin = Number((cfg.roleMinimums || {})[role] ?? cfg.minScore ?? 78);
    if (score < roleMin) failures.push(`weak-score:${score}<${roleMin}`);
  }

  return {
    file: rel,
    routePath,
    routeHint: routeHint(rel),
    role,
    indexable: !layout && !redirect && !noindex && !technical,
    sourceBytes,
    visibleTextBytes,
    internalLinks,
    score,
    signals,
    literals: { title: titleLiteral, description: descriptionLiteral, canonical: canonicalLiteral },
    failures,
    status: failures.length ? "FAIL" : "PASS",
  };
}

const files = [];
for (const dir of cfg.routeDirs || ["src/routes"]) {
  files.push(...await walk(path.join(root, dir)));
}
const candidates = files
  .map((f) => norm(path.relative(root, f)))
  .filter((rel) => (cfg.extensions || [".tsx"]).some((ext) => rel.endsWith(ext)))
  .filter((rel) => !ignored.has(rel));

let sitemapSource = "";
if (cfg.sitemapSource) {
  try {
    sitemapSource = await fs.readFile(path.join(root, cfg.sitemapSource), "utf8");
  } catch {
    sitemapSource = "";
  }
}

const results = [];
for (const rel of candidates) {
  const source = await fs.readFile(path.join(root, rel), "utf8");
  if (!/create(?:File|Root)Route/i.test(source)) continue;
  results.push(audit(rel, source, sitemapSource));
}

function addFailure(item, reason) {
  if (!item.failures.includes(reason)) item.failures.push(reason);
  item.status = item.failures.length ? "FAIL" : "PASS";
}

function enforceUnique(field, label) {
  const seen = new Map();
  for (const item of results.filter((r) => r.indexable)) {
    const value = item.literals?.[field];
    if (!value) continue;
    const key = value.toLowerCase();
    const previous = seen.get(key);
    if (previous && previous.routePath !== item.routePath) {
      addFailure(previous, `duplicate-${label}:${item.routePath}`);
      addFailure(item, `duplicate-${label}:${previous.routePath}`);
    } else {
      seen.set(key, item);
    }
  }
}

if (cfg.enforceUniqueMetadata !== false) {
  enforceUnique("title", "title");
  enforceUnique("description", "description");
  enforceUnique("canonical", "canonical");
}

const routeOwners = new Map();
for (const item of results.filter((r) => r.indexable && r.routePath)) {
  const previous = routeOwners.get(item.routePath);
  if (previous) {
    addFailure(previous, `duplicate-route-owner:${item.file}`);
    addFailure(item, `duplicate-route-owner:${previous.file}`);
  } else {
    routeOwners.set(item.routePath, item);
  }
}

const failures = results.filter((r) => r.status === "FAIL");
const indexable = results.filter((r) => r.indexable);
const summary = {
  version: cfg.version,
  generatedAt: new Date().toISOString(),
  strict,
  routesAudited: results.length,
  indexableRoutesAudited: indexable.length,
  passed: results.length - failures.length,
  failed: failures.length,
  verdict: failures.length ? "FAIL" : "PASS",
};

const report = { summary, failures, results };
const reportPath = path.join(root, cfg.reportPath || "artifacts/seo/zero-weak-pages.json");
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

for (const item of results) {
  const detail = item.failures.length ? item.failures.join(" | ") : `score=${item.score}`;
  console.log(`${item.status}\t${item.role}\t${item.file}\t${detail}`);
}
console.log(`ASTRA_ZERO_WEAK_PAGE_GUARD_${summary.verdict} audited=${summary.routesAudited} failed=${summary.failed}`);

if (strict && failures.length) process.exit(1);
