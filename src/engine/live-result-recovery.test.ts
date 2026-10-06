import assert from "node:assert/strict";
import test from "node:test";
import { resultRecoveryLeagueSlugs } from "./live.ts";

test("result recovery includes international event-only competition families", () => {
  const slugs = resultRecoveryLeagueSlugs("NL");
  assert.ok(slugs.includes("uefa.nations"));
  assert.ok(slugs.includes("fifa.worldq.uefa"));
  assert.ok(slugs.includes("fifa.worldq.caf"));
  assert.ok(slugs.includes("uefa.euroq"));
});

test("result recovery keeps domestic cups alongside the main league", () => {
  const slugs = resultRecoveryLeagueSlugs("PL");
  assert.ok(slugs.includes("eng.1"));
  assert.ok(slugs.includes("eng.fa"));
  assert.ok(slugs.includes("eng.league_cup"));
});

test("result recovery keeps European qualifiers alongside main competitions", () => {
  assert.ok(resultRecoveryLeagueSlugs("CL").includes("uefa.champions_qual"));
  assert.ok(resultRecoveryLeagueSlugs("EL").includes("uefa.europa_qual"));
  assert.ok(resultRecoveryLeagueSlugs("EL").includes("uefa.europa.conf"));
});
