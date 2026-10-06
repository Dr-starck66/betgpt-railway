import { bestFreshMainQuote } from "./best-odds-engine.ts";
import { applyLowScoringNoBetGateToMarkets, type LowScoringContext } from "./low-scoring-no-bet-gate.ts";
import { applyRoi5DominanceGateToMarkets, DEFAULT_ROI5_DOMINANCE_POLICY, type Roi5DominancePolicy } from "./roi5-dominance-gate.ts";
import { applyRoiExpansionShadowGateToMarkets } from "./roi-league-expansion.ts";
import { hedgeXgEligibility } from "./hedge-xg-eligibility.ts";
import {
  ENGINE_VERSION,
  FEATURE_VERSION,
  TACTICAL_VERSION,
} from "./data";
import { findArchiveMatch, loadArchiveHistory, officialResult } from "./archive";
import { matchFromHistory, matchMatchesId } from "./history-match";
import { generateHistory, getLiveSnapshot, getUpcomingMatches, lookupTeam, hydrateLiveFromDisk } from "./live";
import { ensureArchiveBacktest, type ArchiveBacktest } from "./backtest";
import {
  attachAgreements,
  DEFAULT_AGENT_WEIGHTS,
  featureStore,
  runCoachAgents,
  runDevilsAdvocate,
  simulateScenarios,
  tacticalConsensus,
  tacticalMeta,
} from "./coach";
import { clamp, logit, mean, normalize3, sigmoid } from "./math";
import { FRENCH_EUROPE_NO_PRONO, skipEuropeFrenchProno } from "./french-clubs";
import { loadAdmin } from "./admin";
import { logoFor } from "@/lib/crests";
import { applyErrorLearn, EMPTY_LEARN, learnFromErrors, rowsForLearningScope, type ErrorLearn } from "./learn";
import { pickCurrentMethod, prettyPickLabel } from "./pick";
import { tightenFromLearn } from "./quality-pick";
import { enforceBetSafety } from "./bet-safety";
import { attachLiveIntel, INTEL_VERSION } from "./live-intel";
import { recordPredictionVersion, versionsFor } from "./prediction-versions";
import { buildDigest, publishDigest } from "./email";
import {
  marketHits,
  reviewOf,
  selfLearn,
  syncTickets,
  loadTickets,
  upsertHistoryPronos,
  pickCoverScore,
  fairCoverOdds,
  getTicket,
  canonicalChampionRows,
  type TicketRow,
} from "./ticket-log";
import { liveSuperBet } from "./live-super";
import { pushNewPredictions } from "./prediction-hook";
import { MIN_BET_ODDS, MAX_BET_ODDS, oddsPlayable } from "@/lib/markets";
import { adaptiveAllows, adaptiveSafetyBlock, buildAdaptiveLearningReport, scoreProspectiveTrust, type AdaptiveLearningReport } from "./adaptive-learning";
import { bestThree, estimateRho, runStatisticalStack, anchorToListedFavorite } from "./models";
import type {
  AblationRow,
  CalibratedProbs,
  ChampionshipBoard,
  CoachAgentId,
  Decision,
  DeskSummary,
  HistoricalMatch,
  Intelligence,
  LeagueId,
  MarketKind,
  MarketQuote,
  MatchInput,
  ModelMetric,
  ModelName,
  ModelOutput,
  PredictionRecord,
  ScoreProbs,
  TeamProfile,
} from "./types";

export type Learned = {
  rho: number;
  calMethod: CalibratedProbs["method"];
  platt: { a: number; b: number };
  tacticalReliability: number;
  agentWeights: Record<CoachAgentId, number>;
  championship: ChampionshipBoard;
  errorLearn: ErrorLearn;
  internationalErrorLearn: ErrorLearn;
};

export type EngineRun = {
  matches: MatchInput[];
  predictions: PredictionRecord[];
  dailyBest: { prediction: PredictionRecord; market: MarketQuote } | null;
  clPhaseBest: { prediction: PredictionRecord; market: MarketQuote; phaseLabel: string } | null;
  elPhaseBest: { prediction: PredictionRecord; market: MarketQuote; phaseLabel: string } | null;
  summary: DeskSummary;
  learned: Learned;
  historyN: number;
  liveAsOf: string;
  liveSource: string;
  liveWindow: string;
  liveStale: boolean;
  review: ReturnType<typeof reviewOf>;
  archive: ArchiveBacktest | null;
  adaptiveLearning: AdaptiveLearningReport;
};

const MIN_BET_EV = 0.038;
const MIN_BET_EDGE = 0.024;

function outcome3(gh: number, ga: number): [number, number, number] {
  if (gh > ga) return [1, 0, 0];
  if (gh === ga) return [0, 1, 0];
  return [0, 0, 1];
}

function brier3(p: { home: number; draw: number; away: number }, y: [number, number, number]): number {
  return (p.home - y[0]) ** 2 + (p.draw - y[1]) ** 2 + (p.away - y[2]) ** 2;
}

function logLoss3(p: { home: number; draw: number; away: number }, y: [number, number, number]): number {
  const ph = clamp(p.home, 1e-6, 1);
  const pd = clamp(p.draw, 1e-6, 1);
  const pa = clamp(p.away, 1e-6, 1);
  return -(y[0] * Math.log(ph) + y[1] * Math.log(pd) + y[2] * Math.log(pa));
}

function argmax3(p: { home: number; draw: number; away: number }): 0 | 1 | 2 {
  if (p.home >= p.draw && p.home >= p.away) return 0;
  if (p.draw >= p.away) return 1;
  return 2;
}

function learnPlatt(pairs: { p: number; y: number }[]): { a: number; b: number } {
  if (pairs.length < 20) return { a: 1, b: 0 };
  let a = 1;
  let b = 0;
  const lr = 0.25;
  for (let epoch = 0; epoch < 60; epoch++) {
    let ga = 0;
    let gb = 0;
    for (const row of pairs) {
      const z = a * logit(row.p) + b;
      const ph = sigmoid(z);
      const err = ph - row.y;
      ga += err * logit(row.p);
      gb += err;
    }
    a -= (lr * ga) / pairs.length;
    b -= (lr * gb) / pairs.length;
  }
  return { a: clamp(a, 0.4, 2.2), b: clamp(b, -0.8, 0.8) };
}

function applyPlatt(
  p: { home: number; draw: number; away: number },
  platt: { a: number; b: number },
): { home: number; draw: number; away: number } {
  const adj = (x: number) => sigmoid(platt.a * logit(x) + platt.b);
  return normalize3(adj(p.home), adj(p.draw), adj(p.away));
}

function eceScore(
  rows: { p: number; y: number }[],
  bins = 8,
): number {
  if (rows.length === 0) return 0;
  let acc = 0;
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const slice = rows.filter((r) => r.p >= lo && (b === bins - 1 ? r.p <= hi : r.p < hi));
    if (!slice.length) continue;
    const conf = mean(slice.map((r) => r.p));
    const freq = mean(slice.map((r) => r.y));
    acc += (slice.length / rows.length) * Math.abs(conf - freq);
  }
  return acc;
}

function finalizeMetric(
  name: string,
  briers: number[],
  losses: number[],
  hits: number[],
  dirs: number[],
  clvs: number[],
  rois: number[],
  eces: { p: number; y: number }[],
): ModelMetric {
  const n = briers.length;
  const roi = n ? mean(rois) : 0;
  return {
    name,
    n,
    brier: n ? mean(briers) : 0,
    logLoss: n ? mean(losses) : 0,
    accuracy: n ? mean(hits) : 0,
    directional: n ? mean(dirs) : 0,
    clv: n ? mean(clvs) : 0,
    roi,
    yield: roi,
    ece: eceScore(eces),
    hitRate: n ? mean(hits) : 0,
  };
}

function stubTeam(id: string, league: LeagueId, name?: string): TeamProfile {
  const label = name ?? id;
  return {
    id,
    name: label,
    short: label.slice(0, 3).toUpperCase(),
    league,
    attack: 1,
    defense: 1,
    elo: 1700,
    xgFor: 1.3,
    xgAgainst: 1.3,
    possession: 50,
    ppda: 11,
    fieldTilt: 50,
    progressivePasses: 40,
    highTurnovers: 7,
    recoveries: 46,
    compactness: 0.65,
    setPieceXg: 0.2,
    duelWin: 50,
    cardsPerGame: 2,
    flexibility: 0.55,
    pressLine: 0.55,
    buildup: 0.55,
    depth: 0.6,
    formation: "4-3-3",
    color: "#6b7c6e",
  };
}

function historicalInput(h: HistoricalMatch): MatchInput | null {
  const home = lookupTeam(h.homeId) ?? stubTeam(h.homeId, h.league, h.homeName);
  const away = lookupTeam(h.awayId) ?? stubTeam(h.awayId, h.league, h.awayName);
  const ts = h.kickoff;
  const low = {
    value: 7,
    source: "calendrier synthétique",
    timestamp: ts,
    confidence: 0.4,
    freshnessHours: 72,
  };
  const totalXg = clamp((home.xgFor + away.xgFor) / 2, 1.1, 3.2);
  const o25 = clamp(0.42 + (totalXg - 2.4) * 0.18, 0.38, 0.68);
  const margin = 1.055;
  const price = (p: number) => clamp(1 / (p * margin), 1.08, 15);
  const book = {
    book: "Pinnacle",
    home: h.closingHome,
    draw: h.closingDraw,
    away: h.closingAway,
    over15: price(clamp(o25 + 0.24, 0.62, 0.9)),
    over25: price(o25),
    over35: price(clamp(o25 - 0.22, 0.16, 0.48)),
    under25: price(1 - o25),
    bttsYes: price(clamp(0.5 + (totalXg - 2.4) * 0.1, 0.38, 0.68)),
    bttsNo: price(clamp(0.5 - (totalXg - 2.4) * 0.1, 0.32, 0.62)),
  };
  const opening = { ...book, book: "Opening", home: h.oddsHome, draw: h.oddsDraw, away: h.oddsAway };
  return {
    id: h.id,
    league: h.league,
    competition: h.league,
    kickoff: h.kickoff,
    venue: "n/a",
    home,
    away,
    restHome: low,
    restAway: { ...low },
    travelAwayKm: { value: 200, source: "distance synthétique", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    congestionHome: { value: 0.25, source: "fenêtre synthétique", timestamp: ts, confidence: 0.35, freshnessHours: 72 },
    congestionAway: { value: 0.25, source: "fenêtre synthétique", timestamp: ts, confidence: 0.35, freshnessHours: 72 },
    absencesHome: { value: [], source: "indisponible à T-72h", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    absencesAway: { value: [], source: "indisponible à T-72h", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    importance: { value: 0.55, source: "contexte ligue", timestamp: ts, confidence: 0.4, freshnessHours: 72 },
    opening,
    current: [book],
    notes: ["Feuille historique : absences et repos non observés au coup d'envoi simulé."],
  };
}

function matchFromTicket(row: TicketRow): MatchInput | null {
  if (!row.matchId || !row.home || !row.away || !row.kickoff) return null;
  const league = row.league ?? "L1";
  const hist: HistoricalMatch = {
    id: row.matchId,
    league,
    kickoff: row.kickoff,
    homeId: row.home,
    awayId: row.away,
    homeName: row.home,
    awayName: row.away,
    goalsHome: row.goalsHome ?? 0,
    goalsAway: row.goalsAway ?? 0,
    oddsHome: row.market === "1X2_H" ? row.odds : 0,
    oddsDraw: row.market === "1X2_D" ? row.odds : 0,
    oddsAway: row.market === "1X2_A" ? row.odds : 0,
    closingHome: row.closingOdds && row.market === "1X2_H" ? row.closingOdds : 0,
    closingDraw: 0,
    closingAway: 0,
    sourceKind: "official-history",
  };
  if (row.goalsHome != null && row.goalsAway != null) return matchFromHistory(hist);
  const match = historicalInput(hist);
  if (!match) return null;
  const ko = Date.parse(row.kickoff);
  if (Number.isFinite(ko) && ko < Date.now()) match.status = "finished";
  return match;
}

export { matchFromHistory } from "./history-match";

function oddsStability(match: MatchInput): number {
  const cur = bestThree(match);
  const dh = Math.abs(Math.log(cur.home / Math.max(match.opening.home, 1.01)));
  return clamp(1 - dh * 2.4, 0.28, 1);
}

function calibrateEnsemble(ens: ScoreProbs, platt: { a: number; b: number }): CalibratedProbs {
  const n = applyPlatt(ens, platt);
  const shrink = 0.12;
  const over25 = ens.over25 * (1 - shrink) + 0.52 * shrink;
  const over15 = ens.over15 * (1 - shrink) + 0.76 * shrink;
  const over35 = ens.over35 * (1 - shrink) + 0.28 * shrink;
  const bttsYes = ens.bttsYes * (1 - shrink) + 0.52 * shrink;
  return {
    ...n,
    over15: clamp(over15, 0.45, 0.95),
    over25: clamp(over25, 0.28, 0.82),
    over35: clamp(over35, 0.1, 0.6),
    under25: 1 - clamp(over25, 0.28, 0.82),
    bttsYes: clamp(bttsYes, 0.28, 0.82),
    bttsNo: 1 - clamp(bttsYes, 0.28, 0.82),
    method: "platt",
    version: "platt-1.0.0",
  };
}

function marketProb(cal: CalibratedProbs, kind: MarketKind): number {
  switch (kind) {
    case "1X2_H":
      return cal.home;
    case "1X2_D":
      return cal.draw;
    case "1X2_A":
      return cal.away;
    case "DC_1X":
      return cal.home + cal.draw;
    case "DC_X2":
      return cal.draw + cal.away;
    case "DC_12":
      return cal.home + cal.away;
    case "DNB_H":
      return cal.home / Math.max(cal.home + cal.away, 1e-6);
    case "DNB_A":
      return cal.away / Math.max(cal.home + cal.away, 1e-6);
    case "OU_15_O":
      return cal.over15;
    case "OU_25_O":
      return cal.over25;
    case "OU_35_O":
      return cal.over35;
    case "OU_25_U":
      return cal.under25;
    case "BTTS_Y":
      return cal.bttsYes;
    case "BTTS_N":
      return cal.bttsNo;
  }
}

function listedPrice(n: number | undefined): boolean {
  return typeof n === "number" && n >= 1.05 && n <= 80;
}

function listedMarket(match: MatchInput, kind: MarketKind): boolean {
  const books = (match.current ?? []).filter((b) => listedPrice(b.home) && listedPrice(b.draw) && listedPrice(b.away));
  if (!books.length) return false;
  if (kind === "1X2_H" || kind === "1X2_D" || kind === "1X2_A") return true;
  if (kind === "DC_1X" || kind === "DC_X2" || kind === "DC_12" || kind === "DNB_H" || kind === "DNB_A") return false;
  if (kind === "OU_25_O") return books.some((b) => listedPrice(b.over25));
  if (kind === "OU_25_U") return books.some((b) => listedPrice(b.under25));
  if (kind === "OU_15_O") return books.some((b) => listedPrice(b.over15));
  if (kind === "OU_35_O") return books.some((b) => listedPrice(b.over35));
  if (kind === "BTTS_Y") return books.some((b) => listedPrice(b.bttsYes));
  if (kind === "BTTS_N") return books.some((b) => listedPrice(b.bttsNo));
  return false;
}

function bookOddsFor(match: MatchInput, kind: MarketKind): { odds: number; book: string; url?: string } {
  const b = bestThree(match);
  const liveTimestamped = (match.current ?? []).some((x) => Boolean(x.observedAt));
  if (kind === "1X2_H" || kind === "1X2_D" || kind === "1X2_A") {
    const q = bestFreshMainQuote(match.current ?? [], kind, { requireTimestamp: liveTimestamped });
    if (q) return { odds: q.odds, book: q.book, url: q.url };
  }
  switch (kind) {
    case "1X2_H":
      return { odds: b.home, book: b.books.home, url: b.urls.home };
    case "1X2_D":
      return { odds: b.draw, book: b.books.draw, url: b.urls.draw };
    case "1X2_A":
      return { odds: b.away, book: b.books.away, url: b.urls.away };
    case "DC_1X":
      return { odds: 1 / (1 / b.home + 1 / b.draw), book: b.books.home, url: b.urls.home };
    case "DC_X2":
      return { odds: 1 / (1 / b.draw + 1 / b.away), book: b.books.away, url: b.urls.away };
    case "DC_12":
      return { odds: 1 / (1 / b.home + 1 / b.away), book: b.books.home, url: b.urls.home };
    case "DNB_H":
      return { odds: 1 + b.home / b.away, book: b.books.home, url: b.urls.home };
    case "DNB_A":
      return { odds: 1 + b.away / b.home, book: b.books.away, url: b.urls.away };
    case "OU_15_O":
      return { odds: b.over15, book: b.books.over15, url: b.urls.over15 };
    case "OU_25_O":
      return { odds: b.over25, book: b.books.over25, url: b.urls.over25 };
    case "OU_35_O":
      return { odds: b.over35, book: b.books.over35, url: b.urls.over35 };
    case "OU_25_U":
      return { odds: b.under25, book: b.books.under25, url: b.urls.under25 };
    case "BTTS_Y":
      return { odds: b.bttsYes, book: b.books.bttsYes, url: b.urls.bttsYes };
    case "BTTS_N":
      return { odds: b.bttsNo, book: b.books.bttsNo, url: b.urls.bttsNo };
  }
}

const MARKET_META: Record<
  MarketKind,
  { label: string; group: string; selection: string }
> = {
  "1X2_H": { label: "1 — Domicile", group: "1X2", selection: "1" },
  "1X2_D": { label: "X — Nul", group: "1X2", selection: "X" },
  "1X2_A": { label: "2 — Extérieur", group: "1X2", selection: "2" },
  DC_1X: { label: "Double chance 1X", group: "Double chance", selection: "1X" },
  DC_X2: { label: "Double chance X2", group: "Double chance", selection: "X2" },
  DC_12: { label: "Double chance 12", group: "Double chance", selection: "12" },
  DNB_H: { label: "Draw no bet — 1", group: "Draw no bet", selection: "1" },
  DNB_A: { label: "Draw no bet — 2", group: "Draw no bet", selection: "2" },
  OU_15_O: { label: "Plus de 1,5 buts", group: "Buts", selection: "O1.5" },
  OU_25_O: { label: "Plus de 2,5 buts", group: "Buts", selection: "O2.5" },
  OU_35_O: { label: "Plus de 3,5 buts", group: "Buts", selection: "O3.5" },
  OU_25_U: { label: "Moins de 2,5 buts", group: "Buts", selection: "U2.5" },
  BTTS_Y: { label: "Les deux équipes marquent — Oui", group: "BTTS", selection: "Oui" },
  BTTS_N: { label: "Les deux équipes marquent — Non", group: "BTTS", selection: "Non" },
};

function thresholds(league?: LeagueId) {
  const a = loadAdmin();
  const scopedLearn = league === "NL" ? LEARNED?.internationalErrorLearn : LEARNED?.errorLearn;
  const fallbackRows = rowsForLearningScope(loadTickets(), league === "NL" ? "INTERNATIONAL" : "CLUB");
  const extra = scopedLearn?.extraMinEv ?? selfLearn(fallbackRows).extraMinEv;
  return {
    minEv: a.minEv + extra,
    minEdge: a.minEdge,
    freeze: a.freezeBets,
    maxStake: a.maxStake,
    maxBook: a.maxBook,
    leagues: a.leagues,
    maxOdds1x2: scopedLearn?.maxOdds1x2 ?? 4.2,
    banDrawBet: scopedLearn?.banDrawBet ?? false,
  };
}

function decide(
  ev: number,
  edge: number,
  odds: number,
  intel: Intelligence,
  conflict: number,
  devil: number,
  agreement: number,
  kind: MarketKind,
  league: LeagueId,
): { decision: Decision; rejectionReason?: string } {
  const t = thresholds(league);
  if (t.freeze) {
    return { decision: "WATCH", rejectionReason: "Mises gelées depuis les réglages." };
  }
  if (ev <= 0) {
    return {
      decision: "NO_BET",
      rejectionReason: "La cote n'est pas assez payée. On passe.",
    };
  }
  if (kind === "1X2_H" && odds < 1.8) {
    return { decision: "WATCH", rejectionReason: "Domicile trop court : ça gagne souvent, ça ne paie pas assez." };
  }
  if (kind === "1X2_H" && odds > 2.75) {
    return { decision: "WATCH", rejectionReason: "Domicile trop long : sur 5 ans ça ne tient pas." };
  }
  if (kind === "1X2_A" && odds < 2) {
    return { decision: "WATCH", rejectionReason: "Extérieur trop court." };
  }
  if (kind === "1X2_A" && odds > 3.2) {
    return { decision: "WATCH", rejectionReason: "Extérieur trop long." };
  }
  if (kind === "1X2_D" && (odds < 3.05 || odds > 3.85 || edge < 0.08 || ev < 0.12)) {
    return {
      decision: "WATCH",
      rejectionReason: "Les nuls trop souvent pris ont perdu de l'argent sur 5 ans. On n'y touche que si la cote est vraiment trop généreuse.",
    };
  }
  const tLearn = t;
  if (tLearn.banDrawBet && kind === "1X2_D") {
    return { decision: "WATCH", rejectionReason: "Le desk a perdu sur des nuls récents. Plus de mise sur le X." };
  }
  if ((kind === "1X2_H" || kind === "1X2_A" || kind === "1X2_D") && odds > tLearn.maxOdds1x2) {
    return { decision: "NO_BET", rejectionReason: "Cote trop longue : une perte récente a baissé le plafond." };
  }
  if (devil > 0.72 || conflict > 0.75) {
    return {
      decision: "NO_BET",
      rejectionReason: "Trop d'incertitude sur ce match. On ne force pas.",
    };
  }
  if (intel.dataQuality < 0.38) {
    return {
      decision: "WATCH",
      rejectionReason: "Pas assez d'infos fiables pour miser.",
    };
  }
  if (ev < t.minEv || edge < t.minEdge) {
    return { decision: "WATCH", rejectionReason: "L'écart est trop petit pour miser." };
  }
  if (odds < MIN_BET_ODDS) {
    return { decision: "WATCH", rejectionReason: "Cote trop courte : pas sous 1,80." };
  }
  if (devil > 0.58 || conflict > 0.62) {
    return { decision: "WATCH", rejectionReason: "Match trop ouvert. On regarde, on ne mise pas." };
  }
  if (intel.confidenceScore < 0.28) {
    return { decision: "WATCH", rejectionReason: "On n'est pas assez sûr." };
  }
  if (agreement < 0.22 && intel.confidenceScore < 0.5) {
    return { decision: "WATCH", rejectionReason: "Les chiffres et le match ne disent pas la même chose." };
  }
  return { decision: "BET" };
}

function quarterKelly(p: number, odds: number, ev: number): number {
  const b = odds - 1;
  if (b <= 0 || ev <= 0) return 0;
  return clamp((0.25 * ev) / b, 0, thresholds().maxStake);
}

function isPremiumQuote(input: {
  kind: MarketKind;
  decision: Decision;
  listed: boolean;
  modelProb: number;
  odds: number;
  edge: number;
  ev: number;
  score: number;
}): boolean {
  if (input.decision !== "BET" || !input.listed) return false;
  if (input.kind === "1X2_D") {
    return input.ev >= 0.16 && input.edge >= 0.1 && input.modelProb >= 0.32 && input.odds >= 3.05;
  }
  if (input.kind === "1X2_H") {
    return (
      input.odds >= 1.85 &&
      input.odds <= 2.65 &&
      input.modelProb >= 0.48 &&
      input.edge >= 0.03 &&
      input.ev >= 0.05 &&
      input.score >= 52
    );
  }
  if (input.kind === "1X2_A") {
    return (
      input.odds >= 2.05 &&
      input.odds <= 2.9 &&
      input.modelProb >= 0.42 &&
      input.edge >= 0.04 &&
      input.ev >= 0.06 &&
      input.score >= 52
    );
  }
  return input.modelProb >= 0.52 && input.ev >= 0.08 && input.score >= 60;
}

function sizedStake(
  p: number,
  odds: number,
  ev: number,
  intel: Intelligence,
  premium: boolean,
  league?: LeagueId,
): number {
  const b = odds - 1;
  if (b <= 0 || ev <= 0) return 0;
  const frac = premium ? 0.32 : 0.16;
  const raw = (frac * ev) / b;
  const chance = 0.5 + p;
  const conf = 0.7 + 0.55 * intel.confidenceScore;
  const floor = premium ? 0.018 : 0.008;
  return clamp(raw * chance * conf, floor, thresholds(league).maxStake);
}

function opportunityScore(input: {
  ev: number;
  edge: number;
  intel: Intelligence;
  conflict: number;
  devil: number;
  agreement: number;
  stability: number;
}): number {
  const s =
    38 * clamp(input.ev / 0.14, 0, 1) +
    14 * clamp(input.edge / 0.1, 0, 1) +
    14 * input.intel.confidenceScore +
    10 * (1 - input.conflict) +
    8 * input.intel.dataQuality +
    8 * (1 - input.devil) +
    4 * input.agreement +
    4 * input.stability;
  return clamp(s, 0, 100);
}

function valueMarkets(
  match: MatchInput,
  cal: CalibratedProbs,
  intel: Intelligence,
  conflict: number,
  devil: number,
  agreement: number,
  matrix: number[][] | undefined,
  scoringContext?: LowScoringContext,
  roi5Policy?: Roi5DominancePolicy,
): MarketQuote[] {
  const stability = oddsStability(match);
  const kinds = Object.keys(MARKET_META) as MarketKind[];
  const quotes = kinds.map((kind) => {
    const meta = MARKET_META[kind];
    const modelProb = marketProb(cal, kind);
    const { odds, book, url } = bookOddsFor(match, kind);
    const listed = listedMarket(match, kind) && listedPrice(odds);
    const implied = listed ? 1 / odds : 0;
    const edge = listed ? modelProb - implied : 0;
    const ev = listed ? modelProb * odds - 1 : 0;
    let decision: Decision = "NO_BET";
    let rejectionReason: string | undefined = listed ? undefined : "Cote non listée chez un book FR. On n'invente pas.";
    if (listed) {
      const d = decide(ev, edge, odds, intel, conflict, devil, agreement, kind, match.league);
      decision = d.decision;
      rejectionReason = d.rejectionReason;
    }
    if (skipEuropeFrenchProno(match)) {
      decision = "NO_BET";
      rejectionReason = FRENCH_EUROPE_NO_PRONO;
    }
    if (
      decision !== "NO_BET" &&
      (kind === "1X2_H" || kind === "1X2_A" || kind === "1X2_D") &&
      (odds >= 5 || modelProb < 0.22)
    ) {
      decision = "NO_BET";
      rejectionReason = "Outsider trop long : ce n’est pas un prono, c’est une loterie.";
    }
    if (decision === "BET" && !listed) {
      decision = "WATCH";
      rejectionReason = "Cette cote n'est pas affichée chez le book. On ne mise pas dessus.";
    }
    const score = opportunityScore({
      ev,
      edge,
      intel,
      conflict,
      devil,
      agreement,
      stability,
    });
    const premium = isPremiumQuote({
      kind,
      decision,
      listed,
      modelProb,
      odds,
      edge,
      ev,
      score,
    });
    return {
      market: kind,
      label: meta.label,
      group: meta.group,
      selection: meta.selection,
      modelProb,
      fairOdds: clamp(1 / Math.max(modelProb, 0.04), 1.05, 25),
      bestOdds: odds,
      bestBook: listed ? book : book ? `${book} · non listé` : "non listé",
      bestBookUrl: url,
      implied,
      edge,
      ev,
      stakePct: decision === "BET" ? sizedStake(modelProb, odds, ev, intel, premium, match.league) : 0,
      listed,
      premium,
      opportunityScore: decision === "NO_BET" ? score * 0.35 : score,
      decision,
      rejectionReason,
    };
  });
  attachCovers(quotes, match, matrix, scoringContext);
  applyEuropeDesk(quotes, match, intel);
  collapseToOneBet(quotes);
  enforceBetSafety(quotes, match);

  applyLowScoringNoBetGateToMarkets(quotes, scoringContext);
  applyRoi5DominanceGateToMarkets(quotes, {
    league: match.league,
    kickoff: match.kickoff,
    probabilities: { home: cal.home, draw: cal.draw, away: cal.away },
    history: loadTickets(),
    policy: roi5Policy,
  });
  applyRoiExpansionShadowGateToMarkets(quotes, match.league);
  return quotes;
}

function applyEuropeDesk(quotes: MarketQuote[], match: MatchInput, intel: Intelligence): void {
  if (match.league !== "CL" && match.league !== "EL") return;
  if (skipEuropeFrenchProno(match)) {
    for (const q of quotes) {
      q.decision = "NO_BET";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = FRENCH_EUROPE_NO_PRONO;
    }
    return;
  }
  const one = quotes.filter((q) => q.group === "1X2");
  const fav = [...one].sort((a, b) => b.modelProb - a.modelProb)[0];
  for (const q of quotes) {
    if (q.group !== "1X2") {
      if (q.decision === "BET") {
        q.decision = "WATCH";
        q.stakePct = 0;
        q.premium = false;
        q.rejectionReason = "C1/Europa : seulement le 1-N-2 le plus probable.";
      }
      continue;
    }
    if (q !== fav) {
      q.decision = "NO_BET";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = "C1/Europa : un seul ticket par match, jamais l’autre face.";
      continue;
    }
    if (q.market === "1X2_D") {
      q.decision = "WATCH";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = "C1/Europa : on ne mise pas le nul.";
      continue;
    }
    if (q.bestOdds >= 4.05 || q.modelProb < 0.32) {
      q.decision = "WATCH";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = "C1/Europa : écart trop mince, on surveille.";
      continue;
    }
    if (q.bestOdds < MIN_BET_ODDS || !q.listed) {
      q.decision = "WATCH";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = "C1/Europa : trop court (sous 1,80) ou cote non listée. On regarde.";
      continue;
    }
    if (q.decision !== "BET") continue;
    q.rejectionReason = undefined;
    const ev = q.ev;
    q.premium = isPremiumQuote({
      kind: q.market,
      decision: "BET",
      listed: q.listed,
      modelProb: q.modelProb,
      odds: q.bestOdds,
      edge: q.edge,
      ev,
      score: q.opportunityScore,
    });
    q.stakePct = sizedStake(q.modelProb, q.bestOdds, ev, intel, q.premium, match.league);
  }
}

function collapseToOneBet(quotes: MarketQuote[]): void {
  for (const q of quotes) {
    if (q.decision === "BET" && q.bestOdds < MIN_BET_ODDS) {
      q.decision = "WATCH";
      q.stakePct = 0;
      q.premium = false;
      q.rejectionReason = "Cote trop courte : pas sous 1,80.";
    }
  }
  const bets = quotes.filter((q) => q.decision === "BET");
  if (bets.length <= 1) return;
  const keep = [...bets].sort((a, b) => {
    const sane = (m: MarketQuote) => (m.group === "1X2" && m.modelProb >= 0.28 && oddsPlayable(m.bestOdds) ? 1 : 0);
    if (sane(b) !== sane(a)) return sane(b) - sane(a);
    return b.modelProb - a.modelProb;
  })[0]!;
  for (const q of bets) {
    if (q === keep) continue;
    q.decision = "NO_BET";
    q.stakePct = 0;
    q.premium = false;
    q.rejectionReason = "Un seul ticket par match. L’autre face est fermée.";
  }
}

function attachCovers(
  quotes: MarketQuote[],
  match: MatchInput,
  matrix: number[][] | undefined,
  scoringContext?: LowScoringContext,
): void {
  const links = bookLinksOf(match);
  const listed = listedCorrectScores(match);
  for (const q of quotes) {
    const picked = pickListedCover(matrix, q.market, listed, scoringContext);
    if (!picked) {
      q.cover = undefined;
      continue;
    }
    const odds = picked.odds;
    const S = q.stakePct > 0 ? q.stakePct : 0;
    const H = odds > 1.05 && S > 0 ? S / (2 * odds - 1) : 0;
    const url = picked.url ?? links.find((l) => l.book === picked.book)?.url ?? q.bestBookUrl;
    q.cover = {
      market: "CS",
      label: `Score exact ${picked.label}`,
      selection: picked.label,
      odds,
      book: picked.book,
      url,
      listed: true,
      stakePct: H,
      totalStakePct: S + H,
      ifMainWins: S * (q.bestOdds - 1) - H,
      ifCoverWins: H * (odds - 1) - S,
    };
  }
}

function listedCorrectScores(match: MatchInput): Record<string, { odds: number; book: string; url?: string }> {
  const out: Record<string, { odds: number; book: string; url?: string }> = {};
  const currentBooks = match.current ?? [];
  const anyTimestamped = currentBooks.some((b) => Boolean(b.observedAt));
  const books = anyTimestamped
    ? currentBooks.filter((b) => {
        if (!b.observedAt) return false;
        const age = Date.now() - Date.parse(b.observedAt);
        return Number.isFinite(age) && age >= -60_000 && age <= 5 * 60_000;
      })
    : currentBooks;
  for (const b of books) {
    const map = b.cs ?? {};
    if (b.cs11 && !map["1-1"]) map["1-1"] = b.cs11;
    for (const [sel, odds] of Object.entries(map)) {
      if (!odds || odds < 4.5) continue;
      const prev = out[sel];
      if (!prev || odds > prev.odds + 0.001) out[sel] = { odds, book: b.book, url: b.url };
    }
  }
  return out;
}

function pickListedCover(
  matrix: number[][] | undefined,
  market: MarketKind,
  listed: Record<string, { odds: number; book: string; url?: string }>,
  scoringContext?: LowScoringContext,
): { label: string; odds: number; book: string; url?: string } | null {
  if (market !== "1X2_H" && market !== "1X2_A") return null;
  if (!scoringContext) return null;

  const xg = hedgeXgEligibility({ market, ...scoringContext });
  const opponent21 = market === "1X2_H" ? "1-2" : "2-1";
  const candidates: { label: string; odds: number; book: string; url?: string; contribution: number }[] = [];

  if (xg.oneOne && listed["1-1"]) {
    const quote = listed["1-1"]!;
    const p = matrix?.[1]?.[1] ?? 0;
    const ev = p * quote.odds - 1;
    if (ev >= 0.05) candidates.push({ label: "1-1", ...quote, contribution: ev / Math.max(quote.odds - 1, 1) });
  }
  if (xg.opponent21 && listed[opponent21]) {
    const quote = listed[opponent21]!;
    const [hg, ag] = opponent21.split("-").map(Number);
    const p = matrix?.[hg]?.[ag] ?? 0;
    const ev = p * quote.odds - 1;
    if (ev >= 0.05) candidates.push({ label: opponent21, ...quote, contribution: ev / Math.max(quote.odds - 1, 1) });
  }

  candidates.sort((a, b) => b.contribution - a.contribution);
  const best = candidates[0];
  return best ? { label: best.label, odds: best.odds, book: best.book, url: best.url } : null;
}

function bookLinksOf(match: MatchInput): { book: string; url: string }[] {
  const raw = match.ticketLinks?.length
    ? match.ticketLinks
    : (match.current ?? []).filter((b) => b.url).map((b) => ({ book: b.book, url: b.url! }));
  const seen = new Set<string>();
  return raw.filter((l) => {
    const k = l.book.toLowerCase();
    if (!l.url) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function dataQualityOf(match: MatchInput): number {
  const liveOdds = match.oddsSource && match.oddsSource !== "modèle" ? 1 : 0;
  const form = match.formHome && match.formAway ? 1 : 0;
  const venue = match.venue && match.venue !== "Stade" ? 1 : 0;
  return clamp(0.56 + 0.18 * liveOdds + 0.1 * form + 0.08 * venue + 0.06 * match.importance.confidence, 0.5, 0.9);
}

export function buildPrediction(match: MatchInput, learned: Learned, roi5Policy: Roi5DominancePolicy = DEFAULT_ROI5_DOMINANCE_POLICY): PredictionRecord {
  const { models, ensemble } = runStatisticalStack(match, learned.rho);
  const calibratedStat = calibrateEnsemble(ensemble, learned.platt);
  const coaches = runCoachAgents(match, learned.agentWeights);
  let consensus = tacticalConsensus(coaches);
  const market = models.find((m) => m.model === "market") ?? models[0]!;
  consensus = attachAgreements(consensus, calibratedStat, market);
  const devil = runDevilsAdvocate(match, consensus, ensemble, coaches);
  const meta = tacticalMeta(calibratedStat, consensus, learned.tacticalReliability);
  const blended = anchorToListedFavorite(
    applyErrorLearn(
      meta.blended,
      match.league,
      match.league === "NL" ? learned.internationalErrorLearn ?? EMPTY_LEARN : learned.errorLearn ?? EMPTY_LEARN,
    ),
    market,
  );
  const cal: CalibratedProbs = {
    ...calibratedStat,
    home: blended.home,
    draw: blended.draw,
    away: blended.away,
  };
  const dq = dataQualityOf(match);
  const confidence = clamp(
    (1 - ensemble.disagreement) *
      dq *
      (1 - devil.confidenceReduction) *
      (1 - consensus.conflictScore * 0.45),
    0.12,
    0.92,
  );
  const intel: Intelligence = {
    modelDisagreement: ensemble.disagreement,
    confidenceScore: confidence,
    dataQuality: dq,
  };
  const markets = valueMarkets(
    match,
    cal,
    intel,
    consensus.conflictScore,
    devil.predictionChallengeScore,
    consensus.statisticalAgreement,
    ensemble.matrix,
    {
      source: "MODEL_LAMBDA",
      expectedHomeGoals: ensemble.lambdaHome,
      expectedAwayGoals: ensemble.lambdaAway,
      zeroZeroProb: ensemble.matrix?.[0]?.[0] ?? null,
      bttsProb: cal.bttsYes,
      over25Prob: cal.over25,
    },
    roi5Policy,
  );
  const dailyBestCandidate = markets.some((m) => m.decision === "BET");
  const weights = Object.fromEntries(coaches.map((c) => [c.agent, c.weight])) as Record<
    CoachAgentId,
    number
  >;
  return {
    matchId: match.id,
    engineVersion: ENGINE_VERSION,
    tacticalVersion: TACTICAL_VERSION,
    kickoff: match.kickoff,
    league: match.league,
    competition: match.competition,
    venue: match.venue,
    home: {
      id: match.home.id,
      name: match.home.name,
      short: match.home.short,
      formation: match.home.formation,
      logo: logoFor(match.home.name, match.home.id, match.home.logo),
      color: match.home.color,
    },
    away: {
      id: match.away.id,
      name: match.away.name,
      short: match.away.short,
      formation: match.away.formation,
      logo: logoFor(match.away.name, match.away.id, match.away.logo),
      color: match.away.color,
    },
    models,
    ensemble,
    calibrated: cal,
    intelligence: intel,
    coaches,
    agentWeights: weights,
    consensus,
    devil,
    meta,
    features: featureStore(match, coaches),
    scenarios: simulateScenarios(match, {
      ...ensemble,
      home: cal.home,
      draw: cal.draw,
      away: cal.away,
      over25: cal.over25,
      bttsYes: cal.bttsYes,
    }),
    markets,
    bookLinks: bookLinksOf(match),
    dailyBestCandidate,
    notes: match.notes,
    liveSuper: liveSuperBet(match, { ensemble, calibrated: cal }),
    availableInformation: [
      "calendrier et classements officiels",
      match.oddsSource ? `cotes ${match.oddsSource}` : "pas de cote bookmaker",
      match.formHome && match.formAway ? "forme récente listée" : "forme récente inconnue",
      (match.absencesHome.value?.length ?? 0) + (match.absencesAway.value?.length ?? 0)
        ? "absences listées (XI non confirmé)"
        : "absences non listées",
      match.restHome?.source ? `repos : ${match.restHome.source}` : "repos non observé",
      `features ${FEATURE_VERSION}`,
      `intel ${INTEL_VERSION}`,
    ],
    timestamp: new Date().toISOString(),
  };
}

type HistRow = {
  h: HistoricalMatch;
  match: MatchInput;
  models: ModelOutput[];
  ensemble: ScoreProbs;
  y: [number, number, number];
  coaches: ReturnType<typeof runCoachAgents>;
  consensus: ReturnType<typeof tacticalConsensus>;
};

function collectHistory(history: HistoricalMatch[], rho: number): HistRow[] {
  const rows: HistRow[] = [];
  for (const h of history) {
    const match = historicalInput(h);
    if (!match) continue;
    const { models, ensemble } = runStatisticalStack(match, rho);
    const coaches = runCoachAgents(match);
    const consensus = tacticalConsensus(coaches);
    rows.push({
      h,
      match,
      models,
      ensemble,
      y: outcome3(h.goalsHome, h.goalsAway),
      coaches,
      consensus,
    });
  }
  return rows;
}

function metricFromRows(
  name: string,
  rows: HistRow[],
  pick: (row: HistRow) => { home: number; draw: number; away: number },
): ModelMetric {
  const briers: number[] = [];
  const losses: number[] = [];
  const hits: number[] = [];
  const dirs: number[] = [];
  const clvs: number[] = [];
  const rois: number[] = [];
  const eces: { p: number; y: number }[] = [];
  for (const row of rows) {
    const p = pick(row);
    briers.push(brier3(p, row.y));
    losses.push(logLoss3(p, row.y));
    const pred = argmax3(p);
    const actual = argmax3({ home: row.y[0], draw: row.y[1], away: row.y[2] });
    hits.push(pred === actual ? 1 : 0);
    const dirPred = p.home >= p.away ? 0 : 2;
    const dirAct = row.y[0] === 1 ? 0 : row.y[2] === 1 ? 2 : 1;
    dirs.push(dirAct === 1 ? (pred === 1 ? 1 : 0) : dirPred === dirAct ? 1 : 0);
    const closing =
      actual === 0 ? row.h.closingHome : actual === 1 ? row.h.closingDraw : row.h.closingAway;
    const opening = actual === 0 ? row.h.oddsHome : actual === 1 ? row.h.oddsDraw : row.h.oddsAway;
    clvs.push(1 / opening - 1 / closing);
    const evHome = p.home * row.h.oddsHome - 1;
    const pickSide = evHome > 0.04 ? 0 : p.away * row.h.oddsAway - 1 > 0.04 ? 2 : -1;
    if (pickSide < 0) rois.push(0);
    else {
      const odds = pickSide === 0 ? row.h.oddsHome : row.h.oddsAway;
      const won = pickSide === 0 ? row.y[0] === 1 : row.y[2] === 1;
      rois.push(won ? odds - 1 : -1);
    }
    eces.push({ p: p.home, y: row.y[0] });
  }
  return finalizeMetric(name, briers, losses, hits, dirs, clvs, rois, eces);
}

function blendP(
  stat: { home: number; draw: number; away: number },
  tac: { home: number; draw: number; away: number },
  r: number,
) {
  return normalize3(
    stat.home * (1 - r) + tac.home * r,
    stat.draw * (1 - r) + tac.draw * r,
    stat.away * (1 - r) + tac.away * r,
  );
}

export function learnFromHistory(history: HistoricalMatch[] = generateHistory()): Learned {
  const rho = history.length ? estimateRho(history) : -0.12;
  const rows = collectHistory(history, rho).sort((a, b) => a.h.kickoff.localeCompare(b.h.kickoff));
  if (rows.length < 12) {
    return {
      rho,
      calMethod: "none",
      platt: { a: 1, b: 0 },
      tacticalReliability: 0.16,
      agentWeights: { ...DEFAULT_AGENT_WEIGHTS },
      errorLearn: EMPTY_LEARN,
      championship: {
        models: [],
        coaches: [],
        tactical: {
          name: "tactical_consensus",
          n: 0,
          brier: 0,
          logLoss: 0,
          accuracy: 0,
          directional: 0,
          clv: 0,
          roi: 0,
          yield: 0,
          ece: 0,
          hitRate: 0,
        },
        ensemble: {
          name: "ensemble",
          n: 0,
          brier: 0,
          logLoss: 0,
          accuracy: 0,
          directional: 0,
          clv: 0,
          roi: 0,
          yield: 0,
          ece: 0,
          hitRate: 0,
        },
        ablation: [],
        walkForward: [],
        agentLeague: {
          POSSESSION_STRUCTURAL: {},
          PRESSING_TRANSITION: {},
          ADAPTATION_GAME_MANAGEMENT: {},
          DEFENSIVE_COUNTER: {},
          COMPETITIVE_DISCIPLINE: {},
        },
      },
    };
  }
  const cut = Math.floor(rows.length * 0.65);
  const train = rows.slice(0, Math.max(cut, 20));
  const test = rows.slice(cut);
  const evalSet = test.length >= 15 ? test : rows.slice(Math.floor(rows.length * 0.5));

  const plattPairs: { p: number; y: number }[] = [];
  for (const row of train) {
    plattPairs.push({ p: row.ensemble.home, y: row.y[0] });
    plattPairs.push({ p: row.ensemble.away, y: row.y[2] });
  }
  const platt = learnPlatt(plattPairs);

  const calibrated = (row: HistRow) => applyPlatt(row.ensemble, platt);

  let bestR = 0.22;
  let bestBrier = Infinity;
  for (const r of [0.12, 0.18, 0.24, 0.32, 0.4, 0.5]) {
    const b = mean(
      evalSet.map((row) => brier3(blendP(calibrated(row), row.consensus, r), row.y)),
    );
    if (b < bestBrier) {
      bestBrier = b;
      bestR = r;
    }
  }
  const baseBrier = mean(evalSet.map((row) => brier3(calibrated(row), row.y)));
  const tacticalReliability = clamp(
    bestBrier < baseBrier - 0.002 ? bestR : Math.min(bestR, 0.16),
    0.1,
    0.55,
  );

  const agentBriers: Record<CoachAgentId, number[]> = {
    POSSESSION_STRUCTURAL: [],
    PRESSING_TRANSITION: [],
    ADAPTATION_GAME_MANAGEMENT: [],
    DEFENSIVE_COUNTER: [],
    COMPETITIVE_DISCIPLINE: [],
  };
  const agentLeagueAcc: Record<CoachAgentId, Partial<Record<LeagueId, number[]>>> = {
    POSSESSION_STRUCTURAL: {},
    PRESSING_TRANSITION: {},
    ADAPTATION_GAME_MANAGEMENT: {},
    DEFENSIVE_COUNTER: {},
    COMPETITIVE_DISCIPLINE: {},
  };
  for (const row of evalSet) {
    for (const c of row.coaches) {
      const b = brier3(c.marketImplications, row.y);
      agentBriers[c.agent].push(b);
      const bucket = agentLeagueAcc[c.agent][row.h.league] ?? [];
      bucket.push(1 / Math.max(b, 0.08));
      agentLeagueAcc[c.agent][row.h.league] = bucket;
    }
  }
  const learnedWeights = { ...DEFAULT_AGENT_WEIGHTS };
  const inv: Record<CoachAgentId, number> = { ...DEFAULT_AGENT_WEIGHTS };
  let invSum = 0;
  (Object.keys(agentBriers) as CoachAgentId[]).forEach((k) => {
    const n = agentBriers[k].length;
    const b = n ? mean(agentBriers[k]) : 0.45;
    const raw = 1 / Math.max(b, 0.12);
    const shrink = n >= 40 ? 0.7 : 0.35;
    inv[k] = (1 - shrink) * 1 + shrink * raw;
    invSum += inv[k];
  });
  (Object.keys(learnedWeights) as CoachAgentId[]).forEach((k) => {
    learnedWeights[k] = inv[k] / (invSum || 1);
  });

  const modelNames: ModelName[] = ["poisson", "dixonColes", "elo", "xg", "glm", "market"];
  const modelMetrics = modelNames.map((name) =>
    metricFromRows(name, evalSet, (row) => row.models.find((m) => m.model === name) ?? row.ensemble),
  );
  const coachMetrics = (Object.keys(agentBriers) as CoachAgentId[]).map((k) =>
    metricFromRows(k, evalSet, (row) => {
      const c = row.coaches.find((x) => x.agent === k);
      return c?.marketImplications ?? row.ensemble;
    }),
  );
  const tacticalMetric = metricFromRows("tactical_consensus", evalSet, (row) => row.consensus);
  const ensembleMetric = metricFromRows("ensemble", evalSet, (row) => calibrated(row));

  const ablationOf = (
    name: AblationRow["name"],
    pick: (row: HistRow) => { home: number; draw: number; away: number },
  ): AblationRow => {
    const m = metricFromRows(name, evalSet, pick);
    return {
      name,
      brier: m.brier,
      logLoss: m.logLoss,
      ece: m.ece,
      roi: m.roi,
      clv: m.clv,
      hitRate: m.hitRate,
      n: m.n,
    };
  };

  const ablation: AblationRow[] = [
    ablationOf("BASELINE", (row) => calibrated(row)),
    ablationOf("TACTICAL", (row) => blendP(calibrated(row), row.consensus, tacticalReliability)),
    ablationOf("TACTICAL_DEVIL", (row) => {
      const blended = blendP(calibrated(row), row.consensus, tacticalReliability);
      const devil = runDevilsAdvocate(row.match, row.consensus, row.ensemble, row.coaches);
      const t = devil.confidenceReduction;
      const mkt = row.models.find((x) => x.model === "market") ?? row.ensemble;
      return normalize3(
        blended.home * (1 - t) + mkt.home * t,
        blended.draw * (1 - t) + mkt.draw * t,
        blended.away * (1 - t) + mkt.away * t,
      );
    }),
  ];

  const walkForward: { fold: string; brierBase: number; brierTactical: number }[] = [];
  const folds = [
    { fold: "Pli A", from: 0.4, to: 0.55 },
    { fold: "Pli B", from: 0.55, to: 0.75 },
    { fold: "Pli C", from: 0.75, to: 1 },
  ];
  for (const f of folds) {
    const lo = Math.floor(rows.length * f.from);
    const hi = Math.floor(rows.length * f.to);
    const slice = rows.slice(lo, Math.max(hi, lo + 8));
    walkForward.push({
      fold: f.fold,
      brierBase: mean(slice.map((row) => brier3(applyPlatt(row.ensemble, platt), row.y))),
      brierTactical: mean(
        slice.map((row) =>
          brier3(blendP(applyPlatt(row.ensemble, platt), row.consensus, tacticalReliability), row.y),
        ),
      ),
    });
  }

  const agentLeague: ChampionshipBoard["agentLeague"] = {
    POSSESSION_STRUCTURAL: {},
    PRESSING_TRANSITION: {},
    ADAPTATION_GAME_MANAGEMENT: {},
    DEFENSIVE_COUNTER: {},
    COMPETITIVE_DISCIPLINE: {},
  };
  (Object.keys(agentLeagueAcc) as CoachAgentId[]).forEach((k) => {
    (Object.keys(agentLeagueAcc[k]) as LeagueId[]).forEach((lg) => {
      const vals = agentLeagueAcc[k][lg] ?? [];
      agentLeague[k][lg] = vals.length ? mean(vals) : 0;
    });
  });

  return {
    rho,
    calMethod: "platt",
    platt,
    tacticalReliability,
    agentWeights: learnedWeights,
    errorLearn: EMPTY_LEARN,
    championship: {
      models: modelMetrics,
      coaches: coachMetrics,
      tactical: tacticalMetric,
      ensemble: ensembleMetric,
      ablation,
      walkForward,
      agentLeague,
    },
  };
}

function applyTicketCap(predictions: PredictionRecord[]): void {
  const pool: MarketQuote[] = [];
  for (const p of predictions) {
    for (const m of p.markets) {
      if (m.decision === "BET") pool.push(m);
    }
  }
  const MAX_BOOK = thresholds().maxBook;
  let used = pool.reduce((s, m) => s + m.stakePct, 0);
  if (used > MAX_BOOK && used > 0) {
    const scale = MAX_BOOK / used;
    for (const m of pool) m.stakePct *= scale;
    used = MAX_BOOK;
  }
  for (const p of predictions) {
    p.dailyBestCandidate = p.markets.some((m) => m.decision === "BET");
    for (const q of p.markets) {
      if (!q.cover) continue;
      const S = q.stakePct > 0 ? q.stakePct : 0;
      const C = q.cover.odds;
      const H = C > 1.05 && S > 0 ? S / (2 * C - 1) : 0;
      q.cover.stakePct = H;
      q.cover.totalStakePct = S + H;
      q.cover.ifMainWins = S * (q.bestOdds - 1) - H;
      q.cover.ifCoverWins = H * (C - 1) - S;
    }
  }
}

function matchweekKey(iso: string): string {
  const d = new Date(iso);
  const offset = (d.getUTCDay() + 6) % 7;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset));
  return mon.toISOString().slice(0, 10);
}

function parisDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

// European fixtures use the same rejection and expected-value rules as leagues.

function promoteCupPhaseBest(
  predictions: PredictionRecord[],
  matches: MatchInput[],
  league: LeagueId,
  flag: "clPhaseBest" | "elPhaseBest",
): { prediction: PredictionRecord; market: MarketQuote; phaseLabel: string } | null {
  const now = Date.now();
  const byId = new Map(matches.map((m) => [m.id, m]));
  const open = predictions.filter((p) => {
    if (p.league !== league) return false;
    const hours = (new Date(p.kickoff).getTime() - now) / 3600000;
    return hours > -4;
  });
  if (!open.length) return null;
  const liveish = open.filter((p) => {
    const h = (new Date(p.kickoff).getTime() - now) / 3600000;
    return h <= 14;
  });
  const anchor = [...(liveish.length ? liveish : open)].sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]!;
  const week = matchweekKey(anchor.kickoff);
  const phase = open.filter((p) => matchweekKey(p.kickoff) === week);
  const phaseLabel = byId.get(anchor.matchId)?.phaseLabel ?? "Phase de ligue";
  let best: { p: PredictionRecord; m: MarketQuote; score: number } | null = null;
  for (const p of phase) {
    for (const m of p.markets) {
      const row = byId.get(p.matchId);
      if (row && skipEuropeFrenchProno(row)) continue;
      if (skipEuropeFrenchProno(p)) continue;
      if (m.group !== "1X2") continue;
      if (m.decision !== "BET" || !m.listed || m.ev <= 0) continue;
      if (m.bestOdds < MIN_BET_ODDS) continue;
      if (m.bestOdds > MAX_BET_ODDS || m.modelProb < 0.28) continue;
      const score =
        m.opportunityScore +
        (m.listed ? 8 : 0) +
        (m.ev > 0 ? 10 : 0) +
        (m.decision === "BET" ? 4 : 0) +
        (m.edge > 0 ? 4 : 0) +
        (m.market === "1X2_H" && m.bestOdds >= 1.85 && m.bestOdds <= 2.7 ? 10 : 0) +
        (m.market === "1X2_D" ? -14 : 0) +
        (m.bestOdds < 1.8 ? -18 : 0);
      if (!best || score > best.score) best = { p, m, score };
    }
  }
  if (!best) return null;
  const { p, m } = best;
  // Highlight only an already eligible bet; selection must not change its risk.
  m[flag] = true;
  p[flag] = true;
  if (m.cover) {
    const S = m.stakePct;
    const C = m.cover.odds;
    const H = C > 1.05 && S > 0 ? S / (2 * C - 1) : 0;
    m.cover.stakePct = H;
    m.cover.totalStakePct = S + H;
    m.cover.ifMainWins = S * (m.bestOdds - 1) - H;
    m.cover.ifCoverWins = H * (C - 1) - S;
  }
  return { prediction: p, market: m, phaseLabel };
}

function pickDailyBest(
  predictions: PredictionRecord[],
): { prediction: PredictionRecord; market: MarketQuote } | null {
  let best: { prediction: PredictionRecord; market: MarketQuote; score: number } | null = null;
  for (const p of predictions) {
    if (p.consensus.conflictScore > 0.62) continue;
    if (p.devil.predictionChallengeScore > 0.7) continue;
    const hours = (new Date(p.kickoff).getTime() - Date.now()) / 3600000;
    if (hours < -3) continue;
    for (const m of p.markets) {
      if (m.decision !== "BET") continue;
      if (m.ev <= 0) continue;
      if (m.bestOdds < MIN_BET_ODDS || m.bestOdds > MAX_BET_ODDS || m.modelProb < 0.28) continue;
      if (skipEuropeFrenchProno(p)) continue;
      let score =
        m.opportunityScore +
        (p.consensus.statisticalAgreement > 0.5 ? 4 : 0) -
        p.consensus.disagreement * 8 -
        p.devil.predictionChallengeScore * 10;
      if (hours <= 48) score += 10;
      else if (hours <= 80) score += 4;
      else score -= 6;
      if (m.market === "1X2_H" && m.bestOdds >= 1.85 && m.bestOdds <= 2.7) score += 8;
      if (m.market === "1X2_D") score -= 10;
      if (m.bestOdds < 1.8) score -= 16;
      if (!best || score > best.score) best = { prediction: p, market: m, score };
    }
  }
  return best ? { prediction: best.prediction, market: best.market } : null;
}

let CACHE: EngineRun | null = null;
let CACHE_KEY = "";
let LEARNED: Learned | null = null;

function settleFromArchive(m: MatchInput): MatchInput {
  const hist = officialResult({ id: m.id, homeName: m.home.name, awayName: m.away.name, kickoff: m.kickoff });
  if (!hist) return m;
  if (m.status === "finished" && m.scoreHome === hist.goalsHome && m.scoreAway === hist.goalsAway && !m.clock) return m;
  return { ...m, status: "finished", scoreHome: hist.goalsHome, scoreAway: hist.goalsAway, clock: undefined };
}

export function bustEngine(): void {
  CACHE = null;
  CACHE_KEY = "";
}

export function runEngine(): EngineRun {
  hydrateLiveFromDisk();
  try {
    const run = runEngineUncached();
    if (run.matches.length > 0) {
      CACHE = run;
    }
    return run;
  } catch (err) {
    console.error("[engine]", err instanceof Error ? err.stack ?? err.message : err);
    if (CACHE && CACHE.matches.length > 0) return CACHE;
    throw new Error("Desk occupé. Réessaie.");
  }
}

function applyAdaptiveLearningGate(
  rec: PredictionRecord,
  match: MatchInput,
  actualTickets: TicketRow[],
  archiveTickets: TicketRow[],
  learning: AdaptiveLearningReport,
): void {
  for (const q of rec.markets) {
    if (q.decision !== "BET") continue;
    const safetyBlock = adaptiveSafetyBlock({ market: q.market, odds: q.bestOdds, league: match.league }, learning);
    if (safetyBlock) {
      q.decision = "NO_BET";
      q.stakePct = 0;
      q.rejectionReason = `Learning Safety: segment historiquement toxique (${safetyBlock}).`;
      continue;
    }
    if (learning.policy.status !== "PROMOTED") continue;
    const pseudo: TicketRow = {
      id: `prospective:${match.id}:${q.market}`,
      matchId: match.id,
      kickoff: match.kickoff,
      home: match.home.name,
      away: match.away.name,
      market: q.market,
      label: q.label,
      odds: q.bestOdds,
      book: q.bestBook || "live",
      stakePct: q.stakePct,
      modelProb: q.modelProb,
      ev: q.ev,
      dailyBest: false,
      kind: "mise",
      decision: q.decision,
      league: match.league,
      recordedAt: new Date().toISOString(),
    };
    const trust = scoreProspectiveTrust(pseudo, actualTickets, archiveTickets);
    if (!adaptiveAllows({ market: q.market, odds: q.bestOdds, modelProb: q.modelProb, ev: q.ev, league: match.league, trust }, learning.policy)) {
      q.decision = "NO_BET";
      q.stakePct = 0;
      q.rejectionReason = `Learning Engine: challenger promu refuse ce segment (trust ${(trust * 100).toFixed(0)} %).`;
    }
  }
}

function runEngineUncached(): EngineRun {
  hydrateLiveFromDisk();
  const live = getLiveSnapshot();
  const admin = loadAdmin();
  const archiveHist: HistoricalMatch[] = loadArchiveHistory();
  const actualTickets = loadTickets();
  const settledSignal = actualTickets
    .filter((r) => r.result === "win" || r.result === "lose")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(-8)
    .map((r) => `${r.id}:${r.result}`)
    .join("|");
  const key = `${live ? live.fetchedAt : "none"}:${JSON.stringify(admin)}:archive-${archiveHist.length}:learn-${actualTickets.length}:${settledSignal}:listed-uni`;
  if (CACHE && CACHE_KEY === key && CACHE.matches.length > 0) return CACHE;
  const liveHist = generateHistory() as HistoricalMatch[];
  const seenH = new Set(archiveHist.map((h: HistoricalMatch) => h.id));
  const history = [...archiveHist, ...liveHist.filter((h: HistoricalMatch) => !seenH.has(h.id))].sort((a: HistoricalMatch, b: HistoricalMatch) =>
    a.kickoff.localeCompare(b.kickoff),
  );
  const archive = ensureArchiveBacktest(archiveHist.length >= 200 ? archiveHist : history);
  const clubActualTickets = rowsForLearningScope(actualTickets, "CLUB");
  const clubArchiveTickets = rowsForLearningScope(archive?.tickets ?? [], "CLUB");
  const adaptiveLearning = buildAdaptiveLearningReport(clubActualTickets, clubArchiveTickets);
  const learnSlice = history.slice(-450);
  const learnedBase = learnFromHistory(learnSlice.length >= 12 ? learnSlice : history);
  const historyPicks = [];
  const rolling: TicketRow[] = [];
  let walkLearn: ErrorLearn = EMPTY_LEARN;
  const histSorted = [...liveHist].sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(-80);
  for (const h of histSorted) {
    const match = historicalInput(h);
    if (!match) continue;
    const { ensemble } = runStatisticalStack(match, learnedBase.rho);
    const adj = applyErrorLearn(
      { home: ensemble.home, draw: ensemble.draw, away: ensemble.away },
      h.league,
      h.league === "NL" ? EMPTY_LEARN : walkLearn,
    );
    const closeH = h.closingHome >= 1.2 ? h.closingHome : 1 / Math.max(adj.home, 0.08);
    const closeD = h.closingDraw >= 1.2 ? h.closingDraw : 1 / Math.max(adj.draw, 0.08);
    const closeA = h.closingAway >= 1.2 ? h.closingAway : 1 / Math.max(adj.away, 0.08);
    if (skipEuropeFrenchProno(match)) continue;
    const gate = tightenFromLearn(walkLearn);
    const pick = pickCurrentMethod(
      adj,
      { home: closeH, draw: closeD, away: closeA },
      {
        skipDraw: match.league === "CL" || match.league === "EL" || gate.skipDraw,
        minProb: gate.minProb,
        maxOdds: gate.maxOdds,
      },
    );
    if (!pick) continue;
    const result = marketHits(pick.market, h.goalsHome, h.goalsAway);
    const coverPick = pickCoverScore(ensemble.matrix, pick.market);
    const coverOdds = fairCoverOdds(coverPick.p).odds;
    const row = {
      id: `hist:${h.id}:1X2`,
      matchId: h.id,
      kickoff: h.kickoff,
      home: match.home.name,
      away: match.away.name,
      market: pick.market,
      label: prettyPickLabel(match.home.name, match.away.name, pick.market),
      odds: pick.odds,
      book: "clôture",
      modelProb: pick.modelProb,
      league: h.league,
      pHome: adj.home,
      pDraw: adj.draw,
      pAway: adj.away,
      goalsHome: h.goalsHome,
      goalsAway: h.goalsAway,
      result,
      recordedAt: h.kickoff,
      coverOdds,
      coverScore: coverPick.label,
    };
    historyPicks.push(row);
    rolling.push({
      ...row,
      kind: "prono" as const,
      decision: "NO_BET" as const,
      stakePct: 0,
      ev: 0,
      dailyBest: false,
      book: "clôture",
    });
    const clubRolling = rowsForLearningScope(rolling, "CLUB");
    if (clubRolling.length >= 12 && clubRolling.length % 6 === 0) {
      walkLearn = learnFromErrors(clubRolling);
    }
  }
  try {
    upsertHistoryPronos(historyPicks);
  } catch {
    /* ignore */
  }
  const allLearningRows = [...(archive?.tickets ?? []), ...rolling, ...actualTickets];
  const errorLearn = learnFromErrors(rowsForLearningScope(allLearningRows, "CLUB"));
  const internationalErrorLearn = learnFromErrors(rowsForLearningScope(allLearningRows, "INTERNATIONAL"));
  const learned = { ...learnedBase, errorLearn, internationalErrorLearn };
  LEARNED = learned;
  const matches = (getUpcomingMatches() as MatchInput[])
    .filter((m: MatchInput) => admin.leagues[m.league] !== false)
    .map(settleFromArchive);
  const predictions: PredictionRecord[] = [];
  const kept: MatchInput[] = [];
  for (const m of matches) {
    try {
      const rec = attachLiveIntel(m, buildPrediction(m, learned, DEFAULT_ROI5_DOMINANCE_POLICY));
      const asOfMs = Date.parse(live?.meta?.asOf ?? "");
      enforceBetSafety(rec.markets, m, Boolean(live?.meta?.stale) || !Number.isFinite(asOfMs) || Date.now() - asOfMs > 30 * 60_000 || asOfMs > Date.now() + 60_000);
      if (m.league !== "NL") {
        applyAdaptiveLearningGate(rec, m, clubActualTickets, clubArchiveTickets, adaptiveLearning);
      }
      try {
        const v = recordPredictionVersion(m, rec);
        const series = versionsFor(m.id);
        rec.timestamp = series[0]?.timestamp ?? v.timestamp ?? rec.timestamp;
      } catch {
        /* version store is best-effort */
      }
      predictions.push(rec);
      kept.push(m);
    } catch (err) {
      console.error("[engine] match skip", m.id, err instanceof Error ? err.message : err);
    }
  }
  applyTicketCap(predictions);
  const clPhaseBest = promoteCupPhaseBest(predictions, kept, "CL", "clPhaseBest");
  const elPhaseBest = promoteCupPhaseBest(predictions, kept, "EL", "elPhaseBest");
  applyTicketCap(predictions);
  const ablation = learned.championship.ablation;
  const tacticalHelps = ablation.some(
    (a) => a.name === "TACTICAL" && ablation.find((b) => b.name === "BASELINE" && a.brier < b.brier - 0.002),
  );
  const dailyBest = pickDailyBest(predictions);
  if (dailyBest && !tacticalHelps) {
    // Daily best stays: the statistical stack already is the foundation.
  }
  const liveTickets = syncTickets(predictions, kept, liveHist, dailyBest?.prediction.matchId);
  if (process.env.BETGPT_OFFLINE !== "1") void pushNewPredictions({ predictions, matches: kept }).catch((err) => {
    console.error("[BETGPT WEBHOOK] FAILED:", err instanceof Error ? err.message : err);
  });
  const review = reviewOf(canonicalChampionRows(liveTickets));
  const bets = predictions.flatMap((p) => p.markets.filter((m) => m.decision === "BET").map((m) => ({ p, m })));
  if (process.env.BETGPT_OFFLINE !== "1") void publishDigest(buildDigest(dailyBest, bets));
  const openIds = new Set(kept.filter((m) => m.status !== "finished").map((m) => m.id));
  const openMarkets = predictions.filter((p) => openIds.has(p.matchId)).flatMap((p) => p.markets);
  const asOf = live?.meta.asOf ?? new Date().toISOString();
  const summary: DeskSummary = {
    asOf,
    nMatches: openIds.size,
    nBet: openMarkets.filter((m) => m.decision === "BET").length,
    nWatch: openMarkets.filter((m) => m.decision === "WATCH").length,
    nNoBet: openMarkets.filter((m) => m.decision === "NO_BET").length,
    meanAbsEdge: mean(
      predictions.map((p) => {
        const one = p.markets.filter((m) => m.group === "1X2");
        return mean(one.map((m) => Math.abs(m.edge)));
      }),
    ),
  };
  CACHE = {
    matches: kept,
    predictions,
    dailyBest,
    clPhaseBest,
    elPhaseBest,
    summary,
    learned,
    historyN: history.length,
    liveAsOf: asOf,
    liveSource: live?.meta.source ?? "calendrier",
    liveWindow: live?.meta.window ?? "",
    liveStale: live?.meta.stale ?? false,
    review,
    archive,
    adaptiveLearning,
  };
  CACHE_KEY = key;
  return CACHE;
}

function learnedNow(): Learned {
  if (LEARNED) return LEARNED;
  try {
    return runEngine().learned;
  } catch {
    LEARNED = learnFromHistory(loadArchiveHistory().slice(-120));
    return LEARNED;
  }
}

export function resolveStoredMatch(id: string): { match: MatchInput; prediction: PredictionRecord } | null {
  // The sitemap is generated from the full live snapshot, while runEngine()
  // intentionally filters that snapshot. Resolve against the unfiltered live
  // snapshot first so any live-backed /match, /forum or /cotes URL emitted by
  // the sitemap remains resolvable by the public route.
  const current = (getUpcomingMatches() as MatchInput[]).find((match) => matchMatchesId(match, id));
  if (current) {
    const match = settleFromArchive(current);
    return { match, prediction: predictMatch(match) };
  }

  const hist = findArchiveMatch(id);
  if (hist) {
    const match = matchFromHistory(hist);
    return { match, prediction: predictMatch(match) };
  }
  const ticket = getTicket(id);
  if (!ticket) return null;
  const match = matchFromTicket(ticket);
  if (!match) return null;
  return { match, prediction: predictMatch(match) };
}

export function getPrediction(id: string): { match: MatchInput; prediction: PredictionRecord } | null {
  try {
    const e = runEngine();
    const match = e.matches.find((m) => matchMatchesId(m, id));
    const prediction = e.predictions.find((p) => p.matchId === match?.id || p.matchId === id);
    if (match && prediction) return { match: settleFromArchive(match), prediction };
  } catch {
    /* engine occupé : dossier d'archive */
  }
  return resolveStoredMatch(id);
}

export function predictMatch(match: MatchInput): PredictionRecord {
  const rec = attachLiveIntel(match, buildPrediction(match, learnedNow(), DEFAULT_ROI5_DOMINANCE_POLICY));
  try {
    const v = recordPredictionVersion(match, rec);
    const series = versionsFor(match.id);
    rec.timestamp = series[0]?.timestamp ?? v.timestamp ?? rec.timestamp;
  } catch {
    /* best-effort */
  }
  return rec;
}
