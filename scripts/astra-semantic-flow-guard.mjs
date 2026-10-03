#!/usr/bin/env node
/**
 * ASTRA SEMANTIC FLOW GUARD Ω
 *
 * Reusable fail-closed SEO graph guard.
 * - Detects strong cannibalisation candidates.
 * - Finds orphan pages.
 * - Flags semantic jumps and generic anchors.
 * - Recommends parent->child relationships.
 * - Writes a machine-readable report for downstream ASTRA bricks.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  analyzeSemanticFlow,
  extractCatalogLinks,
  extractInternalLinks,
  extractPageSignals,
} from "../src/lib/seo/astra-semantic-flow.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const configPath = process.env.ASTRA_SEMANTIC_FLOW_CONFIG || "config/astra-semantic-flow.json";

const cfg = JSON.parse(await fs.readFile(path.join(root, configPath), "utf8"));

const norm = (value) => value.split(path.sep).join("/");

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

function fallbackRoute(file) {
  const rel = norm(file);
  const routeRoot = (cfg.routeDirs || ["src/routes"])
    .map((dir) => norm(dir).replace(/\/$/, "") + "/")
    .find((prefix) => rel.includes(prefix));
  let routeFile = routeRoot ? rel.slice(rel.indexOf(routeRoot) + routeRoot.length) : path.basename(rel);
  routeFile = routeFile.replace(/\.(tsx|ts|jsx|js|mjs)$/i, "");
  if (routeFile === "__root" || routeFile === "index") return "/";
  routeFile = routeFile
    .replace(/\/index$/i, "")
    .replace(/\._/g, "/")
    .replace(/\./g, "/")
    .replace(/\$([A-Za-z0-9_]+)/g, ":$1");
  return "/" + routeFile.replace(/^\/+/, "");
}

const routeFiles = [];
for (const dir of cfg.routeDirs || ["src/routes"]) {
  routeFiles.push(...await walk(path.join(root, dir)));
}

const extensions = cfg.extensions || [".tsx", ".ts", ".jsx", ".js"];
const ignored = new Set((cfg.ignoreFiles || []).map(norm));
const pages = [];
const routeByFile = new Map();

for (const file of routeFiles) {
  const rel = norm(path.relative(root, file));
  if (ignored.has(rel) || !extensions.some((ext) => rel.endsWith(ext))) continue;
  const source = await fs.readFile(file, "utf8");
  if (!/create(?:File|Root)Route/i.test(source)) continue;
  const signals = extractPageSignals(source, fallbackRoute(rel));
  pages.push({ ...signals, file: rel });
  routeByFile.set(rel, signals.route);
}

const corpusFiles = [];
for (const dir of cfg.corpusDirs || ["src"]) {
  corpusFiles.push(...await walk(path.join(root, dir)));
}

const links = [];
for (const file of corpusFiles) {
  const rel = norm(path.relative(root, file));
  if (!extensions.some((ext) => rel.endsWith(ext)) && !rel.endsWith(".mjs")) continue;
  const source = await fs.readFile(file, "utf8");
  const sourceRoute = routeByFile.get(rel) || `@${rel}`;
  links.push(...extractInternalLinks(source, sourceRoute));
}


for (const catalog of cfg.linkCatalogs || []) {
  const file = path.join(root, catalog.file);
  let source = "";
  try {
    source = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  links.push(
    ...extractCatalogLinks(
      source,
      `@catalog:${norm(catalog.file)}`,
      catalog.properties || []
    )
  );
}

const report = analyzeSemanticFlow(pages, links, cfg);
report.meta = {
  version: cfg.version || "ASTRA-SEMANTIC-FLOW-1",
  generatedAt: new Date().toISOString(),
  strict,
  configPath,
  routesScanned: pages.length,
  sourceLinksScanned: links.length,
};

const reportPath = path.join(root, cfg.reportPath || "artifacts/seo/semantic-flow.json");
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

for (const finding of report.findings) {
  console.log(`${finding.status}\t${finding.code}\t${finding.routes.join(" -> ")}\t${finding.message}`);
}
for (const recommendation of report.recommendations.slice(0, Number(cfg.maxPrintedRecommendations || 25))) {
  console.log(
    `RECOMMEND\t${recommendation.parent} -> ${recommendation.child}\tsemantic=${recommendation.similarity}\tintent=${recommendation.intentSimilarity}`
  );
}

console.log(
  `ASTRA_SEMANTIC_FLOW_${report.summary.verdict} pages=${report.summary.pages} links=${report.summary.links} failures=${report.summary.failures} partials=${report.summary.partials}`
);

if (strict && report.summary.failures > 0) process.exit(1);
