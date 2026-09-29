import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compactTickets,
  fixtureKey,
  isMethodPick,
  teamKey,
  uniqueByFixture,
  type LedgerPickRow,
} from "./ledger-pick.ts";

function t(over: Partial<LedgerPickRow>): LedgerPickRow {
  return {
    id: over.id ?? "a:1X2",
    matchId: over.matchId ?? "a",
    kickoff: over.kickoff ?? "2026-09-10T19:00:00.000Z",
    home: over.home ?? "Home",
    away: over.away ?? "Away",
    market: over.market ?? "1X2_H",
    odds: over.odds ?? 2,
    book: over.book ?? "Unibet",
    kind: over.kind ?? "prono",
    decision: over.decision ?? "WATCH",
    recordedAt: over.recordedAt ?? "2026-09-10T10:00:00.000Z",
    goalsHome: over.goalsHome,
    goalsAway: over.goalsAway,
    league: over.league ?? "CL",
    ...over,
  };
}

describe("ledger fixture identity", () => {
  it("keeps the prematch record even when a later clone has a result and better odds", () => {
    const before = t({ id: "before", odds: 0, book: "non listé" });
    const late = t({ id: "late", recordedAt: "2026-09-10T21:00:00Z", goalsHome: 3, goalsAway: 0 });
    assert.equal(compactTickets([before, late])[0]!.id, "before");
    assert.equal(compactTickets([late, before])[0]!.id, "before");
  });
  it("selects the latest prematch version independently of scores", () => {
    const first = t({ id: "first", goalsHome: 2, goalsAway: 0 });
    const latest = t({ id: "latest", recordedAt: "2026-09-10T18:00:00Z", odds: 5 });
    assert.equal(compactTickets([first, latest])[0]!.id, "latest");
  });
  it("treats Sabah FK and Sabah as the same team", () => {
    assert.equal(teamKey("Sabah FK"), teamKey("Sabah"));
    assert.equal(teamKey("RB Leipzig"), teamKey("Leipzig"));
    assert.equal(
      fixtureKey("Manchester United", "Sabah FK", "2026-09-10T19:00:00Z"),
      fixtureKey("Manchester United", "Sabah", "2026-09-10T19:00:00.000Z"),
    );
  });

  it("drops lottery odds, unlisted odds and 1.07 steamrollers from the public method", () => {
    assert.equal(isMethodPick(t({ odds: 4.5, book: "Unibet", market: "1X2_A" })), false);
    assert.equal(isMethodPick(t({ odds: 1.07, book: "Unibet" })), false);
    assert.equal(isMethodPick(t({ odds: 0, book: "non listé" })), false);
    assert.equal(isMethodPick(t({ odds: 3.4, book: "Unibet" })), true);
    assert.equal(isMethodPick(t({ odds: 1.5, book: "Unibet" })), true);
  });

  it("keeps one ticket per match across espn/ub clones", () => {
    const rows = [
      t({
        id: "espn-1:1X2",
        matchId: "espn-1",
        home: "PSV Eindhoven",
        away: "Shakhtar Donetsk",
        odds: 0,
        book: "non listé",
        kickoff: "2026-09-10T16:45Z",
      }),
      t({
        id: "ub-psv:1X2",
        matchId: "ub-psveindhoven|shakhtardonetsk-2026-09-10",
        home: "PSV Eindhoven",
        away: "Shakhtar Donetsk",
        odds: 3.4,
        book: "Unibet",
        kickoff: "2026-09-10T16:45:00Z",
      }),
      t({
        id: "ub-mu:1X2",
        matchId: "ub-manchesterunited|sabahfk-2026-09-10",
        home: "Manchester United",
        away: "Sabah FK",
        odds: 1.07,
        book: "Unibet",
        kickoff: "2026-09-10T19:00:00Z",
      }),
      t({
        id: "ub-mu2:1X2",
        matchId: "ub-manchesterunited|sabah-2026-09-10",
        home: "Manchester United",
        away: "Sabah FK",
        odds: 1.07,
        book: "Unibet",
        kickoff: "2026-09-10T19:00:00Z",
      }),
      t({
        id: "ub-como:1X2",
        matchId: "ub-como|rbleipzig-2026-09-10",
        home: "Como",
        away: "RB Leipzig",
        market: "1X2_A",
        odds: 4.5,
        book: "Unibet",
        kickoff: "2026-09-10T19:00:00Z",
      }),
      t({
        id: "ub-como2:1X2",
        matchId: "ub-como|leipzig-2026-09-10",
        home: "Como",
        away: "Leipzig",
        market: "1X2_A",
        odds: 4.5,
        book: "Unibet",
        kickoff: "2026-09-10T19:00:00Z",
      }),
    ];
    const compact = compactTickets(rows);
    assert.equal(compact.filter((r) => r.home.includes("PSV")).length, 1);
    assert.equal(compact.filter((r) => r.home.startsWith("Manchester")).length, 1);
    assert.equal(compact.filter((r) => r.home === "Como").length, 1);
    const psv = compact.find((r) => r.home.includes("PSV"))!;
    assert.equal(psv.odds, 3.4);
    assert.equal(psv.book, "Unibet");

    const publicLines = uniqueByFixture(rows.filter(isMethodPick));
    assert.equal(publicLines.length, 1);
    assert.equal(publicLines[0]!.home, "PSV Eindhoven");
    assert.equal(publicLines[0]!.odds, 3.4);
  });
});
