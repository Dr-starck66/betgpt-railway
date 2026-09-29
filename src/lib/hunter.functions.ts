import { createServerFn } from "@tanstack/react-start";
import { ensureArchiveHistory, getArchiveHealth, loadArchiveHistory } from "@/engine/archive";
import {
  HUNTER_SCENARIOS,
  hunterAskQuery,
  hunterEvidenceOf,
  leagueTableFor,
  rankScenario,
  scenarioBySlug,
  toHunterMatch,
  type HunterRow,
  type HunterScenario,
} from "@/engine/hunter";
import { obsError, obsHunterTiming, obsInc, obsSnapshot } from "@/engine/obs";
import { versionCount } from "@/engine/prediction-versions";
import { ensureLive, getLiveSnapshot, hydrateLiveFromDisk } from "@/engine/live";
import { runEngine } from "@/engine/pipeline";
import {
  filterHistory,
  indexTeamRates,
  LEAGUE_FR,
  LEAGUE_SLUG,
  officialHistory,
  provenanceOf,
  scoreCounts,
  seasonLabel,
  SLUG_LEAGUE,
  zeroZeroByLeague,
  zeroZeroByTeam,
  type SeasonWindowId,
} from "@/engine/stats";
import type { LeagueId } from "@/engine/types";
import { allowHunterHeavy, captureClientIp } from "@/engine/guard";
import { explorerQuerySchema, hunterSlugParamSchema, idParamSchema, radarQuerySchema } from "@/lib/schemas";

const SEASONS: SeasonWindowId[] = ["all", "current", "prev", "last-3", "last-5"];

type HunterPack = {
  key: string;
  asOf: string;
  historyN: number;
  liveSource: string;
  provenance: ReturnType<typeof provenanceOf>;
  bySlug: Record<string, ReturnType<typeof rankScenario>>;
  degraded?: boolean;
  error?: string;
};

let PACK: HunterPack | null = (globalThis as typeof globalThis & { __betgptHunterPack?: HunterPack | null }).__betgptHunterPack ?? null;

function emptyPack(reason: string): HunterPack {
  obsError(reason);
  const bySlug: HunterPack["bySlug"] = {};
  const hist = officialArchive();
  const provenance = provenanceOf(hist);
  for (const sc of HUNTER_SCENARIOS) {
    bySlug[sc.slug] = {
      rows: [],
      prior: 0,
      nGlobal: 0,
      nLeague: {},
      provenance,
    };
  }
  return {
    key: "degraded",
    asOf: new Date().toISOString(),
    historyN: hist.length,
    liveSource: "indisponible",
    provenance,
    bySlug,
    degraded: true,
    error: reason,
  };
}

function setPack(next: HunterPack | null) {
  PACK = next;
  (globalThis as typeof globalThis & { __betgptHunterPack?: HunterPack | null }).__betgptHunterPack = next;
}

function officialArchive() {
  return officialHistory(loadArchiveHistory());
}

function liveKey(): string {
  const live = getLiveSnapshot();
  const n = officialArchive().length;
  // fetchedAt changes every score poll — must not bust the hunter pack or the page remounts.
  return `${n}:${live?.matches?.length ?? 0}`;
}

async function readyLive(): Promise<void> {
  hydrateLiveFromDisk();
  const archiveP = ensureArchiveHistory().catch(() => undefined);
  if (getLiveSnapshot()?.matches?.length) {
    void ensureLive().catch(() => undefined);
    await archiveP;
    return;
  }
  try {
    await Promise.race([ensureLive(), new Promise((r) => setTimeout(r, 8000))]);
  } catch {
    /* snapshot */
  }
  hydrateLiveFromDisk();
  await archiveP;
}

function computePack(): HunterPack {
  const t0 = Date.now();
  const key = liveKey();
  if (PACK && PACK.key === key) {
    obsHunterTiming(Date.now() - t0, true);
    return PACK;
  }
  const engine = runEngine();
  const hist = officialArchive();
  const rates = indexTeamRates(hist);
  const predById = new Map(engine.predictions.map((p) => [p.matchId, p]));
  const matches = engine.matches
    .map((m) => {
      const p = predById.get(m.id);
      return p ? toHunterMatch(m, p) : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const bySlug: HunterPack["bySlug"] = {};
  for (const sc of HUNTER_SCENARIOS) {
    bySlug[sc.slug] = rankScenario(sc, matches, hist, Date.now(), rates);
  }
  const first = bySlug[HUNTER_SCENARIOS[0]!.slug]!;
  PACK = {
    key,
    asOf: engine.liveAsOf,
    historyN: hist.length,
    liveSource: engine.liveSource,
    provenance: first.provenance,
    bySlug,
  };
  setPack(PACK);
  obsHunterTiming(Date.now() - t0, false);
  obsInc("hunter_compute", String(hist.length));
  return PACK;
}

async function computePackGuarded(): Promise<HunterPack> {
  await captureClientIp();
  const key = liveKey();
  if (PACK && PACK.key === key && !PACK.degraded) return PACK;
  if (!(await allowHunterHeavy()) && PACK) return PACK;
  try {
    return computePack();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "hunter_error";
    obsError(msg);
    return PACK ?? emptyPack(msg);
  }
}

function slimRow(row: HunterRow) {
  return {
    matchId: row.matchId,
    slug: row.slug,
    league: row.league,
    competition: row.competition,
    kickoff: row.kickoff,
    status: row.status,
    home: row.home,
    away: row.away,
    score: row.score,
    modelP: row.modelP,
    leagueFreq: row.leagueFreq,
    nLeague: row.nLeague,
    nHome: row.nHome,
    nAway: row.nAway,
    confidence: row.confidence,
    sampleNote: row.sampleNote,
    commentary: row.commentary,
    impliedP: row.impliedP,
    impliedNoVigP: row.impliedNoVigP,
    why: row.why,
  };
}

export const getHunterHome = createServerFn({ method: "GET" }).handler(async () => {
  await readyLive();
  const pack = await computePackGuarded();
  const featured = ["2-1", "over-2-5", "btts", "low-0-0", "0-0"];
  obsInc("hunter_home");
  return {
    asOf: pack.asOf,
    historyN: pack.historyN,
    source: pack.provenance.source,
    liveSource: pack.liveSource,
    degraded: Boolean(pack.degraded),
    error: pack.error ?? null,
    boards: featured.map((slug) => {
      const sc = scenarioBySlug(slug)!;
      const ranked = pack.bySlug[slug]!;
      return {
        slug,
        label: sc.label,
        short: sc.short,
        rows: ranked.rows.slice(0, 3).map(slimRow),
        n: ranked.rows.length,
      };
    }),
  };
});

export const getHunterIndex = createServerFn({ method: "GET" }).handler(async () => {
  await readyLive();
  const pack = await computePackGuarded();
  obsInc("hunter_index");
  return {
    asOf: pack.asOf,
    historyN: pack.historyN,
    source: pack.provenance.source,
    liveSource: pack.liveSource,
    degraded: Boolean(pack.degraded),
    error: pack.error ?? null,
    provenance: pack.provenance,
    scenarios: HUNTER_SCENARIOS.map((sc) => {
      const ranked = pack.bySlug[sc.slug]!;
      return {
        slug: sc.slug,
        label: sc.label,
        short: sc.short,
        kind: sc.kind,
        n: ranked.rows.length,
        top: ranked.rows[0] ? slimRow(ranked.rows[0]) : null,
        prior: ranked.prior,
      };
    }),
  };
});

export const getHunterScenario = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => hunterSlugParamSchema.parse(data))
  .handler(async ({ data }) => {
    const sc = scenarioBySlug(data.slug);
    if (!sc) return null;
    await readyLive();
    const pack = await computePackGuarded();
    const ranked = pack.bySlug[sc.slug]!;
    obsInc("hunter_scenario", sc.slug);
    return {
      asOf: pack.asOf,
      historyN: pack.historyN,
      source: pack.provenance.source,
      liveSource: pack.liveSource,
      degraded: Boolean(pack.degraded),
      error: pack.error ?? null,
      provenance: pack.provenance,
      scenario: sc,
      prior: ranked.prior,
      nGlobal: ranked.nGlobal,
      rows: ranked.rows.slice(0, 40).map(slimRow),
      leagues: leagueTableFor(sc, officialArchive()),
      ask: ranked.rows[0] ? hunterAskQuery(ranked.rows[0], sc) : "",
    };
  });

export const getMatchHunter = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => idParamSchema.parse(data))
  .handler(async ({ data }) => {
    await readyLive();
    const pack = await computePackGuarded();
    const scores = HUNTER_SCENARIOS.map((sc) => {
      const row = pack.bySlug[sc.slug]?.rows.find((r) => r.matchId === data.id || r.slug === data.id);
      if (!row) return null;
      return { slug: sc.slug, label: sc.label, short: sc.short, row: slimRow(row) };
    })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.row.score - a.row.score);
    obsInc("hunter_match", data.id);
    return {
      asOf: pack.asOf,
      historyN: pack.historyN,
      source: pack.provenance.source,
      scores: scores.slice(0, 8),
    };
  });

export const getScoreExplorer = createServerFn({ method: "GET" })
  .validator((data: { league?: string; season?: string; lastN?: number }) => explorerQuerySchema.parse(data))
  .handler(async ({ data }) => {
    await ensureArchiveHistory().catch(() => undefined);
    const hist = officialArchive();
    const league = data.league && data.league !== "all" ? SLUG_LEAGUE[data.league] ?? (data.league as LeagueId) : undefined;
    const season = SEASONS.includes(data.season as SeasonWindowId) ? (data.season as SeasonWindowId) : "all";
    const lastN = data.lastN && data.lastN > 0 ? Math.min(data.lastN, 5000) : undefined;
    const rows = filterHistory(hist, { league, season, lastN });
    const allCounts = scoreCounts(rows);
    const countsSum = allCounts.reduce((s, c) => s + c.n, 0);
    const counts = allCounts.slice(0, 24);
    const provenance = provenanceOf(rows);
    obsInc("explorer", league ?? "all");
    return {
      league: league ?? null,
      leagueLabel: league ? LEAGUE_FR[league] : "Toutes compétitions",
      season,
      seasonLabel: seasonLabel(season),
      lastN: lastN ?? null,
      provenance,
      historyN: hist.length,
      source: provenance.source,
      counts,
      countsSum,
      leagues: (Object.keys(LEAGUE_SLUG) as LeagueId[]).map((id) => ({
        id,
        slug: LEAGUE_SLUG[id],
        label: LEAGUE_FR[id],
      })),
    };
  });

export const getZeroRadar = createServerFn({ method: "GET" })
  .validator((data: { season?: string; sort?: "low" | "high" }) => radarQuerySchema.parse(data))
  .handler(async ({ data }) => {
    await ensureArchiveHistory().catch(() => undefined);
    const hist = officialArchive();
    const season = SEASONS.includes(data.season as SeasonWindowId) ? (data.season as SeasonWindowId) : "last-5";
    const rows = filterHistory(hist, { season });
    const leagues = zeroZeroByLeague(rows);
    const teams = zeroZeroByTeam(rows, 20);
    const sort = data.sort === "high" ? "high" : "low";
    const leagueBoard = sort === "high" ? [...leagues].reverse() : leagues;
    const teamBoard = sort === "high" ? [...teams].reverse() : teams;
    const provenance = provenanceOf(rows);
    obsInc("zero_radar", `${season}:${sort}`);
    return {
      season,
      seasonLabel: seasonLabel(season),
      sort,
      source: provenance.source,
      provenance,
      historyN: hist.length,
      leagues: leagueBoard,
      teams: teamBoard.slice(0, 40),
      empty: rows.length === 0,
    };
  });

export const getHunterObs = createServerFn({ method: "GET" }).handler(async () => {
  const hist = officialArchive();
  const live = getLiveSnapshot();
  const archive = getArchiveHealth();
  return {
    ...obsSnapshot(),
    historyN: hist.length,
    liveAsOf: live ? new Date(live.fetchedAt).toISOString() : null,
    liveN: live?.matches?.length ?? 0,
    cacheKey: liveKey(),
    source: archive.label,
    archive,
    predictionVersions: versionCount(),
  };
});

export function hunterChatFacts(): string {
  try {
    const pack = PACK ?? computePack();
    const lines: string[] = [
      `SCORE HUNTER — stats réelles ${pack.provenance.source}, n=${pack.historyN}. Ne pas inventer de chiffre.`,
      `Source live: ${pack.liveSource}. MAJ ${pack.asOf}.`,
      "Explain ONLY from the supplied evidence. Never invent a football statistic. Never pretend estimated data is observed data. If evidence is insufficient, say so.",
    ];
    const low = pack.bySlug["0-0"];
    if (low) {
      const table = leagueTableFor(scenarioBySlug("0-0")!, officialArchive());
      const few = [...table].sort((a, b) => a.freq - b.freq).slice(0, 3);
      const many = [...table].sort((a, b) => b.freq - a.freq).slice(0, 3);
      lines.push(
        `Ligues les moins 0-0: ${few.map((x) => `${x.label} ${(x.freq * 100).toFixed(1)}% n=${x.n}`).join(" · ")}`,
      );
      lines.push(
        `Ligues les plus 0-0: ${many.map((x) => `${x.label} ${(x.freq * 100).toFixed(1)}% n=${x.n}`).join(" · ")}`,
      );
    }
    const evidence = [];
    for (const slug of ["2-1", "over-2-5", "btts", "low-0-0", "0-0"]) {
      const sc = scenarioBySlug(slug);
      const top = pack.bySlug[slug]?.rows.slice(0, 3) ?? [];
      if (!sc || !top.length) continue;
      lines.push(
        `${sc.label}: ` +
          top
            .map(
              (r) =>
                `${r.home.short}-${r.away.short} ${r.score}/100 modèle ${(r.modelP * 100).toFixed(1)}% ligue ${(r.leagueFreq * 100).toFixed(1)}% n=${r.nLeague}`,
            )
            .join(" · "),
      );
      if (top[0]) evidence.push(hunterEvidenceOf(top[0], sc));
    }
    lines.push("EVIDENCE_JSON=" + JSON.stringify({ evidence, n: pack.historyN, source: pack.provenance.source }));
    return lines.join("\n");
  } catch {
    return "Score Hunter indisponible pour l’instant (pas de faux chiffres).";
  }
}

export function hunterLocalAnswer(q: string): string | null {
  const line = q.toLowerCase();
  const wants =
    /0-0|0 – 0|nul nul|score hunter|hunter|btts|both teams|plus de 2|over 2|2-1|1-1|fréquen|statist/.test(line);
  if (!wants) return null;
  try {
    void computePack();
    return [
      hunterChatFacts(),
      "",
      "Ces pourcentages sont des fréquences historiques ou des estimations de modèle. Pas une certitude. Pas un conseil de mise.",
    ].join("\n");
  } catch {
    return null;
  }
}

export type { HunterScenario };
