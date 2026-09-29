import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "./sha256.ts";
import {
  canMutatePrediction,
  hashIntegrity,
  hashPrediction,
  isImmutable,
  kickoffPassed,
  lifecycle,
  publishedBeforeKickoff,
  sampleBand,
  sampleLabel,
  stampLock,
  verifyStatus,
  type EvidenceRow,
} from "./verify.ts";

function row(over: Partial<EvidenceRow> = {}): EvidenceRow {
  return {
    id: "espn-1:1X2",
    matchId: "espn-1",
    kickoff: "2026-09-14T18:00:00.000Z",
    recordedAt: "2026-09-14T12:00:00.000Z",
    market: "1X2_H",
    label: "Victoire Home",
    odds: 2.1,
    book: "Unibet",
    modelProb: 0.52,
    ...over,
  };
}

describe("verify / lock", () => {
  it("sha256Hex matches FIPS 180-2 abc vector", () => {
    assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("kickoffPassed is true at and after kickoff", () => {
    const ko = Date.parse("2026-09-14T18:00:00.000Z");
    assert.equal(kickoffPassed("2026-09-14T18:00:00.000Z", ko - 1), false);
    assert.equal(kickoffPassed("2026-09-14T18:00:00.000Z", ko), true);
  });

  it("publishedBeforeKickoff requires recordedAt < kickoff", () => {
    assert.equal(publishedBeforeKickoff(row()), true);
    assert.equal(
      publishedBeforeKickoff(row({ recordedAt: "2026-09-14T19:00:00.000Z" })),
      false,
    );
  });

  it("timezone offsets are compared in absolute UTC", () => {
    const r = row({
      recordedAt: "2026-09-14T16:00:00+02:00",
      kickoff: "2026-09-14T16:30:00.000Z",
    });
    assert.equal(publishedBeforeKickoff(r), true);
    const late = row({
      recordedAt: "2026-09-14T19:00:00+02:00",
      kickoff: "2026-09-14T16:30:00.000Z",
    });
    assert.equal(publishedBeforeKickoff(late), false);
  });

  it("does not count post-kickoff rows as verified", () => {
    assert.equal(verifyStatus(row({ recordedAt: "2026-09-14T19:00:00.000Z" })), "unverified");
    assert.equal(verifyStatus(row()), "partial");
    assert.equal(
      verifyStatus(row({ predictionHash: "abc", engineVersion: "betgpt-ensemble-1.0.0" })),
      "verified",
    );
  });

  it("stampLock is idempotent and freezes a hash for engine rows", () => {
    const a = row({ engineVersion: "betgpt-ensemble-1.0.0" });
    const now = Date.parse("2026-09-14T18:01:00.000Z");
    stampLock(a, now);
    const hash = a.predictionHash;
    assert.ok(hash && hash.length === 64);
    a.odds = 9.9;
    stampLock(a, now + 1000);
    assert.equal(a.predictionHash, hash);
    assert.equal(a.odds, 9.9);
    assert.equal(isImmutable(a, now + 1000), true);
    assert.equal(canMutatePrediction(a, now + 1000), false);
  });

  it("does not fabricate hashes for post-kickoff rows even if already locked", () => {
    const a = row({
      recordedAt: "2026-09-14T19:00:00.000Z",
      engineVersion: "betgpt-ensemble-1.0.0",
      predictionHash: "deadbeef",
      lockedAt: "2026-09-14T19:01:00.000Z",
    });
    stampLock(a, Date.parse("2026-09-14T19:02:00.000Z"));
    assert.equal(a.predictionHash, undefined);
    assert.equal(verifyStatus(a), "unverified");
  });

  it("does not fabricate hashes for legacy rows without engineVersion", () => {
    const a = row();
    const now = Date.parse("2026-09-14T18:01:00.000Z");
    stampLock(a, now);
    assert.equal(a.predictionHash, undefined);
    assert.equal(verifyStatus(a), "partial");
    assert.equal(lifecycle(a, now), "locked");
  });

  it("does not lock or hash before kickoff", () => {
    const a = row({ engineVersion: "betgpt-ensemble-1.0.0" });
    const now = Date.parse("2026-09-14T12:00:00.000Z");
    stampLock(a, now);
    assert.equal(a.lockedAt, undefined);
    assert.equal(a.predictionHash, undefined);
    assert.equal(canMutatePrediction(a, now), true);
  });

  it("hashIntegrity detects a mutated locked payload", () => {
    const a = row({ engineVersion: "v1" });
    stampLock(a, Date.parse("2026-09-14T18:01:00.000Z"));
    assert.equal(hashIntegrity(a), "ok");
    a.odds = 4;
    assert.equal(hashIntegrity(a), "mismatch");
    assert.equal(hashIntegrity(row()), "unavailable");
  });

  it("hash changes if the locked payload would change", () => {
    const a = row({ engineVersion: "v1" });
    const b = row({ engineVersion: "v1", odds: 3.5 });
    assert.notEqual(hashPrediction(a), hashPrediction(b));
  });

  it("sample bands never call 0 matches meaningful", () => {
    assert.equal(sampleBand(0), "unverified");
    assert.equal(sampleBand(12), "early");
    assert.equal(sampleBand(40), "limited");
    assert.equal(sampleBand(120), "meaningful");
    assert.match(sampleLabel(0), /insuffisant/i);
  });

  it("lifecycle maps void / unverified / settled", () => {
    assert.equal(lifecycle(row({ result: "void" })), "void");
    assert.equal(lifecycle(row({ recordedAt: "2026-09-14T19:00:00.000Z" })), "unverified");
    assert.equal(
      lifecycle(row({ result: "win" }), Date.parse("2026-09-14T19:00:00.000Z")),
      "settled",
    );
  });
});
