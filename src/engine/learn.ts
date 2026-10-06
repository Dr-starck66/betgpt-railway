import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { clamp, logit, mean, normalize3, sigmoid } from "./math";
import type { LeagueId } from "./types";
import type { TicketRow } from "./ticket-log";
import { isShortPricedWinner } from "./ticket-log";

export type LearningScope = "CLUB" | "INTERNATIONAL";

export function learningScopeOfLeague(league?: LeagueId): LearningScope {
  return league === "NL" ? "INTERNATIONAL" : "CLUB";
}

export function rowsForLearningScope(rows: TicketRow[], scope: LearningScope): TicketRow[] {
  return rows.filter((row) => learningScopeOfLeague(row.league) === scope);
}

export type ErrorLearn = {
  n: number;
  nWrong: number;
  hitRate: number;
  meanP: number;
  platt: { a: number; b: number };
  shrinkGlobal: number;
  shrinkHighP: number;
  homeScale: number;
  drawScale: number;
  awayScale: number;
  leagueShrink: Partial<Record<LeagueId, number>>;
  notes: string[];
  extraMinEv: number;
  maxOdds1x2: number;
  banDrawBet: boolean;
  recentMiseN: number;
  recentMiseHit: number;
  lessons: string[];
};

export const EMPTY_LEARN: ErrorLearn = {
  n: 0,
  nWrong: 0,
  hitRate: 0,
  meanP: 0,
  platt: { a: 1, b: 0 },
  shrinkGlobal: 0,
  shrinkHighP: 0,
  homeScale: 1,
  drawScale: 1,
  awayScale: 1,
  leagueShrink: {},
  notes: ["Pas encore assez d'erreurs tranchées. On accumule."],
  extraMinEv: 0,
  maxOdds1x2: 4.2,
  banDrawBet: false,
  recentMiseN: 0,
  recentMiseHit: 0,
  lessons: [],
};

function plattFit(pairs: { p: number; y: number; w: number }[]): { a: number; b: number } {
  if (pairs.length < 12) return { a: 1, b: 0 };
  let a = 1;
  let b = 0;
  const lr = 0.2;
  for (let epoch = 0; epoch < 80; epoch++) {
    let ga = 0;
    let gb = 0;
    let tw = 0;
    for (const row of pairs) {
      const z = a * logit(row.p) + b;
      const ph = sigmoid(z);
      const err = (ph - row.y) * row.w;
      ga += err * logit(row.p);
      gb += err;
      tw += row.w;
    }
    a -= (lr * ga) / (tw || 1);
    b -= (lr * gb) / (tw || 1);
  }
  return { a: clamp(a, 0.45, 2.1), b: clamp(b, -0.9, 0.9) };
}

function scaleFromHit(hit: number, n: number, base = 1): number {
  if (n < 8) return base;
  if (hit < 0.35) return 0.82;
  if (hit < 0.45) return 0.9;
  if (hit > 0.7) return 1.08;
  return base;
}

export function learnFromErrors(rows: TicketRow[]): ErrorLearn {
  const settled = rows
    .filter((r) => (r.result === "win" || r.result === "lose") && r.modelProb > 0.05)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  // Calibration learns from every settled pre-match 1X2 observation, including
  // short-priced favorites. Betting KPI/safety remains isolated: short-priced
  // rows are still excluded from the actual-mise performance channel.
  const pronos = settled.filter(
    (r) =>
      r.kind !== "mise" &&
      (r.market === "1X2_H" || r.market === "1X2_D" || r.market === "1X2_A"),
  );
  const mises = settled.filter((r) => r.kind === "mise" && !isShortPricedWinner(r));
  const eligibleSettled = [...pronos, ...mises].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (pronos.length < 8 && mises.length < 3) return { ...EMPTY_LEARN, n: eligibleSettled.length };

  const train = pronos.length >= 8 ? pronos : eligibleSettled;
  const recentCut = train.length - 25;
  const pairs = train.map((r, i) => {
    const wrong = r.result === "lose";
    const recency = i >= recentCut ? 1.6 : 1;
    const miseW = r.kind === "mise" ? 3 : 1;
    const w = (wrong ? 2.2 : 1) * recency * miseW;
    return { p: clamp(r.modelProb, 0.05, 0.92), y: wrong ? 0 : 1, w, r };
  });

  const platt = plattFit(pairs);
  const hitRate = mean(train.map((r) => (r.result === "win" ? 1 : 0)));
  const meanP = mean(train.map((r) => r.modelProb));
  const nWrong = train.filter((r) => r.result === "lose").length;
  const over = clamp(meanP - hitRate, 0, 0.28);
  const highP = train.filter((r) => r.modelProb >= 0.55);
  const highHit = highP.length ? mean(highP.map((r) => (r.result === "win" ? 1 : 0))) : 1;
  const shrinkHighP = highP.length >= 8 ? clamp(0.55 - highHit, 0, 0.25) : 0;

  const of = (m: string) => train.filter((r) => r.market === m);
  const home = of("1X2_H");
  const draw = of("1X2_D");
  const away = of("1X2_A");
  const homeHit = home.length ? mean(home.map((r) => (r.result === "win" ? 1 : 0))) : 0.5;
  const drawHit = draw.length ? mean(draw.map((r) => (r.result === "win" ? 1 : 0))) : 0.5;
  const awayHit = away.length ? mean(away.map((r) => (r.result === "win" ? 1 : 0))) : 0.5;

  const leagues: LeagueId[] = ["PL", "LL", "BL", "SA", "L1", "ER", "PT", "SC", "TR", "CL", "EL", "NL"];
  const leagueShrink: Partial<Record<LeagueId, number>> = {};
  const names: Record<LeagueId, string> = {
    PL: "Premier League",
    LL: "La Liga",
    BL: "Bundesliga",
    SA: "Serie A",
    L1: "Ligue 1",
    ER: "Eredivisie",
    PT: "Primeira Liga",
    SC: "Premiership écossaise",
    TR: "Süper Lig",
    CL: "Ligue des champions",
    EL: "Ligue Europa",
    NL: "Internationaux",
  };
  const notes: string[] = [];
  const lessons: string[] = [];

  for (const lg of leagues) {
    const slice = train.filter((r) => r.league === lg);
    if (slice.length < 8) continue;
    const h = mean(slice.map((r) => (r.result === "win" ? 1 : 0)));
    const mp = mean(slice.map((r) => r.modelProb));
    const s = clamp(mp - h, 0, 0.22);
    if (s > 0.04) {
      leagueShrink[lg] = s;
      notes.push(`En ${names[lg]}, on était trop sûr (${Math.round(mp * 100)} % annoncé, ${Math.round(h * 100)} % réel). On baisse le volume.`);
    }
  }

  const recentMises = mises.slice(-12);
  const recentMiseN = recentMises.length;
  const recentMiseHit = recentMiseN ? mean(recentMises.map((r) => (r.result === "win" ? 1 : 0))) : 0;
  let extraMinEv = 0;
  if (recentMiseN >= 4 && recentMiseHit < 0.35) extraMinEv = 0.05;
  else if (recentMiseN >= 4 && recentMiseHit < 0.45) extraMinEv = 0.03;
  else if (recentMiseN >= 6 && recentMiseHit < 0.5) extraMinEv = 0.015;

  let maxOdds1x2 = 4.2;
  const longshots = recentMises.filter((r) => r.odds >= 4.5);
  if (longshots.some((r) => r.result === "lose")) {
    maxOdds1x2 = 3.3;
    lessons.push("Cote loterie (≥ 4,5) perdue : plafond 3,3 sur le 1-N-2.");
  }
  if (hitRate < 0.5 && train.length >= 12) {
    extraMinEv = Math.max(extraMinEv, 0.02);
    maxOdds1x2 = Math.min(maxOdds1x2, 3.4);
    lessons.push("Taux de justes sous 50 % : on resserre (cotes plus courtes, EV plus haut) pour les prochains tickets.");
  }
  if (hitRate < 0.42 && train.length >= 20) {
    extraMinEv = Math.max(extraMinEv, 0.035);
    maxOdds1x2 = Math.min(maxOdds1x2, 2.9);
    lessons.push("Série faible : le desk ne joue plus que les favoris du modèle dans la bande 1,40–2,90.");
  }

  const cupDrawLose = recentMises.some(
    (r) => (r.league === "CL" || r.league === "EL") && r.market === "1X2_D" && r.result === "lose",
  );
  const banDrawBet = cupDrawLose || (draw.length >= 6 && drawHit < 0.3);
  if (banDrawBet) lessons.push("Nul joué et perdu : plus de mise sur le X en C1/Europa.");

  const byMatch = new Map<string, TicketRow[]>();
  for (const r of recentMises) {
    const k = `${r.home}|${r.away}|${r.kickoff.slice(0, 10)}`;
    const arr = byMatch.get(k) ?? [];
    arr.push(r);
    byMatch.set(k, arr);
  }
  for (const [, arr] of byMatch) {
    if (arr.length < 2) continue;
    const sides = new Set(arr.map((r) => r.market));
    if (sides.has("1X2_H") && sides.has("1X2_A")) {
      lessons.push(`Double face sur ${arr[0]!.home}–${arr[0]!.away} : un seul ticket par match.`);
    }
  }

  for (const r of recentMises.filter((x) => x.result === "lose").slice(-4)) {
    lessons.push(
      `Perdu : ${r.home}–${r.away} · ${r.label} @ ${r.odds.toFixed(2).replace(".", ",")} (${r.goalsHome ?? "?"}–${r.goalsAway ?? "?"}).`,
    );
  }

  if (over > 0.04) {
    notes.push(
      `Trop sûr en général : ${Math.round(meanP * 100)} % annoncé, ${Math.round(hitRate * 100)} % de justes. On recale.`,
    );
  } else {
    notes.push(
      `Les pronos 1-N-2 tiennent : ${Math.round(hitRate * 100)} % de justes sur ${train.length} matchs. On garde la main, on corrige les ligues qui dérapent.`,
    );
  }
  if (recentMiseN) {
    notes.push(
      `Mises récentes : ${Math.round(recentMiseHit * 100)} % justes sur ${recentMiseN}. Seuil EV +${(extraMinEv * 100).toFixed(1).replace(".", ",")} pts.`,
    );
  }
  if (shrinkHighP > 0.05) {
    notes.push("Quand on mettait plus de 55 % sur un résultat, on se trompait trop. Ces pronos seront moins agressifs.");
  }
  if (home.length >= 8 && homeHit < 0.45) {
    notes.push("Les victoires à domicile étaient trop souvent fausses. On baisse un peu le 1.");
  }
  if (draw.length >= 6 && drawHit < 0.28) {
    notes.push("On voyait trop de nuls. On les rabote.");
  } else if (draw.length >= 6 && drawHit > 0.45) {
    notes.push("On ratait des nuls. On leur redonne un peu de poids.");
  }
  if (away.length >= 8 && awayHit < 0.4) {
    notes.push("Les victoires à l'extérieur étaient trop optimistes.");
  }
  if (!notes.length) notes.push("Pas de biais net. On continue d'empiler les scores.");

  const out: ErrorLearn = {
    n: train.length,
    nWrong,
    hitRate,
    meanP,
    platt,
    shrinkGlobal: over,
    shrinkHighP,
    homeScale: scaleFromHit(homeHit, home.length),
    drawScale: draw.length >= 6 ? (drawHit < 0.28 ? 0.85 : drawHit > 0.45 ? 1.12 : 1) : 1,
    awayScale: scaleFromHit(awayHit, away.length),
    leagueShrink,
    notes: notes.slice(0, 6),
    extraMinEv,
    maxOdds1x2,
    banDrawBet,
    recentMiseN,
    recentMiseHit,
    lessons: [...new Set(lessons)].slice(0, 8),
  };
  try {
    const file = join(process.cwd(), "data", "learn.json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(out, null, 2));
  } catch {
    /* ignore */
  }
  return out;
}

export function applyErrorLearn(
  p: { home: number; draw: number; away: number },
  league: LeagueId,
  L: ErrorLearn,
): { home: number; draw: number; away: number } {
  if (!L || L.n < 8) return p;
  const adj = (x: number) => sigmoid(L.platt.a * logit(x) + L.platt.b);
  let home = adj(p.home) * L.homeScale;
  let draw = adj(p.draw) * L.drawScale;
  let away = adj(p.away) * L.awayScale;
  let q = normalize3(home, draw, away);
  const pickP = Math.max(q.home, q.draw, q.away);
  const shrink =
    L.shrinkGlobal + (L.leagueShrink[league] ?? 0) + (pickP >= 0.55 ? L.shrinkHighP : 0);
  const t = clamp(shrink, 0, 0.4);
  if (t > 0.01) {
    q = normalize3(q.home * (1 - t) + t / 3, q.draw * (1 - t) + t / 3, q.away * (1 - t) + t / 3);
  }
  return q;
}
