import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePinnacleValueResearch } from "./pinnacle-value-research.ts";
import type { BookOdds } from "./types.ts";

const now = Date.parse("2026-11-13T18:00:00Z");
const observedAt = new Date(now - 30_000).toISOString();
const kickoff = new Date(now + 4 * 3600_000).toISOString();
const p = {
  home: 2.05, draw: 3.40, away: 3.75,
  homeTeam: "Paris SG", awayTeam: "Lyon", kickoff, observedAt,
  provenance: "SYNTHETIC_TEST" as const,
};
const book: BookOdds = {
  book: "Betclic", home: 2.30, draw: 3.35, away: 3.7, observedAt,
  over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0,
};
const f = { home: "Paris SG", away: "Lyon", kickoff, books: [book] };
const model = { home: .50, draw: .27, away: .23, source: "independent-backtest", observedAt, validatedOutOfSample: true };
const run = (options: Record<string, unknown> = {}) => evaluatePinnacleValueResearch({ pinnacle: p, french: f, model, nowMs: now, ...options });

test("synthetic snapshots can be simulated but never create real candidates", () => {
  const r = run(); assert.equal(r.status, "SIMULATION");
  assert.equal(r.outcomes[0]?.selection, "home");
  assert.equal(r.outcomes[0]?.price, 2.3);
  assert.equal(r.outcomes[0]?.modelEv?.toFixed(2), "0.15");
  assert.equal(r.outcomes[0]?.eligible, false);
});
test("licensed research with separately validated model yields candidate", () => {
  const r = run({ pinnacle: { ...p, provenance: "LICENSED_FEED" } });
  assert.equal(r.status, "RESEARCH_CANDIDATE");
  assert.equal(r.outcomes[0]?.eligible, true);
  assert.ok(r.outcomes[0]!.benchmarkEv > 0);
});
test("no independent calibration => reference only", () => {
  const r = run({ pinnacle: { ...p, provenance: "LICENSED_FEED" }, model: { ...model, validatedOutOfSample: false } });
  assert.equal(r.status, "REFERENCE_ONLY");
  assert.equal(r.outcomes[0]?.eligible, false);
});
test("reject stale Pinnacle prices", () => {
  assert.equal(run({ pinnacle: { ...p, observedAt: new Date(now - 3600_000).toISOString() } }).reason, "STALE_OR_FUTURE_PINNACLE_QUOTE");
});
test("reject future Pinnacle timestamps", () => {
  assert.equal(run({ pinnacle: { ...p, observedAt: new Date(now + 60_000).toISOString() } }).status, "NO_DATA");
});
test("reject reversed team orientation", () => {
  assert.equal(run({ french: { ...f, home: "Lyon", away: "Paris SG" } }).reason, "AMBIGUOUS_OR_MISMATCHED_FIXTURE");
});
test("reject kickoff mismatch", () => {
  assert.equal(run({ french: { ...f, kickoff: new Date(now + 6 * 3600_000).toISOString() } }).status, "NO_DATA");
});
test("reject implausible reference overround", () => {
  assert.equal(run({ pinnacle: { ...p, home: 1.1, draw: 1.1, away: 1.1 } }).reason, "INVALID_PINNACLE_1X2_MARKET");
});
test("reject missing FR book timestamps", () => {
  assert.equal(run({ french: { ...f, books: [{ ...book, observedAt: undefined }] } }).reason, "NO_FRESH_APPROVED_FR_BOOK_PRICE");
});
test("reject unapproved book even with attractive odds", () => {
  assert.equal(run({ french: { ...f, books: [{ ...book, book: "Unknown bookmaker", home: 2.99 }] } }).status, "NO_DATA");
});
test("do not surface odds beyond canonical 1.80-3.00 window", () => {
  assert.equal(run({ french: { ...f, books: [{ ...book, home: 3.4, away: 4.2 }] } }).status, "NO_DATA");
});
test("reject malformed model probability simplex", () => {
  assert.equal(run({ pinnacle: { ...p, provenance: "LICENSED_FEED" }, model: { ...model, home: .9 } }).status, "REFERENCE_ONLY");
});
test("reject past kickoff", () => {
  assert.equal(run({ pinnacle: { ...p, kickoff: new Date(now - 1000).toISOString() } }).status, "NO_DATA");
});
test("negative or NaN policy threshold fails closed", () => {
  assert.equal(run({ minModelEv: NaN }).reason, "INVALID_RESEARCH_POLICY");
});
test("fail closed with no reference snapshot", () => {
  assert.equal(run({ pinnacle: null }).reason, "MISSING_PROVIDER_SNAPSHOT");
});
test("no edge when both thresholds are not met", () => {
  const r = run({ pinnacle: { ...p, provenance: "LICENSED_FEED" }, minModelEv: .5 });
  assert.equal(r.status, "NO_EDGE");
  assert.equal(r.outcomes[0]?.eligible, false);
});
