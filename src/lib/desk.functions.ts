import { createServerFn } from "@tanstack/react-start";
import { ensureLive, getUpcomingMatches, hydrateLiveFromDisk, bustLive, fetchEspnEvent } from "@/engine/live";
import { ensureArchiveHistory, loadArchiveHistory } from "@/engine/archive";
import {
  bustEngine,
  getPrediction,
  resolveStoredMatch,
  runEngine,
  predictMatch,
  type EngineRun,
} from "@/engine/pipeline";
import { matchFromHistory } from "@/engine/history-match";
import { loadAdmin, saveAdmin, hydrateAdmin, type AdminSettings } from "@/engine/admin";
import { logClick, recentClicks, safeAffiliateUrl } from "@/engine/clicks";
import { latestDigest } from "@/engine/email";
import { completeChat } from "@/lib/chat/complete";
import type { ChatRequestBody } from "@/lib/chat/types";
import { maybeRefreshIaDesk, readIaThread } from "@/engine/forum-ia";
import { buildForum } from "@/engine/forum";
import { legalIdentity, legalReady } from "@/lib/legal";
import { stripMarkup } from "./plain";
import type { LeagueId, MatchInput } from "@/engine/types";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { enqueueBroadcast, flushBroadcast } from "@/engine/broadcast";
import {
  adminDisabled,
  adminNeedsSetup,
  allowAdminLogin,
  allowChat,
  allowExplain,
  captureClientIp,
  issueAdminToken,
  setupAdmin,
  verifyAdminToken,
} from "@/engine/guard";
import { analyticsSummary } from "@/lib/store";
import { compactTickets } from "@/engine/ledger-pick";
import { loadTickets, getTicket, hydrateTickets, canonicalChampionRows } from "@/engine/ticket-log";
import { versionsFor, bustVersions, hydrateVersions } from "@/engine/prediction-versions";
import { pickMatchVideo } from "@/lib/serp/video-store";
import { slugify } from "@/lib/programmatic";
import { buildEdition, newsCards } from "@/lib/editorial/engine";
import { readLedgerDurable } from "@/lib/editorial/ledger-store";
import { calculateLedgerStats, ledgerHealth } from "@/engine/ledger-stats";
import { canonicalRoi5Evidence } from "@/engine/canonical-roi5-evidence";
import {
  eventsFor,
  hashIntegrity,
  lifecycle,
  lifecycleLabel,
  minutesBeforeKickoff,
  publishedBeforeKickoff,
  verifyLabel,
  verifyStatus,
} from "@/engine/verify";
import {
  affiliateClickSchema,
  chatBodySchema,
  explainSchema,
  homeSliceSchema,
  idParamSchema,
  pinBodySchema,
} from "@/lib/schemas";

type DeskPayload = ReturnType<typeof deskFromEngine>;
/** open-window: counts are live + upcoming, not four days of finished games. Bilan = mises only. */
const DESK_GEN = 47;
const deskMem = globalThis as typeof globalThis & {
  __betgptDeskGen?: number;
  __betgptLastDesk?: DeskPayload | null;
  __betgptDeskRefresh?: Promise<void> | null;
};
if (deskMem.__betgptDeskGen !== DESK_GEN) {
  deskMem.__betgptDeskGen = DESK_GEN;
  deskMem.__betgptLastDesk = null;
  deskMem.__betgptDeskRefresh = null;
  bustEngine();
  bustLive();
  bustVersions();
}
let LAST_DESK: DeskPayload | null = deskMem.__betgptLastDesk ?? null;
let DESK_REFRESH: Promise<void> | null = deskMem.__betgptDeskRefresh ?? null;

function setLastDesk(next: DeskPayload | null) {
  LAST_DESK = next;
  deskMem.__betgptLastDesk = next;
}

function pushBroadcast(desk: DeskPayload): void {
  if (process.env.BETGPT_OFFLINE === "1") return;
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const seen = new Set<string>();
    const tickets = [];
    for (const p of desk.predictions) {
      if (skipEuropeFrenchProno(p)) continue;
      const match = desk.matches.find((m) => m.id === p.matchId);
      if (match?.status === "finished") continue;
      const day = new Date(p.kickoff).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
      if (day !== today && match?.status !== "live") continue;
      const m = p.markets.find((x) => x.decision === "BET");
      if (!m || seen.has(p.matchId)) continue;
      seen.add(p.matchId);
      tickets.push({
        home: p.home.name,
        away: p.away.name,
        label: m.label,
        odds: m.bestOdds,
        league: p.league,
      });
    }
    enqueueBroadcast(tickets);
    void flushBroadcast().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

function refreshDesk(): void {
  if (DESK_REFRESH) return;
  DESK_REFRESH = (async () => {
    try {
      await ensureLive();
      const next = deskFromEngine(runEngine());
      setLastDesk(next);
      pushBroadcast(next);
      const peek = next.matches
        .slice(0, 8)
        .map((m) => `${m.home.name}–${m.away.name} ${m.status ?? ""}`)
        .join(" ; ");
      if (process.env.BETGPT_OFFLINE !== "1") void maybeRefreshIaDesk(peek).catch(() => undefined);
    } catch {
      /* keep last */
    } finally {
      DESK_REFRESH = null;
      deskMem.__betgptDeskRefresh = null;
    }
  })();
  deskMem.__betgptDeskRefresh = DESK_REFRESH;
}

function emptyDesk(): DeskPayload {
  return {
    summary: { asOf: new Date().toISOString(), nMatches: 0, nBet: 0, nWatch: 0, nNoBet: 0, meanAbsEdge: 0 },
    dailyBest: null,
    clPhaseBest: null,
    elPhaseBest: null,
    predictions: [],
    matches: [],
    championship: {
      models: [],
      coaches: [],
      tactical: { name: "tact", brier: 0, logLoss: 0, ece: 0, roi: 0, clv: 0, hitRate: 0, n: 0 },
      ensemble: { name: "ens", brier: 0, logLoss: 0, ece: 0, roi: 0, clv: 0, hitRate: 0, n: 0 },
      rows: [],
      walkForward: [],
      ablation: [],
      agentLeague: {},
    },
    reliability: 0,
    calMethod: "none",
    rho: 0,
    historyN: 0,
    agentWeights: {},
    engineVersion: "betgpt",
    tacticalVersion: "coach",
    liveAsOf: new Date().toISOString(),
    liveSource: "hors ligne",
    liveWindow: "",
    liveStale: true,
    review: { n: 0, acc: 0, brier: 0, logloss: 0, clv: 0, coverHit: 0, rows: [] },
    errorLearn: null,
    archive: null,
    evidence: calculateLedgerStats([]),
  } as unknown as DeskPayload;
}

export const getDesk = createServerFn({ method: "GET" }).handler(async (): Promise<DeskPayload> => {
  LAST_DESK = deskMem.__betgptLastDesk ?? LAST_DESK;
  DESK_REFRESH = deskMem.__betgptDeskRefresh ?? DESK_REFRESH;
  void DESK_GEN;
  await Promise.all([hydrateTickets(), hydrateVersions()]).catch(() => undefined);
  if (
    LAST_DESK?.matches?.some((m) => {
      const ko = Date.parse(m.kickoff);
      if (!Number.isFinite(ko) || Date.now() < ko) return false;
      if (m.status === "live" || m.status === "finished") return false;
      return (m.current ?? []).some(
        (b) => Math.min(b.home, b.draw, b.away) < 1.45 && Math.max(b.home, b.draw, b.away) >= 8,
      );
    })
  ) {
    setLastDesk(null);
    bustEngine();
    bustLive();
  }
  hydrateLiveFromDisk();
  try {
    const liveBudget = getUpcomingMatches().length > 0 ? 2500 : 8000;
    await Promise.race([ensureLive(), new Promise((r) => setTimeout(r, liveBudget))]);
  } catch {
    /* last snapshot */
  }
  hydrateLiveFromDisk();
  const liveMatches = getUpcomingMatches() as MatchInput[];
  const liveNear = comingCount(liveMatches);
  const deskNear = comingCount(LAST_DESK?.matches);
  if (LAST_DESK && LAST_DESK.matches.length > 0 && liveNear === 0) {
    refreshDesk();
    void flushBroadcast().catch(() => undefined);
    return LAST_DESK;
  }
  if (LAST_DESK && liveNear > 0 && deskNear >= liveNear && LAST_DESK.matches.length >= liveMatches.length) {
    refreshDesk();
    void flushBroadcast().catch(() => undefined);
    return LAST_DESK;
  }
  void ensureArchiveHistory().catch(() => undefined);
  try {
    const e = runEngine();
    setLastDesk(deskFromEngine(e));
    if (LAST_DESK?.matches.length) pushBroadcast(LAST_DESK);
    return LAST_DESK ?? emptyDesk();
  } catch (err) {
    console.error("[desk]", err instanceof Error ? err.stack ?? err.message : err);
    if (LAST_DESK && LAST_DESK.matches.length) return LAST_DESK;
    hydrateLiveFromDisk();
    try {
      const e = runEngine();
      setLastDesk(deskFromEngine(e));
      return LAST_DESK ?? emptyDesk();
    } catch (err2) {
      console.error("[desk retry]", err2 instanceof Error ? err2.message : err2);
      return LAST_DESK && LAST_DESK.matches.length ? LAST_DESK : emptyDesk();
    }
  }
});

/** Accueil : même desk, sans le ballast (championship, coaches, archive) qui gonfle l'HTML. */
export const getHomeDesk = createServerFn({ method: "GET" }).handler(async () => {
  const d = (await getDesk()) ?? emptyDesk();
  const ordered = orderHomeMatches(d.matches);
  const first = ordered.slice(0, 10);
  const ids = new Set(first.map((m) => m.id));
  if (d.dailyBest?.prediction.matchId) ids.add(d.dailyBest.prediction.matchId);
  let news: ReturnType<typeof newsCards> = { published: [], planned: [] };
  try {
    news = newsCards(
      buildEdition({
        now: new Date(),
        matches: d.matches,
        frozen: await readLedgerDurable(),
        models: d.predictions.flatMap((prediction) => {
          const home = prediction.calibrated?.home;
          const draw = prediction.calibrated?.draw;
          const away = prediction.calibrated?.away;
          if (home == null || draw == null || away == null) return [];
          return [{ matchId: prediction.matchId, timestamp: prediction.timestamp, home, draw, away }];
        }),
      }),
    );
  } catch (err) {
    console.error("[editorial]", err instanceof Error ? err.message : err);
  }
  return {
    summary: d.summary,
    dailyBest: d.dailyBest,
    leagues: [...new Set(d.matches.map((m) => m.league))],
    total: ordered.length,
    matches: d.matches.filter((m) => ids.has(m.id)).map(cardMatch),
    predictions: d.predictions.filter((p) => ids.has(p.matchId)).map(cardPrediction),
    news,
  };
});

export const getHomeSlice = createServerFn({ method: "GET" })
  .validator((data: { offset: number; league: LeagueId | "ALL" }) => {
    const parsed = homeSliceSchema.parse(data);
    return { offset: parsed.offset, league: parsed.league as LeagueId | "ALL" };
  })
  .handler(async ({ data }) => {
    const d = (await getDesk()) ?? emptyDesk();
    const visible = orderHomeMatches(d.matches).filter(
      (m) => data.league === "ALL" || m.league === data.league,
    );
    const slice = visible.slice(data.offset, data.offset + 10);
    const ids = new Set(slice.map((m) => m.id));
    return {
      total: visible.length,
      matches: slice.map(cardMatch),
      predictions: d.predictions.filter((p) => ids.has(p.matchId)).map(cardPrediction),
    };
  });

function publicReview(d: DeskPayload) {
  return { ...d.review, rows: [] as typeof d.review.rows };
}

/** SEO/public pages: card-level matches, no championship/archive/review rows. */
export function publicBoard(d: DeskPayload, league?: LeagueId) {
  const pool = (league ? d.matches.filter((m) => m.league === league) : d.matches).filter(onBoard);
  const ranked = pool.slice().sort((a, b) => {
    const rank = (s?: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
    const dlt = rank(a.status) - rank(b.status);
    return dlt !== 0 ? dlt : a.kickoff.localeCompare(b.kickoff);
  });
  const cap = 40;
  const matches = ranked.slice(0, cap).map(cardMatch);
  const ids = new Set(matches.map((m) => m.id));
  if (d.dailyBest?.prediction.matchId) ids.add(d.dailyBest.prediction.matchId);
  if (d.clPhaseBest?.prediction.matchId) ids.add(d.clPhaseBest.prediction.matchId);
  if (d.elPhaseBest?.prediction.matchId) ids.add(d.elPhaseBest.prediction.matchId);
  return {
    summary: d.summary,
    dailyBest: d.dailyBest,
    clPhaseBest: !league || league === "CL" ? d.clPhaseBest : null,
    elPhaseBest: !league || league === "EL" ? d.elPhaseBest : null,
    matches,
    predictions: d.predictions.filter((p) => ids.has(p.matchId)).map(cardPrediction),
    reliability: d.reliability,
    calMethod: d.calMethod,
    historyN: d.historyN,
    liveAsOf: d.liveAsOf,
    liveSource: d.liveSource,
    liveWindow: d.liveWindow,
    liveStale: d.liveStale,
    review: publicReview(d),
    engineVersion: d.engineVersion,
    tacticalVersion: d.tacticalVersion,
    rho: d.rho,
    championship: {
      models: [],
      coaches: [],
      tactical: d.championship.tactical,
      ensemble: d.championship.ensemble,
      rows: [],
      walkForward: [],
      ablation: [],
      agentLeague: {},
    },
    archive: null as DeskPayload["archive"],
    evidence: d.evidence,
    errorLearn: null as unknown as DeskPayload["errorLearn"],
    agentWeights: {} as DeskPayload["agentWeights"],
  };
}

export type PublicDesk = ReturnType<typeof publicBoard>;

export const getPublicDesk = createServerFn({ method: "GET" }).handler(async () => {
  const d = (await getDesk()) ?? emptyDesk();
  return publicBoard(d);
});

/** Day silo: filter before the 40-card cap so a busy board cannot hide the date. */
export const getDayDesk = createServerFn({ method: "GET" })
  .validator((data: { day: string }) => {
    const day = String(data?.day ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("jour");
    return { day };
  })
  .handler(async ({ data }) => {
    const d = (await getDesk()) ?? emptyDesk();
    const matches = d.matches.filter((m) => onBoard(m) && parisDay(m.kickoff) === data.day);
    return publicBoard({ ...d, matches });
  });

/** Team hub: full desk, then engine, then archive. Not the 40-card public board. */
export const getTeamDesk = createServerFn({ method: "GET" })
  .validator((data: { team: string }) => {
    const team = slugify(String(data?.team ?? ""));
    if (!team) throw new Error("équipe");
    return { team };
  })
  .handler(async ({ data }) => {
    const same = (name: string) => slugify(name) === data.team;
    const desk = (await getDesk()) ?? emptyDesk();
    let matches = desk.matches.filter((m) => same(m.home.name) || same(m.away.name));
    let predictions = desk.predictions.filter((p) => matches.some((m) => m.id === p.matchId));
    if (!matches.length) {
      try {
        const engine = runEngine();
        matches = engine.matches.filter((m) => same(m.home.name) || same(m.away.name));
        predictions = engine.predictions.filter((p) => matches.some((m) => m.id === p.matchId));
      } catch {
        /* archive below */
      }
    }
    if (!matches.length) {
      matches = loadArchiveHistory()
        .filter((h) => same(h.homeName ?? "") || same(h.awayName ?? ""))
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
        .slice(0, 16)
        .map(matchFromHistory);
      predictions = [];
    }
    if (!matches.length) return null;
    const ordered = matches.slice().sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, 24);
    const sample = ordered.find((m) => same(m.home.name)) ?? ordered[0]!;
    const name = same(sample.home.name) ? sample.home.name : sample.away.name;
    const ids = new Set(ordered.map((m) => m.id));
    return {
      name,
      team: data.team,
      matches: ordered.map(cardMatch),
      predictions: predictions.filter((p) => ids.has(p.matchId)).map(cardPrediction),
    };
  });

export const getLeagueDesk = createServerFn({ method: "GET" })
  .validator((data: { league: LeagueId }) => {
    const league = homeSliceSchema.shape.league.parse(data.league) as LeagueId;
    return { league };
  })
  .handler(async ({ data }) => {
    const d = (await getDesk()) ?? emptyDesk();
    return publicBoard(d, data.league);
  });

export const getChampionshipDesk = createServerFn({ method: "GET" }).handler(async () => {
  const d = (await getDesk()) ?? emptyDesk();
  return {
    championship: {
      ...d.championship,
      walkForward: d.championship.walkForward?.slice(-8) ?? [],
    },
    historyN: d.historyN,
    reliability: d.reliability,
    agentWeights: d.agentWeights,
  };
});

/** Bilan public : pas de desk complet (1 Mo+). */
export const getLedgerDesk = createServerFn({ method: "GET" }).handler(async () => {
  const d = (await getDesk()) ?? emptyDesk();
  const canonicalReplay = canonicalRoi5Evidence();
  return {
    review: d.review,
    evidence: d.evidence,
    canonicalReplay,
    championship: {
      models: d.championship.models,
      coaches: [] as typeof d.championship.coaches,
      tactical: d.championship.tactical,
      ensemble: d.championship.ensemble,
      walkForward: [] as typeof d.championship.walkForward,
      ablation: d.championship.ablation,
      agentLeague: {} as typeof d.championship.agentLeague,
    },
    archive: {
      years: "replay chronologique canonique",
      n: canonicalReplay.summary.n,
      acc: canonicalReplay.summary.hitRate,
      coverHit: canonicalReplay.summary.hedges
        ? canonicalReplay.summary.hedgeHits / canonicalReplay.summary.hedges
        : 0,
      cover11Hit: 0,
      coverWhenLose: 0,
      cover11WhenLose: 0,
      staked: canonicalReplay.summary.capital * 100,
      profit: canonicalReplay.summary.profit * 100,
      roi: canonicalReplay.summary.roi,
      byLeague: [],
      notes: [
        "Champion canonique ROI5 : gate de dominance 1X2 verrouillé en production.",
        `Replay chronologique : ${canonicalReplay.summary.n} sélections, ROI ${(canonicalReplay.summary.roi * 100).toFixed(2)} %, drawdown max ${canonicalReplay.summary.maxDrawdown.toFixed(2)} unités.`,
        `Validation chronologique séparée : ${canonicalReplay.summary.validationN} sélections, ROI ${(canonicalReplay.summary.validationRoi * 100).toFixed(2)} %, drawdown max ${canonicalReplay.summary.validationMaxDrawdown.toFixed(2)} unités.`,
        canonicalReplay.oddsDisclosure,
        canonicalReplay.scoreDisclosure,
        "Performance historique : aucun rendement futur n’est garanti.",
      ],
    } as typeof d.archive,
    historyN: d.historyN,
    liveAsOf: d.liveAsOf,
    reliability: d.reliability,
    errorLearn: d.errorLearn,
  };
});

function deskFromEngine(e: EngineRun) {
  return {
    summary: e.summary,
    dailyBest: e.dailyBest
      ? {
          prediction: slimPrediction(e.dailyBest.prediction),
          market: e.dailyBest.market,
        }
      : null,
    clPhaseBest: e.clPhaseBest
      ? {
          prediction: slimPrediction(e.clPhaseBest.prediction),
          market: e.clPhaseBest.market,
          phaseLabel: e.clPhaseBest.phaseLabel,
        }
      : null,
    elPhaseBest: e.elPhaseBest
      ? {
          prediction: slimPrediction(e.elPhaseBest.prediction),
          market: e.elPhaseBest.market,
          phaseLabel: e.elPhaseBest.phaseLabel,
        }
      : null,
    predictions: e.predictions.map(slimPrediction),
    matches: e.matches.map(slimMatch),
    championship: {
      ...e.learned.championship,
      walkForward: e.learned.championship.walkForward?.slice(-8) ?? [],
    },
    reliability: e.learned.tacticalReliability,
    calMethod: e.learned.calMethod,
    rho: e.learned.rho,
    historyN: e.historyN,
    agentWeights: e.learned.agentWeights,
    engineVersion: e.predictions[0]?.engineVersion ?? "betgpt",
    tacticalVersion: e.predictions[0]?.tacticalVersion ?? "coach",
    liveAsOf: e.liveAsOf,
    liveSource: e.liveSource,
    liveWindow: e.liveWindow,
    liveStale: e.liveStale,
    review: {
      ...e.review,
      rows: e.review.rows.slice(0, 80),
    },
    errorLearn: e.learned.errorLearn,
    evidence: calculateLedgerStats(canonicalChampionRows(compactTickets(loadTickets()))),
    archive: e.archive
      ? {
          years: e.archive.years,
          n: e.archive.n,
          acc: e.archive.acc,
          coverHit: e.archive.coverHit,
          cover11Hit: e.archive.cover11Hit,
          coverWhenLose: e.archive.coverWhenLose,
          cover11WhenLose: e.archive.cover11WhenLose,
          staked: e.archive.staked,
          profit: e.archive.profit,
          roi: e.archive.roi,
          byLeague: e.archive.byLeague,
          notes: e.archive.notes,
        }
      : null,
  };
}

export const warmDesk = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureLive();
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
});

function slimPrediction<
  T extends {
    markets: { group: string; decision: string }[];
    models: unknown[];
    ensemble: { matrix?: unknown };
    features?: unknown;
    scenarios?: unknown[];
    coaches?: {
      keyReasons?: string[];
      contradictions?: string[];
      missingInformation?: string[];
      signals?: unknown;
    }[];
  },
>(p: T): T {
  return {
    ...p,
    markets: p.markets.filter((m) => m.group === "1X2" || m.decision !== "NO_BET") as T["markets"],
    models: [],
    ensemble: { ...p.ensemble, matrix: [] },
    features: {},
    scenarios: [],
    coaches: (p.coaches ?? []).map((c) => ({
      ...c,
      signals: {},
      keyReasons: (c.keyReasons ?? []).slice(0, 1).filter((x) => !/\bPPDA\b|field tilt/i.test(x)),
      contradictions: [],
      missingInformation: [],
    })),
  };
}

function slimTeam(t: MatchInput["home"]) {
  return {
    id: t.id,
    name: t.name,
    short: t.short,
    logo: t.logo,
    league: t.league,
    color: t.color,
    attack: t.attack,
    defense: t.defense,
    elo: t.elo,
    xgFor: t.xgFor,
    xgAgainst: t.xgAgainst,
    possession: t.possession,
    ppda: t.ppda,
    fieldTilt: t.fieldTilt,
    compactness: t.compactness,
    setPieceXg: t.setPieceXg,
    duelWin: t.duelWin,
    cardsPerGame: t.cardsPerGame,
    flexibility: t.flexibility,
    pressLine: t.pressLine,
    buildup: t.buildup,
    depth: t.depth,
    formation: t.formation,
    progressivePasses: t.progressivePasses,
    highTurnovers: t.highTurnovers,
    recoveries: t.recoveries,
  };
}

function slimMatch(m: MatchInput): MatchInput {
  return {
    ...m,
    home: slimTeam(m.home) as MatchInput["home"],
    away: slimTeam(m.away) as MatchInput["away"],
    notes: (m.notes ?? []).slice(0, 2),
    current: (m.current ?? []).slice(0, 8),
    absencesHome: { ...m.absencesHome, value: [] },
    absencesAway: { ...m.absencesAway, value: [] },
  };
}

function cardTeam(t: MatchInput["home"]) {
  return {
    id: t.id,
    name: t.name,
    short: t.short,
    logo: t.logo,
    league: t.league,
    color: t.color,
    formation: t.formation,
    attack: 0,
    defense: 0,
    elo: 0,
    xgFor: 0,
    xgAgainst: 0,
    possession: 0,
    ppda: 0,
    fieldTilt: 0,
    progressivePasses: 0,
    highTurnovers: 0,
    recoveries: 0,
    compactness: 0,
    setPieceXg: 0,
    duelWin: 0,
    cardsPerGame: 0,
    flexibility: 0,
    pressLine: 0,
    buildup: 0,
    depth: 0,
  };
}

function cardMatch(m: MatchInput): MatchInput {
  return {
    id: m.id,
    slug: m.slug,
    league: m.league,
    competition: m.competition,
    kickoff: m.kickoff,
    venue: m.venue,
    status: m.status,
    clock: m.clock,
    scoreHome: m.scoreHome,
    scoreAway: m.scoreAway,
    home: cardTeam(m.home) as MatchInput["home"],
    away: cardTeam(m.away) as MatchInput["away"],
    restHome: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    restAway: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    travelAwayKm: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    congestionHome: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    congestionAway: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    absencesHome: { value: [], source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    absencesAway: { value: [], source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    importance: { value: 0, source: "", timestamp: m.kickoff, confidence: 0, freshnessHours: 0 },
    notes: [],
    incidents: m.incidents ?? [],
    current: (m.current ?? []).slice(0, 3).map((b) => ({
      book: b.book,
      home: b.home,
      draw: b.draw,
      away: b.away,
      over15: 0,
      over25: 0,
      over35: 0,
      under25: 0,
      bttsYes: 0,
      bttsNo: 0,
      url: b.url,
    })),
    opening: {
      book: "",
      home: 0,
      draw: 0,
      away: 0,
      over15: 0,
      over25: 0,
      over35: 0,
      under25: 0,
      bttsYes: 0,
      bttsNo: 0,
    },
  } as MatchInput;
}

function cardPrediction<T extends { markets: { group: string; decision: string }[] }>(p: T): T {
  return {
    ...p,
    markets: p.markets.filter((m) => m.group === "1X2" || m.decision === "BET") as T["markets"],
    models: [],
    ensemble: { lambdaHome: 0, lambdaAway: 0, home: 0, draw: 0, away: 0, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0, matrix: [], weights: {}, disagreement: 0 },
    features: [],
    scenarios: [],
    coaches: [],
    devil: { predictionChallengeScore: 0, riskFactors: [], alternativeScenario: "", confidenceReduction: 0 },
    intelligence: { modelDisagreement: 0, confidenceScore: 0, dataQuality: 0 },
    consensus: { home: 0, draw: 0, away: 0, disagreement: 0, conflictScore: 0, directionalAgreement: 0, marketAgreement: 0, statisticalAgreement: 0, confidenceWeighted: false },
    meta: { tacticalAdjustment: { home: 0, draw: 0, away: 0 }, tacticalReliability: 0, blended: { home: 0, draw: 0, away: 0 } },
    agentWeights: {},
    availableInformation: [],
    liveSuper: null,
    live: undefined,
    notes: [],
    bookLinks: [],
  } as T;
}

function parisDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function comingCount(matches?: MatchInput[]): number {
  const now = Date.now();
  const horizon = now + 21 * 864e5;
  return (matches ?? []).filter((m) => {
    const ko = Date.parse(m.kickoff);
    return Number.isFinite(ko) && ko >= now - 36 * 36e5 && ko <= horizon && m.status !== "cancelled" && m.status !== "finished";
  }).length;
}

function onBoard(m: MatchInput, now = Date.now()): boolean {
  const ko = Date.parse(m.kickoff);
  if (!Number.isFinite(ko) || m.status === "cancelled") return false;
  if (m.status === "finished") return parisDay(m.kickoff) === parisToday(now);
  if (m.status === "live") return now - ko < 3 * 36e5;
  return ko >= now - 20 * 60e3;
}

function parisToday(now = Date.now()): string {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function orderHomeMatches(matches: MatchInput[]): MatchInput[] {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const now = Date.now();
  const rank = (m: MatchInput) => {
    const ko = Date.parse(m.kickoff);
    const past = Number.isFinite(ko) && ko < now - 20 * 60e3;
    if (m.status === "live" && !past) return 0;
    const day = parisDay(m.kickoff);
    const cup = m.league === "CL" || m.league === "EL";
    if (!past && day === today && cup) return 1;
    if (!past && day === today) return 2;
    if (!past && m.status === "scheduled") return 3;
    if (m.status === "finished") return 4;
    return 5;
  };
  return matches.filter((m) => onBoard(m, now)).slice().sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return a.kickoff.localeCompare(b.kickoff);
  });
}

export const getLiveTick = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureLive();
  } catch {
    /* snapshot */
  }
  return (getUpcomingMatches() as MatchInput[])
    .filter((m: MatchInput) => m.status === "live" || m.status === "finished")
    .map((m: MatchInput) => ({
      id: m.id,
      h: m.scoreHome ?? 0,
      a: m.scoreAway ?? 0,
      clock: m.clock,
      status: m.status,
    }));
});

function slimForumThread(t: ReturnType<typeof buildForum>[number]) {
  return {
    ...t,
    excerpt: t.excerpt.slice(0, 180),
    posts: t.posts.slice(0, 12).map((p) => ({ ...p, body: p.body.slice(0, 360) })),
  };
}

async function forumDesk() {
  LAST_DESK = deskMem.__betgptLastDesk ?? LAST_DESK;
  DESK_REFRESH = deskMem.__betgptDeskRefresh ?? DESK_REFRESH;
  if (LAST_DESK) {
    refreshDesk();
    void flushBroadcast().catch(() => undefined);
    return LAST_DESK;
  }
  try {
    await ensureLive();
  } catch {
    /* */
  }
  try {
    setLastDesk(deskFromEngine(runEngine()));
  } catch {
    /* */
  }
  return LAST_DESK ?? emptyDesk();
}

export const getForum = createServerFn({ method: "GET" }).handler(async () => {
  const desk = await forumDesk();
  const ia = readIaThread();
  const threads = buildForum(desk.matches, desk.predictions, ia ? [ia] : [])
    .map(slimForumThread)
    .slice(0, 40);
  return { threads, live: desk.matches.some((m) => m.status === "live") };
});

export const getForumThread = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => idParamSchema.parse(data))
  .handler(async ({ data }) => {
    const desk = await forumDesk();
    const ia = readIaThread();
    const liveThread = buildForum(desk.matches, desk.predictions, ia ? [ia] : [])
      .map(slimForumThread)
      .find((t) => t.id === data.id);
    if (liveThread) return liveThread;

    // The public desk can be a short window. A match page still resolves from
    // the engine or the archive — the forum URL must do the same.
    const stored = getPrediction(data.id) ?? resolveStoredMatch(data.id);
    if (!stored) return null;
    const matchId = stored.match.slug ?? stored.match.id;
    if (skipEuropeFrenchProno(stored.match)) return { redirectMatchId: matchId };
    const thread = buildForum([stored.match], [stored.prediction])
      .map(slimForumThread)
      .find((t) => t.matchHref);
    return thread ?? { redirectMatchId: matchId };
  });

function sistersFor(match: MatchInput): MatchInput[] {
  const live = LAST_DESK?.matches ?? [];
  const fromLive = live.filter((m) => m.league === match.league && m.id !== match.id).slice(0, 8);
  if (fromLive.length) return fromLive;
  try {
    const ko = Date.parse(match.kickoff);
    return loadArchiveHistory()
      .filter((h) => h.league === match.league && h.id !== match.id)
      .sort((a, b) => Math.abs(Date.parse(a.kickoff) - ko) - Math.abs(Date.parse(b.kickoff) - ko))
      .slice(0, 8)
      .map((h) => matchFromHistory(h));
  } catch {
    return [];
  }
}

async function withObservedForm<T extends { match: MatchInput }>(found: T): Promise<T> {
  try {
    const { hydrateMatchForm } = await import("@/engine/team-form-live");
    await hydrateMatchForm([found.match], { limit: 2 });
  } catch {
    /* form stays unobserved */
  }
  return found;
}

function packMatchDesk(found: { match: MatchInput; prediction: ReturnType<typeof predictMatch> }) {
  return {
    ...found,
    sisters: sistersFor(found.match),
    ticket: getTicket(found.match.id) ?? null,
    versions: versionsFor(found.match.id),
    liveAsOf: LAST_DESK?.liveAsOf ?? null,
    video: pickMatchVideo(found.match),
  };
}

export const getMatchDesk = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => idParamSchema.parse(data))
  .handler(async ({ data }) => {
    const cached = getPrediction(data.id);
    if (cached) {
      refreshDesk();
      return packMatchDesk(await withObservedForm(cached));
    }
    try {
      await Promise.race([ensureLive(), new Promise((r) => setTimeout(r, 8000))]);
    } catch {
      /* stale */
    }
    const found = getPrediction(data.id);
    if (found) {
      try {
        setLastDesk(deskFromEngine(runEngine()));
      } catch {
        /* */
      }
      return packMatchDesk(await withObservedForm(found));
    }
    try {
      const espn = await fetchEspnEvent(data.id);
      if (espn) {
        const prediction = predictMatch(espn as MatchInput);
        return packMatchDesk(await withObservedForm({ match: espn as MatchInput, prediction }));
      }
    } catch {
      /* ESPN down */
    }
    return null;
  });

export const getEvidence = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => idParamSchema.parse(data))
  .handler(async ({ data }) => {
    const id = decodeURIComponent(data.id);
    const row = getTicket(id);
    if (!row) return null;
    const status = verifyStatus(row);
    const life = lifecycle(row);
    return {
      row,
      status,
      statusLabel: verifyLabel(status),
      lifecycle: life,
      lifecycleLabel: lifecycleLabel(life),
      beforeKickoff: publishedBeforeKickoff(row),
      minutes: minutesBeforeKickoff(row),
      integrity: status === "unverified" || status === "legacy" ? "unavailable" : hashIntegrity(row),
      events: eventsFor(row.id),
    };
  });

export const getLedgerHealth = createServerFn({ method: "GET" }).handler(async () => {
  return ledgerHealth(loadTickets());
});

export const getLegal = createServerFn({ method: "GET" }).handler(async () => {
  await hydrateAdmin();
  return legalIdentity();
});

export const getControlCenter = createServerFn({ method: "GET" }).handler(async () => {
  await hydrateAdmin();
  return {
    locked: true as const,
    needsSetup: adminNeedsSetup(),
    adminDisabled: adminDisabled(),
    legalReady: legalReady(),
  };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .validator((data: { pin: string }) => pinBodySchema.parse(data))
  .handler(async ({ data }) => {
    await captureClientIp();
    if (!(await allowAdminLogin())) return { ok: false as const, error: "Trop de tentatives." };
    if (adminDisabled()) return { ok: false as const, error: "Admin désactivé : ADMIN_KEY manquant." };
    const token = issueAdminToken(data.pin.slice(0, 128));
    if (!token) return { ok: false as const, error: "Clé refusée." };
    await hydrateAdmin();
    return {
      ok: true as const,
      token,
      admin: loadAdmin(),
      clicks: recentClicks(30),
      digest: latestDigest(),
      legalReady: legalReady(),
      analytics: await analyticsSummary(),
      ledger: ledgerHealth(loadTickets()),
    };
  });

export const setupAdminGate = createServerFn({ method: "POST" })
  .validator((data: { pin: string }) => pinBodySchema.parse(data))
  .handler(async ({ data }) => {
    await captureClientIp();
    if (!(await allowAdminLogin())) return { ok: false as const, error: "Trop de tentatives." };
    if (adminDisabled()) return { ok: false as const, error: "Admin désactivé : ADMIN_KEY manquant." };
    const r = setupAdmin(data.pin.slice(0, 128));
    if (!r.ok) return r;
    const token = issueAdminToken(data.pin);
    if (!token) return { ok: false as const, error: "Clé créée, reconnecte." };
    return { ok: true as const, token };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .validator((data: Partial<AdminSettings> & { leagues?: Partial<Record<LeagueId, boolean>>; token?: string }) => data)
  .handler(async ({ data }) => {
    const { token, ...rest } = data;
    if (!verifyAdminToken(token)) return { ok: false as const, error: "Session admin expirée." };
    const next = saveAdmin(rest);
    bustEngine();
    return { ok: true as const, admin: next };
  });

export const askBetgpt = createServerFn({ method: "POST" })
  .validator((data: ChatRequestBody) => chatBodySchema.parse(data) as ChatRequestBody)
  .handler(async ({ data }) => {
    await captureClientIp();
    if (!(await allowChat())) return { ok: false as const, error: "Trop de messages. Patiente une minute." };
    return completeChat(data);
  });

export const logAffiliateClick = createServerFn({ method: "POST" })
  .validator((data: { url: string; book: string; matchId: string }) => affiliateClickSchema.parse(data))
  .handler(async ({ data }) => {
    const target = safeAffiliateUrl(data.url);
    if (!target) return { ok: false as const, url: "/" };
    try {
      logClick(String(data.book).slice(0, 40), target, String(data.matchId ?? "").slice(0, 80));
    } catch {
      /* ignore */
    }
    return { ok: true as const, url: target };
  });

export const explainMatch = createServerFn({ method: "POST" })
  .validator((data: { matchId: string; market?: string }) => explainSchema.parse(data))
  .handler(async ({ data }) => {
    await captureClientIp();
    if (!(await allowExplain())) return { ok: false as const, error: "Trop de demandes. Patiente." };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Explication IA indisponible dans cet environnement." };
    }
    try {
      await ensureLive();
    } catch {
      /* continue */
    }
    const found = getPrediction(data.matchId);
    if (!found) return { ok: false as const, error: "Match introuvable." };
    const ens = found.prediction.ensemble;
    const cal = found.prediction.calibrated;
    const evidence = {
      match: `${found.match.home.name} – ${found.match.away.name}`,
      competition: found.match.competition,
      market: data.market ?? "1X2",
      modelHome: cal.home,
      modelDraw: cal.draw,
      modelAway: cal.away,
      expectedHomeGoals: ens.lambdaHome,
      expectedAwayGoals: ens.lambdaAway,
      over25: ens.over25,
      bttsYes: ens.bttsYes,
      provenance: "DERIVED_FROM_REAL_DATA" as const,
      teamProfileProvenance: "MODEL_ESTIMATE" as const,
    };
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          stream: false,
          temperature: 0.4,
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content:
                "Tu expliques un pronostic football en français clair, sans markdown. Explain ONLY from the supplied evidence. Never invent a football statistic. Never pretend estimated data is observed data. If evidence is insufficient, say so.",
            },
            {
              role: "user",
              content: JSON.stringify(evidence).slice(0, 2000),
            },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { ok: false as const, error: "Le desk ne répond pas." };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = stripMarkup(json.choices?.[0]?.message?.content ?? "").trim();
      if (!text) return { ok: false as const, error: "Réponse vide." };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "Connexion coupée." };
    }
  });
