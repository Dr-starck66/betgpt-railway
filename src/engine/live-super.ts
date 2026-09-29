import { clamp } from "./math";
import { skipEuropeFrenchProno } from "./french-clubs";
import type { LiveSuperBet, MatchInput, PredictionRecord } from "./types";

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export function parseMinute(clock?: string, status?: string): number {
  if (status === "finished") return 90;
  const c = clock ?? "";
  const plus = c.match(/(\d+)\s*\+\s*(\d+)/);
  if (plus) return Math.min(95, Number(plus[1]) + Number(plus[2]));
  const m = c.match(/(\d+)/);
  if (m) return Math.min(95, Number(m[1]));
  if (/1re|ht|mt/i.test(c)) return 22;
  if (/2e/i.test(c)) return 68;
  return 50;
}

export function liveSuperBet(match: MatchInput, p: Pick<PredictionRecord, "ensemble" | "calibrated">): LiveSuperBet | null {
  if (match.status !== "live") return null;
  if (skipEuropeFrenchProno(match)) return null;
  const minute = parseMinute(match.clock, match.status);
  const remaining = Math.max(4, 93 - minute);
  const frac = remaining / 93;
  const sh = match.scoreHome ?? 0;
  const sa = match.scoreAway ?? 0;
  const incidents = match.incidents ?? [];
  const redH = incidents.filter((i) => i.kind === "red" && i.side === "home").length;
  const redA = incidents.filter((i) => i.kind === "red" && i.side === "away").length;
  let lh = (p.ensemble.lambdaHome || 1.3) * frac;
  let la = (p.ensemble.lambdaAway || 1.1) * frac;
  if (sh > sa) {
    lh *= 0.74;
    la *= 1.22;
  } else if (sa > sh) {
    la *= 0.74;
    lh *= 1.22;
  }
  if (redH) {
    lh *= 0.62;
    la *= 1.2;
  }
  if (redA) {
    la *= 0.62;
    lh *= 1.2;
  }
  const lastGoal = [...incidents].reverse().find((i) => i.kind === "goal" || i.kind === "penalty" || i.kind === "own_goal");
  if (lastGoal) {
    const gm = parseInt(lastGoal.minute, 10);
    if (Number.isFinite(gm) && minute - gm <= 8) {
      if (lastGoal.side === "home") lh *= 1.12;
      else la *= 1.12;
    }
  }
  lh = clamp(lh, 0.05, 2.2);
  la = clamp(la, 0.05, 2.2);
  const tot = lh + la;
  const pNoMore = Math.exp(-tot);
  const pNextH = (1 - pNoMore) * (lh / tot);
  const pNextA = (1 - pNoMore) * (la / tot);
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j <= 5; j++) {
      const pr = poissonPmf(i, lh) * poissonPmf(j, la);
      const fh = sh + i;
      const fa = sa + j;
      if (fh > fa) pHome += pr;
      else if (fh === fa) pDraw += pr;
      else pAway += pr;
    }
  }
  const lead = sh - sa;
  type Cand = { pick: string; label: string; p: number; cover: string; why: string };
  const cands: Cand[] = [
    { pick: `Prochain but ${match.home.short}`, label: "Prochain but", p: pNextH, cover: `Prochain but ${match.away.short}`, why: `${match.home.name} pousse encore.` },
    { pick: `Prochain but ${match.away.short}`, label: "Prochain but", p: pNextA, cover: `Prochain but ${match.home.short}`, why: `${match.away.name} peut piquer.` },
    { pick: "Plus de but", label: "Score figé", p: pNoMore, cover: "Encore un but", why: "Le match se ferme." },
    { pick: `${match.home.short} gagne`, label: "Issue", p: pHome, cover: "Pas de victoire domicile", why: `${match.home.name} part avec ce score.` },
    { pick: `${match.away.short} gagne`, label: "Issue", p: pAway, cover: "Pas de victoire extérieur", why: `${match.away.name} peut basculer le match.` },
    { pick: "Match nul", label: "Issue", p: pDraw, cover: "Un vainqueur", why: "Le nul tient la route d'ici le coup de sifflet." },
  ];
  if (lead > 0) {
    cands.push({
      pick: `${match.home.short} tient`,
      label: "Tenir",
      p: pHome,
      cover: `${match.away.short} revient`,
      why: `${match.home.name} mène ${sh}–${sa}. Le reste du temps, on gère.`,
    });
  }
  if (lead < 0) {
    cands.push({
      pick: `${match.away.short} tient`,
      label: "Tenir",
      p: pAway,
      cover: `${match.home.short} revient`,
      why: `${match.away.name} mène ${sh}–${sa} à l'extérieur.`,
    });
  }
  if (lead !== 0 && minute >= 70) {
    const holder = lead > 0 ? match.home.short : match.away.short;
    const holdP = lead > 0 ? pHome : pAway;
    cands.push({
      pick: `${holder} va au bout`,
      label: "Fin de match",
      p: holdP * (0.55 + pNoMore * 0.45),
      cover: "Encore un but",
      why: `${minute}e, un but d'écart. Fin de match, peu d'espaces.`,
    });
  }
  cands.sort((a, b) => b.p - a.p);
  const best = cands[0]!;
  const redTxt = redH || redA ? ` Rouge : ${redH ? match.home.short : ""}${redH && redA ? " et " : ""}${redA ? match.away.short : ""} à 10.` : "";
  const lastTxt = lastGoal
    ? ` Dernier but : ${lastGoal.player} ${lastGoal.minute}.`
    : incidents.length
      ? ` Dernière action : ${incidents[incidents.length - 1]!.label} ${incidents[incidents.length - 1]!.player}.`
      : "";
  const pulse = `${minute}e, ${match.home.short} ${sh}–${sa} ${match.away.short}. On est dans le stade : rythme, cartons, buts, pas un tweet au hasard.${redTxt}${lastTxt}`;
  return {
    pick: best.pick,
    label: best.label,
    cover: best.cover,
    p: clamp(best.p, 0.2, 0.92),
    minute,
    why: `${pulse} ${best.why}`.replace(/\s+/g, " ").trim(),
  };
}
