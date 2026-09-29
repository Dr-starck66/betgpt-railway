import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { legalIdentity, legalReady } from "./legal.ts";

describe("legal ready", () => {
  it("hides SIRET / address / director placeholders when identity is incomplete", () => {
    const id = legalIdentity();
    assert.equal(id.ready, false);
    assert.equal(legalReady(id), false);
    assert.equal(id.siret, "");
    assert.equal(id.address, "");
    assert.equal(id.director, "");
    const blob = JSON.stringify(id).toLowerCase();
    assert.equal(/à déclarer|à renseigner/.test(blob), false);
  });
});
