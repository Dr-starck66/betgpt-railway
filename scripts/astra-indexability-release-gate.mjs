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

function publicRoutePattern(route) {
  return norm(route)
    .split("/")
    .map((seg) => (seg.endsWith("_") ? seg.slice(0, -1) : seg))
    .join("/");
}

function routeRegex(routePattern) {
  const escaped = publicRoutePattern(routePattern)
    .split("/")
    .map((seg) => {
      if (!seg) return "";
      if (seg.startsWith(":") || seg.startsWith("$")) return "[^/]+";
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\function norm(p) {
  if (!p) return "/";
  let x = String(p).split("?")[0].split("#")[0];
  if (!x.startsWith("/")) x = "/" + x;
  if (x.length > 1) x = x.replace(/\/+$/, "");
  return x;
}");
    })
    .join("/");
  return new RegExp("^" + escaped + "$");
}

function syntheticMatches() {
  const leagues = ["PL", "LL", "BL", "SA", "L1", "ER", "PT", "SC", "TR", "CL", "EL", "NL"];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return leagues.flatMap((league, i) => {
    const home = { name: `Gate Home ${league}`, id: `gate-home-${league}` };
    const away = { name: `Gate Away ${league}`, id: `gate-away-${league}` };
    return [
      {
        id: `gate-upcoming-${league}`,
        slug: `gate-upcoming-${league.toLowerCase()}`,
        league,
        status: "scheduled",
        kickoff: new Date(now + (i + 1) * 60_000).toISOString(),
        home,
        away,
      },
      {
        id: `gate-finished-${league}`,
        slug: `gate-finished-${league.toLowerCase()}`,
        league,
        status: "finished",
        kickoff: new Date(now - day - (i + 1) * 60_000).toISOString(),
        home: { name: `Gate Past Home ${league}`, id: `gate-past-home-${league}` },
        away: { name: `Gate Past Away ${league}`, id: `gate-past-away-${league}` },
        scoreHome: 1,
        scoreAway: 0,
      },
    ];
  });
}

function dynamicCovered(route) {
  return (cfg.dynamicCoverage || []).some((rule) => {
    let applies = false;
    if (rule.routePattern) {
      applies = new RegExp(rule.routePattern).test(route);
    } else {
      const prefix = norm(rule.routePrefix || "/");
      applies = route === prefix || route.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");
    }
    if (!applies) return false;
    const src = fs.readFileSync(path.join(root, rule.sitemapSource), "utf8");
    return (rule.requiredFragments || []).every((frag) => src.includes(frag));
  });
}

function aliasedRoute(route) {
  return norm((cfg.routeAliases || {})[route] || route);
}

if (!fs.existsSync(reportPath)) {
  console.error("ASTRA_INDEXABILITY_RELEASE_GATE_FAIL zero-weak report missing");
  process.exit(1);
}

const zero = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const sitemapSource = fs.readFileSync(path.join(root, cfg.sitemapSource), "utf8");
const routes = (zero.results || []).filter((r) => r.indexable);
const failures = [];
const results = [];

const generated = buildSitemapUrls({
  matches: syntheticMatches(),
  asOf: new Date().toISOString(),
  standingsAsOf: new Date().toISOString(),
});
const generatedPaths = [...new Set(generated.map((row) => norm(row.path)))];

for (const item of routes) {
  const rawRoute = norm(item.routePath);
  const route = publicRoutePattern(rawRoute);
  if ((cfg.ignoreRoutes || []).includes(route)) continue;

  const re = routeRegex(route);
  const runtimeMatches = generatedPaths.filter((p) => re.test(p));
  const runtime = runtimeMatches.length > 0;
  const dynamic = dynamicCovered(route);
  const ok = runtime || dynamic;

  results.push({
    route,
    rawRoute,
    file: item.file,
    runtime,
    runtimeMatches: runtimeMatches.slice(0, 5),
    dynamic,
    status: ok ? "PASS" : "FAIL",
  });
  if (!ok) failures.push({ route, rawRoute, file: item.file, reason: "indexable-route-not-covered-by-runtime-sitemap" });
}

const duplicateStaticPaths = [];
const staticMatches = [...sitemapSource.matchAll(/\\bpath:\\s*["']([^"']+)["']/g)].map((m) => m[1]);
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
  strategy: "runtime-sitemap-builder-plus-explicit-dynamic-coverage",
  generatedAt: new Date().toISOString(),
  indexableRoutes: routes.length,
  generatedPaths: generatedPaths.length,
  checked: results.length,
  failures,
  verdict: failures.length ? "FAIL" : "PASS",
  results
};

const out = path.join(root, cfg.reportPath || "artifacts/seo/indexability-release-gate.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");

if (failures.length) {
  for (const failure of failures) console.error("FAIL", JSON.stringify(failure));
  console.error("ASTRA_INDEXABILITY_RELEASE_GATE_FAIL failures=" + failures.length);
  process.exit(1);
}

console.log("ASTRA_INDEXABILITY_RELEASE_GATE_PASS routes=" + results.length + " generatedPaths=" + generatedPaths.length);
