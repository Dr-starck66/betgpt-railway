#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apply = process.argv.includes("--apply");
const cfgPath = path.join(root, "config/astra-seo-self-heal.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

function readJson(rel, fallback = null) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function norm(route) {
  if (!route) return "/";
  let value = String(route).split("?")[0].split("#")[0];
  if (!value.startsWith("/")) value = "/" + value;
  if (value.length > 1) value = value.replace(/\/+$/, "");
  return value;
}

function safeStaticRoute(route) {
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*$/.test(route) &&
    !route.includes(":") &&
    !route.includes("$") &&
    !route.includes("[") &&
    !route.includes("]");
}

function titleFor(route, zeroReport, file) {
  const rows = Array.isArray(zeroReport?.results) ? zeroReport.results : [];
  const row = rows.find((item) => item.file === file || norm(item.routePath) === route);
  const title = String(row?.literals?.title || "").trim();
  if (title.length >= 3) return title;
  return "";
}

function parseRegistry(source) {
  const match = source.match(/ASTRA_SELF_HEAL_SITEMAP_ROUTES[^=]*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error("ASTRA_SEO_SELF_HEAL_BLOCKED registry format not recognized");
  const arrayText = match[1]
    .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'/g, '"');
  try {
    return JSON.parse(arrayText);
  } catch {
    if (/^\[\s*\]$/.test(match[1])) return [];
    throw new Error("ASTRA_SEO_SELF_HEAL_BLOCKED registry is not machine-editable");
  }
}

function renderRegistry(entries) {
  return 'export type AstraSelfHealSitemapRoute = {\n' +
    '  path: string;\n' +
    '  title: string;\n' +
    '  group: string;\n' +
    '  changefreq: string;\n' +
    '  priority: string;\n' +
    '};\n\n' +
    '/**\n' +
    ' * Deterministic SEO repairs only.\n' +
    ' * This file is rewritten by ASTRA SEO SELF-HEAL Ω after a proven gate failure.\n' +
    ' * Never add a route here unless the route is already classified indexable.\n' +
    ' */\n' +
    'export const ASTRA_SELF_HEAL_SITEMAP_ROUTES: AstraSelfHealSitemapRoute[] = ' +
    JSON.stringify(entries, null, 2) + ';\n';
}

const zero = readJson(cfg.zeroWeakReport);
const indexability = readJson(cfg.indexabilityReport);
const actions = [];
const blocked = [];

if (zero?.failures?.length) {
  for (const failure of zero.failures) {
    blocked.push({
      source: "zero-weak",
      file: failure.file || null,
      route: failure.routePath || null,
      reason: "ambiguous-page-quality-or-index-intent",
      details: failure.failures || []
    });
  }
}

if (indexability?.failures?.length) {
  for (const failure of indexability.failures) {
    if (failure.reason === "duplicate-literal-sitemap-path" && Array.isArray(failure.values)) {
      const sitemapPath = path.join(root, cfg.sitemapSource);
      let source = fs.readFileSync(sitemapPath, "utf8");
      let changed = false;

      for (const duplicate of failure.values.map(norm)) {
        let seen = 0;
        const lines = source.split("\n");
        const next = [];
        let unsafe = false;

        for (const line of lines) {
          const match = line.match(/\bpath:\s*["']([^"']+)["']/);
          if (!match || norm(match[1]) !== duplicate) {
            next.push(line);
            continue;
          }

          seen += 1;
          if (seen === 1) {
            next.push(line);
            continue;
          }

          const trimmed = line.trim();
          if (!(trimmed.startsWith("{") && trimmed.endsWith("},"))) {
            unsafe = true;
            next.push(line);
            continue;
          }

          changed = true;
          actions.push({ type: "remove-duplicate-sitemap-literal", route: duplicate });
        }

        if (unsafe) {
          blocked.push({ source: "indexability", route: duplicate, reason: "duplicate-is-not-single-line-safe-edit" });
        } else if (changed) {
          source = next.join("\n");
        }
      }

      if (apply && changed) fs.writeFileSync(sitemapPath, source, "utf8");
      continue;
    }

    if (failure.reason === "indexable-route-not-covered-by-runtime-sitemap") {
      const route = norm(failure.route || failure.rawRoute);
      if (!safeStaticRoute(route)) {
        blocked.push({ source: "indexability", route, reason: "dynamic-route-needs-explicit-human-approved-generator" });
        continue;
      }

      const title = titleFor(route, zero, failure.file);
      if (!title) {
        blocked.push({ source: "indexability", route, reason: "missing-specific-title-for-safe-sitemap-entry" });
        continue;
      }

      const registryPath = path.join(root, cfg.registrySource);
      const registrySource = fs.readFileSync(registryPath, "utf8");
      const entries = parseRegistry(registrySource);
      if (!entries.some((entry) => norm(entry.path) === route)) {
        entries.push({
          path: route,
          title,
          group: "Auto-réparé",
          changefreq: "weekly",
          priority: "0.5"
        });
        entries.sort((a, b) => a.path.localeCompare(b.path));
        actions.push({ type: "add-indexable-static-route-to-sitemap", route, title });
        if (apply) write(cfg.registrySource, renderRegistry(entries));
      }
      continue;
    }

    blocked.push({ source: "indexability", route: failure.route || null, reason: "unsupported-failure-class", failure });
  }
}

const report = {
  schema: "astra-seo-self-heal/v1",
  generatedAt: new Date().toISOString(),
  mode: apply ? "apply" : "diagnose",
  actions,
  blocked,
  verdict: blocked.length ? (actions.length ? "PARTIAL" : "BLOCKED") : "PASS"
};

write(cfg.reportPath, JSON.stringify(report, null, 2) + "\n");
console.log("ASTRA_SEO_SELF_HEAL_RESULT", JSON.stringify({
  mode: report.mode,
  actions: actions.length,
  blocked: blocked.length,
  verdict: report.verdict
}));

if (blocked.length && actions.length === 0) process.exit(78);
