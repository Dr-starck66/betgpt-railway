#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildSitemapUrls } from "../src/lib/sitemap-urls.ts";

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/astra-indexability-release-gate.json"), "utf8"));
const reportPath = path.join(root, cfg.zeroWeakReport || "artifacts/seo/zero-weak-pages.json");

function norm(p) {
  if (!p) return "/";
  let x = String(p).split("?")[0].split("#")[0];
  if (!x.startsWith("/")) x = "/" + x;
  if (x.length > 1) x = x.replace(/\/+$/, "");
  return x;
}

function publicRouteTemplate(route) {
  return norm(route)
    .split("/")
    .map((segment) => (segment.endsWith("_") ? segment.slice(0, -1) : segment))
    .join("/");
}

function routeTemplateMatches(template, candidate) {
  const left = publicRouteTemplate(template).split("/").filter(Boolean);
  const right = norm(candidate).split("/").filter(Boolean);
  if (left.length !== right.length) return false;
  return left.every((segment, index) => segment.startsWith(":") ? Boolean(right[index]) : segment === right[index]);
}

function dynamicCovered(route) {
  return (cfg.dynamicCoverage || []).some((rule) => {
    const prefix = norm(rule.routePrefix || "/");
    if (!(route === prefix || route.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"))) return false;
    const src = fs.readFileSync(path.join(root, rule.sitemapSource), "utf8");
    return (rule.requiredFragments || []).every((frag) => src.includes(frag));
  });
}

function syntheticMatches() {
  const leagues = ["L1", "PL", "LL", "BL", "SA", "CL", "EL"];
  const now = Date.now();
  const rows = [];
  for (const [index, league] of leagues.entries()) {
    rows.push({
      id: `astra-audit-${league.toLowerCase()}-scheduled`,
      slug: `astra-audit-${league.toLowerCase()}-scheduled`,
      status: "scheduled",
      kickoff: new Date(now + (index + 2) * 60 * 60 * 1000).toISOString(),
      league,
      home: { name: `Astra ${league} Home`, id: `astra-${league.toLowerCase()}-home` },
      away: { name: `Astra ${league} Away`, id: `astra-${league.toLowerCase()}-away` },
    });
    rows.push({
      id: `astra-audit-${league.toLowerCase()}-finished`,
      slug: `astra-audit-${league.toLowerCase()}-finished`,
      status: "finished",
      kickoff: new Date(now - (index + 1) * 30 * 60 * 1000).toISOString(),
      league,
      home: { name: `Astra ${league} Finished Home`, id: `astra-${league.toLowerCase()}-finished-home` },
      away: { name: `Astra ${league} Finished Away`, id: `astra-${league.toLowerCase()}-finished-away` },
      scoreHome: 1,
      scoreAway: 0,
    });
  }
  rows.push({
    id: "astra-audit-tomorrow",
    slug: "astra-audit-tomorrow",
    status: "scheduled",
    kickoff: new Date(now + 30 * 60 * 60 * 1000).toISOString(),
    league: "L1",
    home: { name: "Astra Tomorrow Home", id: "astra-tomorrow-home" },
    away: { name: "Astra Tomorrow Away", id: "astra-tomorrow-away" },
  });
  return rows;
}

if (!fs.existsSync(reportPath)) {
  console.error("ASTRA_INDEXABILITY_RELEASE_GATE_FAIL zero-weak report missing");
  process.exit(1);
}

const zero = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const sitemapSource = fs.readFileSync(path.join(root, cfg.sitemapSource), "utf8");
const generatedUrls = buildSitemapUrls({
  matches: syntheticMatches(),
  asOf: new Date().toISOString(),
  standingsAsOf: new Date().toISOString(),
});
const generatedPaths = generatedUrls.map((item) => norm(item.path));
const routes = (zero.results || []).filter((r) => r.indexable);
const failures = [];
const results = [];

for (const item of routes) {
  const route = publicRouteTemplate(item.routePath);
  if ((cfg.ignoreRoutes || []).includes(route)) continue;

  const literal =
    !route.includes(":") &&
    (
      sitemapSource.includes('path: "' + route + '"') ||
      sitemapSource.includes("path: '" + route + "'") ||
      sitemapSource.includes('"' + route + '"') ||
      sitemapSource.includes("'" + route + "'")
    );
  const generated = generatedPaths.some((candidate) => routeTemplateMatches(route, candidate));
  const dynamic = dynamicCovered(route);
  const ok = generated || literal || dynamic;

  results.push({ route, file: item.file, literal, generated, dynamic, status: ok ? "PASS" : "FAIL" });
  if (!ok) failures.push({ route, file: item.file, reason: "indexable-route-not-covered-by-sitemap" });
}

const duplicateStaticPaths = [];
const staticMatches = [...sitemapSource.matchAll(/\bpath:\s*["']([^"']+)["']/g)].map((m) => norm(m[1]));
const seen = new Set();
for (const value of staticMatches) {
  if (seen.has(value)) duplicateStaticPaths.push(value);
  seen.add(value);
}
if (duplicateStaticPaths.length && cfg.failOnDuplicateLiteralPaths !== false) {
  failures.push({ reason: "duplicate-literal-sitemap-path", values: [...new Set(duplicateStaticPaths)] });
}

const report = {
  schema: "astra-indexability-release-gate/v2",
  generatedAt: new Date().toISOString(),
  indexableRoutes: routes.length,
  generatedSitemapPaths: generatedPaths.length,
  checked: results.length,
  failures,
  verdict: failures.length ? "FAIL" : "PASS",
  results,
};

const outPath = path.join(root, cfg.reportPath || "artifacts/seo/indexability-release-gate.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

if (failures.length) {
  for (const failure of failures) console.error("FAIL", JSON.stringify(failure));
  console.error("ASTRA_INDEXABILITY_RELEASE_GATE_FAIL failures=" + failures.length);
  process.exit(1);
}

console.log(
  "ASTRA_INDEXABILITY_RELEASE_GATE_PASS routes=" + results.length +
  " generated=" + generatedPaths.length +
  " mode=runtime-generator",
);
