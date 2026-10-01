import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const engine = path.resolve("scripts/astra-seo-self-heal.mjs");

const registryTemplate = `export type AstraSelfHealSitemapRoute = {
  path: string;
  title: string;
  group: string;
  changefreq: string;
  priority: string;
};

export const ASTRA_SELF_HEAL_SITEMAP_ROUTES: AstraSelfHealSitemapRoute[] = [];
`;

function fixture({ route, title = "Contact | BetGPT" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "astra-seo-self-heal-"));
  for (const dir of ["config", "artifacts/seo", "src/lib/seo", "src/lib"]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }

  fs.writeFileSync(
    path.join(root, "config/astra-seo-self-heal.json"),
    JSON.stringify({
      zeroWeakReport: "artifacts/seo/zero-weak-pages.json",
      indexabilityReport: "artifacts/seo/indexability-release-gate.json",
      sitemapSource: "src/lib/sitemap-urls.ts",
      registrySource: "src/lib/seo/astra-self-heal-sitemap.ts",
      reportPath: "artifacts/seo/self-heal.json"
    }, null, 2),
  );

  fs.writeFileSync(
    path.join(root, "artifacts/seo/zero-weak-pages.json"),
    JSON.stringify({
      failures: [],
      results: [{
        file: "src/routes/contact.tsx",
        routePath: route,
        indexable: true,
        literals: { title }
      }]
    }, null, 2),
  );

  fs.writeFileSync(
    path.join(root, "artifacts/seo/indexability-release-gate.json"),
    JSON.stringify({
      failures: [{
        reason: "indexable-route-not-covered-by-runtime-sitemap",
        route,
        rawRoute: route,
        file: "src/routes/contact.tsx"
      }]
    }, null, 2),
  );

  fs.writeFileSync(path.join(root, "src/lib/sitemap-urls.ts"), 'const out = [{ path: "/" }];\n');
  fs.writeFileSync(path.join(root, "src/lib/seo/astra-self-heal-sitemap.ts"), registryTemplate);
  return root;
}

test("repairs a proven missing static sitemap route", () => {
  const root = fixture({ route: "/contact" });
  try {
    const run = spawnSync(process.execPath, [engine, "--apply"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const registry = fs.readFileSync(path.join(root, "src/lib/seo/astra-self-heal-sitemap.ts"), "utf8");
    assert.match(registry, /"path": "\/contact"/);
    assert.match(registry, /"title": "Contact \| BetGPT"/);
    const report = JSON.parse(fs.readFileSync(path.join(root, "artifacts/seo/self-heal.json"), "utf8"));
    assert.equal(report.verdict, "PASS");
    assert.equal(report.actions[0]?.type, "add-indexable-static-route-to-sitemap");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed for a dynamic route that needs generator knowledge", () => {
  const root = fixture({ route: "/match/:matchId", title: "Match | BetGPT" });
  try {
    const run = spawnSync(process.execPath, [engine, "--apply"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 78, run.stderr || run.stdout);
    const registry = fs.readFileSync(path.join(root, "src/lib/seo/astra-self-heal-sitemap.ts"), "utf8");
    assert.doesNotMatch(registry, /matchId/);
    const report = JSON.parse(fs.readFileSync(path.join(root, "artifacts/seo/self-heal.json"), "utf8"));
    assert.equal(report.verdict, "BLOCKED");
    assert.equal(report.blocked[0]?.reason, "dynamic-route-needs-explicit-human-approved-generator");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
