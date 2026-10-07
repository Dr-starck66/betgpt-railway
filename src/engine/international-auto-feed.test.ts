import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERNATIONAL_AUTO_FEED_LOOKAHEAD_DAYS,
  INTERNATIONAL_AUTO_FEED_MAX_DATES_PER_COMPETITION,
  INTERNATIONAL_AUTO_FEED_MINUTES,
  internationalAutoFeedSpecs,
} from "./live.ts";

test("international auto-feed is bounded and zero-cost friendly", () => {
  assert.ok(INTERNATIONAL_AUTO_FEED_MINUTES >= 30);
  assert.ok(INTERNATIONAL_AUTO_FEED_LOOKAHEAD_DAYS >= 14);
  assert.ok(INTERNATIONAL_AUTO_FEED_MAX_DATES_PER_COMPETITION <= 4);
});

test("international auto-feed covers event-only national competitions without club cups", () => {
  const specs = internationalAutoFeedSpecs();
  const keys: string[] = specs.map((row) => row.slug);

  assert.ok(specs.length >= 10);
  assert.ok(specs.every((row) => row.id === "NL"));
  assert.equal(new Set(keys).size, keys.length);

  for (const required of [
    "uefa.euro",
    "uefa.euroq",
    "fifa.world",
    "fifa.worldq.uefa",
    "fifa.worldq.caf",
    "fifa.worldq.afc",
    "fifa.worldq.concacaf",
    "fifa.worldq.conmebol",
    "caf.nations",
    "conmebol.america",
    "concacaf.gold",
    "afc.asian.cup",
  ]) {
    assert.ok(keys.includes(required), `missing international auto-feed competition: ${required}`);
  }

  assert.ok(!keys.includes("eng.fa"));
  assert.ok(!keys.includes("esp.copa_del_rey"));
});
