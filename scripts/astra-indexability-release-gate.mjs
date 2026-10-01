#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config/astra-indexability-release-gate.json"), "utf8"));
const reportPath = path.join(root, cfg.zeroWeakReport || "artifacts/seo/zero-weak-pages.json");

function norm(p) {
  if (!p) return "/";
  let x = String(p).split("?")[0].split("#")[0];
  if (!x.startsWith("/")) x = "/" + x;
  if (x.length > 1) x = x.replace(/\\/+$/, "");
  return x;
}

function dynamicCovered(route) {
  return (cfg.dynamicCoverage || []).some((rule) => {
    const prefix = norm(rule.routePrefix || "/");
    if (!(route === prefix || route.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"))) return false;
    const src = fs.readFileSync(path.join(root, rule.sitemapSource), "utf8");
    return (rule.requiredFragments || []).every((frag) => src.includes(frag));
  });
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

for (const item of routes) {
  const route = norm(item.routePath);
  if ((cfg.ignoreRoutes || []).includes(route)) continue;

  const literal =
    sitemapSource.includes('path: "' + route + '"') ||
    sitemapSource.includes("path: '" + route + "'") ||
    sitemapSource.includes('"' + route + '"') ||
    sitemapSource.includes("'" + route + "'");
  const dynamic = dynamicCovered(route);
  const ok = literal || dynamic;

  results.push({ route, file: item.file, literal, dynamic, status: ok ? "PASS" : "FAIL" });
  if (!ok) failures.push({ route, file: item.file, reason: "indexable-route-not-covered-by-sitemap" });
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
  schema: "astra-indexability-release-gate/v1",
  generatedAt: new Date().toISOString(),
  indexableRoutes: routes.length,
  checked: results.length,
  failures,
  verdict: failures.length ? "FAIL" : "PASS",
  results
};

const out = path.join(root, cfg.reportPath || "artifacts/seo/indexability-release-gate.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\\n", "utf8");

if (failures.length) {
  for (const failure of failures) console.error("FAIL", JSON.stringify(failure));
  console.error("ASTRA_INDEXABILITY_RELEASE_GATE_FAIL failures=" + failures.length);
  process.exit(1);
}

console.log("ASTRA_INDEXABILITY_RELEASE_GATE_PASS routes=" + results.length);
