import { clamp, sigmoid } from "./math.ts";
import {
  avg,
  bttsFreq,
  filterHistory,
  foldName,
  LEAGUE_FR,
  officialHistory,
  overFreq,
  provenanceOf,
  rate,
  sampleConfidence,
  scoreFreq,
  scoreKey,
  shrinkToMid,
  teamRates,
  lookupRates,
  type Provenance,
} from "./stats.ts";
import type { HistoricalMatch, LeagueId, MatchInput, PredictionRecord } from "./types.ts";

export type HunterKind = "exact" | "low-exact" | "over" | "btts";

export type HunterScenario = {
  slug: string;
  kind: HunterKind;
  label: string;
  short: string;
  home?: number;
  away?: number;
  minGoals?: number;
  bttsYes?: boolean;
};

export type HunterSignal = {
  label: string;
  value: string;
  n: number;
  layer: "history" | "model" | "market";
};

export type HunterRow = {
  matchId: string;
  slug: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  status: string;
  home: { id: string; name: string; short: string; logo?: string };
  away: { id: string; name: string; short: string; logo?: string };
  score: number;
  modelP: number;
  leagueFreq: number;
  teamP: number;
  prior: number;
  nLeague: number;
  nHome: number;
  nAway: number;
  nH2h: number;
  confidence: number;
  sampleNote: string;
  why: HunterSignal[];
  commentary: string;
  impliedP: number | null;
  impliedNoVigP: number | null;
  impliedBook: string | null;
  modelAvailable: boolean;
  lambdaHome: number | null;
  lambdaAway: number | null;
};

export const HUNTER_SCENARIOS: HunterScenario[] = [
  { slug: "0-0", kind: "exact", home: 0, away: 0, label: "0-0 Hunter", short: "0-0" },
  { slug: "low-0-0", kind: "low-exact", home: 0, away: 0, label: "Faible probabilité 0-0", short: "Peu de 0-0" },
  { slug: "1-0", kind: "exact", home: 1, away: 0, label: "1-0 Hunter", short: "1-0" },
  { slug: "0-1", kind: "exact", home: 0, away: 1, label: "0-1 Hunter", short: "0-1" },
  { slug: "1-1", kind: "exact", home: 1, away: 1, label: "1-1 Hunter", short: "1-1" },
  { slug: "2-0", kind: "exact", home: 2, away: 0, label: "2-0 Hunter", short: "2-0" },
  { slug: "0-2", kind: "exact", home: 0, away: 2, label: "0-2 Hunter", short: "0-2" },
  { slug: "2-1", kind: "exact", home: 2, away: 1, label: "2-1 Hunter", short: "2-1" },
  { slug: "1-2", kind: "exact", home: 1, away: 2, label: "1-2 Hunter", short: "1-2" },
  { slug: "2-2", kind: "exact", home: 2, away: 2, label: "2-2 Hunter", short: "2-2" },
  { slug: "3-1", kind: "exact", home: 3, away: 1, label: "3-1 Hunter", short: "3-1" },
  { slug: "1-3", kind: "exact", home: 1, away: 3, label: "1-3 Hunter", short: "1-3" },
  { slug: "over-1-5", kind: "over", minGoals: 2, label: "Plus de 1,5 buts", short: "Over 1.5" },
  { slug: "over-2-5", kind: "over", minGoals: 3, label: "Plus de 2,5 buts", short: "Over 2.5" },
  { slug: "over-3-5", kind: "over", minGoals: 4, label: "Plus de 3,5 buts", short: "Over 3.5" },
  { slug: "btts", kind: "btts", bttsYes: true, label: "BTTS — Oui", short: "BTTS oui" },
  { slug: "btts-no", kind: "btts", bttsYes: false, label: "BTTS — Non", short: "BTTS non" },
];

export function scenarioBySlug(slug: string): HunterScenario | undefined {
  return HUNTER_SCENARIOS.find((s) => s.slug === slug);
}

/**
 * Score Hunter 0–100 = relative statistical compatibility with the selected scenario.
 * It is NOT the probability that this exact result will happen. That figure is `modelP`
 * (Poisson / Dixon-Coles matrix). Example: 91/100 ranking with modelP = 11.8%.
 *
 * raw = 0.70 * modelScore + 0.20 * leagueScore + 0.10 * teamScore
 *   modelScore  — lift of the model scenario probability vs the league prior
 *   leagueScore — lift of empirical league frequency vs the global prior (50 if n < 30)
 *   teamScore   — lift of home/away empirical rates (50 if nHome+nAway < 8);
 *                 H2H mixes into teamP at 30% only when nH2h ≥ 6
 * score = round(shrinkToMid(raw, sampleConfidence(nLeague, nHome, nAway)))
 *   thin samples pull the score toward 50. Weights are explanatory, not fitted.
 */
export const HUNTER_RANKING = { model: 0.7, league: 0.2, team: 0.1 } as const;

export type HunterMatch = {
  id: string;
  slug?: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  status?: string;
  home: { id: string; name: string; short: string; logo?: string };
  away: { id: string; name: string; short: string; logo?: string };
  matrix: number[][];
  over15: number;
  over25: number;
  over35: number;
  bttsYes: number;
  implied?: {
    over15?: number;
    over25?: number;
    over35?: number;
    under25?: number;
    bttsYes?: number;
    bttsNo?: number;
    cs?: Record<string, number>;
  };
  impliedBook?: string;
  lambdaHome?: number;
  lambdaAway?: number;
};

export function hasMatrix(matrix: number[][] | undefined): boolean {
  return Boolean(matrix && matrix.length >= 4 && matrix[0] && matrix[0].length >= 4);
}

export function matrixCell(matrix: number[][], h: number, a: number): number {
  const row = matrix[h];
  if (!row) return 0;
  const p = row[a];
  return Number.isFinite(p) ? p : 0;
}

export function matrixOver(matrix: number[][], minGoals: number): number {
  let s = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]!;
    for (let j = 0; j < row.length; j++) {
      if (i + j >= minGoals) s += row[j]!;
    }
  }
  return s;
}

export function matrixBtts(matrix: number[][], yes: boolean): number {
  let s = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]!;
    for (let j = 0; j < row.length; j++) {
      const both = i > 0 && j > 0;
      if (both === yes) s += row[j]!;
    }
  }
  return s;
}

export function modelScenarioP(sc: HunterScenario, m: HunterMatch): number | null {
  if (sc.kind === "over") {
    if (hasMatrix(m.matrix)) return matrixOver(m.matrix, sc.minGoals ?? 3);
    if (sc.minGoals === 2) return m.over15;
    if (sc.minGoals === 3) return m.over25;
    if (sc.minGoals === 4) return m.over35;
    return null;
  }
  if (sc.kind === "btts") {
    if (hasMatrix(m.matrix)) return matrixBtts(m.matrix, sc.bttsYes !== false);
    return sc.bttsYes === false ? 1 - m.bttsYes : m.bttsYes;
  }
  if (!hasMatrix(m.matrix)) return null;
  const p = matrixCell(m.matrix, sc.home ?? 0, sc.away ?? 0);
  if (sc.kind === "low-exact") return 1 - p;
  return p;
}

function empirical(sc: HunterScenario, rows: HistoricalMatch[]): { n: number; freq: number } {
  if (sc.kind === "over") return overFreq(rows, sc.minGoals ?? 3);
  if (sc.kind === "btts") return bttsFreq(rows, sc.bttsYes !== false);
  const f = scoreFreq(rows, sc.home ?? 0, sc.away ?? 0);
  if (sc.kind === "low-exact") return { n: rows.length - f.n, freq: rows.length ? 1 - f.freq : 0 };
  return f;
}

function teamEmpiricalFromRates(
  sc: HunterScenario,
  home: ReturnType<typeof teamRates>,
  away: ReturnType<typeof teamRates>,
): { p: number; nHome: number; nAway: number } {
  const nHome = home.nHome;
  const nAway = away.nAway;
  let pHome = 0;
  let pAway = 0;
  if (sc.kind === "over") {
    pHome = rate(home.over25Home, nHome);
    pAway = rate(away.over25Away, nAway);
  } else if (sc.kind === "btts") {
    const yes = sc.bttsYes !== false;
    pHome = yes ? rate(home.bttsHome, nHome) : 1 - rate(home.bttsHome, nHome);
    pAway = yes ? rate(away.bttsAway, nAway) : 1 - rate(away.bttsAway, nAway);
  } else {
    const key = scoreKey(sc.home ?? 0, sc.away ?? 0);
    pHome = rate(home.exactHome.get(key) ?? 0, nHome);
    pAway = rate(away.exactAway.get(key) ?? 0, nAway);
    if (sc.kind === "low-exact") {
      pHome = 1 - rate(home.zeroZeroHome, nHome);
      pAway = 1 - rate(away.zeroZeroAway, nAway);
    }
  }
  const p = nHome + nAway > 0 ? (pHome * nHome + pAway * nAway) / (nHome + nAway) : 0;
  return { p, nHome, nAway };
}

type H2hIndex = {
  byHomeId: Map<string, HistoricalMatch[]>;
  byHomeName: Map<string, HistoricalMatch[]>;
};

function buildH2hIndex(rows: HistoricalMatch[]): H2hIndex {
  const byHomeId = new Map<string, HistoricalMatch[]>();
  const byHomeName = new Map<string, HistoricalMatch[]>();
  const push = (map: Map<string, HistoricalMatch[]>, key: string, m: HistoricalMatch) => {
    if (!key) return;
    const arr = map.get(key);
    if (arr) arr.push(m);
    else map.set(key, [m]);
  };
  for (const m of rows) {
    if (m.homeId) push(byHomeId, m.homeId, m);
    const name = m.homeName ? foldName(m.homeName) : "";
    if (name) push(byHomeName, name, m);
  }
  return { byHomeId, byHomeName };
}

function h2hEmpirical(
  sc: HunterScenario,
  index: H2hIndex,
  homeId: string,
  homeName: string,
  awayId: string,
  awayName: string,
): { p: number; n: number } {
  const homeFold = foldName(homeName);
  const awayFold = foldName(awayName);
  const seen = new Set<HistoricalMatch>();
  const directed: HistoricalMatch[] = [];
  const take = (list: HistoricalMatch[] | undefined) => {
    if (!list) return;
    for (const m of list) {
      if (seen.has(m)) continue;
      const awayOk = (awayId && m.awayId === awayId) || (awayFold && m.awayName && foldName(m.awayName) === awayFold);
      if (!awayOk) continue;
      seen.add(m);
      directed.push(m);
    }
  };
  if (homeId) take(index.byHomeId.get(homeId));
  if (homeFold) take(index.byHomeName.get(homeFold));
  const emp = empirical(sc, directed);
  return { p: emp.freq, n: directed.length };
}

function liftScore(p: number, prior: number): number {
  const lift = p / Math.max(prior, 0.008);
  return clamp(100 * sigmoid(2 * Math.log(Math.max(lift, 0.04))), 1, 99);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}

function sampleNote(nLeague: number, nHome: number, nAway: number): string {
  if (nLeague < 10) return `Échantillon ligue trop petit (n=${nLeague}). Score ramené vers 50.`;
  if (nLeague < 30) return `Échantillon ligue limité (n=${nLeague}). Confiance réduite.`;
  if (nHome < 8 || nAway < 8) return `Peu de matches équipe (domicile n=${nHome}, extérieur n=${nAway}). Poids équipe réduit.`;
  return `Échantillon ligue n=${nLeague} · domicile n=${nHome} · extérieur n=${nAway}.`;
}

function commentary(score: number, sc: HunterScenario): string {
  if (score >= 86) return `Le modèle place ce match nettement au-dessus de la norme ${sc.short}. Ce n’est pas une certitude.`;
  if (score >= 72) return `Les signaux ${sc.short} vont dans le même sens. Classement relatif, pas un résultat promis.`;
  if (score >= 58) return `Léger avantage statistique pour ${sc.short}. Rien de tranché.`;
  if (score <= 32) return `Peu de matière pour ${sc.short} ici. D’autres matches du desk collent mieux.`;
  return `Signal modeste pour ${sc.short}. Le score 0–100 compare les matches du desk entre eux.`;
}

function impliedFor(
  sc: HunterScenario,
  m: HunterMatch,
): { rawP: number; noVigP: number | null; book: string } | null {
  const imp = m.implied;
  if (!imp) return null;
  const book = m.impliedBook ?? "";
  let odds = 0;
  let opposite: number | undefined;
  if (sc.kind === "over" && sc.minGoals === 2) odds = imp.over15 ?? 0;
  else if (sc.kind === "over" && sc.minGoals === 3) {
    odds = imp.over25 ?? 0;
    opposite = imp.under25;
  } else if (sc.kind === "over" && sc.minGoals === 4) odds = imp.over35 ?? 0;
  else if (sc.kind === "btts" && sc.bttsYes !== false) {
    odds = imp.bttsYes ?? 0;
    opposite = imp.bttsNo;
  } else if (sc.kind === "btts") {
    odds = imp.bttsNo ?? 0;
    opposite = imp.bttsYes;
  } else if (sc.kind === "exact") {
    const key = scoreKey(sc.home ?? 0, sc.away ?? 0);
    odds = imp.cs?.[key] ?? 0;
  }
  if (odds < 1.05) return null;
  return { rawP: 1 / odds, noVigP: twoWayNoVig(odds, opposite), book };
}

/** Two-way no-vig only when both listed prices exist. Never invent the missing side. */
function twoWayNoVig(odds: number, opposite: number | undefined): number | null {
  if (odds < 1.05 || opposite == null || opposite < 1.05) return null;
  const a = 1 / odds;
  const b = 1 / opposite;
  const s = a + b;
  if (!(s > 0)) return null;
  return a / s;
}

export function rankScenario(
  sc: HunterScenario,
  matches: HunterMatch[],
  history: HistoricalMatch[],
  now = Date.now(),
  preRates?: Map<string, ReturnType<typeof teamRates>>,
): { rows: HunterRow[]; prior: number; nGlobal: number; nLeague: Record<string, number>; provenance: Provenance } {
  const hist = officialHistory(history);
  const global = empirical(sc, hist);
  const priorGlobal = global.freq > 0 ? global.freq : sc.kind === "low-exact" ? 0.94 : 0.07;
  const leagueCache = new Map<LeagueId, HistoricalMatch[]>();
  const leagueEmp = new Map<LeagueId, { n: number; freq: number }>();
  const leagueExtras = new Map<LeagueId, { btts: string; over: string }>();
  const h2hIndex = buildH2hIndex(hist);
  const rateCache = new Map<string, ReturnType<typeof teamRates>>();
  const ratesOf = (id: string, name: string) => {
    if (preRates) return lookupRates(preRates, id, name);
    const k = id || foldName(name);
    let r = rateCache.get(k);
    if (!r) {
      r = teamRates(hist, id, name);
      rateCache.set(k, r);
    }
    return r;
  };
  const rows: HunterRow[] = [];

  for (const m of matches) {
    if (m.status === "finished" || m.status === "cancelled") continue;
    const modelP = modelScenarioP(sc, m);
    if (modelP == null || !Number.isFinite(modelP)) continue;
    let leagueRows = leagueCache.get(m.league);
    if (!leagueRows) {
      leagueRows = filterHistory(hist, { league: m.league });
      leagueCache.set(m.league, leagueRows);
    }
    let emp = leagueEmp.get(m.league);
    if (!emp) {
      emp = empirical(sc, leagueRows);
      leagueEmp.set(m.league, emp);
    }
    const leagueN = leagueRows.length;
    const leagueFreq = emp.freq;
    const prior = leagueN >= 30 ? leagueFreq : priorGlobal;
    const homeRates = ratesOf(m.home.id, m.home.name);
    const awayRates = ratesOf(m.away.id, m.away.name);
    const team = teamEmpiricalFromRates(sc, homeRates, awayRates);
    const h2h = h2hEmpirical(sc, h2hIndex, m.home.id, m.home.name, m.away.id, m.away.name);
    let teamP = team.p;
    if (h2h.n >= 6) teamP = 0.7 * teamP + 0.3 * h2h.p;

    const modelScore = liftScore(modelP, Math.max(prior, 0.01));
    const leagueScore = leagueN >= 30 ? liftScore(leagueFreq, Math.max(priorGlobal, 0.01)) : 50;
    const teamScore = team.nHome + team.nAway >= 8 ? liftScore(teamP || prior, Math.max(prior, 0.01)) : 50;
    const raw = HUNTER_RANKING.model * modelScore + HUNTER_RANKING.league * leagueScore + HUNTER_RANKING.team * teamScore;
    const conf = sampleConfidence(leagueN, team.nHome, team.nAway);
    const score = Math.round(clamp(shrinkToMid(raw, conf), 1, 99));
    const implied = impliedFor(sc, m);
    let extras = leagueExtras.get(m.league);
    if (!extras) {
      extras = {
        btts: leagueN ? pct(bttsFreq(leagueRows, true).freq) : "n indisponible",
        over: leagueN ? pct(overFreq(leagueRows, 3).freq) : "n indisponible",
      };
      leagueExtras.set(m.league, extras);
    }
    const why: HunterSignal[] = [
      { label: "Estimation modèle (Poisson / Dixon-Coles)", value: pct(modelP), n: 0, layer: "model" },
      {
        label: `Fréquence ${sc.short} en ${LEAGUE_FR[m.league]}`,
        value: leagueN ? pct(leagueFreq) : "n indisponible",
        n: leagueN,
        layer: "history",
      },
      {
        label: `${m.home.name} marque à domicile`,
        value: homeRates.nHome ? pct(rate(homeRates.scoredHome, homeRates.nHome)) : "n indisponible",
        n: homeRates.nHome,
        layer: "history",
      },
      {
        label: `${m.away.name} encaisse / match à l’extérieur`,
        value: awayRates.nAway ? `${avg(awayRates.gaAway, awayRates.nAway).toFixed(2).replace(".", ",")} buts` : "n indisponible",
        n: awayRates.nAway,
        layer: "history",
      },
      {
        label: `BTTS historique ${LEAGUE_FR[m.league]}`,
        value: extras.btts,
        n: leagueN,
        layer: "history",
      },
      {
        label: `Over 2,5 historique ${LEAGUE_FR[m.league]}`,
        value: extras.over,
        n: leagueN,
        layer: "history",
      },
    ];
    if (h2h.n >= 6) {
      why.push({ label: "Confrontations directes (poids faible)", value: pct(h2h.p), n: h2h.n, layer: "history" });
    }
    if (implied) {
      why.push({
        label: `Probabilité implicite brute 1/cote (${implied.book || "marché"})`,
        value: pct(implied.rawP),
        n: 0,
        layer: "market",
      });
      if (implied.noVigP != null) {
        why.push({
          label: `Probabilité implicite no-vig (deux issues listées, ${implied.book || "marché"})`,
          value: pct(implied.noVigP),
          n: 0,
          layer: "market",
        });
      }
    }

    rows.push({
      matchId: m.id,
      slug: m.slug ?? m.id,
      league: m.league,
      competition: m.competition,
      kickoff: m.kickoff,
      status: m.status ?? "scheduled",
      home: m.home,
      away: m.away,
      score,
      modelP,
      leagueFreq,
      teamP,
      prior,
      nLeague: leagueN,
      nHome: team.nHome,
      nAway: team.nAway,
      nH2h: h2h.n,
      confidence: conf,
      sampleNote: sampleNote(leagueN, team.nHome, team.nAway),
      why,
      commentary: commentary(score, sc),
      impliedP: implied?.rawP ?? null,
      impliedNoVigP: implied?.noVigP ?? null,
      impliedBook: implied?.book ?? null,
      modelAvailable: true,
      lambdaHome: m.lambdaHome ?? null,
      lambdaAway: m.lambdaAway ?? null,
    });
  }

  rows.sort((a, b) => b.score - a.score || b.modelP - a.modelP || a.kickoff.localeCompare(b.kickoff));
  const nLeague: Record<string, number> = {};
  for (const [k, v] of leagueCache) nLeague[k] = v.length;
  void now;
  return {
    rows,
    prior: priorGlobal,
    nGlobal: hist.length,
    nLeague,
    provenance: provenanceOf(hist, now),
  };
}

export function toHunterMatch(match: MatchInput, prediction: PredictionRecord): HunterMatch {
  const books = (match.current ?? []).filter((b) => (b.over25 ?? 0) >= 1.05 || (b.bttsYes ?? 0) >= 1.05 || (b.cs && Object.keys(b.cs).length));
  const book = books[0];
  const cs: Record<string, number> = {};
  if (book?.cs) Object.assign(cs, book.cs);
  if (book?.cs11 && !cs["1-1"]) cs["1-1"] = book.cs11;
  return {
    id: match.id,
    slug: match.slug ?? match.id,
    league: match.league,
    competition: match.competition,
    kickoff: match.kickoff,
    status: match.status,
    home: { id: match.home.id, name: match.home.name, short: match.home.short, logo: match.home.logo },
    away: { id: match.away.id, name: match.away.name, short: match.away.short, logo: match.away.logo },
    matrix: prediction.ensemble?.matrix ?? [],
    over15: prediction.ensemble?.over15 ?? 0,
    over25: prediction.ensemble?.over25 ?? 0,
    over35: prediction.ensemble?.over35 ?? 0,
    bttsYes: prediction.ensemble?.bttsYes ?? 0,
    implied: book
      ? {
          over15: book.over15,
          over25: book.over25,
          over35: book.over35,
          under25: book.under25,
          bttsYes: book.bttsYes,
          bttsNo: book.bttsNo,
          cs,
        }
      : undefined,
    impliedBook: book?.book,
    lambdaHome: prediction.ensemble?.lambdaHome,
    lambdaAway: prediction.ensemble?.lambdaAway,
  };
}

export function leagueTableFor(
  sc: HunterScenario,
  history: HistoricalMatch[],
): { league: LeagueId; label: string; n: number; freq: number }[] {
  const leagues: LeagueId[] = ["PL", "LL", "BL", "SA", "L1", "ER", "PT", "SC", "TR", "CL", "EL"];
  const clean = officialHistory(history);
  return leagues
    .map((league) => {
      const rows = filterHistory(clean, { league });
      const emp = empirical(sc, rows);
      return { league, label: LEAGUE_FR[league], n: rows.length, freq: emp.freq };
    })
    .sort((a, b) => b.freq - a.freq);
}

export function hunterAskQuery(row: HunterRow, sc: HunterScenario): string {
  return `Pourquoi ${row.home.name} – ${row.away.name} est classé ${row.score}/100 au Score Hunter ${sc.short} ? Explique avec les stats (n ligue ${row.nLeague}).`;
}

export type HunterEvidence = {
  hunterScenario: string;
  hunterIndex: number;
  modelProbability: number;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  leagueScoreFrequency: number;
  teamP: number;
  sampleSize: number;
  nHome: number;
  nAway: number;
  nH2h: number;
  confidence: number;
  marketRawImplied: number | null;
  marketNoVig: number | null;
  provenance: "DERIVED_FROM_REAL_DATA";
};

/** Structured evidence blob for the LLM. Never invent stats beyond these fields. */
export function hunterEvidenceOf(row: HunterRow, sc: HunterScenario): HunterEvidence {
  return {
    hunterScenario: sc.slug,
    hunterIndex: row.score,
    modelProbability: Number(row.modelP.toFixed(4)),
    expectedHomeGoals: row.lambdaHome,
    expectedAwayGoals: row.lambdaAway,
    leagueScoreFrequency: Number(row.leagueFreq.toFixed(4)),
    teamP: Number(row.teamP.toFixed(4)),
    sampleSize: row.nLeague,
    nHome: row.nHome,
    nAway: row.nAway,
    nH2h: row.nH2h,
    confidence: Number(row.confidence.toFixed(3)),
    marketRawImplied: row.impliedP,
    marketNoVig: row.impliedNoVigP,
    provenance: "DERIVED_FROM_REAL_DATA",
  };
}
