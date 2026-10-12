import test from "node:test";
import assert from "node:assert/strict";
import {inspectWiring,inspectNewsSitemap,classify} from "./astra-news-eligibility-proof.mjs";
const example=()=>({
  "scripts/run-editorial-publish.ts":"sourceIntegrityGate contextualAuthorityGate discoverLaunchpadStaticAudit writeLedger",
  "src/lib/editorial/source-integrity.ts":"sourceIntegrityGate",
  "src/lib/editorial/authority-citations.ts":"contextualAuthorityGate",
  "src/lib/editorial/discover-launchpad.ts":"discoverLaunchpadStaticAudit"
});
test("real wiring only if every required editorial validator participates",()=>{
  assert.equal(inspectWiring(example()).every(x=>x.status==="WIRED"),true);
  const broken=example();broken["scripts/run-editorial-publish.ts"]="writeLedger";
  assert.equal(inspectWiring(broken)[0].status,"FAIL");
});
test("source tests do not claim Google inclusion",()=>{
  assert.equal(classify({wiring:inspectWiring(example()),tests:[{status:"PASS"}]}),"PASS_SOURCE_TESTS_ONLY");
});
test("failing editorial regression prevents PASS",()=>{
  assert.equal(classify({wiring:inspectWiring(example()),tests:[{status:"FAIL"}]}),"FAIL");
});
test("Google News sitemap rejects wrong origin and old stories",()=>{
  const now=Date.parse("2026-10-13T00:00:00Z");
  const xml='<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://other.example/article</loc><news:news><news:publication_date>2026-10-01T10:00:00Z</news:publication_date></news:news></url></urlset>';
  const x=inspectNewsSitemap(xml,"https://betgpt.live",now);
  assert.equal(x.status,"FAIL");assert.ok(x.failures.some(e=>e.startsWith("foreign-origin")));
});
test("empty news sitemap is PARTIAL, never inclusion PASS",()=>{
  const x=inspectNewsSitemap("<urlset></urlset>","https://betgpt.live");
  assert.equal(x.status,"PARTIAL_NO_RECENT_NEWS");
});
test("fresh same-origin news sitemap yields public technical validation only",()=>{
  const now=Date.parse("2026-10-13T00:00:00Z");
  const xml='<urlset><url><loc>https://betgpt.live/news/test</loc><news:news><news:publication_date>2026-10-12T22:00:00Z</news:publication_date></news:news></url></urlset>';
  const x=inspectNewsSitemap(xml,"https://betgpt.live",now);
  assert.equal(x.status,"PASS");
  assert.equal(classify({wiring:inspectWiring(example()),tests:[{status:"PASS"}],publicProbe:x}),"PASS_PUBLIC_TECHNICAL");
});
