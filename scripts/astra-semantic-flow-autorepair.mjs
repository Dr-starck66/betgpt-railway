#!/usr/bin/env node
/**
 * ASTRA SEMANTIC FLOW AUTO-REPAIR Ω
 * Applies only deterministic, high-confidence semantic-link repairs.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  analyzeSemanticFlow,
  extractAutoRepairLinks,
  extractCatalogLinks,
  extractInternalLinks,
  extractPageSignals,
} from "../src/lib/seo/astra-semantic-flow.mjs";
import {
  planSemanticRepairs,
  renderSemanticAutoLinks,
} from "../src/lib/seo/astra-semantic-autorepair.mjs";

const root = process.cwd();
const apply = process.argv.includes("--apply");
const strict = process.argv.includes("--strict");
const configPath = process.env.ASTRA_SEMANTIC_FLOW_CONFIG || "config/astra-semantic-flow.json";
const cfg = JSON.parse(await fs.readFile(path.join(root, configPath), "utf8"));
const registryRel = cfg.autoRepairRegistry || "src/lib/seo/semantic-auto-links.generated.ts";
const reportRel = cfg.autoRepairReportPath || "artifacts/seo/semantic-autorepair.json";
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

function parseRegistryRows(source = "") {
  const rows = [];
  for (const rawLine of String(source).split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line.startsWith('{"source":')) continue;
    try {
      const row = JSON.parse(line);
      if (row?.source && row?.href && row?.anchor) rows.push(row);
    } catch {
      // Registry syntax is verified independently.
    }
  }
  return rows;
}

async function collect() {
  const extensions = cfg.extensions || [".tsx", ".ts", ".jsx", ".js"];
  const ignored = new Set((cfg.ignoreFiles || []).map(norm));
  const pages = [];
  const routeByFile = new Map();

  for (const dir of cfg.routeDirs || ["src/routes"]) {
    for (const file of await walk(path.join(root, dir))) {
      const rel = norm(path.relative(root, file));
      if (ignored.has(rel) || !extensions.some((ext) => rel.endsWith(ext))) continue;
      const source = await fs.readFile(file, "utf8");
      if (!/create(?:File|Root)Route/i.test(source)) continue;
      const signals = extractPageSignals(source, fallbackRoute(rel));
      pages.push({ ...signals, file: rel });
      routeByFile.set(rel, signals.route);
    }
  }

  const links = [];
  for (const dir of cfg.corpusDirs || ["src"]) {
    for (const file of await walk(path.join(root, dir))) {
      const rel = norm(path.relative(root, file));
      if (!extensions.some((ext) => rel.endsWith(ext)) && !rel.endsWith(".mjs")) continue;
      if (rel === registryRel) continue;
      const source = await fs.readFile(file, "utf8");
      links.push(...extractInternalLinks(source, routeByFile.get(rel) || "@" + rel));
    }
  }

  for (const catalog of cfg.linkCatalogs || []) {
    try {
      const source = await fs.readFile(path.join(root, catalog.file), "utf8");
      links.push(...extractCatalogLinks(source, "@catalog:" + norm(catalog.file), catalog.properties || []));
    } catch {
      // A missing optional catalog cannot fabricate links.
    }
  }

  let registrySource = "";
  try {
    registrySource = await fs.readFile(path.join(root, registryRel), "utf8");
    links.push(...extractAutoRepairLinks(registrySource));
  } catch {
    registrySource = renderSemanticAutoLinks([]);
  }

  return { pages, links, registrySource };
}

const beforeData = await collect();
const before = analyzeSemanticFlow(beforeData.pages, beforeData.links, cfg);
const plan = planSemanticRepairs(before, beforeData.pages, cfg);

let registrySource = beforeData.registrySource;
let applied = 0;

if (apply && plan.actions.length) {
  const existing = parseRegistryRows(registrySource);
  const merged = new Map();

  for (const row of existing) {
    merged.set(row.source + "|" + row.href, row);
  }
  for (const action of plan.actions) {
    merged.set(action.source + "|" + action.target, {
      source: action.source,
      href: action.target,
      anchor: action.anchor,
      relation: action.relation || "contextual",
      reason: action.reason || "auto-repair",
    });
  }

  registrySource = renderSemanticAutoLinks([...merged.values()]);
  const registryPath = path.join(root, registryRel);
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, registrySource, "utf8");
  applied = plan.actions.length;
}

const afterData = await collect();
const after = analyzeSemanticFlow(afterData.pages, afterData.links, cfg);
const report = {
  meta: {
    version: "ASTRA-SEMANTIC-AUTOREPAIR-1",
    generatedAt: new Date().toISOString(),
    apply,
    strict,
    registry: registryRel,
  },
  before: before.summary,
  plan,
  applied,
  after: after.summary,
};

const reportPath = path.join(root, reportRel);
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

for (const action of plan.actions) {
  console.log(
    "APPLY\t" +
      action.source +
      " -> " +
      action.target +
      "\t" +
      action.anchor +
      "\t" +
      action.reason
  );
}
for (const item of plan.suggestions) {
  console.log("SUGGEST\t" + item.code + "\t" + (item.routes || []).join(" -> ") + "\t" + item.reason);
}
for (const item of plan.blocked) {
  console.log("BLOCK\t" + item.code + "\t" + (item.routes || []).join(" -> ") + "\t" + item.reason);
}

console.log(
  "ASTRA_SEMANTIC_AUTOREPAIR_" +
    (after.summary.failures || plan.blocked.length ? "FAIL" : "PASS") +
    " before=" +
    before.summary.verdict +
    " applied=" +
    applied +
    " after=" +
    after.summary.verdict +
    " blocked=" +
    plan.blocked.length
);

if (strict && (after.summary.failures > 0 || plan.blocked.length > 0)) process.exit(1);
