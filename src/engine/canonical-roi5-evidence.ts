import { loadArchiveHistory } from "./archive";
import { clamp, goalMatrix } from "./math";
import { pickCurrentMethod } from "./pick";
import { skipEuropeFrenchProno } from "./french-clubs";
import { discoverRoiChallenger, CONTINUOUS_ROI_CONFIG } from "./continuous-portfolio-learning";
import { portfolioMetrics, ruleMatches, type PortfolioRule, type PortfolioTicket } from "./portfolio-lab";
import { selectiveScoreHedge, DEFAULT_SCORE_HEDGE_POLICY } from "./selective-score-hedge";
import { lowScoringNoBetGate } from "./low-scoring-no-bet-gate";
import type { HistoricalMatch, LeagueId } from "./types";

export type CanonicalReplayEvidenceRow = {
  sequence: number;
  id: string;
  kickoff: string;
  league: LeagueId;
  home: string;
  away: string;
  selection: string;
  market: "1X2_H" | "1X2_A";
  odds: number;
  oddsSource: "synthetic-reconstructed";
  modelProb: number;
  dominanceMargin: number;
  score: string;
  result: "win" | "lose";
  mainStake: number;
  mainPnl: number;
  hedge: null | {
    score: string;
    odds: number;
    stake: number;
    hit: boolean;
    pnl: number;
    oddsSource: "synthetic-reconstructed";
  };
  totalStake: number;
  pnl: number;
  cumulativePnl: number;
  validation20: boolean;
};

export type CanonicalReplayEvidence = {
  generatedFrom: "archive-history";
  oddsDisclosure: string;
  scoreDisclosure: string;
  summary: {
    n: number;
    wins: number;
    losses: number;
    hitRate: number;
    profit: number;
    capital: number;
    roi: number;
    maxDrawdown: number;
    hedges: number;
    hedgeHits: number;
    validationN: number;
    validationWins: number;
    validationLosses: number;
    validationProfit: number;
    validationCapital: number;
    validationRoi: number;
    validationMaxDrawdown: number;
  };
  rows: CanonicalReplayEvidenceRow[];
};

type ReplayRow = PortfolioTicket & {
  id: string;
  homeName: string;
  awayName: string;
  goalsHome: number;
  goalsAway: number;
  p11: number;
  pOpp21: number;
  oppScore: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  dominanceMargin: number;
  scoringContext: {
    source: "MODEL_LAMBDA";
    expectedHomeGoals: number;
    expectedAwayGoals: number;
    zeroZeroProb: number;
    bttsProb: number;
    over25Prob: number;
  };
  lowBlocked: boolean;
};

let CACHE: CanonicalReplayEvidence | null = null;

function marketHits(m: "1X2_H" | "1X2_A", gh: number, ga: number): "win" | "lose" {
  if (m === "1X2_H") return gh > ga ? "win" : "lose";
  return gh < ga ? "win" : "lose";
}

function fairCoverOdds(p: number): { odds: number } {
  return { odds: clamp(1.08 / clamp(p, 0.035, 0.22), 5, 28) };
}

function lambdas(eH: number, eA: number) {
  const d = (eH - eA + 55) / 900;
  return {
    lh: clamp(1.18 * Math.pow(10, d * 0.55), 0.55, 2.7),
    la: clamp(1.08 * Math.pow(10, -d * 0.55), 0.5, 2.5),
  };
}

function price(p: number): number {
  return clamp(1 / Math.max(p * 1.05, 0.06), 1.12, 18);
}

function rowsFromHistory(history: HistoricalMatch[]): ReplayRow[] {
  const elo = new Map<string, number>();
  const get = (id: string) => elo.get(id) ?? 1700;
  const rows: ReplayRow[] = [];

  for (const h of [...history].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const eH = get(h.homeId);
    const eA = get(h.awayId);
    const { lh, la } = lambdas(eH, eA);
    const g = goalMatrix(lh, la, -0.1);
    const pick = pickCurrentMethod(
      { home: g.home, draw: g.draw, away: g.away },
      { home: price(g.home), draw: price(g.draw), away: price(g.away) },
      { skipDraw: h.league === "CL" || h.league === "EL" },
    );
    const homeName = h.homeName ?? h.homeId;
    const awayName = h.awayName ?? h.awayId;

    if (
      pick &&
      !skipEuropeFrenchProno({
        league: h.league,
        home: { id: h.homeId, name: homeName },
        away: { id: h.awayId, name: awayName },
      }) &&
      (pick.market === "1X2_H" || pick.market === "1X2_A") &&
      pick.odds >= 1.8 &&
      pick.odds <= 3.0
    ) {
      const opp: [number, number] = pick.market === "1X2_H" ? [1, 2] : [2, 1];
      const probs = [g.home, g.draw, g.away].sort((a, b) => b - a);
      const dominanceMargin = pick.modelProb - (probs[1] ?? 0);
      const scoringContext = {
        source: "MODEL_LAMBDA" as const,
        expectedHomeGoals: lh,
        expectedAwayGoals: la,
        zeroZeroProb: g.matrix[0]![0]!,
        bttsProb: g.bttsYes,
        over25Prob: g.over25,
      };
      const low = lowScoringNoBetGate(scoringContext);
      rows.push({
        id: h.id,
        kickoff: h.kickoff,
        league: h.league,
        homeName,
        awayName,
        market: pick.market,
        odds: pick.odds,
        modelProb: pick.modelProb,
        result: marketHits(pick.market, h.goalsHome, h.goalsAway),
        goalsHome: h.goalsHome,
        goalsAway: h.goalsAway,
        p11: g.matrix[1]![1]!,
        pOpp21: g.matrix[opp[0]]![opp[1]]!,
        oppScore: `${opp[0]}-${opp[1]}`,
        pHome: g.home,
        pDraw: g.draw,
        pAway: g.away,
        dominanceMargin,
        scoringContext,
        lowBlocked: low.blockBet,
      });
    }

    const score = h.goalsHome > h.goalsAway ? 1 : h.goalsHome === h.goalsAway ? 0.5 : 0;
    const exp = 1 / (1 + Math.pow(10, (eA - (eH + 55)) / 400));
    const k = 16;
    elo.set(h.homeId, clamp(eH + k * (score - exp), 1350, 2300));
    elo.set(h.awayId, clamp(eA + k * ((1 - score) - (1 - exp)), 1350, 2300));
  }

  return rows;
}

function baseRows(rows: ReplayRow[]): ReplayRow[] {
  return rows.filter((t) => t.odds >= 1.8 && t.odds <= 2.5);
}

function gate(
  baseline: ReturnType<typeof portfolioMetrics>,
  challenger: ReturnType<typeof portfolioMetrics>,
  cfg: typeof CONTINUOUS_ROI_CONFIG,
): boolean {
  if (challenger.n < cfg.minBlockN) return false;
  if (challenger.roi < (cfg.minAbsoluteRoi ?? 0)) return false;
  if (challenger.roi < baseline.roi + cfg.minRoiLift) return false;
  if (challenger.profit <= 0) return false;
  if (challenger.maxDrawdown > baseline.maxDrawdown * cfg.maxDrawdownMultiplier) return false;
  return true;
}

function selectPrequential(input: ReplayRow[]) {
  const cfg = { ...CONTINUOUS_ROI_CONFIG };
  const tickets = input
    .filter((t) => !t.lowBlocked && t.odds >= cfg.minOdds && t.odds <= cfg.maxOdds)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const start = Math.min(Math.max(cfg.warmup, cfg.minTotalN), tickets.length);
  let champion: PortfolioRule | null = null;
  const selected: ReplayRow[] = [];
  let promotions = 0;
  let rollbacks = 0;

  for (let at = start; at < tickets.length; at += cfg.retrainEvery) {
    const hist = tickets.slice(0, at);
    const future = tickets.slice(at, Math.min(tickets.length, at + cfg.retrainEvery));
    const recent = hist.slice(-Math.max(cfg.retrainEvery * 2, 700));
    const bmet = portfolioMetrics(baseRows(recent));
    const cand = discoverRoiChallenger(hist, cfg);
    const cmet = cand ? portfolioMetrics(recent.filter((t) => ruleMatches(t, cand.rule))) : null;
    let promoted = false;

    if (cand && cmet && gate(bmet, cmet, cfg)) {
      champion = cand.rule;
      promotions += 1;
      promoted = true;
    }

    if (champion) {
      const cm = portfolioMetrics(recent.filter((t) => ruleMatches(t, champion!)));
      const degraded =
        cm.n >= cfg.minBlockN &&
        (cm.roi < Math.max(bmet.roi, cfg.minAbsoluteRoi ?? 0) ||
          cm.maxDrawdown > bmet.maxDrawdown * cfg.maxDrawdownMultiplier);
      if (degraded && !promoted) {
        champion = null;
        rollbacks += 1;
      }
    }

    if (champion) selected.push(...future.filter((t) => ruleMatches(t, champion!)));
  }

  return { tickets, selected, promotions, rollbacks };
}

const GATE_MARGIN = 0.08;
const MIN_SEGMENT_EVIDENCE = 15;

function applyGateChronological(seq: ReplayRow[], initial: ReplayRow[] = []): ReplayRow[] {
  const counts = new Map<string, number>();
  for (const r of initial) {
    if (r.dominanceMargin >= GATE_MARGIN) {
      counts.set(r.league, (counts.get(r.league) ?? 0) + 1);
    }
  }
  const accepted: ReplayRow[] = [];
  for (const r of seq) {
    const qualified = r.dominanceMargin >= GATE_MARGIN;
    if (qualified && (counts.get(r.league) ?? 0) >= MIN_SEGMENT_EVIDENCE) accepted.push(r);
    if (qualified) counts.set(r.league, (counts.get(r.league) ?? 0) + 1);
  }
  return accepted;
}

function enrichRows(gated: ReplayRow[], validationIds: Set<string>): CanonicalReplayEvidenceRow[] {
  let cumulativePnl = 0;
  return gated.map((r, index) => {
    const win = r.result === "win";
    const mainPnl = win ? r.odds - 1 : -1;
    const o11 = fairCoverOdds(r.p11).odds;
    const oOpp = fairCoverOdds(r.pOpp21).odds;
    const decision = selectiveScoreHedge(
      {
        league: r.league,
        market: r.market,
        mainOdds: r.odds,
        mainStake: 1,
        mainModelProb: r.modelProb,
        p11: r.p11,
        pOpponent21: r.pOpp21,
        listed11Odds: o11,
        listedOpponent21Odds: oOpp,
        scoringContext: r.scoringContext,
      },
      DEFAULT_SCORE_HEDGE_POLICY,
    );
    const h = decision.selected;
    let hedge: CanonicalReplayEvidenceRow["hedge"] = null;
    let totalStake = 1;
    let pnl = mainPnl;

    if (h) {
      const finalScore = `${r.goalsHome}-${r.goalsAway}`;
      const hit = h.scoreLabel === finalScore;
      const hedgePnl = hit ? h.hedgeStake * (h.listedOdds - 1) : -h.hedgeStake;
      totalStake += h.hedgeStake;
      pnl += hedgePnl;
      hedge = {
        score: h.scoreLabel,
        odds: h.listedOdds,
        stake: h.hedgeStake,
        hit,
        pnl: hedgePnl,
        oddsSource: "synthetic-reconstructed",
      };
    }

    cumulativePnl += pnl;
    return {
      sequence: index + 1,
      id: r.id,
      kickoff: r.kickoff,
      league: r.league,
      home: r.homeName,
      away: r.awayName,
      selection: r.market === "1X2_H" ? r.homeName : r.awayName,
      market: r.market,
      odds: r.odds,
      oddsSource: "synthetic-reconstructed",
      modelProb: r.modelProb,
      dominanceMargin: r.dominanceMargin,
      score: `${r.goalsHome}-${r.goalsAway}`,
      result: r.result,
      mainStake: 1,
      mainPnl,
      hedge,
      totalStake,
      pnl,
      cumulativePnl,
      validation20: validationIds.has(r.id),
    };
  });
}

function metrics(rows: CanonicalReplayEvidenceRow[]) {
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let capital = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let hedges = 0;
  let hedgeHits = 0;

  for (const r of rows) {
    if (r.result === "win") wins += 1;
    else losses += 1;
    profit += r.pnl;
    capital += r.totalStake;
    equity += r.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    if (r.hedge) {
      hedges += 1;
      if (r.hedge.hit) hedgeHits += 1;
    }
  }

  return {
    n: rows.length,
    wins,
    losses,
    hitRate: rows.length ? wins / rows.length : 0,
    profit,
    capital,
    roi: capital ? profit / capital : 0,
    maxDrawdown,
    hedges,
    hedgeHits,
  };
}

export function canonicalRoi5Evidence(): CanonicalReplayEvidence {
  if (CACHE) return CACHE;
  const rows = rowsFromHistory(loadArchiveHistory());
  const replay = selectPrequential(rows);
  const baseSelected = replay.selected;
  const gated = applyGateChronological(baseSelected);
  const cut = Math.floor(baseSelected.length * 0.8);
  const validationBase = baseSelected.slice(cut);
  const development = baseSelected.slice(0, cut);
  const validationGated = applyGateChronological(validationBase, development);
  const validationIds = new Set(validationGated.map((r) => r.id));
  const evidenceRows = enrichRows(gated, validationIds);
  const all = metrics(evidenceRows);
  const validation = metrics(evidenceRows.filter((r) => r.validation20));

  CACHE = {
    generatedFrom: "archive-history",
    oddsDisclosure:
      "Les cotes du replay canonique sont synthétiques/reconstruites à partir des probabilités du modèle. Elles ne sont pas des cotes bookmaker horodatées.",
    scoreDisclosure:
      "Les scores finaux proviennent de l’archive historique des matchs utilisée par le replay.",
    summary: {
      ...all,
      validationN: validation.n,
      validationWins: validation.wins,
      validationLosses: validation.losses,
      validationProfit: validation.profit,
      validationCapital: validation.capital,
      validationRoi: validation.roi,
      validationMaxDrawdown: validation.maxDrawdown,
    },
    rows: evidenceRows,
  };
  return CACHE;
}

export function bustCanonicalRoi5Evidence(): void {
  CACHE = null;
}
