#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = process.env.ASTRA_ZERO_COST_CONFIG || "config/astra-zero-cost.json";
const scriptPath = "scripts/astra-zero-cost-guard.mjs";

function fail(message) {
  console.error(`ASTRA_ZERO_COST_GUARD_FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(configPath)) fail(`missing config ${configPath}`);
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));

if (cfg.mode !== "ZERO_EXTRA_SPEND_UNTIL_EXPLICIT_OVERRIDE") {
  fail("mode must be ZERO_EXTRA_SPEND_UNTIL_EXPLICIT_OVERRIDE");
}
if (Number(cfg.defaultBudgetEur) !== 0) fail("defaultBudgetEur must be 0");
if (cfg.principles?.allowNewPaidSubscriptionByDefault !== false) {
  fail("new paid subscriptions must be disabled by default");
}
if (cfg.principles?.allowCreditTopUpByDefault !== false) {
  fail("credit top-ups must be disabled by default");
}
if (cfg.principles?.allowPayPerCallCriticalDependencyByDefault !== false) {
  fail("pay-per-call critical dependencies must be disabled by default");
}
if (cfg.failurePolicy !== "NEVER_REQUIRE_PAYMENT_WITHOUT_EXPLICIT_USER_OVERRIDE") {
  fail("failurePolicy must prevent payment without explicit user override");
}

const strategic = cfg.strategicPaidExceptionPolicy || {};
if (
  strategic.mode !== "ONLY_IF_MASSIVE_UNLOCK" ||
  strategic.requireExplicitUserApproval !== true ||
  strategic.requireFreePathsExhausted !== true ||
  strategic.requireMeasuredBenefit !== true ||
  strategic.requireMaxBudgetEur !== true ||
  strategic.autoPurchase !== false ||
  strategic.autoTopUp !== false
) {
  fail("strategic paid exceptions must be explicit, bounded, measured, and never automatic");
}

const overrides = new Map();
for (const entry of cfg.explicitPaidOverrides || []) {
  if (!entry || typeof entry !== "object") fail("invalid explicitPaidOverrides entry");
  const provider = String(entry.provider || "").trim().toLowerCase();
  const maxBudgetEur = Number(entry.maxBudgetEur);
  const authorizedBy = String(entry.authorizedBy || "").trim();
  const reason = String(entry.reason || "").trim();
  if (!provider || !Number.isFinite(maxBudgetEur) || maxBudgetEur <= 0 || !authorizedBy || !reason) {
    fail("paid override requires provider, positive maxBudgetEur, authorizedBy, and reason");
  }
  overrides.set(provider, entry);
}

function providerAllowed(provider) {
  return overrides.has(String(provider || "").toLowerCase());
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const installed = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
  ...(pkg.optionalDependencies || {})
};

for (const name of cfg.forbiddenPackagesWithoutOverride || []) {
  if (Object.prototype.hasOwnProperty.call(installed, name) && !providerAllowed(name)) {
    fail(`paid/credit-metered package present without explicit override: ${name}`);
  }
}

const envFiles = [".env", ".env.local", ".env.production", ".env.production.local"]
  .filter((p) => fs.existsSync(path.join(root, p)));

for (const envFile of envFiles) {
  const text = fs.readFileSync(path.join(root, envFile), "utf8");
  for (const prefix of cfg.forbiddenEnvPrefixesWithoutOverride || []) {
    if (new RegExp(`^\\s*${prefix}`, "m").test(text)) {
      const provider = prefix.replace(/_+$/, "").toLowerCase();
      if (!providerAllowed(provider)) {
        fail(`paid/credit-metered env credential found without explicit override: ${prefix} in ${envFile}`);
      }
    }
  }
}

const scanRoots = ["src", "server", "scripts", "config", ".github"].filter((p) =>
  fs.existsSync(path.join(root, p)),
);
const textExt = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".md"]);

function walk(rel) {
  const abs = path.join(root, rel);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return textExt.has(path.extname(abs)) ? [abs] : [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".git", "dist", ".output"].includes(entry.name)) return [];
    return walk(path.join(rel, entry.name));
  });
}

const files = scanRoots.flatMap(walk);
for (const file of files) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (rel === configPath || rel === scriptPath) continue;
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  for (const marker of cfg.forbiddenSourceMarkersWithoutOverride || []) {
    if (text.includes(String(marker).toLowerCase())) {
      fail(`payment/credit prompt marker found in ${rel}: ${marker}`);
    }
  }
}

console.log(
  `ASTRA ZERO COST GUARD PASS: default extra spend €0; paid services require explicit scoped override; overrides=${overrides.size}`,
);
