import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowKeyed, kvGet, kvSet, resetStoreForTests } from "./store.ts";

describe("durable store memory adapter", () => {
  it("allowKeyed caps hits inside the window", async () => {
    resetStoreForTests();
    assert.equal(await allowKeyed("t", 2, 10_000), true);
    assert.equal(await allowKeyed("t", 2, 10_000), true);
    assert.equal(await allowKeyed("t", 2, 10_000), false);
  });

  it("kv round-trips in memory when SQL is forced off", async () => {
    resetStoreForTests();
    await kvSet("hello", { n: 3 });
    const v = await kvGet<{ n: number }>("hello");
    assert.deepEqual(v, { n: 3 });
  });
});
