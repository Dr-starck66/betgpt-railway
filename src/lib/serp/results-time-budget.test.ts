import test from "node:test";
import assert from "node:assert/strict";
import { withTimeoutFallback } from "./results-time-budget.ts";

test("returns real completed data before budget", async () => {
  const value = await withTimeoutFallback(Promise.resolve(["verified"]), 150, () => []);
  assert.deepEqual(value, ["verified"]);
});
test("returns fallback without waiting for a hanging provider", async () => {
  const begin = Date.now();
  const value = await withTimeoutFallback(new Promise<string[]>(() => {}), 25, () => []);
  assert.deepEqual(value, []);
  assert.ok(Date.now() - begin < 600, "provider must not block the HTTP response");
});
test("returns explicit fallback for rejected provider", async () => {
  assert.equal(await withTimeoutFallback(Promise.reject(new Error("ESPN timeout")), 20, () => null), null);
});
test("late data does not retroactively change timeout result", async () => {
  let complete!: (value: string) => void;
  const pending = new Promise<string>((resolve) => { complete = resolve; });
  const value = await withTimeoutFallback(pending, 10, () => "UNVERIFIED");
  complete("real later");
  assert.equal(value, "UNVERIFIED");
});
