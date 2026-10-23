import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningMemory, factorsOf, canonicalRiskState, applyCanonicalRiskBrakeToMarkets } from "./learning-memory.ts";
import type { TicketRow } from "./ticket-log.ts";

function row(i: number, result: "win" | "lose", odds = 2.1): TicketRow {
  const kickoff = new Date(Date.UTC(2026, 8, 1 + i, 20)).toISOString();
  const recordedAt = new Date(Date.parse(kickoff) - 6 * 3600_000).toISOString();
  return {
    id: `t${i}`,
    matchId: `m${i}`,
    kickoff,
    recordedAt,
    home: `H${i}`,
    away: `A${i}`,
    market: "1X2_H",
    label: "Home",
    odds,
    book: "Unibet",
    stakePct: 0,
    modelProb: 0.52,
    ev: 0.08,
    dailyBest: false,
    kind: "mise",
    decision: "BET",
    league: "L1",
    pHome: 0.52,
    pDraw: 0.27,
    pAway: 0.21,
    result,
    learningContext: {
      capturedAt: recordedAt,
      modelDisagreement: 0.05,
      confidenceScore: 0.77,
      dataQuality: 0.84,
      tacticalReliability: 0.72,
      tacticalConflict: 0.04,
      directionalAgreement: 0.8,
      devilChallenge: 0.08,
      openingOdds: 2.2,
      quotedOdds: odds,
      oddsMove: odds / 2.2 - 1,
      absenceHomeImpact: 0,
      absenceAwayImpact: 1.1,
      restDiffDays: 2,
      congestionDiff: -1,
      travelAwayKm: 1000,
      importance: 0.9,
      missingInformationCount: 1,
      availableInformationCount: 10,
      lambdaHome: 1.7,
      lambdaAway: 0.9,
      homeFormation: "4-3-3",
      awayFormation: "4-2-3-1",
      features: { press: 0.7 },
    },
  };
}

test("learning memory keeps canonical 1X2 ROI isolated", () => {
  const rows = [row(1, "win", 2.2), row(2, "lose", 2.0)];
  const report = buildLearningMemory(rows, "2026-10-02T00:00:00.000Z");
  assert.equal(report.canonicalScope, "1X2_HOME_AWAY_1.80_3.00");
  assert.equal(report.canonicalSettledN, 2);
  assert.equal(report.canonicalWins, 1);
  assert.equal(report.canonicalLosses, 1);
  assert.ok(Math.abs((report.canonicalRoi ?? 0) - 0.1) < 1e-9);
});

test("pre-match causal factors survive settlement and are attributable", () => {
  const r = row(3, "lose", 2.05);
  const factors = factorsOf(r);
  assert.ok(factors.includes("market:1X2_H"));
  assert.ok(factors.includes("league:L1"));
  assert.ok(factors.includes("awayTravel:HIGH"));
  assert.ok(factors.includes("importance:HIGH"));
  assert.ok(factors.includes("infoCoverage:HIGH"));
});


test("honest pre-match 1X2 observations teach the learner even when no canonical bet was placed", () => {
  const observed = {
    ...row(6, "win", 2.15),
    kind: "prono" as const,
    decision: "WATCH" as const,
    stakePct: 0,
  };
  const report = buildLearningMemory([observed], "2026-10-02T00:00:00.000Z");
  assert.equal(report.canonicalSettledN, 0);
  assert.equal(report.canonicalRoi, null);
  assert.equal(report.learningSettledN, 1);
  assert.equal(report.learningWins, 1);
  assert.equal(report.learningLosses, 0);
  assert.ok((report.learningSimulatedRoi ?? 0) > 1);
  assert.equal(report.latestSettled[0]?.evidence, "OBSERVATIONAL_PREDICTION");
  assert.ok(report.factorPerformance.some((f) => f.factor === "market:1X2_H" && f.n === 1));
});

test("learning memory deduplicates prono and mise copies of the same canonical selection", () => {
  const mise = row(7, "lose", 2.2);
  const prono = {
    ...mise,
    id: "t7:prono",
    kind: "prono" as const,
    decision: "BET" as const,
    stakePct: 0,
    recordedAt: new Date(Date.parse(mise.recordedAt) - 1000).toISOString(),
  };
  const report = buildLearningMemory([prono, mise], "2026-10-02T00:00:00.000Z");
  assert.equal(report.learningSettledN, 1);
  assert.equal(report.canonicalSettledN, 1);
  assert.equal(report.latestSettled[0]?.evidence, "ACTUAL_BET");
});

test("secondary markets never contaminate canonical learning ROI", () => {
  const canonical = row(4, "win", 2.0);
  const secondary = {
    ...row(5, "lose", 2.0),
    id: "secondary",
    matchId: "secondary",
    market: "BTTS_Y" as const,
  };
  const report = buildLearningMemory([canonical, secondary], "2026-10-02T00:00:00.000Z");
  assert.equal(report.canonicalSettledN, 1);
  assert.equal(report.canonicalWins, 1);
  assert.equal(report.canonicalRoi, 1);
});


test("short-priced recent 1X2 settles into contextual learning without contaminating canonical ROI", () => {
  const observed = {
    ...row(20, "win", 1.38),
    kind: "prono" as const,
    decision: "NO_BET" as const,
    stakePct: 0,
    kickoff: "2026-10-06T19:00:00.000Z",
    recordedAt: "2026-10-06T18:00:00.000Z",
  };
  const report = buildLearningMemory([observed], "2026-10-06T21:30:00.000Z");
  assert.equal(report.canonicalSettledN, 0);
  assert.equal(report.learningSettledN, 0);
  assert.equal(report.contextualSettledN, 1);
  assert.equal(report.contextualWins, 1);
  assert.equal(report.contextualFreshness.status, "FRESH");
  assert.equal(report.contextualFreshness.settledLast24h, 1);
  assert.equal(report.latestContextSettled[0]?.market, "1X2_H");
  assert.ok(report.latestContextSettled[0]?.factors.includes("odds:<1.80"));
});

test("secondary market result teaches contextual memory but never canonical ROI", () => {
  const secondary = {
    ...row(21, "lose", 2.65),
    market: "BTTS_Y" as const,
    kickoff: "2026-10-06T19:00:00.000Z",
    recordedAt: "2026-10-06T18:00:00.000Z",
  };
  const report = buildLearningMemory([secondary], "2026-10-06T21:30:00.000Z");
  assert.equal(report.canonicalSettledN, 0);
  assert.equal(report.learningSettledN, 0);
  assert.equal(report.contextualSettledN, 1);
  assert.equal(report.contextualLosses, 1);
  assert.equal(report.contextualFreshness.status, "FRESH");
  assert.equal(report.latestContextSettled[0]?.market, "BTTS_Y");
});


test("international competition performance is split instead of pooled", () => {
  const nations = {
    ...row(30, "win", 2.0),
    id: "nations",
    matchId: "nations",
    league: "NL" as const,
    competition: "Ligue des nations",
    competitionKey: "uefa.nations",
  };
  const afconq = {
    ...row(31, "lose", 2.0),
    id: "afconq",
    matchId: "afconq",
    league: "NL" as const,
    competition: "Qualifications Coupe d'Afrique des Nations",
    competitionKey: "caf.nations_qual",
  };
  const wcaf = {
    ...row(32, "lose", 2.0),
    id: "wcaf",
    matchId: "wcaf",
    league: "NL" as const,
    competition: "Qualifications Coupe du monde - CAF",
    competitionKey: "fifa.worldq.caf",
  };
  const report = buildLearningMemory([nations, afconq, wcaf], "2026-10-07T00:00:00.000Z");

  const byKey = new Map(report.internationalCompetitionPerformance.map((x) => [x.competitionKey, x]));
  assert.equal(byKey.get("uefa.nations")?.n, 1);
  assert.equal(byKey.get("uefa.nations")?.wins, 1);
  assert.equal(byKey.get("caf.nations_qual")?.n, 1);
  assert.equal(byKey.get("caf.nations_qual")?.losses, 1);
  assert.equal(byKey.get("fifa.worldq.caf")?.n, 1);
  assert.equal(byKey.get("fifa.worldq.caf")?.losses, 1);

  const nationsFactors = report.latestContextSettled.find((x) => x.id === "nations")?.factors ?? [];
  assert.ok(nationsFactors.includes("competition:uefa.nations"));
  assert.ok(!nationsFactors.includes("competition:caf.nations_qual"));
});


test("international challenger remains collecting below honest sample gate", () => {
  const rows = Array.from({ length: 2 }, (_, i) => ({
    ...row(60 + i, "win", 2.0),
    id: `afconq-${i}`,
    matchId: `afconq-${i}`,
    league: "NL" as const,
    competition: "Qualifications Coupe d'Afrique des Nations",
    competitionKey: "caf.nations_qual",
  }));
  const report = buildLearningMemory(rows, "2026-10-07T00:00:00.000Z");
  const maturity = report.internationalMaturityByCompetition.find((x) => x.competitionKey === "caf.nations_qual");
  assert.equal(maturity?.settledN, 2);
  assert.equal(maturity?.status, "COLLECTING");
  assert.equal(maturity?.minForShadow, 28);
  assert.equal(maturity?.policyStatus, "SHADOW");
});


test("ROI circuit breaker pauses at 33 honest settled BETs with -16% ROI", () => {
  const settled = Array.from({ length: 33 }, (_, i) =>
    row(i, i < 12 ? "win" : "lose", 2.29),
  );
  const state = canonicalRiskState(settled);
  assert.equal(state.settledN, 33);
  assert.equal(state.wins, 12);
  assert.equal(state.losses, 21);
  assert.equal(state.status, "PAUSE");
  assert.ok((state.roi ?? 0) < -0.16);

  const bets: Array<{ decision: "BET" | "WATCH" | "NO_BET"; stakePct: number; premium: boolean; cover?: unknown; rejectionReason?: string }> = [
    { decision: "BET" as const, stakePct: 0.025, premium: true, cover: { odds: 8 }, rejectionReason: "" },
    { decision: "WATCH" as const, stakePct: 0, premium: false, rejectionReason: "" },
    { decision: "BET" as const, stakePct: 0.02, premium: false, rejectionReason: "" },
  ];
  assert.equal(applyCanonicalRiskBrakeToMarkets(bets, state), 2);
  assert.equal(bets[0]!.decision, "NO_BET");
  assert.equal(bets[0]!.stakePct, 0);
  assert.equal(bets[0]!.premium, false);
  assert.equal(bets[0]!.cover, undefined);
  assert.equal(bets[1]!.decision, "WATCH");
  assert.equal(bets[2]!.decision, "NO_BET");
  assert.equal(bets[2]!.stakePct, 0);
});

test("ROI circuit breaker leaves insufficient or positive honest samples untouched", () => {
  const small = Array.from({ length: 29 }, (_, i) => row(i, "lose", 2.0));
  const good = Array.from({ length: 33 }, (_, i) => row(i, i < 22 ? "win" : "lose", 2.0));
  assert.equal(canonicalRiskState(small).status, "CONTINUE");
  assert.equal(canonicalRiskState(good).status, "CONTINUE");
  const market = [{ decision: "BET" as const, stakePct: 0.02, premium: true }];
  assert.equal(applyCanonicalRiskBrakeToMarkets(market, canonicalRiskState(good)), 0);
  assert.equal(market[0]!.decision, "BET");
  assert.equal(market[0]!.stakePct, 0.02);
});

test("ROI safety accounting ignores archived, post-kickoff and observational rows", () => {
  const settled = Array.from({ length: 33 }, (_, i) =>
    row(i, i < 12 ? "win" : "lose", 2.29),
  );
  const copy = { ...settled[0]!, id: "duplicate-prono", kind: "prono" as const, decision: "WATCH" as const };
  const archive = { ...row(34, "win", 3.0), id: "archive", book: "clôture" };
  const hindsight = { ...row(35, "win", 2.9), id: "postmatch", recordedAt: row(35, "win", 2.9).kickoff };
  const observed = { ...row(36, "win", 2.6), id: "shadow", kind: "prono" as const, decision: "NO_BET" as const };
  const state = canonicalRiskState([...settled, copy, archive, hindsight, observed]);
  assert.equal(state.settledN, 33);
  assert.equal(state.wins, 12);
  assert.equal(state.status, "PAUSE");
});
