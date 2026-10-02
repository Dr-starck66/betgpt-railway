import assert from "node:assert/strict";
import test from "node:test";
import { parseEspnLineups } from "./official-lineups.ts";
import type { MatchInput } from "./types.ts";

function player(i: number, starter = true) {
  return {
    athlete: { id: String(i), displayName: `Joueur ${i}`, position: { abbreviation: "MF" } },
    jersey: String(i),
    starter,
  };
}

function match(): MatchInput {
  const dp = <T>(value: T) => ({ value, source: "test", timestamp: "2026-09-20T12:00:00Z", confidence: 1, freshnessHours: 0 });
  const team = (id: string, name: string) => ({
    id, name, short: name.slice(0, 3).toUpperCase(), league: "PL" as const,
    attack: 1, defense: 1, elo: 1800, xgFor: 1, xgAgainst: 1, possession: 50, ppda: 10,
    fieldTilt: 50, progressivePasses: 40, highTurnovers: 7, recoveries: 50, compactness: .7,
    setPieceXg: .2, duelWin: 50, cardsPerGame: 2, flexibility: .6, pressLine: .6, buildup: .6,
    depth: .6, formation: "4-2-3-1", color: "#000000",
  });
  return {
    id: "espn-123456789", league: "PL", competition: "Premier League", kickoff: "2026-09-20T15:30:00Z",
    venue: "Craven Cottage", home: team("370", "Fulham"), away: team("360", "Manchester United"),
    restHome: dp(6), restAway: dp(6), travelAwayKm: dp(0), congestionHome: dp(0), congestionAway: dp(0),
    absencesHome: dp([]), absencesAway: dp([]), importance: dp(.8),
    opening: { book: "", home: 0, draw: 0, away: 0, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0 },
    current: [], notes: [],
  };
}

function summary(homeStarters = 11, awayStarters = 11, duplicateHome = false) {
  const home = Array.from({ length: homeStarters }, (_, i) => player(i + 1, true));
  if (duplicateHome && home.length > 1) home[1] = home[0];
  return {
    rosters: [
      {
        team: { id: "370", displayName: "Fulham" },
        formation: "4-2-3-1",
        roster: [...home, player(90, false), player(91, false)],
      },
      {
        team: { id: "360", displayName: "Manchester United" },
        formation: "4-2-3-1",
        roster: [
          ...Array.from({ length: awayStarters }, (_, i) => ({
            ...player(i + 30, true),
            athlete: { id: String(i + 30), displayName: `United ${i + 1}`, position: { abbreviation: "MF" } },
          })),
          { ...player(92, false), athlete: { id: "92", displayName: "United Bench" } },
        ],
      },
    ],
  };
}

test("confirme uniquement deux XI complets de 11 titulaires uniques", () => {
  const out = parseEspnLineups(summary(), match(), "123456789");
  assert.equal(out.status, "CONFIRMED");
  assert.equal(out.home?.starters.length, 11);
  assert.equal(out.away?.starters.length, 11);
  assert.equal(out.home?.formation, "4-2-3-1");
});

test("une équipe à 10 titulaires reste PARTIAL et ne produit jamais un faux PASS", () => {
  const out = parseEspnLineups(summary(10, 11), match(), "123456789");
  assert.equal(out.status, "PARTIAL");
  assert.notEqual(out.status, "CONFIRMED");
});

test("un doublon dans le XI casse la confirmation", () => {
  const out = parseEspnLineups(summary(11, 11, true), match(), "123456789");
  assert.equal(out.home?.starters.length, 10);
  assert.equal(out.status, "PARTIAL");
});

test("aucune feuille fournisseur => UNVERIFIED", () => {
  const out = parseEspnLineups({ rosters: [] }, match(), "123456789");
  assert.equal(out.status, "UNVERIFIED");
  assert.equal(out.home, undefined);
  assert.equal(out.away, undefined);
});
