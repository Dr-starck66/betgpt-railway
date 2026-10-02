#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  ["registry", "src/lib/broadcaster-links.ts", ["BROADCASTERS", "officialUrl", "affiliateUrl", "extractBroadcasters", "tokenizeBroadcasterText"]],
  ["link-component", "src/components/broadcaster-text.tsx", ["target=\"_blank\"", "data-affiliate-ready=\"true\"", "sponsored nofollow noopener noreferrer"]],
  ["news-global", "src/components/news-article.tsx", ["BroadcasterText", "BroadcastLinks", "articleBroadcastTexts"]],
  ["match-global", "src/components/match-article.tsx", ["BroadcasterText", "BroadcastLinks"]],\n  ["match-tv-registry", "src/lib/match-broadcasts.ts", ["borussia-dortmund-werder-bremen-2026-10-09", "beIN SPORTS MAX 10", "sourceUrl"]],\n  ["match-tv-surface", "src/components/match-detail.tsx", ["matchBroadcast(match)", "<BroadcastLinks texts={[broadcast.label]} />", "Diffusion France vérifiée"]],
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

const registry = read("src/lib/broadcaster-links.ts");
for (const required of ["beIN SPORTS", "DAZN", "CANAL+", "TF1", "M6", "L'Équipe", "Awin", "Amazon Partenaires"]) {
  if (!registry.includes(required)) failures.push({ id: "coverage", reason: "missing-broadcaster", required });
}

if (failures.length) {
  for (const failure of failures) console.error("ASTRA_BROADCAST_AFFILIATE_FAIL", JSON.stringify(failure));
  process.exit(1);
}

console.log("ASTRA_BROADCAST_AFFILIATE_PASS global_linkification=on affiliate_ready=on");
