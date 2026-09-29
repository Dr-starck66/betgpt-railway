import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lettersFromLines, linesBefore, parseSchedule, recentLineLabel } from "./team-form.ts";

const payload = {
  season: { displayName: "2026-27 LALIGA" },
  events: [
    {
      date: "2026-09-20T16:30Z",
      competitions: [
        {
          status: { type: { completed: true, name: "STATUS_FULL_TIME" } },
          competitors: [
            { homeAway: "home", score: { displayValue: "1" }, team: { displayName: "Deportivo" } },
            { homeAway: "away", score: { value: 1 }, team: { displayName: "Real Betis" } },
          ],
        },
      ],
    },
    {
      date: "2026-09-17T17:00Z",
      competitions: [
        {
          status: { type: { completed: true, name: "STATUS_FULL_TIME" } },
          competitors: [
            { homeAway: "home", score: { displayValue: "1" }, team: { displayName: "Real Betis" } },
            { homeAway: "away", score: { displayValue: "0" }, team: { displayName: "Getafe" } },
          ],
        },
      ],
    },
    {
      date: "2026-10-14T19:00Z",
      competitions: [
        {
          status: { type: { completed: false, name: "STATUS_SCHEDULED" } },
          competitors: [
            { homeAway: "home", score: { displayValue: "0" }, team: { displayName: "Real Betis" } },
            { homeAway: "away", score: { displayValue: "0" }, team: { displayName: "FC Porto" } },
          ],
        },
      ],
    },
  ],
};

describe("team form", () => {
  it("reads completed ESPN scores and ignores the future fixture", () => {
    const lines = parseSchedule("Real Betis", payload);
    assert.equal(lines.length, 2);
    const recent = linesBefore(lines, "2026-10-14T19:00:00.000Z", 5);
    assert.equal(recent[0]?.opponent, "Deportivo");
    assert.equal(recent[0]?.scoreFor, 1);
    assert.equal(recent[1]?.opponent, "Getafe");
    assert.equal(lettersFromLines(recent), "DW");
    assert.match(recentLineLabel(recent[1]!), /1–0 contre Getafe/);
  });

  it("does not attach another club", () => {
    assert.equal(parseSchedule("FC Porto", payload).length, 0);
  });
});
