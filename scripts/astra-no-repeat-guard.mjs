import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "config/astra-no-repeat-guard.json");

function fail(message) {
  console.error(`ASTRA NO-REPEAT GUARD FAIL: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(manifestPath)) {
  fail("missing config/astra-no-repeat-guard.json");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const requirements = Array.isArray(manifest.requirements) ? manifest.requirements : [];

  if (!requirements.length) fail("requirement ledger is empty");

  for (const req of requirements) {
    if (!req?.id || !req?.description) {
      fail("every requirement needs id + description");
      continue;
    }
    if (!Array.isArray(req.checks) || req.checks.length === 0) {
      fail(`${req.id} is UNGUARDED: no machine check declared`);
      continue;
    }

    for (const check of req.checks) {
      if (check.type === "fileContains") {
        const target = path.join(root, check.file);
        if (!fs.existsSync(target)) {
          fail(`${req.id}: missing ${check.file}`);
          continue;
        }
        const text = fs.readFileSync(target, "utf8");
        for (const needle of check.needles ?? []) {
          if (!text.includes(needle)) fail(`${req.id}: ${check.file} lost required marker: ${needle}`);
        }
      } else if (check.type === "fileExists") {
        if (!fs.existsSync(path.join(root, check.file))) fail(`${req.id}: missing ${check.file}`);
      } else if (check.type === "packageScriptContains") {
        const value = pkg.scripts?.[check.script] ?? "";
        for (const needle of check.needles ?? []) {
          if (!value.includes(needle)) fail(`${req.id}: package script ${check.script} lost guard: ${needle}`);
        }
      } else {
        fail(`${req.id}: unknown check type ${check.type}`);
      }
    }
  }

  const prebuild = pkg.scripts?.prebuild ?? "";
  if (!prebuild.includes("astra-no-repeat-guard.mjs")) {
    fail("guard itself is not wired into prebuild");
  }

  if (!process.exitCode) {
    console.log(`ASTRA NO-REPEAT GUARD PASS: ${requirements.length} persistent requirements are machine-guarded.`);
  }
}
