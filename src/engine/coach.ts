import { FEATURE_VERSION, TACTICAL_VERSION } from "./data";
import { clamp, mean, normalize3, sigmoid, stdev } from "./math";
import type {
  CoachAgentId,
  CoachAgentOutput,
  DevilsAdvocateOutput,
  MatchInput,
  ScenarioResult,
  ScoreProbs,
  TacticalConsensus,
  TacticalFeature,
  TacticalMeta,
} from "./types";

function nowIso(): string {
  return "2026-09-04T16:00:00+02:00";
}

function dq(match: MatchInput): number {
  const points = [
    match.restHome.confidence,
    match.restAway.confidence,
    match.absencesHome.confidence,
    match.absencesAway.confidence,
    match.congestionHome.confidence,
    0.82,
  ];
  const stale =
    (match.absencesHome.freshnessHours > 36 ? 0.08 : 0) +
    (match.absencesAway.freshnessHours > 36 ? 0.08 : 0);
  return clamp(mean(points) - stale, 0.35, 0.96);
}

function absenceLoad(match: MatchInput, side: "home" | "away"): number {
  const list = (side === "home" ? match.absencesHome : match.absencesAway).value;
  return clamp(
    list.reduce((s, a) => {
      const w = a.role === "star" ? 1 : a.role === "starter" ? 0.62 : 0.22;
      return s + a.importance * w;
    }, 0),
    0,
    1.5,
  );
}

function implicationsFromEdge(
  edgeHome: number,
  openness: number,
): { home: number; draw: number; away: number } {
  const home = sigmoid(0.15 + edgeHome * 1.6);
  const away = sigmoid(0.05 - edgeHome * 1.5);
  const draw = sigmoid(-0.35 - Math.abs(edgeHome) * 0.8 + openness * 0.4);
  return normalize3(home, draw, away);
}

function possessionAgent(
  match: MatchInput,
  weight: number,
): CoachAgentOutput {
  const h = match.home;
  const a = match.away;
  const poss = (h.possession - a.possession) / 100;
  const tilt = (h.fieldTilt - a.fieldTilt) / 100;
  const prog = (h.progressivePasses - a.progressivePasses) / 40;
  const buildupGap = h.buildup - a.buildup;
  const restStruct = h.compactness * 0.5 + (1 - h.pressLine) * 0.2;
  const midSuper = sigmoid((poss + tilt + prog) * 4);
  const overload = sigmoid((h.formation.includes("2-4-1") || h.formation.startsWith("3") ? 0.35 : 0) + prog * 1.4);
  const pressResist = sigmoid((a.ppda - 9) / 4 + h.buildup * 0.8 - 0.4);
  const halfSpace = sigmoid(tilt * 3 + (h.formation.includes("3-3") ? 0.3 : 0));
  const vulnAway = sigmoid((a.ppda - 11) / 5 + (1 - a.compactness));
  const edge = poss * 2.2 + tilt * 1.8 + buildupGap * 0.6 - absenceLoad(match, "home") * 0.35;
  const reasons: string[] = [];
  if (h.possession - a.possession >= 8) {
    reasons.push(
      `${h.short} ${h.formation} penche le terrain : possession ${h.possession.toFixed(0)} % / field tilt ${h.fieldTilt.toFixed(0)} % contre ${a.possession.toFixed(0)} / ${a.fieldTilt.toFixed(0)}. Occupation du camp adverse, pas juste le ballon.`,
    );
  }
  if (h.buildup > 0.8 && a.ppda > 11) {
    reasons.push(
      `Relance ${h.short} propre (construction ${Math.round(h.buildup * 100)}) contre un ${a.short} qui ne presse pas (PPDA ${a.ppda.toFixed(1)}). Circulation sans pression sur le premier relais.`,
    );
  }
  if (a.possession > h.possession + 5) {
    reasons.push(
      `${a.short} en ${a.formation} voit plus le ballon à l'extérieur (${a.possession.toFixed(0)} % vs ${h.possession.toFixed(0)} %). ${h.short} devra exister en rest defense, pas en contrôle.`,
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      `${h.formation} contre ${a.formation}, possession ${h.possession.toFixed(0)}–${a.possession.toFixed(0)} %. Duel de demi-espaces et de passes progressives (${h.progressivePasses.toFixed(0)} vs ${a.progressivePasses.toFixed(0)}), pas un écrasement.`,
    );
  }
  const missing: string[] = [];
  if (match.absencesHome.confidence < 0.75) missing.push("XI probable domicile non figé");
  return {
    agent: "POSSESSION_STRUCTURAL",
    matchId: match.id,
    analysisTimestamp: nowIso(),
    signals: {
      midfield_superiority: midSuper,
      territorial_control: sigmoid(tilt * 5),
      overload_potential: overload,
      pressing_resistance: pressResist,
      half_space_occupation: halfSpace,
      rest_defense: restStruct,
      buildup_vulnerability_away: vulnAway,
      buildup_vulnerability_home: sigmoid((h.ppda - 11) / 5),
    },
    marketImplications: implicationsFromEdge(edge, 0.35),
    confidence: clamp(0.55 + Math.abs(poss) * 1.2, 0.4, 0.88) * dq(match),
    keyReasons: reasons.slice(0, 3),
    contradictions: Math.abs(poss) < 0.03 ? ["Possession récente peu discriminante."] : [],
    missingInformation: missing,
    dataQuality: dq(match),
    weight,
  };
}

function pressingAgent(match: MatchInput, weight: number): CoachAgentOutput {
  const h = match.home;
  const a = match.away;
  const pressH = (12 - h.ppda) / 8;
  const pressA = (12 - a.ppda) / 8;
  const mismatch = pressH - pressA;
  const transH = sigmoid(h.highTurnovers / 6 + h.pressLine - a.buildup);
  const transA = sigmoid(a.highTurnovers / 6 + a.pressLine - h.buildup);
  const behindH = sigmoid((1 - h.compactness) + h.pressLine * 0.6 - 0.4);
  const behindA = sigmoid((1 - a.compactness) + a.pressLine * 0.6 - 0.4);
  const fatigueH = match.congestionHome.value + (match.restHome.value < 4 ? 0.4 : 0);
  const fatigueA = match.congestionAway.value + (match.restAway.value < 4 ? 0.4 : 0);
  const edge =
    mismatch * 0.9 +
    (transH - transA) * 0.8 +
    (behindA - behindH) * 0.5 +
    (fatigueA - fatigueH) * 0.45;
  const reasons: string[] = [];
  if (h.ppda + 1.4 < a.ppda) {
    reasons.push(
      `${h.short} presse plus haut (PPDA ${h.ppda.toFixed(1)} vs ${a.ppda.toFixed(1)}, ligne ${Math.round(h.pressLine * 100)}). Premier rideau plus tôt, plus de recoveries hautes possibles.`,
    );
  }
  if (a.buildup > 0.75 && h.pressLine > 0.75) {
    reasons.push(
      `Pressing haut de ${h.short} contre la relance de ${a.short}. Soit des ballons gagnés dans le tiers adverse, soit le dos de défense ouvert si le 2e rideau ne rentre pas.`,
    );
  }
  if (fatigueA > 0.55) {
    reasons.push(
      `${a.short} arrive avec ${match.restAway.value} jours de repos. Intensité de pressing et recul de ligne à surveiller après 60'.`,
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      `PPDA proche (${h.ppda.toFixed(1)} vs ${a.ppda.toFixed(1)}). Pas de mismatch de pressing : avantage à qui gagne le 2e ballon et tient sa rest defense.`,
    );
  }
  return {
    agent: "PRESSING_TRANSITION",
    matchId: match.id,
    analysisTimestamp: nowIso(),
    signals: {
      pressing_mismatch: sigmoid(mismatch * 3),
      transition_advantage_home: transH,
      transition_advantage_away: transA,
      buildup_vulnerability_home: behindH,
      buildup_vulnerability_away: behindA,
      defensive_compactness_home: h.compactness,
      defensive_compactness_away: a.compactness,
      fatigue_risk_home: clamp(fatigueH, 0, 1),
      fatigue_risk_away: clamp(fatigueA, 0, 1),
    },
    marketImplications: implicationsFromEdge(edge, 0.55),
    confidence: clamp(0.52 + Math.abs(mismatch) * 0.7, 0.4, 0.86) * dq(match),
    keyReasons: reasons.slice(0, 3),
    contradictions:
      transH > 0.65 && behindH > 0.65
        ? ["Le pressing qui vole des ballons ouvre aussi l'espace dans le dos."]
        : [],
    missingInformation: ["triggers de pressing individuels non observés sur vidéo"],
    dataQuality: dq(match),
    weight,
  };
}

function adaptationAgent(match: MatchInput, weight: number): CoachAgentOutput {
  const h = match.home;
  const a = match.away;
  const depthGap = h.depth - a.depth;
  const flexGap = h.flexibility - a.flexibility;
  const restGap = match.restHome.value - match.restAway.value;
  const absH = absenceLoad(match, "home");
  const absA = absenceLoad(match, "away");
  const lineupUncertainty = clamp(
    (1 - match.absencesHome.confidence) * 0.5 +
      (1 - match.absencesAway.confidence) * 0.5 +
      absH * 0.2 +
      absA * 0.2,
    0,
    1,
  );
  const edge =
    depthGap * 0.7 +
    flexGap * 0.5 +
    restGap * 0.08 +
    (absA - absH) * 0.55 +
    (match.importance.value - 0.5) * 0.15;
  const reasons: string[] = [];
  if (absA > 0.5) {
    const names = match.absencesAway.value.map((x) => x.player).join(", ");
    reasons.push(
      `${a.short} doit faire sans ${names}. ${h.short} a plus de solutions sur le banc si le match se tend.`,
    );
  }
  if (absH > 0.5) {
    const names = match.absencesHome.value.map((x) => x.player).join(", ");
    reasons.push(`${h.short} est amputé (${names}) : plan A plus fragile, surtout si le score s'emballe.`);
  }
  if (restGap >= 3) {
    reasons.push(
      `${h.short} a plus récupéré (${match.restHome.value} jours contre ${match.restAway.value}). Ils tiendront mieux la fin de match.`,
    );
  } else if (restGap <= -3) {
    reasons.push(
      `${h.short} a moins récupéré (${match.restHome.value} jours). Attention aux 20 dernières minutes.`,
    );
  }
  if (reasons.length === 0) {
    reasons.push("Pas de gros absents. Le match se jouera sur le banc et les changements de rythme.");
  }
  return {
    agent: "ADAPTATION_GAME_MANAGEMENT",
    matchId: match.id,
    analysisTimestamp: nowIso(),
    signals: {
      tactical_flexibility_home: h.flexibility,
      tactical_flexibility_away: a.flexibility,
      lineup_uncertainty: lineupUncertainty,
      squad_depth_gap: sigmoid(depthGap * 3),
      rest_advantage_home: sigmoid(restGap / 3),
      game_state_sensitivity: clamp(Math.abs(h.pressLine - a.pressLine), 0, 1),
    },
    marketImplications: implicationsFromEdge(edge, 0.4),
    confidence: clamp(0.5 + match.absencesHome.confidence * 0.25, 0.38, 0.82) * dq(match),
    keyReasons: reasons.slice(0, 3),
    contradictions: [],
    missingInformation:
      match.absencesHome.freshnessHours > 24
        ? ["feuille d'effectif à rafraîchir avant le coup d'envoi"]
        : [],
    dataQuality: dq(match),
    weight,
  };
}

function defensiveAgent(match: MatchInput, weight: number): CoachAgentOutput {
  const h = match.home;
  const a = match.away;
  const blockH = h.compactness * (1 - h.pressLine * 0.35);
  const blockA = a.compactness * (1 - a.pressLine * 0.35);
  const counterH = sigmoid(h.highTurnovers / 8 + (1 - a.compactness) + (1 - a.pressLine) * 0.4);
  const counterA = sigmoid(a.highTurnovers / 8 + (1 - h.compactness) + (1 - h.pressLine) * 0.4);
  const setH = h.setPieceXg;
  const setA = a.setPieceXg;
  const edge =
    (blockH - blockA) * 0.9 +
    (counterH - counterA) * 0.7 +
    (h.xgAgainst - a.xgAgainst) * -0.35 +
    (setH - setA) * 0.8;
  const reasons: string[] = [];
  if (blockH > blockA + 0.12) {
    reasons.push(
      `${h.short} défend plus compact (${h.compactness.toFixed(2)} vs ${a.compactness.toFixed(2)}). Moins d'intervalle dans l'axe pour ${a.short}, jeu à faire sortir sur les côtés.`,
    );
  }
  if (counterA > 0.62 && h.pressLine > 0.75) {
    reasons.push(
      `${a.short} est armé pour le contre (${a.highTurnovers.toFixed(1)} recoveries hautes). Si ${h.short} hausse trop sa ligne, le dos de défense devient le vrai match.`,
    );
  }
  if (setH > setA + 0.08) {
    reasons.push(
      `Avantage CPA ${h.short} (xG arrêtés ${setH.toFixed(2)} vs ${setA.toFixed(2)}). Un corner mal défendu peut peser plus qu'une séquence de 20 passes.`,
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      `Blocs proches. Le match se joue sur la transition, pas sur un mur. Premier but = l'un des deux doit casser sa compactness.`,
    );
  }
  return {
    agent: "DEFENSIVE_COUNTER",
    matchId: match.id,
    analysisTimestamp: nowIso(),
    signals: {
      defensive_compactness_home: blockH,
      defensive_compactness_away: blockA,
      counter_potential_home: counterH,
      counter_potential_away: counterA,
      set_piece_advantage_home: sigmoid((setH - setA) * 8),
      space_denial_home: h.compactness,
      defensive_transition_risk_home: sigmoid(h.pressLine * 0.8 + (1 - h.compactness)),
      defensive_transition_risk_away: sigmoid(a.pressLine * 0.8 + (1 - a.compactness)),
    },
    marketImplications: implicationsFromEdge(edge, 0.3),
    confidence: clamp(0.56 + Math.abs(blockH - blockA), 0.42, 0.85) * dq(match),
    keyReasons: reasons.slice(0, 3),
    contradictions: [],
    missingInformation: ["plans CPA adverses de la semaine non filmés"],
    dataQuality: dq(match),
    weight,
  };
}

function disciplineAgent(match: MatchInput, weight: number): CoachAgentOutput {
  const h = match.home;
  const a = match.away;
  const duel = (h.duelWin - a.duelWin) / 20;
  const cards = (a.cardsPerGame - h.cardsPerGame) / 3;
  const sufferH = h.compactness * 0.6 + (1 - h.pressLine) * 0.3 + h.duelWin / 200;
  const sufferA = a.compactness * 0.6 + (1 - a.pressLine) * 0.3 + a.duelWin / 200;
  const homeBoost = 0.12 * match.importance.value;
  const edge = duel * 1.1 + cards * 0.4 + (sufferH - sufferA) * 0.8 + homeBoost;
  const reasons: string[] = [];
  if (h.duelWin - a.duelWin >= 4) {
    reasons.push(
      `${h.short} gagne plus de duels (${h.duelWin.toFixed(0)} % contre ${a.duelWin.toFixed(0)} %). Ils seront plus solides dans les contacts.`,
    );
  }
  if (match.importance.value > 0.85) {
    reasons.push(
      `Gros match. Le premier but va tester les nerfs, surtout ceux de ${h.compactness > a.compactness ? h.short : a.short}.`,
    );
  }
  if (a.cardsPerGame > h.cardsPerGame + 0.4) {
    reasons.push(`${a.short} prend plus de cartons (${a.cardsPerGame.toFixed(1)} par match). Risque de jouer à dix, ou de reculer.`);
  }
  if (reasons.length === 0) {
    reasons.push("Même profil des deux côtés. Pas de signal d'équipe qui craque.");
  }
  return {
    agent: "COMPETITIVE_DISCIPLINE",
    matchId: match.id,
    analysisTimestamp: nowIso(),
    signals: {
      duel_advantage_home: sigmoid(duel * 6),
      compactness_home: h.compactness,
      compactness_away: a.compactness,
      set_piece_advantage_home: sigmoid((h.setPieceXg - a.setPieceXg) * 8),
      high_pressure_resilience_home: clamp(sufferH, 0, 1),
      high_pressure_resilience_away: clamp(sufferA, 0, 1),
    },
    marketImplications: implicationsFromEdge(edge, 0.25),
    confidence: clamp(0.5 + Math.abs(duel), 0.4, 0.8) * dq(match),
    keyReasons: reasons.slice(0, 3),
    contradictions: [],
    missingInformation: ["indicateurs psychologiques d'après-match non disponibles"],
    dataQuality: dq(match),
    weight,
  };
}

export const DEFAULT_AGENT_WEIGHTS: Record<CoachAgentId, number> = {
  POSSESSION_STRUCTURAL: 0.22,
  PRESSING_TRANSITION: 0.24,
  ADAPTATION_GAME_MANAGEMENT: 0.18,
  DEFENSIVE_COUNTER: 0.2,
  COMPETITIVE_DISCIPLINE: 0.16,
};

export function situationWeights(match: MatchInput): Record<CoachAgentId, number> {
  const w = { ...DEFAULT_AGENT_WEIGHTS };
  const pressGap = Math.abs(match.home.ppda - match.away.ppda);
  const possGap = Math.abs(match.home.possession - match.away.possession);
  const abs =
    absenceLoad(match, "home") + absenceLoad(match, "away");
  const eloGap = Math.abs(match.home.elo - match.away.elo);
  if (pressGap > 2.2) w.PRESSING_TRANSITION += 0.06;
  if (possGap > 10) w.POSSESSION_STRUCTURAL += 0.05;
  if (abs > 0.7) w.ADAPTATION_GAME_MANAGEMENT += 0.07;
  if (eloGap > 120) w.DEFENSIVE_COUNTER += 0.05;
  if (match.importance.value > 0.85) w.COMPETITIVE_DISCIPLINE += 0.04;
  const s = Object.values(w).reduce((a, b) => a + b, 0);
  (Object.keys(w) as CoachAgentId[]).forEach((k) => {
    w[k] = w[k] / s;
  });
  return w;
}

export function runCoachAgents(
  match: MatchInput,
  learned?: Record<CoachAgentId, number>,
): CoachAgentOutput[] {
  const sit = situationWeights(match);
  const w: Record<CoachAgentId, number> = { ...sit };
  if (learned) {
    (Object.keys(w) as CoachAgentId[]).forEach((k) => {
      w[k] = 0.55 * sit[k] + 0.45 * learned[k];
    });
    const s = Object.values(w).reduce((a, b) => a + b, 0);
    (Object.keys(w) as CoachAgentId[]).forEach((k) => {
      w[k] /= s;
    });
  }
  return [
    possessionAgent(match, w.POSSESSION_STRUCTURAL),
    pressingAgent(match, w.PRESSING_TRANSITION),
    adaptationAgent(match, w.ADAPTATION_GAME_MANAGEMENT),
    defensiveAgent(match, w.DEFENSIVE_COUNTER),
    disciplineAgent(match, w.COMPETITIVE_DISCIPLINE),
  ];
}

export function tacticalConsensus(agents: CoachAgentOutput[]): TacticalConsensus {
  let h = 0;
  let d = 0;
  let a = 0;
  let wsum = 0;
  for (const ag of agents) {
    const w = ag.weight * ag.confidence;
    h += ag.marketImplications.home * w;
    d += ag.marketImplications.draw * w;
    a += ag.marketImplications.away * w;
    wsum += w;
  }
  const n = normalize3(h / (wsum || 1), d / (wsum || 1), a / (wsum || 1));
  const homes = agents.map((x) => x.marketImplications.home);
  const disagreement = clamp(stdev(homes) * 2.8, 0, 1);
  const signs = agents.map((x) => {
    const m = x.marketImplications;
    if (m.home > m.away && m.home > m.draw) return 1;
    if (m.away > m.home && m.away > m.draw) return -1;
    return 0;
  });
  const conflictScore = clamp(
    (signs.filter((s) => s === 1).length > 0 && signs.filter((s) => s === -1).length > 0
      ? 0.45
      : 0) +
      disagreement,
    0,
    1,
  );
  const directionalAgreement = 1 - conflictScore;
  return {
    ...n,
    disagreement,
    conflictScore,
    directionalAgreement,
    marketAgreement: 0,
    statisticalAgreement: 0,
    confidenceWeighted: true,
  };
}

export function attachAgreements(
  c: TacticalConsensus,
  statistical: { home: number; away: number },
  market: { home: number; away: number },
): TacticalConsensus {
  const dir = (x: { home: number; away: number }) => (x.home >= x.away ? 1 : -1);
  return {
    ...c,
    statisticalAgreement: dir(c) === dir(statistical) ? 0.82 : 0.28,
    marketAgreement: dir(c) === dir(market) ? 0.8 : 0.3,
  };
}

export function runDevilsAdvocate(
  match: MatchInput,
  consensus: TacticalConsensus,
  statistical: ScoreProbs,
  agents: CoachAgentOutput[],
): DevilsAdvocateOutput {
  const risks: string[] = [];
  let challenge = 0.18;
  const favHome = statistical.home >= statistical.away;
  const fav = favHome ? match.home : match.away;
  const dog = favHome ? match.away : match.home;
  const absFav = absenceLoad(match, favHome ? "home" : "away");
  const absDog = absenceLoad(match, favHome ? "away" : "home");
  if (absFav > 0.55) {
    risks.push(
      `${fav.short} est le favori mais il manque du monde. Le nom du club ne joue pas tout seul.`,
    );
    challenge += 0.18;
  }
  const restFav = favHome ? match.restHome.value : match.restAway.value;
  if (restFav <= 3) {
    risks.push(`${fav.short} a peu récupéré (${restFav} jours). Favori fatigué, surtout si le match s'emballe.`);
    challenge += 0.14;
  }
  if (consensus.conflictScore > 0.45) {
    risks.push(
      "Les analyses du match ne disent pas la même chose. En faire un récit unique serait forcer.",
    );
    challenge += 0.16;
  }
  if (Math.max(statistical.home, statistical.away) > 0.62 && consensus.disagreement > 0.22) {
    risks.push("Le modèle est très confiant, alors que le match peut encore basculer. Méfiance.");
    challenge += 0.12;
  }
  const pressTrap =
    fav.pressLine > 0.78 && dog.highTurnovers > 8 && dog.compactness < 0.62;
  if (pressTrap) {
    risks.push(
      `${fav.short} presse haut. ${dog.short} peut piquer dans le dos s'ils sortent vite.`,
    );
    challenge += 0.12;
  }
  if (match.importance.value > 0.9 && statistical.draw < 0.24) {
    risks.push("Gros match : les petits scores (0-0, 1-1) arrivent plus souvent qu'on ne le croit.");
    challenge += 0.08;
  }
  if (absDog > absFav + 0.4 && statistical.home > 0.55) {
    risks.push("L'outsider est plus amputé. La cote du favori peut être trop courte — ou trop longue.");
  }
  if (risks.length === 0) {
    risks.push(
      favHome
        ? `${dog.short} peut marquer en premier. ${fav.short} devra alors pousser.`
        : `${dog.short} peut encaisser tôt et reculer. Autre match.`,
    );
  }
  const alt = favHome
    ? `${dog.short} peut marquer en premier. ${fav.short} devra alors pousser, et le match change.`
    : `${dog.short} peut encaisser tôt, reculer, et ${fav.short} se retrouve à chasser. Autre match.`;
  const score = clamp(challenge, 0.12, 0.88);
  return {
    predictionChallengeScore: score,
    riskFactors: risks.slice(0, 5),
    alternativeScenario: alt,
    confidenceReduction: clamp(score * 0.22, 0.04, 0.2),
  };
}

export function tacticalMeta(
  statistical: { home: number; draw: number; away: number },
  consensus: TacticalConsensus,
  reliability: number,
): TacticalMeta {
  const r = clamp(reliability, 0.08, 0.72);
  const blended = normalize3(
    statistical.home * (1 - r) + consensus.home * r,
    statistical.draw * (1 - r) + consensus.draw * r,
    statistical.away * (1 - r) + consensus.away * r,
  );
  return {
    tacticalAdjustment: {
      home: blended.home - statistical.home,
      draw: blended.draw - statistical.draw,
      away: blended.away - statistical.away,
    },
    tacticalReliability: r,
    blended,
  };
}

export function featureStore(match: MatchInput, agents: CoachAgentOutput[]): TacticalFeature[] {
  const pick = (key: string, fallback: number) => {
    const vals = agents.map((a) => a.signals[key]).filter((v): v is number => v !== undefined);
    return vals.length ? mean(vals) : fallback;
  };
  const ts = nowIso();
  const mk = (key: string, value: number, source: string, confidence: number): TacticalFeature => ({
    key,
    value: clamp(value, 0, 1),
    source,
    timestamp: ts,
    confidence,
    freshnessHours: 12,
    version: FEATURE_VERSION,
  });
  return [
    mk("pressing_mismatch", pick("pressing_mismatch", 0.5), TACTICAL_VERSION, 0.8),
    mk("transition_mismatch", Math.abs(pick("transition_advantage_home", 0.5) - pick("transition_advantage_away", 0.5)), TACTICAL_VERSION, 0.78),
    mk("buildup_vulnerability", pick("buildup_vulnerability_away", 0.5), TACTICAL_VERSION, 0.74),
    mk("defensive_compactness", pick("defensive_compactness_home", 0.5), TACTICAL_VERSION, 0.8),
    mk("formation_mismatch", clamp(Math.abs(match.home.pressLine - match.away.pressLine), 0, 1), "formations déclarées", 0.7),
    mk("midfield_superiority", pick("midfield_superiority", 0.5), TACTICAL_VERSION, 0.77),
    mk("set_piece_advantage", pick("set_piece_advantage_home", 0.5), TACTICAL_VERSION, 0.72),
    mk("fatigue", clamp((match.congestionHome.value + match.congestionAway.value) / 2, 0, 1), "calendrier", 0.86),
    mk("tactical_flexibility", (match.home.flexibility + match.away.flexibility) / 2, "profils club", 0.7),
    mk("tactical_uncertainty", pick("lineup_uncertainty", 0.3), TACTICAL_VERSION, match.absencesHome.confidence),
  ];
}

export function simulateScenarios(
  match: MatchInput,
  base: ScoreProbs,
): ScenarioResult[] {
  const shift = (
    id: ScenarioResult["id"],
    label: string,
    description: string,
    dh: number,
    da: number,
    openness: number,
  ): ScenarioResult => {
    const n = normalize3(
      clamp(base.home + dh, 0.05, 0.85),
      clamp(base.draw - Math.abs(dh) * 0.35 + (openness < 0 ? 0.06 : -0.02), 0.1, 0.4),
      clamp(base.away + da, 0.05, 0.85),
    );
    const over25 = clamp(base.over25 + openness * 0.12, 0.25, 0.85);
    const bttsYes = clamp(base.bttsYes + openness * 0.1, 0.25, 0.85);
    return { id, label, description, ...n, over25, bttsYes };
  };
  const favHome = base.home >= base.away;
  return [
    shift(
      "favorite_scores_first",
      "Le favori marque en premier",
      favHome
        ? `${match.home.short} ouvre le score, contrôle le rythme, l'outsider doit sortir.`
        : `${match.away.short} ouvre le score et invite ${match.home.short} à ouvrir.`,
      favHome ? 0.12 : -0.08,
      favHome ? -0.1 : 0.12,
      0.15,
    ),
    shift(
      "underdog_scores_first",
      "L'outsider marque en premier",
      "État de jeu inverse : le favori chasse, espaces dans le dos.",
      favHome ? -0.14 : 0.1,
      favHome ? 0.12 : -0.12,
      0.35,
    ),
    shift(
      "stalemate_late",
      "0-0 après 70 minutes",
      "Les blocs se figent, les buts deviennent plus rares, les CPA pèsent.",
      -0.04,
      -0.04,
      -0.45,
    ),
    shift(
      "red_card_favorite",
      "Carton rouge du favori",
      "Infériorité numérique : le favori encaisse du volume, l'outsider accélère.",
      favHome ? -0.22 : 0.08,
      favHome ? 0.18 : -0.2,
      0.2,
    ),
    shift(
      "early_goal",
      "But avant la 15e",
      "Match ouvert immédiatement. Plus de BTTS, moins de contrôle.",
      0.02,
      0.02,
      0.4,
    ),
    shift(
      "favorite_chasing",
      "Le favori doit chasser",
      "Lignes plus hautes, xG des deux côtés en hausse.",
      favHome ? -0.06 : 0.04,
      favHome ? 0.05 : -0.06,
      0.38,
    ),
    shift(
      "underdog_protects",
      "L'outsider protège un résultat",
      "Bloc bas, temps qui passe, Under plus plausible.",
      favHome ? 0.06 : -0.05,
      favHome ? -0.08 : 0.05,
      -0.28,
    ),
    shift(
      "high_press_success",
      "Pressing haut qui fonctionne",
      "Turnovers dans le camp adverse, vagues répétées.",
      match.home.pressLine > match.away.pressLine ? 0.1 : -0.06,
      match.home.pressLine > match.away.pressLine ? -0.08 : 0.1,
      0.22,
    ),
    shift(
      "high_press_failure",
      "Pressing haut battu",
      "Le premier rideau est contourné, courses dans le dos.",
      match.home.pressLine > match.away.pressLine ? -0.1 : 0.06,
      match.home.pressLine > match.away.pressLine ? 0.1 : -0.08,
      0.3,
    ),
  ];
}
