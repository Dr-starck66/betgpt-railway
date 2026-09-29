/**
 * Local SEO/GEO audit. --production also fetches https://betgpt.live.
 * A PASS here is a code or HTTP check, never a claim that an AI cited BetGPT.
 */
import { crawlerProof } from "../src/lib/geo/robots-audit.ts";
import { geoHealth } from "../src/lib/geo/health.ts";
import { GEO_PAGES } from "../src/lib/geo/entity.ts";
import { validateJsonLd, geoJsonLd } from "../src/lib/geo/schema.ts";
import { llmsTxt } from "../src/lib/geo/llms.ts";
import { ecosystemCarousel } from "../src/lib/serp/carousel.ts";

const production = process.argv.includes("--production");
const failures = [];

function row(feature, status, proof) {
  console.log(`${feature}\t${status}\t${proof}`);
  if (status === "FAIL") failures.push(feature);
}

const proofs = crawlerProof();
for (const proof of proofs) {
  row(
    `robots ${proof.agent}`,
    proof.importantOpen && proof.privateClosed ? "PASS" : "FAIL",
    `open ${proof.allowed.length} blocked ${proof.blocked.join(",")}`,
  );
}

for (const doc of GEO_PAGES) {
  const check = validateJsonLd(geoJsonLd(doc));
  row(`schema ${doc.path}`, check.ok ? "PASS" : "FAIL", check.errors.join(",") || "json-ld");
}

row("llms.txt", llmsTxt().includes("/methodology") && llmsTxt().includes("ne garantit") ? "PASS" : "FAIL", "local generator");

const carousel = ecosystemCarousel();
row(
  "ecosystem carousel decision",
  carousel.googleDecision === "UNKNOWN" ? "PASS" : "FAIL",
  `${carousel.readiness} / Google ${carousel.googleDecision}`,
);
row(
  "ecosystem not claimed accepted",
  carousel.googleDecision === "ACCEPTED" ? "FAIL" : "PASS",
  "aucune preuve d’acceptation Google",
);

for (const item of geoHealth()) {
  row(`health ${item.id}`, item.status === "FAIL" ? "FAIL" : item.status, item.detail);
}

if (production) {
  const origin = "https://betgpt.live";
  const targets = ["/robots.txt", "/llms.txt", "/about", "/methodology", "/sitemap.xml", "/changelog.json"];
  for (const path of targets) {
    try {
      const res = await fetch(origin + path, { redirect: "follow" });
      const body = await res.text();
      let ok = res.status === 200 && body.length > 40;
      let note = `HTTP ${res.status} ${body.length}o`;
      if (path === "/robots.txt") {
        ok = res.status === 200 && body.includes("OAI-SearchBot") && !/Disallow:\s*\/chat/.test(body) && /Disallow:\s*\/admin/.test(body);
        note = ok ? "Googlebot/Bingbot/OAI-SearchBot group present" : "fichier public encore ancien ou incomplet";
      }
      if (path === "/llms.txt") {
        ok = res.status === 200 && body.includes("/methodology") && body.includes("ne garantit");
        note = ok ? "llms.txt expérimental à jour" : "fichier public encore ancien";
      }
      if (path === "/about" || path === "/methodology") {
        ok = res.status === 200 && body.includes("betgpt.live" + path);
        note = `HTTP ${res.status}`;
      }
      if (path === "/sitemap.xml") {
        ok = res.status === 200 && body.includes("https://betgpt.live/methodology") && !body.includes("https://betgpt.live/lab");
        note = ok ? "sitemap contient les pages d’entité" : "sitemap public sans les nouvelles pages";
      }
      if (path === "/changelog.json") {
        ok = res.status === 200 && body.includes("\"updated\":\"2026-09-23\"");
        note = ok ? "changelog machine" : `HTTP ${res.status}`;
      }
      row(`production ${path}`, ok ? "PASS" : "FAIL", note);
    } catch (error) {
      row(`production ${path}`, "UNVERIFIED", error instanceof Error ? error.message : "fetch failed");
    }
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.join(", ")}`);
  process.exit(1);
}
console.log("seo-audit done");
