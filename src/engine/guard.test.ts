import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adminDisabled,
  adminKeyConfigured,
  adminNeedsSetup,
  issueAdminToken,
  isProductionRuntime,
  setupAdmin,
  verifyAdminToken,
} from "./guard.ts";

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  ADMIN_KEY: process.env.ADMIN_KEY,
  ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET,
};

function restore(): void {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(restore);

describe("admin fail-closed", () => {
  it("production without ADMIN_KEY disables admin and first-visitor setup", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;
    delete process.env.ADMIN_KEY;
    delete process.env.ADMIN_TOKEN_SECRET;
    assert.equal(isProductionRuntime(), true);
    assert.equal(adminKeyConfigured(), false);
    assert.equal(adminDisabled(), true);
    assert.equal(adminNeedsSetup(), false);
    assert.equal(issueAdminToken("abcdefgh"), null);
    const r = setupAdmin("abcdefgh");
    assert.equal(r.ok, false);
  });

  it("ADMIN_KEY in production issues and verifies a token", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_KEY = "supersecret-key";
    delete process.env.ADMIN_TOKEN_SECRET;
    assert.equal(adminDisabled(), false);
    assert.equal(adminNeedsSetup(), false);
    const tok = issueAdminToken("supersecret-key");
    assert.ok(tok);
    assert.equal(verifyAdminToken(tok), true);
    assert.equal(issueAdminToken("wrong-password"), null);
    assert.equal(verifyAdminToken("nope"), false);
  });

  it("preview without ADMIN_KEY is not fail-closed", () => {
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL;
    delete process.env.ADMIN_KEY;
    assert.equal(isProductionRuntime(), false);
    assert.equal(adminDisabled(), false);
  });
});
