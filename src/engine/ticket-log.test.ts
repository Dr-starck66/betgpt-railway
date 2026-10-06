import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRuntimeCheckpointPayload, stablePublicEvidenceTickets, type TicketRow } from "./ticket-log.ts";
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

  it("keeps only canonical ROI5 1X2 home/away BETs in the 1.80-3.00 window", () => {
    assert.equal(isMethodPick(t({ odds: 3.01, book: "Unibet", market: "1X2_A", decision: "BET" })), false);
    assert.equal(isMethodPick(t({ odds: 1.79, book: "Unibet", market: "1X2_H", decision: "BET" })), false);
    assert.equal(isMethodPick(t({ odds: 2.2, book: "Unibet", market: "1X2_D", decision: "BET" })), false);
    assert.equal(isMethodPick(t({ odds: 2.2, book: "Unibet", market: "BTTS_Y", decision: "BET" })), false);
    assert.equal(isMethodPick(t({ odds: 2.2, book: "non listé", market: "1X2_H", decision: "BET" })), false);
    assert.equal(isMethodPick(t({ odds: 2.2, book: "Unibet", market: "1X2_H", decision: "WATCH" })), false);
    assert.equal(isMethodPick(t({ odds: 1.8, book: "Unibet", market: "1X2_H", decision: "BET" })), true);
    assert.equal(isMethodPick(t({ odds: 3.0, book: "Unibet", market: "1X2_A", decision: "BET" })), true);
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
        decision: "BET",
        kickoff: "2026-09-10T16:45Z",
      }),
      t({
        id: "ub-psv:1X2",
        matchId: "ub-psveindhoven|shakhtardonetsk-2026-09-10",
        home: "PSV Eindhoven",
        away: "Shakhtar Donetsk",
        odds: 2.4,
        book: "Unibet",
        decision: "BET",
        kickoff: "2026-09-10T16:45:00Z",
      }),
      t({
        id: "ub-mu:1X2",
        matchId: "ub-manchesterunited|sabahfk-2026-09-10",
        home: "Manchester United",
        away: "Sabah FK",
        odds: 1.07,
        book: "Unibet",
        decision: "BET",
        kickoff: "2026-09-10T19:00:00Z",
      }),
      t({
        id: "ub-mu2:1X2",
        matchId: "ub-manchesterunited|sabah-2026-09-10",
        home: "Manchester United",
        away: "Sabah FK",
        odds: 1.07,
        book: "Unibet",
        decision: "BET",
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
        decision: "BET",
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
        decision: "BET",
        kickoff: "2026-09-10T19:00:00Z",
      }),
    ];
    const compact = compactTickets(rows);
    assert.equal(compact.filter((r) => r.home.includes("PSV")).length, 1);
    assert.equal(compact.filter((r) => r.home.startsWith("Manchester")).length, 1);
    assert.equal(compact.filter((r) => r.home === "Como").length, 1);
    const psv = compact.find((r) => r.home.includes("PSV"))!;
    assert.equal(psv.odds, 2.4);
    assert.equal(psv.book, "Unibet");

    const publicLines = uniqueByFixture(rows.filter(isMethodPick));
    assert.equal(publicLines.length, 1);
    assert.equal(publicLines[0]!.home, "PSV Eindhoven");
    assert.equal(publicLines[0]!.odds, 2.4);
  });
});


describe("public prediction evidence durability", () => {
  it("keeps stable seed evidence and rejects runtime-only ticket ids from sitemap candidates", () => {
    const stable = t({
      id: "espn-401879291:1X2",
      matchId: "espn-401879291",
      kind: "prono",
      market: "1X2_H",
    }) as unknown as TicketRow;
    const ephemeral = t({
      id: "espn-runtime-only:1X2",
      matchId: "espn-runtime-only",
      kind: "prono",
      market: "1X2_H",
    }) as unknown as TicketRow;

    const rows = stablePublicEvidenceTickets([stable, ephemeral]);
    assert.deepEqual(rows.map((row) => row.id), ["espn-401879291:1X2"]);
  });
});


describe("runtime learning checkpoint compatibility", () => {
  it("hydrates the current v2 checkpoint when refresh proof passed", () => {
    const rows = parseRuntimeCheckpointPayload({
      schema: "astra-betgpt-runtime-checkpoint/v2",
      refresh: { status: "PASS" },
      tickets: [
        {
          ...(t({ id: "runtime-v2", matchId: "runtime-v2" }) as TicketRow),
          label: "Home",
          stakePct: 0,
          modelProb: 0.5,
          ev: 0,
          dailyBest: false,
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, "runtime-v2");
  });

  it("fails closed on a v2 checkpoint whose live refresh failed", () => {
    const rows = parseRuntimeCheckpointPayload({
      schema: "astra-betgpt-runtime-checkpoint/v2",
      refresh: { status: "FAIL" },
      tickets: [t({ id: "bad-v2" })],
    });
    assert.equal(rows.length, 0);
  });

  it("keeps backward compatibility with v1 checkpoints", () => {
    const rows = parseRuntimeCheckpointPayload({
      schema: "astra-betgpt-runtime-checkpoint/v1",
      tickets: [
        {
          ...(t({ id: "runtime-v1", matchId: "runtime-v1" }) as TicketRow),
          label: "Home",
          stakePct: 0,
          modelProb: 0.5,
          ev: 0,
          dailyBest: false,
        },
      ],
    });
    assert.equal(rows.length, 1);
  });
});
