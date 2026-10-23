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

  it("evicts the oldest KV entries without evicting recently accessed entries", async () => {
    resetStoreForTests();
    await kvSet("hot", { n: 1 });
    for (let i = 0; i < 510; i++) await kvSet("key-" + i, { n: i });
    assert.deepEqual(await kvGet("hot"), { n: 1 });
    await kvSet("new-a", 1);
    await kvSet("new-b", 2);
    assert.equal(await kvGet("key-0"), null);
    assert.deepEqual(await kvGet("hot"), { n: 1 });
    assert.equal(await kvGet("new-b"), 2);
  });

  it("fails closed when too many distinct in-memory rate-limit buckets accumulate", async () => {
    resetStoreForTests();
    for (let i = 0; i < 16_384; i++) {
      assert.equal(await allowKeyed("client-" + i, 1, 600_000), true);
    }
    assert.equal(await allowKeyed("overflow", 1, 600_000), false);
    assert.equal(await allowKeyed("client-0", 1, 600_000), false);
  });
});
