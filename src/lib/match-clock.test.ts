import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchClock } from "./match-clock.ts";

describe("match clock", () => {
  it("never publishes a future kickoff", () => {
    const clock = matchClock({
      kickoff: "2026-10-14T19:00:00.000Z",
      predictionAt: "2026-10-14T19:00:00.000Z",
      now: Date.parse("2026-09-25T00:10:00.000Z"),
    });
    assert.equal(clock.published, undefined);
    assert.equal(clock.freshnessLabel, "indisponible");
  });

  it("keeps publication and update on the same real stamps", () => {
    const clock = matchClock({
      kickoff: "2026-10-14T19:00:00.000Z",
      predictionAt: "2026-09-24T23:06:00.000Z",
      versions: [{ timestamp: "2026-09-14T14:42:00.000Z" }],
      now: Date.parse("2026-09-25T00:10:00.000Z"),
    });
    assert.equal(clock.published, "2026-09-14T14:42:00.000Z");
    assert.equal(clock.modified, "2026-09-24T23:06:00.000Z");
    assert.equal(clock.freshnessLabel, "1 h");
    assert.notEqual(clock.published?.slice(0, 10), "2026-10-14");
  });
});
