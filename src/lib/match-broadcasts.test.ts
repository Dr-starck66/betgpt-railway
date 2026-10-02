import assert from "node:assert/strict";
import test from "node:test";
import { matchBroadcast } from "./match-broadcasts.ts";

test("Dortmund - Werder expose le diffuseur français vérifié", () => {
  const info = matchBroadcast({
    id: "ub-borussiadortmund|werderbremen-2026-10-09",
    slug: "borussia-dortmund-werder-bremen-2026-10-09",
  });
  assert.ok(info);
  assert.equal(info.territory, "FR");
  assert.equal(info.label, "beIN SPORTS MAX 10");
  assert.match(info.sourceUrl, /^https:\/\//);
});
