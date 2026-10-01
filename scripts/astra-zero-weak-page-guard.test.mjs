import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const guardScript = path.resolve("scripts/astra-zero-weak-page-guard.mjs");

async function runFixture(routes, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-zero-weak-"));
  await mkdir(path.join(root, "src/routes"), { recursive: true });
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "src/lib"), { recursive: true });

  for (const [name, source] of Object.entries(routes)) {
    await writeFile(path.join(root, "src/routes", name), source, "utf8");
  }

  const config = {
    version: "TEST",
    routeDirs: ["src/routes"],
    extensions: [".tsx"],
    ignoreFiles: [],
    technicalPatterns: [],
    headDelegatePatterns: [],
    contentDelegatePatterns: [],
    minVisibleTextBytes: 80,
    minInternalLinks: 1,
    minScore: 60,
    sitemapSource: "src/lib/sitemap-urls.ts",
    reportPath: "artifacts/zero-weak.json",
    enforceUniqueMetadata: true,
    roleMinimums: { legal: 50, trust: 60, commercial: 60, editorial: 60, entity: 60, landing: 60, layout: 0 },
    ...overrides,
  };
  await writeFile(path.join(root, "config/astra-zero-weak-page-guard.json"), JSON.stringify(config), "utf8");
  await writeFile(path.join(root, "src/lib/sitemap-urls.ts"), "", "utf8");

  const run = spawnSync(process.execPath, [guardScript, "--strict"], {
    cwd: root,
    encoding: "utf8",
  });
  const report = JSON.parse(await readFile(path.join(root, "artifacts/zero-weak.json"), "utf8"));
  return { run, report };
}

const strong = (route, title, canonical) => `
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("${route}/")({
  head: () => ({
    meta: [
      { title: "${title}" },
      { name: "description", content: "Description substantielle et spécifique pour cette page de test avec assez de contexte utile." }
    ],
    links: [{ rel: "canonical", href: "${canonical}" }],
  }),
  component: () => (
    <article>
      <h1>Titre principal unique</h1>
      <p>Contenu éditorial substantiel, spécifique et suffisamment long pour représenter une vraie valeur utilisateur.</p>
      <a href="/next">Lien interne contextuel</a>
    </article>
  ),
});
`;

test("strong indexable page passes", async () => {
  const { run, report } = await runFixture({ "strong.tsx": strong("/strong", "Strong page", "https://example.test/strong") });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(report.summary.verdict, "PASS");
});

test("Outlet-only parent is classified as layout, not a weak public page", async () => {
  const source = `
import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/actualites")({ component: () => <Outlet /> });
`;
  const { run, report } = await runFixture({ "actualites.tsx": source });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(report.results[0].role, "layout");
  assert.equal(report.results[0].indexable, false);
});

test("large source code no longer counts as substantive content", async () => {
  const noise = "const n = 1;\n".repeat(500);
  const source = `
import { createFileRoute } from "@tanstack/react-router";
${noise}
export const Route = createFileRoute("/thin/")({
  head: () => ({
    meta: [
      { title: "Thin page" },
      { name: "description", content: "Description longue mais corps public volontairement insuffisant pour vérifier le garde." }
    ],
    links: [{ rel: "canonical", href: "https://example.test/thin" }],
  }),
  component: () => <article><h1>Thin</h1><a href="/next">Next</a></article>,
});
`;
  const { run, report } = await runFixture({ "thin.tsx": source }, { minVisibleTextBytes: 1000 });
  assert.notEqual(run.status, 0);
  assert.match(report.failures[0].failures.join(" "), /main-content/);
});

test("multiple H1 blocks promotion", async () => {
  const source = strong("/two-h1", "Two H1", "https://example.test/two-h1").replace(
    "<h1>Titre principal unique</h1>",
    "<h1>Premier H1</h1><h1>Second H1</h1>",
  );
  const { run, report } = await runFixture({ "two-h1.tsx": source });
  assert.notEqual(run.status, 0);
  assert.match(report.failures[0].failures.join(" "), /multiple-h1/);
});

test("duplicate literal metadata across routes blocks promotion", async () => {
  const a = strong("/a", "Même titre SEO", "https://example.test/shared");
  const b = strong("/b", "Même titre SEO", "https://example.test/shared");
  const { run, report } = await runFixture({ "a.tsx": a, "b.tsx": b });
  assert.notEqual(run.status, 0);
  const reasons = report.failures.flatMap((x) => x.failures).join(" ");
  assert.match(reasons, /duplicate-title/);
  assert.match(reasons, /duplicate-canonical/);
});
