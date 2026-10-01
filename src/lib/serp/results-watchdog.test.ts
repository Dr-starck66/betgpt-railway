import test from "node:test";
import assert from "node:assert/strict";
import { auditResultsSnapshot } from "./results-watchdog.ts";

test("PASS for fresh complete results", () => {
  const now = Date.parse("2026-10-01T18:00:00Z");
  const out = auditResultsSnapshot({
    httpOk: true,
    asOf: "2026-10-01T17:30:00Z",
    rowCount: 20,
    visualCount: 40,
    historySections: 7,
    now,
  });
  assert.equal(out.status, "PASS");
});

test("PARTIAL when visuals are incomplete", () => {
  const now = Date.parse("2026-10-01T18:00:00Z");
  const out = auditResultsSnapshot({
    httpOk: true,
    asOf: "2026-10-01T17:30:00Z",
    rowCount: 20,
    visualCount: 20,
    historySections: 7,
    now,
  });
  assert.equal(out.status, "PARTIAL");
});

test("FAIL when results are stale", () => {
  const now = Date.parse("2026-10-01T18:00:00Z");
  const out = auditResultsSnapshot({
    httpOk: true,
    asOf: "2026-09-29T17:00:00Z",
    rowCount: 20,
    visualCount: 40,
    historySections: 7,
    now,
  });
  assert.equal(out.status, "FAIL");
});
