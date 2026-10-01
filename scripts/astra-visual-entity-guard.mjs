#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath =
  process.env.ASTRA_VISUAL_ENTITY_GUARD_CONFIG ||
  "config/astra-visual-entity-guard.json";

function fail(message) {
  console.error(`ASTRA_VISUAL_ENTITY_GUARD_FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) fail(`missing config ${configPath}`);
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));

if (!Array.isArray(cfg.sourceRoots) || !cfg.sourceRoots.length) {
  fail("sourceRoots[] is required");
}
if (!Array.isArray(cfg.ownershipContracts)) {
  fail("ownershipContracts[] is required");
}

const renderExtensions = new Set(
  cfg.renderExtensions || [".tsx", ".jsx", ".vue", ".svelte", ".html"],
);
const excluded = new Set((cfg.exclude || []).map((x) => String(x).replaceAll("\\", "/")));
const regionalPair = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

function walk(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [abs];

  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(abs, entry.name);
    const childRel = path.relative(root, child).replaceAll("\\", "/");
    if (excluded.has(childRel)) return [];
    if (entry.isDirectory()) return walk(childRel);
    return renderExtensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

const renderFiles = [...new Set(cfg.sourceRoots.flatMap(walk))];

if (cfg.forbidDirectRegionalFlagEmoji !== false) {
  for (const file of renderFiles) {
    const text = fs.readFileSync(file, "utf8");
    if (regionalPair.test(text)) {
      fail(
        `direct regional flag emoji found in ${path.relative(root, file)}; use the designated visual-owner component`,
      );
    }
    regionalPair.lastIndex = 0;
  }
}

for (const rule of cfg.remoteAssetOwnership || []) {
  const needle = String(rule.needle || "");
  const owner = String(rule.owner || "").replaceAll("\\", "/");
  if (!needle || !owner) fail("remoteAssetOwnership entries require needle + owner");

  for (const file of renderFiles) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (rel === owner) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(needle)) {
      fail(`remote visual asset "${needle}" is owned by ${owner} but appears in ${rel}`);
    }
  }
}

for (const contract of cfg.ownershipContracts) {
  const rel = String(contract.file || "").replaceAll("\\", "/");
  const abs = path.join(root, rel);
  if (!rel || !fs.existsSync(abs)) fail(`ownership contract file missing: ${rel || "(empty)"}`);

  const text = fs.readFileSync(abs, "utf8");
  const id = contract.id || rel;

  for (const needle of contract.mustContain || []) {
    if (!text.includes(needle)) fail(`${id}: missing required marker "${needle}"`);
  }
  for (const needle of contract.mustNotContain || []) {
    if (text.includes(needle)) fail(`${id}: forbidden duplicate/foreign visual marker "${needle}"`);
  }
}

console.log(
  "ASTRA VISUAL ENTITY GUARD PASS: unique visual ownership, fallback-family integrity and anti-duplication contracts validated.",
);
