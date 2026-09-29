import { lookupTeam } from "./live";
import {
  clamp,
  goalMatrix,
  mean,
  normalize3,
  removeVig,
  sigmoid,
  type GoalMatrix,
} from "./math";
import type {
  EnsembleOutput,
  HistoricalMatch,
  MatchInput,
  ModelName,
  ModelOutput,
  ScoreProbs,
} from "./types";

const HOME_ADV = 1.12;
const HOME_ELO = 55;

function fromMatrix(model: ModelName, version: string, g: GoalMatrix): ModelOutput {
  return {
    model,
    version,
    lambdaHome: g.lambdaHome,
    lambdaAway: g.lambdaAway,
    home: g.home,
    draw: g.draw,
    away: g.away,
    over15: g.over15,
    over25: g.over25,
    over35: g.over35,
    under25: g.under25,
    bttsYes: g.bttsYes,
    bttsNo: g.bttsNo,
    matrix: g.matrix,
  };
}

function restFactor(days: number): number {
  if (days <= 3) return 0.9;
  if (days <= 4) return 0.95;
  if (days >= 8) return 1.02;
  return 1;
}

function absenceHit(match: MatchInput, side: "home" | "away"): number {
  const list = (side === "home" ? match.absencesHome : match.absencesAway).value;
  let hit = 0;
  for (const a of list) {
    const w = a.role === "star" ? 1 : a.role === "starter" ? 0.65 : 0.25;
    hit += a.importance * w;
  }
  return clamp(hit, 0, 1.4);
}

export function poissonModel(match: MatchInput): ModelOutput {
  const h = match.home;
  const a = match.away;
  const ah = 1 - 0.08 * absenceHit(match, "home");
  const aa = 1 - 0.08 * absenceHit(match, "away");
  const lh =
    h.attack * a.defense * HOME_ADV * restFactor(match.restHome.value) * ah;
  const la =
    a.attack * h.defense * restFactor(match.restAway.value) * aa;
  return fromMatrix("poisson", "poisson-1.1", goalMatrix(lh, la));
}

export function dixonColesModel(match: MatchInput, rho: number): ModelOutput {
  const base = poissonModel(match);
  return fromMatrix(
    "dixonColes",
    "dc-1.1",
    goalMatrix(base.lambdaHome, base.lambdaAway, rho),
  );
}

export function eloModel(match: MatchInput): ModelOutput {
  const eh = match.home.elo + HOME_ELO;
  const ea = match.away.elo;
  const expected = 1 / (1 + 10 ** ((ea - eh) / 400));
  const gap = Math.abs(eh - ea);
  const draw = clamp(0.285 * Math.exp(-((gap / 280) ** 2)), 0.18, 0.3);
  const home = expected * (1 - draw);
  const away = (1 - expected) * (1 - draw);
  const n = normalize3(home, draw, away);
  const totalGoals =
    2.55 +
    (match.home.xgFor + match.away.xgFor - match.home.xgAgainst - match.away.xgAgainst) *
      0.15;
  const lh = totalGoals * n.home + totalGoals * 0.5 * n.draw;
  const la = totalGoals * n.away + totalGoals * 0.5 * n.draw;
  const g = goalMatrix(lh, la);
  const scaled = goalMatrix(
    g.lambdaHome * (n.home / Math.max(0.05, g.home)),
    g.lambdaAway * (n.away / Math.max(0.05, g.away)),
  );
  return fromMatrix("elo", "elo-1.1", {
    ...scaled,
    home: n.home,
    draw: n.draw,
    away: n.away,
  });
}

export function xgModel(match: MatchInput): ModelOutput {
  const leagueXg = 1.55;
  const lh =
    match.home.xgFor *
    (match.away.xgAgainst / leagueXg) *
    HOME_ADV *
    restFactor(match.restHome.value) *
    (1 - 0.07 * absenceHit(match, "home"));
  const la =
    match.away.xgFor *
    (match.home.xgAgainst / leagueXg) *
    restFactor(match.restAway.value) *
    (1 - 0.07 * absenceHit(match, "away"));
  return fromMatrix("xg", "xg-1.1", goalMatrix(lh, la));
}

export function glmModel(match: MatchInput): ModelOutput {
  const eloDiff = (match.home.elo + HOME_ELO - match.away.elo) / 120;
  const xgDiff = match.home.xgFor - match.away.xgAgainst - (match.away.xgFor - match.home.xgAgainst);
  const pressDiff = (match.away.ppda - match.home.ppda) / 8;
  const restDiff = (match.restHome.value - match.restAway.value) / 6;
  const possDiff = (match.home.possession - match.away.possession) / 18;
  const absDiff = absenceHit(match, "away") - absenceHit(match, "home");
  const zHome =
    0.18 +
    0.55 * eloDiff +
    0.32 * xgDiff +
    0.18 * pressDiff +
    0.22 * restDiff +
    0.14 * possDiff +
    0.2 * absDiff;
  const zAway =
    -0.08 -
    0.5 * eloDiff -
    0.28 * xgDiff -
    0.12 * pressDiff -
    0.18 * restDiff -
    0.1 * possDiff -
    0.18 * absDiff;
  const zDraw = 0.04 - 0.22 * Math.abs(eloDiff);
  const n = normalize3(sigmoid(zHome), sigmoid(zDraw) * 0.85, sigmoid(zAway));
  const g = goalMatrix(
    clamp(1.15 + 0.45 * match.home.xgFor * 0.5, 0.6, 2.8),
    clamp(1.0 + 0.45 * match.away.xgFor * 0.5, 0.5, 2.6),
  );
  return fromMatrix("glm", "glm-context-1.0", {
    ...g,
    home: n.home,
    draw: n.draw,
    away: n.away,
  });
}

export function marketModel(match: MatchInput): ModelOutput {
  const books = (match.current ?? []).filter((b) => b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05);
  if (!books.length) {
    return { ...poissonModel(match), model: "market", version: "market-implied-1.0" };
  }
  const best = bestThree(match);
  const [ph, pd, pa] = removeVig([best.home, best.draw, best.away]);
  const o25 = best.over25 >= 1.05 ? 1 / best.over25 : NaN;
  const o15 = best.over15 >= 1.05 ? 1 / best.over15 : NaN;
  const o35 = best.over35 >= 1.05 ? 1 / best.over35 : NaN;
  const btts = best.bttsYes >= 1.05 ? 1 / best.bttsYes : NaN;
  const poisson = poissonModel(match);
  const g = goalMatrix(poisson.lambdaHome, poisson.lambdaAway);
  return {
    ...fromMatrix("market", "market-implied-1.0", g),
    home: ph,
    draw: pd,
    away: pa,
    over15: Number.isFinite(o15) ? clamp(o15 / 1.05, 0.5, 0.95) : poisson.over15,
    over25: Number.isFinite(o25) ? clamp(o25 / 1.05, 0.3, 0.8) : poisson.over25,
    over35: Number.isFinite(o35) ? clamp(o35 / 1.05, 0.12, 0.55) : poisson.over35,
    under25: Number.isFinite(o25) ? 1 - clamp(o25 / 1.05, 0.3, 0.8) : poisson.under25,
    bttsYes: Number.isFinite(btts) ? clamp(btts / 1.05, 0.3, 0.8) : poisson.bttsYes,
    bttsNo: Number.isFinite(btts) ? 1 - clamp(btts / 1.05, 0.3, 0.8) : poisson.bttsNo,
  };
}

export function bestThree(match: MatchInput): {
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  books: Record<string, string>;
  urls: Record<string, string | undefined>;
} {
  const books = (match.current ?? []).filter((b) => b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05);
  const pick = (key: "home" | "draw" | "away" | "over15" | "over25" | "over35" | "under25" | "bttsYes" | "bttsNo") => {
    const pool = books.filter((b) => (b[key] ?? 0) >= 1.05);
    if (!pool.length) return { odds: 0, book: "", url: undefined as string | undefined };
    let best = pool[0]!;
    for (const b of pool) if (b[key] > best[key] + 0.001) best = b;
    const url =
      key === "home" ? best.homeUrl ?? best.url
      : key === "draw" ? best.drawUrl ?? best.url
      : key === "away" ? best.awayUrl ?? best.url
      : best.url;
    return { odds: best[key], book: best.book, url };
  };
  const h = pick("home");
  const d = pick("draw");
  const a = pick("away");
  const o15 = pick("over15");
  const o25 = pick("over25");
  const o35 = pick("over35");
  const u25 = pick("under25");
  const y = pick("bttsYes");
  const n = pick("bttsNo");
  return {
    home: h.odds,
    draw: d.odds,
    away: a.odds,
    over15: o15.odds,
    over25: o25.odds,
    over35: o35.odds,
    under25: u25.odds,
    bttsYes: y.odds,
    bttsNo: n.odds,
    books: {
      home: h.book,
      draw: d.book,
      away: a.book,
      over15: o15.book,
      over25: o25.book,
      over35: o35.book,
      under25: u25.book,
      bttsYes: y.book,
      bttsNo: n.book,
    },
    urls: {
      home: h.url,
      draw: d.url,
      away: a.url,
      over15: o15.url,
      over25: o25.url,
      over35: o35.url,
      under25: u25.url,
      bttsYes: y.url,
      bttsNo: n.url,
    },
  };
}

export function estimateRho(history: HistoricalMatch[]): number {
  let low00 = 0;
  let exp00 = 0;
  for (const m of history) {
    const h = lookupTeam(m.homeId);
    const a = lookupTeam(m.awayId);
    if (!h || !a) continue;
    const lh = h.attack * a.defense * HOME_ADV;
    const la = a.attack * h.defense;
    const p00 = Math.exp(-lh) * Math.exp(-la);
    exp00 += p00;
    if (m.goalsHome === 0 && m.goalsAway === 0) low00 += 1;
  }
  if (exp00 <= 0) return -0.12;
  const ratio = low00 / history.length - exp00 / history.length;
  return clamp(-0.08 - ratio * 4, -0.2, 0.02);
}

const DEFAULT_WEIGHTS: Record<ModelName, number> = {
  poisson: 0.16,
  dixonColes: 0.18,
  elo: 0.14,
  xg: 0.18,
  glm: 0.16,
  market: 0.18,
};

export function blendModels(
  models: ModelOutput[],
  weights: Record<ModelName, number> = DEFAULT_WEIGHTS,
): EnsembleOutput {
  const keys: (keyof ScoreProbs)[] = [
    "home",
    "draw",
    "away",
    "over15",
    "over25",
    "over35",
    "under25",
    "bttsYes",
    "bttsNo",
    "lambdaHome",
    "lambdaAway",
  ];
  const acc: Record<string, number> = {};
  let wsum = 0;
  for (const m of models) {
    const w = weights[m.model] ?? 0;
    wsum += w;
    for (const k of keys) acc[k] = (acc[k] ?? 0) + (m[k] as number) * w;
  }
  const out = {} as ScoreProbs;
  for (const k of keys) {
    (out as unknown as Record<string, number>)[k] = (acc[k] ?? 0) / (wsum || 1);
  }
  const n = normalize3(out.home, out.draw, out.away);
  out.home = n.home;
  out.draw = n.draw;
  out.away = n.away;
  const homes = models.map((m) => m.home);
  const disagreement = mean(homes.map((h) => (h - n.home) ** 2)) ** 0.5 * 2.4;
  const matrix = goalMatrix(out.lambdaHome, out.lambdaAway).matrix;
  return { ...out, matrix, weights, disagreement: clamp(disagreement, 0, 1) };
}

/** Don't call a 1.09 favourite a 50/50. Listed blowouts stay blowouts; 3.45 value is untouched. */
export function anchorToListedFavorite(
  p: { home: number; draw: number; away: number },
  market: { home: number; draw: number; away: number },
): { home: number; draw: number; away: number } {
  const mp = Math.max(market.home, market.draw, market.away);
  if (mp < 0.78) return p;
  const w = 0.4 + 0.5 * clamp((mp - 0.78) / 0.14, 0, 1);
  return normalize3(
    p.home * (1 - w) + market.home * w,
    p.draw * (1 - w) + market.draw * w,
    p.away * (1 - w) + market.away * w,
  );
}

export function runStatisticalStack(
  match: MatchInput,
  rho: number,
): { models: ModelOutput[]; ensemble: EnsembleOutput } {
  const models = [
    poissonModel(match),
    dixonColesModel(match, rho),
    eloModel(match),
    xgModel(match),
    glmModel(match),
    marketModel(match),
  ];
  return { models, ensemble: blendModels(models) };
}
