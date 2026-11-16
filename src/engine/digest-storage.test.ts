import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { probeDigestStorage } from "./digest-storage.ts";

test("writable local digest directory passes without leaving probe files", () => {
  const root = mkdtempSync(join(tmpdir(), "astra-digest-"));
  try {
    const result = probeDigestStorage(join(root, "data", "digests"), {});
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(readdirSync(join(root, "data", "digests")), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Vercel and AWS Lambda fail closed even when /tmp is writable", () => {
  const root = mkdtempSync(join(tmpdir(), "astra-digest-"));
  try {
    assert.deepEqual(probeDigestStorage(root, { VERCEL: "1" }), {
      ok: false, reason: "SERVERLESS_STORAGE_NOT_DURABLE",
    });
    assert.deepEqual(probeDigestStorage(root, { AWS_LAMBDA_FUNCTION_NAME: "betgpt" }), {
      ok: false, reason: "SERVERLESS_STORAGE_NOT_DURABLE",
    });
    assert.deepEqual(readdirSync(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("impossible write path fails closed instead of throwing", () => {
  const root = mkdtempSync(join(tmpdir(), "astra-digest-"));
  try {
    const blocker = join(root, "not-a-directory");
    writeFileSync(blocker, "x");
    const result = probeDigestStorage(join(blocker, "nested"), {});
    assert.equal(result.ok, false);
    assert.equal(typeof ("reason" in result && result.reason), "string");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
