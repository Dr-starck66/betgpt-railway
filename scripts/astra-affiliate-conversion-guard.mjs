#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  ["chat-tracked-link", "src/lib/chat/daily-pick.ts", ["trackedPublicUrl", "hasAffiliateTag"]],
  ["affiliate-tag-decoration", "src/engine/aff-tag.ts", ["AFF_", "utm_source", "utm_medium"]],
  ["conversion-readiness", "src/engine/affiliate-conversion.ts", ["TRACKING_READY", "MONETIZED", "AffiliateActivationSource"]],
  ["redirect-proof", "src/lib/go.server.ts", ["x-betgpt-affiliate-mode", "recordAnalytics", "decorateAffiliateUrl", "logClick"]],
  ["health-endpoint", "server/api/affiliate-health.get.ts", ["affiliateConversionSnapshot", "no-store"]],
];

const failures = [];
for (const [id, file, fragments] of checks) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push({ id, file, reason: "missing-file" });
    continue;
  }
  const source = read(file);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) failures.push({ id, file, reason: "missing-fragment", fragment });
  }
}

const keys = ["UNIBET", "BETCLIC", "WINAMAX", "NETBET", "BET365", "BWIN", "PMU", "VBET", "ZEBET", "PARIONSSPORT"];
const configured = keys.filter((key) => Boolean(process.env[`AFF_${key}`]?.trim()));
const requireMonetized = process.env.AFFILIATE_REQUIRE_MONETIZED === "1";

if (requireMonetized && configured.length === 0) {
  failures.push({
    id: "runtime-monetization-required",
    reason: "AFFILIATE_REQUIRE_MONETIZED=1 but no AFF_* bookmaker tag is configured",
  });
}

const report = {
  schema: "astra-affiliate-conversion-guard/v1",
  generatedAt: new Date().toISOString(),
  requireMonetized,
  configuredAffiliateVars: configured,
  mode: configured.length ? "MONETIZED" : "TRACKING_READY",
  failures,
  verdict: failures.length ? "FAIL" : "PASS",
};

const out = path.join(root, "artifacts/release/affiliate-conversion-guard.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");

if (failures.length) {
  for (const failure of failures) console.error("AFFILIATE_GUARD_FAIL", JSON.stringify(failure));
  process.exit(1);
}

console.log(
  `ASTRA_AFFILIATE_CONVERSION_PASS mode=${report.mode} configured=${configured.length} requireMonetized=${requireMonetized}`,
);
