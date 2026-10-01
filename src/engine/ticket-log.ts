import { clamp } from "./math";
import { prettyPickLabel } from "./pick";
import { marketHits, coverHitsScore, coverStakeOf } from "./settle";
import { skipEuropeFrenchProno } from "./french-clubs";
import { compactTickets, fixtureKey, isCanonicalRoi5Selection, isMethodPick, uniqueByFixture } from "./ledger-pick";
import { isRoiEligibleDecision } from "./roi-eligibility";
import { headlineMarket } from "@/lib/markets";
import { readPersist, writePersist } from "@/lib/persist";
import { ENGINE_VERSION } from "./data";
import { appendEvent, isImmutable, stampLock, kickoffPassed, publishedBeforeKickoff } from "./verify";
import seedTickets from "./seed-tickets.json" with { type: "json" };
import type { Decision, HistoricalMatch, LeagueId, MarketKind, MatchInput, PredictionRecord } from "./types";

export { marketHits, coverHitsScore, coverStakeOf, FILET_COVER_FRAC } from "./settle";
export { compactTickets, fixtureKey, isMethodPick, teamKey, uniqueByFixture } from "./ledger-pick";

export type TicketKind = "mise" | "prono";

export type LearningContext = {
  capturedAt: string;
  modelDisagreement: number;
  confidenceScore: number;
  dataQuality: number;
  tacticalReliability: number;
  tacticalConflict: number;
  directionalAgreement: number;
  devilChallenge: number;
  openingOdds: number;
  quotedOdds: number;
  oddsMove: number;
  absenceHomeImpact: number;
  absenceAwayImpact: number;
  restDiffDays: number;
  congestionDiff: number;
  travelAwayKm: number;
  importance: number;
  missingInformationCount: number;
  availableInformationCount: number;
  lambdaHome: number;
  lambdaAway: number;
  homeFormation: string;
  awayFormation: string;
  features: Record<string, number>;
};

export type TicketRow = {
  id: string;
  matchId: string;
  kickoff: string;
  home: string;
  away: string;
  market: MarketKind;
  label: string;
  odds: number;
  book: string;
  stakePct: number;
  modelProb: number;
  ev: number;
  dailyBest: boolean;
  kind: TicketKind;
  decision: Decision;
  league?: LeagueId;
  pHome?: number;
  pDraw?: number;
  pAway?: number;
  recordedAt: string;
  goalsHome?: number;
  goalsAway?: number;
  closingOdds?: number;
  clv?: number;
  result?: "win" | "lose" | "void";
  coverOdds?: number;
  coverStakePct?: number;
  coverResult?: "win" | "lose";
  coverScore?: string;
  pnl10?: number | null;
  verdict?: "juste" | "couvert" | "faux" | "void" | "attente";
  filetUsed?: boolean;
  lockedAt?: string;
  predictionHash?: string;
  engineVersion?: string;
  revision?: number;
  snapshots?: { at: string; market: string; label: string; odds: number; modelProb: number }[];
  learningContext?: LearningContext;
};

export function canonicalChampionRows(rows: TicketRow[]): TicketRow[] {
  return rows.filter(
    (row) =>
      row.engineVersion === ENGINE_VERSION &&
      row.kind === "prono" &&
      isCanonicalRoi5Selection(row),
  );
}

const FILE = "tickets.json";
let MEM: TicketRow[] | null = null;

function mapRow(r: TicketRow): TicketRow {
  const row: TicketRow = {
    ...r,
    kind: r.kind ?? (r.stakePct > 0 || r.decision === "BET" ? "mise" : "prono"),
    decision: r.decision ?? (r.kind === "mise" || r.stakePct > 0 ? "BET" : "NO_BET"),
  };
  const rec = Date.parse(row.recordedAt);
  const ko = Date.parse(row.kickoff);
  if (!Number.isFinite(rec) || !Number.isFinite(ko) || rec >= ko) {
    delete row.predictionHash;
  }
  return row;
}

function parseRows(raw: unknown): TicketRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TicketRow[]).map(mapRow);
}

function mergeTickets(a: TicketRow[], b: TicketRow[]): TicketRow[] {
  const byId = new Map(a.map((r) => [r.id, r]));
  for (const r of b) {
    const e = byId.get(r.id);
    if (!e) {
      byId.set(r.id, r);
      continue;
    }
    if (!e.result && r.result) byId.set(r.id, { ...e, ...r });
    else if (e.result && !r.result) continue;
    else byId.set(r.id, { ...e, ...r, result: e.result ?? r.result, goalsHome: e.goalsHome ?? r.goalsHome, goalsAway: e.goalsAway ?? r.goalsAway });
  }
  return [...byId.values()];
}

function stripFakeProof(rows: TicketRow[]): TicketRow[] {
  for (const row of rows) {
    if (!publishedBeforeKickoff(row)) delete row.predictionHash;
  }
  return rows;
}

export function loadTickets(): TicketRow[] {
  if (MEM) return stripFakeProof(MEM);
  let disk: TicketRow[] = [];
  try {
    const txt = readPersist(FILE);
    if (txt) disk = parseRows(JSON.parse(txt));
  } catch {
    disk = [];
  }
  MEM = stripFakeProof(compactTickets(mergeTickets(parseRows(seedTickets), disk)));
  return MEM;
}

const STABLE_PUBLIC_EVIDENCE_IDS = new Set(parseRows(seedTickets).map((row) => row.id));

/**
 * Sitemap-safe evidence rows only.
 *
 * Runtime-generated tickets can be useful while a process is alive, but they
 * must never be advertised as durable public URLs unless their identifier is
 * part of the immutable seed corpus. This prevents a redeploy from turning a
 * previously emitted sitemap URL into a 404.
 */
export function stablePublicEvidenceTickets(rows: TicketRow[] = loadTickets()): TicketRow[] {
  return rows.filter((row) => row.kind === "prono" && STABLE_PUBLIC_EVIDENCE_IDS.has(row.id));
}

let ticketsHydrated = false;

/** Merge durable Postgres kv into the in-process ledger (Vercel / Neon). */
export async function hydrateTickets(): Promise<void> {
  if (ticketsHydrated) return;
  ticketsHydrated = true;
  try {
    const { kvGet } = await import("@/lib/store");
    const remote = await kvGet<TicketRow[]>("tickets");
    if (!Array.isArray(remote) || !remote.length) return;
    const local = loadTickets();
    MEM = stripFakeProof(compactTickets(mergeTickets(local, parseRows(remote))));
  } catch {
    /* preview / missing table */
  }
}

function save(rows: TicketRow[]): void {
  MEM = rows;
  writePersist(FILE, JSON.stringify(rows, null, 2));
  void import("@/lib/store")
    .then((m) => m.kvSet("tickets", rows))
    .catch(() => undefined);
}

export type CoverScorePick = { hg: number; ag: number; p: number; label: string };

function fallbackCover(market: MarketKind): CoverScorePick {
  if (market === "1X2_D" || market === "DC_12") return { hg: 1, ag: 0, p: 0.11, label: "1-0" };
  if (market === "OU_25_U") return { hg: 2, ag: 1, p: 0.1, label: "2-1" };
  if (market === "OU_15_O") return { hg: 0, ag: 0, p: 0.08, label: "0-0" };
  if (market === "BTTS_Y") return { hg: 1, ag: 0, p: 0.11, label: "1-0" };
  return { hg: 1, ag: 1, p: 0.09, label: "1-1" };
}

export function pickCoverScore(matrix: number[][] | undefined, market: MarketKind): CoverScorePick {
  let best: CoverScorePick | null = null;
  if (matrix?.length) {
    const imax = Math.min(5, matrix.length - 1);
    for (let i = 0; i <= imax; i++) {
      const row = matrix[i];
      if (!row) continue;
      const jmax = Math.min(5, row.length - 1);
      for (let j = 0; j <= jmax; j++) {
        if (marketHits(market, i, j) !== "lose") continue;
        const p = row[j] ?? 0;
        if (!best || p > best.p) best = { hg: i, ag: j, p, label: `${i}-${j}` };
      }
    }
  }
  const hit = best ?? fallbackCover(market);
  hit.label = `${hit.hg}-${hit.ag}`;
  return hit;
}

export function fairCoverOdds(p: number, listed?: number, selection?: string): { odds: number; listed: boolean } {
  if (listed && listed >= 4.5) {
    return { odds: clamp(listed, 4.5, 35), listed: true };
  }
  void selection;
  return { odds: clamp(1.08 / clamp(p, 0.035, 0.22), 5, 28), listed: false };
}

export function headline1x2(p: PredictionRecord) {
  const top = headlineMarket(p.markets);
  return {
    market: top.market,
    label: prettyPickLabel(p.home.name, p.away.name, top.market),
    modelProb: top.modelProb,
    odds: top.bestOdds,
    book: top.bestBook,
    ev: top.ev,
    decision: top.decision,
  };
}

function openingOddsFor(match: MatchInput | undefined, market: MarketKind, fallback: number): number {
  if (!match) return fallback;
  const o = match.opening;
  const byMarket: Partial<Record<MarketKind, number>> = {
    "1X2_H": o.home,
    "1X2_D": o.draw,
    "1X2_A": o.away,
    "OU_15_O": o.over15,
    "OU_25_O": o.over25,
    "OU_35_O": o.over35,
    "OU_25_U": o.under25,
    "BTTS_Y": o.bttsYes,
    "BTTS_N": o.bttsNo,
  };
  const value = byMarket[market];
  return typeof value === "number" && Number.isFinite(value) && value > 1 ? value : fallback;
}

function absenceImpact(match: MatchInput | undefined, side: "home" | "away"): number {
  const absences = side === "home" ? match?.absencesHome?.value : match?.absencesAway?.value;
  if (!Array.isArray(absences)) return 0;
  return absences.reduce((sum, a) => sum + (Number.isFinite(a.importance) ? a.importance : 0), 0);
}

function learningContextOf(
  p: PredictionRecord,
  match: MatchInput | undefined,
  market: MarketKind,
  quotedOdds: number,
): LearningContext {
  const openingOdds = openingOddsFor(match, market, quotedOdds);
  const missingInformationCount =
    p.coaches.reduce((sum, c) => sum + c.missingInformation.length, 0) +
    p.devil.riskFactors.length;
  const features = Object.fromEntries(
    p.features
      .filter((f) => Number.isFinite(f.value))
      .slice(0, 40)
      .map((f) => [f.key, f.value]),
  );
  return {
    capturedAt: new Date().toISOString(),
    modelDisagreement: p.intelligence.modelDisagreement,
    confidenceScore: p.intelligence.confidenceScore,
    dataQuality: p.intelligence.dataQuality,
    tacticalReliability: p.meta.tacticalReliability,
    tacticalConflict: p.consensus.conflictScore,
    directionalAgreement: p.consensus.directionalAgreement,
    devilChallenge: p.devil.predictionChallengeScore,
    openingOdds,
    quotedOdds,
    oddsMove: openingOdds > 1 ? quotedOdds / openingOdds - 1 : 0,
    absenceHomeImpact: absenceImpact(match, "home"),
    absenceAwayImpact: absenceImpact(match, "away"),
    restDiffDays: (match?.restHome?.value ?? 0) - (match?.restAway?.value ?? 0),
    congestionDiff: (match?.congestionAway?.value ?? 0) - (match?.congestionHome?.value ?? 0),
    travelAwayKm: match?.travelAwayKm?.value ?? 0,
    importance: match?.importance?.value ?? 0,
    missingInformationCount,
    availableInformationCount: p.availableInformation.length,
    lambdaHome: p.ensemble.lambdaHome,
    lambdaAway: p.ensemble.lambdaAway,
    homeFormation: p.home.formation,
    awayFormation: p.away.formation,
    features,
  };
}

type ScoreHit = { gh: number; ga: number; closing?: Partial<Record<MarketKind, number>> };

function pairKey(home: string, away: string, kickoff: string): string {
  return fixtureKey(home, away, kickoff);
}

function settleRow(row: TicketRow, scores: { byId: Map<string, ScoreHit>; byPair: Map<string, ScoreHit> }, match?: MatchInput): void {
  if (match?.status === "cancelled") {
    row.result = "void";
    row.verdict = "void";
    appendEvent({
      type: "prediction_settled",
      predictionId: row.id,
      at: new Date().toISOString(),
      meta: { result: "void", reason: match.voidReason ?? "cancelled" },
    });
    return;
  }
  const sc =
    (match?.status === "finished" && match.scoreHome != null && match.scoreAway != null
      ? { gh: match.scoreHome, ga: match.scoreAway, closing: scores.byId.get(match.id)?.closing }
      : undefined) ??
    scores.byId.get(row.matchId) ??
    scores.byPair.get(pairKey(row.home, row.away, row.kickoff));
  if (!sc) return;
  const sameScore = row.goalsHome === sc.gh && row.goalsAway === sc.ga && Boolean(row.result);
  if (sameScore) return;
  const had = row.result;
  row.goalsHome = sc.gh;
  row.goalsAway = sc.ga;
  row.result = marketHits(row.market, sc.gh, sc.ga);
  const close = sc.closing?.[row.market];
  if (close && close > 1 && row.odds > 1) {
    row.closingOdds = close;
    row.clv = row.odds / close - 1;
  }
  if (row.coverOdds && row.coverOdds > 1.05) {
    row.coverResult = coverHitsScore(row.coverScore, sc.gh, sc.ga) ? "win" : "lose";
  }
  if (!had && row.result) {
    appendEvent({
      type: "prediction_settled",
      predictionId: row.id,
      at: new Date().toISOString(),
      meta: { result: row.result, score: `${sc.gh}-${sc.ga}` },
    });
  }
}

function scoreIndex(history: HistoricalMatch[], matches: MatchInput[]) {
  const byId = new Map<string, ScoreHit>();
  const byPair = new Map<string, ScoreHit>();
  const put = (id: string, home: string, away: string, kickoff: string, sc: ScoreHit) => {
    byId.set(id, sc);
    byPair.set(pairKey(home, away, kickoff), sc);
  };
  for (const h of history) {
    put(h.id, h.homeName ?? h.homeId, h.awayName ?? h.awayId, h.kickoff, {
      gh: h.goalsHome,
      ga: h.goalsAway,
      closing: { "1X2_H": h.closingHome, "1X2_D": h.closingDraw, "1X2_A": h.closingAway },
    });
  }
  for (const m of matches) {
    if (m.status === "finished" && m.scoreHome != null && m.scoreAway != null) {
      const prev = byId.get(m.id);
      put(m.id, m.home.name, m.away.name, m.kickoff, {
        gh: m.scoreHome,
        ga: m.scoreAway,
        closing: prev?.closing,
      });
    }
  }
  return { byId, byPair };
}

function attachCover(row: TicketRow, cover?: { odds: number; stakePct: number; selection?: string }): void {
  if (!cover || cover.odds <= 1.05) return;
  row.coverOdds = cover.odds;
  row.coverStakePct = cover.stakePct;
  if (cover.selection) row.coverScore = cover.selection;
}

export function syncTickets(
  predictions: PredictionRecord[],
  matches: MatchInput[],
  history: HistoricalMatch[],
  dailyMatchId?: string,
): TicketRow[] {
  const rows = loadTickets();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const predByMatch = new Map(predictions.map((p) => [p.matchId, p]));
  const matchById = new Map(matches.map((m) => [m.id, m]));

  for (const p of predictions) {
    const match = matchById.get(p.matchId);
    if (match && skipEuropeFrenchProno(match)) {
      const pronoId = `${p.matchId}:1X2`;
      const existing = byId.get(pronoId);
      if (existing) {
        existing.decision = "NO_BET";
        existing.result = "void";
      }
      continue;
    }
    const started =
      kickoffPassed(p.kickoff) || match?.status === "live" || match?.status === "finished";
    const head = headline1x2(p);
    const pronoId = `${p.matchId}:1X2`;
    const existingProno = byId.get(pronoId);
    const headM = p.markets.find((m) => m.market === head.market);
    if (!existingProno) {
      if (started) continue;
      const row: TicketRow = {
        id: pronoId,
        matchId: p.matchId,
        kickoff: p.kickoff,
        home: p.home.name,
        away: p.away.name,
        market: head.market,
        label: head.label,
        odds: head.odds,
        book: head.book,
        stakePct: 0,
        modelProb: head.modelProb,
        ev: head.ev,
        dailyBest: p.matchId === dailyMatchId,
        kind: "prono",
        decision: head.decision,
        league: p.league,
        pHome: p.calibrated.home,
        pDraw: p.calibrated.draw,
        pAway: p.calibrated.away,
        recordedAt: new Date().toISOString(),
        engineVersion: ENGINE_VERSION,
        revision: 1,
        learningContext: learningContextOf(p, match, head.market, head.odds),
      };
      attachCover(row, headM?.cover);
      byId.set(pronoId, row);
      rows.push(row);
      appendEvent({
        type: "prediction_created",
        predictionId: row.id,
        at: row.recordedAt,
        meta: { market: row.market, odds: row.odds },
      });
    } else if (isImmutable(existingProno) || started) {
      stampLock(existingProno);
    } else {
      const changed =
        existingProno.market !== head.market ||
        existingProno.label !== head.label ||
        Math.abs(existingProno.odds - head.odds) > 0.01;
      if (changed) {
        existingProno.snapshots = [
          ...(existingProno.snapshots ?? []),
          {
            at: new Date().toISOString(),
            market: existingProno.market,
            label: existingProno.label,
            odds: existingProno.odds,
            modelProb: existingProno.modelProb,
          },
        ].slice(-8);
        existingProno.revision = (existingProno.revision ?? 1) + 1;
        appendEvent({
          type: "prediction_updated",
          predictionId: existingProno.id,
          at: existingProno.snapshots[existingProno.snapshots.length - 1]!.at,
          meta: { revision: existingProno.revision, odds: head.odds },
        });
      }
      existingProno.market = head.market;
      existingProno.label = head.label;
      existingProno.odds = head.odds;
      existingProno.book = head.book;
      existingProno.modelProb = head.modelProb;
      existingProno.ev = head.ev;
      existingProno.decision = head.decision;
      existingProno.dailyBest = p.matchId === dailyMatchId;
      existingProno.pHome = p.calibrated.home;
      existingProno.pDraw = p.calibrated.draw;
      existingProno.pAway = p.calibrated.away;
      existingProno.engineVersion = ENGINE_VERSION;
      existingProno.learningContext = learningContextOf(p, match, head.market, head.odds);
      attachCover(existingProno, headM?.cover);
    }
    for (const m of p.markets) {
      if (m.decision !== "BET") continue;
      const id = `${p.matchId}:${m.market}:mise`;
      const existing = byId.get(id);
      const miseLabel = prettyPickLabel(p.home.name, p.away.name, m.market);
      if (!existing) {
        if (started) continue;
        const row: TicketRow = {
          id,
          matchId: p.matchId,
          kickoff: p.kickoff,
          home: p.home.name,
          away: p.away.name,
          market: m.market,
          label: miseLabel,
          odds: m.bestOdds,
          book: m.bestBook,
          stakePct: m.stakePct,
          modelProb: m.modelProb,
          ev: m.ev,
          dailyBest: p.matchId === dailyMatchId,
          kind: "mise",
          decision: "BET",
          league: p.league,
          pHome: p.calibrated.home,
          pDraw: p.calibrated.draw,
          pAway: p.calibrated.away,
          recordedAt: new Date().toISOString(),
          engineVersion: ENGINE_VERSION,
          revision: 1,
          learningContext: learningContextOf(p, match, m.market, m.bestOdds),
        };
        attachCover(row, m.cover);
        byId.set(id, row);
        rows.push(row);
        appendEvent({
          type: "prediction_created",
          predictionId: row.id,
          at: row.recordedAt,
          meta: { kind: "mise", market: row.market, odds: row.odds },
        });
      } else if (isImmutable(existing) || started) {
        stampLock(existing);
      } else {
        existing.market = m.market;
        existing.label = miseLabel;
        existing.odds = m.bestOdds;
        existing.book = m.bestBook;
        existing.modelProb = m.modelProb;
        existing.ev = m.ev;
        existing.stakePct = m.stakePct;
        existing.engineVersion = ENGINE_VERSION;
        existing.learningContext = learningContextOf(p, match, m.market, m.bestOdds);
        attachCover(existing, m.cover);
      }
    }
  }

  const kept: TicketRow[] = [];
  for (const row of rows) {
    if (row.kind === "mise") {
      if (isImmutable(row) || row.result) {
        kept.push(row);
        continue;
      }
      const p = predByMatch.get(row.matchId);
      if (p && !p.markets.some((m) => m.market === row.market && m.decision === "BET")) continue;
    }
    kept.push(row);
  }

  const scores = scoreIndex(history, matches);
  for (const row of kept) {
    if (kickoffPassed(row.kickoff)) stampLock(row);
    settleRow(row, scores, matchById.get(row.matchId));
  }
  const compact = compactTickets(kept);
  save(compact);
  void import("./learning-memory")
    .then((m) => m.persistLearningMemory(compact))
    .catch(() => undefined);
  return compact;
}

export function upsertHistoryPronos(
  picks: Array<{
    id: string;
    matchId: string;
    kickoff: string;
    home: string;
    away: string;
    market: MarketKind;
    label: string;
    odds: number;
    book: string;
    modelProb: number;
    goalsHome: number;
    goalsAway: number;
    result: "win" | "lose" | "void";
    recordedAt: string;
    league?: LeagueId;
    pHome?: number;
    pDraw?: number;
    pAway?: number;
    coverOdds?: number;
    coverScore?: string;
  }>,
): TicketRow[] {
  const rows = loadTickets();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const p of picks) {
    const existing = byId.get(p.id) ?? byId.get(`${p.matchId}:1X2`);
    if (existing) {
      if (isImmutable(existing)) {
        if (!existing.result) {
          existing.result = p.result;
          existing.goalsHome = p.goalsHome;
          existing.goalsAway = p.goalsAway;
          if (p.coverOdds && p.coverOdds > 1.05) {
            existing.coverOdds = existing.coverOdds ?? p.coverOdds;
            existing.coverScore = existing.coverScore ?? p.coverScore;
            existing.coverResult = coverHitsScore(existing.coverScore, p.goalsHome, p.goalsAway)
              ? "win"
              : "lose";
          }
        }
        continue;
      }
      existing.market = p.market;
      existing.label = p.label;
      existing.odds = p.odds;
      existing.modelProb = p.modelProb;
      existing.result = p.result;
      existing.goalsHome = p.goalsHome;
      existing.goalsAway = p.goalsAway;
      existing.league = p.league ?? existing.league;
      existing.pHome = p.pHome;
      existing.pDraw = p.pDraw;
      existing.pAway = p.pAway;
      if (p.coverOdds && p.coverOdds > 1.05) {
        existing.coverOdds = p.coverOdds;
        if (p.coverScore) existing.coverScore = p.coverScore;
        existing.coverResult = coverHitsScore(existing.coverScore, p.goalsHome, p.goalsAway)
          ? "win"
          : "lose";
      }
      continue;
    }
    const row: TicketRow = {
      id: p.id,
      matchId: p.matchId,
      kickoff: p.kickoff,
      home: p.home,
      away: p.away,
      market: p.market,
      label: p.label,
      odds: p.odds,
      book: p.book,
      stakePct: 0,
      modelProb: p.modelProb,
      ev: 0,
      dailyBest: false,
      kind: "prono",
      decision: "NO_BET",
      recordedAt: p.recordedAt,
      goalsHome: p.goalsHome,
      goalsAway: p.goalsAway,
      result: p.result,
      league: p.league,
      pHome: p.pHome,
      pDraw: p.pDraw,
      pAway: p.pAway,
      coverOdds: p.coverOdds,
      coverScore: p.coverScore,
      coverResult:
        p.coverOdds && p.coverOdds > 1.05
          ? coverHitsScore(p.coverScore, p.goalsHome, p.goalsAway)
            ? "win"
            : "lose"
          : undefined,
    };
    byId.set(row.id, row);
    rows.push(row);
  }
  save(rows);
  return rows;
}

export function isShortPricedWinner(row: TicketRow): boolean {
  if (row.odds < 1.7) return true;
  if (row.market === "1X2_H" && row.odds < 1.9) return true;
  if (row.market === "1X2_A" && row.odds < 2) return true;
  return false;
}

export function isBestOpportunity(row: TicketRow): boolean {
  if (isShortPricedWinner(row)) return false;
  if (row.kind === "mise" && row.decision === "BET") return true;
  if (row.dailyBest) return true;
  const o = row.odds;
  const p = row.modelProb;
  if (row.book === "clôture") {
    if (row.market === "1X2_H") return p >= 0.48 && p <= 0.58;
    if (row.market === "1X2_A") return p >= 0.42 && p <= 0.52;
    return false;
  }
  if (row.market === "1X2_H") return o >= 1.85 && o <= 2.65 && p >= 0.48;
  if (row.market === "1X2_A") return o >= 2.05 && o <= 2.9 && p >= 0.42;
  if (row.market === "1X2_D") return o >= 3.05 && o <= 3.85 && p >= 0.32 && row.ev >= 0.12;
  return false;
}

export function bilanRows(rows: TicketRow[]): TicketRow[] {
  return rows.filter((row) => isCanonicalRoi5Selection(row) && isBestOpportunity(row));
}

export function selfLearn(rows: TicketRow[]): { n: number; precision: number; extraMinEv: number } {
  const settled = bilanRows(rows).filter((r) => r.kind === "mise" && (r.result === "win" || r.result === "lose"));
  const n = settled.length;
  const precision = n ? settled.filter((r) => r.result === "win").length / n : 0;
  const extraMinEv = n >= 6 && precision < 0.42 ? 0.02 : n >= 6 && precision < 0.5 ? 0.01 : 0;
  return { n, precision, extraMinEv };
}

export type NightLine = {
  home: string;
  away: string;
  label: string;
  odds: number;
  score: string;
  coverScore?: string;
  coverOdds: number;
  mainStake: number;
  coverStake: number;
  mainReturn: number;
  coverReturn: number;
  pnl: number;
  verdict: "juste" | "couvert" | "faux" | "void" | "attente";
};

export type CupNightSim = {
  league: LeagueId;
  day: string;
  stake: number;
  lines: NightLine[];
  staked: number;
  returned: number;
  profit: number;
  roi: number;
  hits: number;
  covered: number;
};

export function lastCupNight(rows: TicketRow[], league: LeagueId, stake = 100): CupNightSim | null {
  const picks = uniqueByFixture(
    rows.filter(
      (r) =>
        r.league === league &&
        isRoiEligibleDecision(r.decision) &&
        isMethodPick(r) &&
        (r.result === "win" || r.result === "lose"),
    ),
  );
  if (!picks.length) return null;
  const days = [...new Set(picks.map((r) => r.kickoff.slice(0, 10)))].sort();
  const today = new Date().toISOString().slice(0, 10);
  const day = [...days].reverse().find((d) => d < today) ?? days[days.length - 1]!;
  const night = picks.filter((r) => r.kickoff.slice(0, 10) === day);
  if (!night.length) return null;
  const lines: NightLine[] = night.map((r) => {
    const C = filetOdds(r);
    const H = coverWanted(r) ? coverStakeOf(C, stake) : 0;
    const mainReturn = r.result === "win" ? stake * r.odds : 0;
    const hitCover = coverWanted(r) && filetHit(r);
    const coverReturn = hitCover && C && H > 0 ? H * C : 0;
    const staked = stake + H;
    const pnl = mainReturn + coverReturn - staked;
    const gh = r.goalsHome;
    const ga = r.goalsAway;
    return {
      home: r.home,
      away: r.away,
      label: r.label,
      odds: r.odds,
      score: gh != null && ga != null ? `${gh}–${ga}` : "—",
      coverScore: r.coverScore,
      coverOdds: C,
      mainStake: stake,
      coverStake: H,
      mainReturn,
      coverReturn,
      pnl,
      verdict: rowVerdict(r),
    };
  });
  const staked = lines.reduce((s, l) => s + l.mainStake + l.coverStake, 0);
  const returned = lines.reduce((s, l) => s + l.mainReturn + l.coverReturn, 0);
  return {
    league,
    day,
    stake,
    lines,
    staked,
    returned,
    profit: returned - staked,
    roi: staked ? (returned - staked) / staked : 0,
    hits: lines.filter((l) => l.verdict === "juste").length,
    covered: lines.filter((l) => l.verdict === "couvert").length,
  };
}

export type BankSim = {
  n: number;
  stake: number;
  staked: number;
  returned: number;
  profit: number;
  roi: number;
  hits: number;
  covered: number;
  mainStaked: number;
  mainReturned: number;
  coverStaked: number;
  coverReturned: number;
};

export function rowPnl(row: TicketRow, stake = 100): number | null {
  if (row.result !== "win" && row.result !== "lose") return null;
  const H = coverWanted(row) ? coverStakeOf(filetOdds(row), stake) : 0;
  return settleReturn(row, stake) - stake - H;
}

export function rowVerdict(row: TicketRow): "juste" | "couvert" | "faux" | "void" | "attente" {
  if (!row.result) return "attente";
  if (row.result === "void") return "void";
  const hitCover = coverWanted(row) && filetHit(row);
  if (row.result === "win") return "juste";
  if (hitCover) return "couvert";
  return "faux";
}

function uniquePronos(rows: TicketRow[]): TicketRow[] {
  return uniqueByFixture(rows.filter((r) => isRoiEligibleDecision(r.decision) && isMethodPick(r) && (r.result === "win" || r.result === "lose")));
}

function coverWanted(row: TicketRow): boolean {
  const c = filetOdds(row);
  if (c < 4.5) return false;
  if (row.coverScore) return true;
  if (row.market === "1X2_D" || row.market === "DC_1X" || row.market === "DC_X2") return false;
  if (row.pDraw == null || row.pDraw < 0.25) return false;
  return c >= 7;
}

function filetOdds(row: TicketRow): number {
  const c = row.coverOdds ?? 0;
  if (c < 1.05) return 0;
  return c;
}

function filetHit(row: TicketRow): boolean {
  if (row.goalsHome == null || row.goalsAway == null) return false;
  return coverHitsScore(row.coverScore, row.goalsHome, row.goalsAway);
}

function settleReturn(row: TicketRow, mainStake: number): number {
  const C = filetOdds(row);
  const H = coverWanted(row) ? coverStakeOf(C, mainStake) : 0;
  let ret = 0;
  if (row.result === "win") ret += mainStake * row.odds;
  if (filetHit(row) && C && H > 0) ret += H * C;
  return ret;
}

export function simulateStake(rows: TicketRow[], stake = 100): BankSim {
  const picks = uniquePronos(rows);
  let mainStaked = 0;
  let mainReturned = 0;
  let coverStaked = 0;
  let coverReturned = 0;
  let hits = 0;
  let covered = 0;
  for (const r of picks) {
    const C = filetOdds(r);
    const H = coverWanted(r) ? coverStakeOf(C, stake) : 0;
    mainStaked += stake;
    coverStaked += H;
    if (r.result === "win") mainReturned += stake * r.odds;
    if (filetHit(r) && C && H > 0) coverReturned += H * C;
    const v = rowVerdict(r);
    if (v === "juste") hits += 1;
    if (v === "couvert") covered += 1;
  }
  const staked = mainStaked + coverStaked;
  const returned = mainReturned + coverReturned;
  const profit = returned - staked;
  return {
    n: picks.length,
    stake,
    staked,
    returned,
    profit,
    roi: staked ? profit / staked : 0,
    hits,
    covered,
    mainStaked,
    mainReturned,
    coverStaked,
    coverReturned,
  };
}

export function simulateMises(rows: TicketRow[], stake = 100): BankSim {
  const picks = uniqueByFixture(
    rows.filter(
      (r) =>
        r.kind === "mise" &&
        isRoiEligibleDecision(r.decision) &&
        isCanonicalRoi5Selection(r) &&
        r.book !== "clôture" &&
        (r.result === "win" || r.result === "lose"),
    ),
  );
  let mainStaked = 0;
  let mainReturned = 0;
  let coverStaked = 0;
  let coverReturned = 0;
  let hits = 0;
  let covered = 0;
  for (const r of picks) {
    const C = filetOdds(r);
    const H = coverWanted(r) ? coverStakeOf(C, stake) : 0;
    mainStaked += stake;
    coverStaked += H;
    if (r.result === "win") mainReturned += stake * r.odds;
    if (filetHit(r) && C && H > 0) coverReturned += H * C;
    const v = rowVerdict(r);
    if (v === "juste") hits += 1;
    if (v === "couvert") covered += 1;
  }
  const staked = mainStaked + coverStaked;
  const returned = mainReturned + coverReturned;
  const profit = returned - staked;
  return {
    n: picks.length,
    stake,
    staked,
    returned,
    profit,
    roi: staked ? profit / staked : 0,
    hits,
    covered,
    mainStaked,
    mainReturned,
    coverStaked,
    coverReturned,
  };
}

export function reviewOf(rows: TicketRow[]): {
  n: number;
  pending: number;
  wins: number;
  losses: number;
  voids: number;
  precision: number;
  clv: number;
  extraMinEv: number;
  pronoN: number;
  pronoHits: number;
  pronoAcc: number;
  miseN: number;
  miseSettled: number;
  miseHits: number;
  misePending: number;
  sim: BankSim;
  simMise: BankSim;
  clNight: CupNightSim | null;
  rows: TicketRow[];
} {
  const live = rows.filter((r) => r.book !== "clôture" && r.result !== "void");
  const learned = selfLearn(live);
  const uniqueAll = uniqueByFixture(live.filter((r) => r.kind !== "mise" && isRoiEligibleDecision(r.decision) && isMethodPick(r)));
  const unique = uniqueAll.filter((r) => r.result === "win" || r.result === "lose");
  const pendingPronos = uniqueAll.filter((r) => !r.result);
  const pronoOk = unique.filter((r) => {
    const v = rowVerdict(r);
    return v === "juste" || v === "couvert";
  });
  const mises = uniqueByFixture(live.filter((r) => r.kind === "mise" && isCanonicalRoi5Selection(r)));
  const miseSettled = mises.filter((r) => r.result === "win" || r.result === "lose");
  const clvs = unique.map((r) => r.clv).filter((x): x is number => typeof x === "number");
  const table = [
    ...unique.sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
    ...pendingPronos.sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    ...mises.sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
  ];
  return {
    n: uniqueAll.length,
    pending: pendingPronos.length,
    wins: unique.filter((r) => r.result === "win").length,
    losses: unique.filter((r) => r.result === "lose").length,
    voids: live.filter((r) => r.result === "void").length,
    precision: unique.length ? unique.filter((r) => r.result === "win").length / unique.length : 0,
    clv: clvs.length ? clvs.reduce((a, b) => a + b, 0) / clvs.length : 0,
    extraMinEv: learned.extraMinEv,
    pronoN: unique.length,
    pronoHits: pronoOk.length,
    pronoAcc: unique.length ? pronoOk.length / unique.length : 0,
    miseN: mises.length,
    miseSettled: miseSettled.length,
    miseHits: miseSettled.filter((r) => r.result === "win").length,
    misePending: mises.filter((r) => !r.result).length,
    sim: simulateStake(live, 100),
    simMise: simulateMises(live, 100),
    clNight: lastCupNight(live, "CL", 100),
    rows: table.map((r) => ({
      ...r,
      pnl10: rowPnl(r),
      verdict: rowVerdict(r),
      filetUsed: coverWanted(r),
    })),
  };
}

export function getTicket(id: string): TicketRow | undefined {
  const rows = loadTickets();
  return rows.find((r) => r.id === id || r.id === `${id}:1X2` || r.matchId === id);
}
