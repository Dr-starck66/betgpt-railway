import type { MatchInput, MarketQuote, PredictionRecord } from "../../engine/types.ts";

export type ChatDailyPick = {
  matchId: string;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  label: string;
  odds: number | null;
  fairOdds: number | null;
  book?: string;
  modelProb: number;
  ev: number;
  opportunityScore: number;
  decision: MarketQuote["decision"];
  premium: boolean;
  grade: "PREMIUM" | "STANDARD" | "STANDARD_FALLBACK" | "STANDARD_MODEL" | "STANDARD_DATA";
  limitation?: string;
  rationale?: string;
};

function parisDayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isHardBlock(reason?: string): boolean {
  if (!reason) return false;
  return /donn(?:ée|e)s anciennes|mise suspendue|après le coup d.?envoi|non list(?:ée|e)|loterie|gelées|toxique|challenger promu refuse|français.*europe|pas de nouvelle mise/i.test(
    reason,
  );
}

function isModelSafetyBlock(reason?: string): boolean {
  if (!reason) return false;
  return /donn(?:ée|e)s anciennes|mise suspendue|après le coup d.?envoi|loterie|gelées|toxique|challenger promu refuse|français.*europe|pas de nouvelle mise/i.test(
    reason,
  );
}

function candidateScore(q: MarketQuote): number {
  const tier = q.decision === "BET" ? (q.premium ? 3 : 2) : 1;
  return (
    tier * 1000 +
    (Number.isFinite(q.opportunityScore) ? q.opportunityScore : 0) * 10 +
    (Number.isFinite(q.modelProb) ? q.modelProb : 0) * 100 +
    (Number.isFinite(q.ev) ? Math.max(-0.2, q.ev) : -0.2) * 10
  );
}

function modelFallbackScore(q: MarketQuote): number {
  return (
    (Number.isFinite(q.modelProb) ? q.modelProb : 0) * 1000 +
    (Number.isFinite(q.opportunityScore) ? q.opportunityScore : 0) * 10
  );
}

export function selectDailyChatPick(
  matches: MatchInput[],
  predictions: PredictionRecord[],
  asOf?: string,
  stale = false,
): ChatDailyPick | null {
  if (stale) return null;

  const reference = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf) : new Date();
  const referenceMs = reference.getTime();
  const todayKey = parisDayKey(reference);

  const upcoming = matches
    .filter((m) => m.status === "scheduled" && Number.isFinite(Date.parse(m.kickoff)) && Date.parse(m.kickoff) >= referenceMs)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const today = upcoming.filter((m) => parisDayKey(m.kickoff) === todayKey);
  const scope = (today.length ? today : upcoming).slice(0, 20);
  const predictionById = new Map(predictions.map((p) => [p.matchId, p]));

  const candidates: Array<{ match: MatchInput; quote: MarketQuote; score: number }> = [];

  for (const match of scope) {
    const prediction = predictionById.get(match.id);
    if (!prediction) continue;
    for (const quote of prediction.markets ?? []) {
      if (!quote.listed) continue;
      if (!Number.isFinite(quote.bestOdds) || quote.bestOdds < 1.8 || quote.bestOdds > 4.2) continue;
      if (!Number.isFinite(quote.modelProb) || quote.modelProb < 0.28) continue;
      if (isHardBlock(quote.rejectionReason)) continue;

      if (quote.decision === "BET") {
        candidates.push({ match, quote, score: candidateScore(quote) });
        continue;
      }

      if (
        quote.group === "1X2" &&
        quote.market !== "1X2_D" &&
        quote.modelProb >= 0.28 &&
        Number.isFinite(quote.ev)
      ) {
        candidates.push({ match, quote, score: candidateScore(quote) });
      }
    }
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (best) {
    const { match, quote } = best;
    const grade =
      quote.decision === "BET"
        ? quote.premium
          ? "PREMIUM"
          : "STANDARD"
        : "STANDARD_FALLBACK";

    return {
      matchId: match.id,
      home: match.home.name,
      away: match.away.name,
      competition: match.competition,
      kickoff: match.kickoff,
      label: quote.label,
      odds: quote.bestOdds,
      fairOdds: quote.fairOdds,
      book: quote.bestBook,
      modelProb: quote.modelProb,
      ev: quote.ev,
      opportunityScore: quote.opportunityScore,
      decision: quote.decision,
      premium: quote.premium,
      grade,
      limitation:
        grade === "STANDARD_FALLBACK"
          ? quote.rejectionReason || "Le filtre premium n'est pas validé."
          : quote.premium
            ? undefined
            : "Pari validé par le moteur mais hors niveau premium.",
    };
  }

  // Last-resort chat fallback: when the fixture/model exists but no bookmaker
  // quote is currently usable, still answer with the strongest non-draw 1X2
  // model selection. This is explicitly NOT a value bet and never mutates
  // the engine/ticket ledger.
  const modelCandidates: Array<{ match: MatchInput; quote: MarketQuote; score: number }> = [];
  for (const match of scope) {
    const prediction = predictionById.get(match.id);
    if (!prediction) continue;
    for (const quote of prediction.markets ?? []) {
      if (quote.group !== "1X2" || quote.market === "1X2_D") continue;
      if (!Number.isFinite(quote.modelProb) || quote.modelProb < 0.28) continue;
      if (!Number.isFinite(quote.fairOdds)) continue;
      if (isModelSafetyBlock(quote.rejectionReason)) continue;
      modelCandidates.push({ match, quote, score: modelFallbackScore(quote) });
    }
  }

  const modelBest = modelCandidates.sort((a, b) => b.score - a.score)[0];
  if (!modelBest) return null;

  const { match, quote } = modelBest;
  return {
    matchId: match.id,
    home: match.home.name,
    away: match.away.name,
    competition: match.competition,
    kickoff: match.kickoff,
    label: quote.label,
    odds: quote.listed && Number.isFinite(quote.bestOdds) ? quote.bestOdds : null,
    fairOdds: quote.fairOdds,
    book: quote.listed ? quote.bestBook : undefined,
    modelProb: quote.modelProb,
    ev: Number.isFinite(quote.ev) ? quote.ev : 0,
    opportunityScore: quote.opportunityScore,
    decision: quote.decision,
    premium: false,
    grade: "STANDARD_MODEL",
    limitation:
      "Aucune cote bookmaker exploitable n'est disponible pour ce choix. C'est la meilleure issue 1X2 du modèle, pas un pari premium ni une value validée.",
  };
}


function formPoints(form?: string): number {
  const chars = String(form ?? "").toUpperCase().replace(/[^WDL]/g, "").slice(-5);
  if (!chars) return 0;
  return [...chars].reduce((sum, c) => sum + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
}

export function selectDailyDataFallback(
  matches: MatchInput[],
  asOf?: string,
  stale = false,
): ChatDailyPick | null {
  if (stale) return null;

  const reference = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf) : new Date();
  const referenceMs = reference.getTime();
  const todayKey = parisDayKey(reference);
  const upcoming = matches
    .filter((m) => m.status === "scheduled" && Number.isFinite(Date.parse(m.kickoff)) && Date.parse(m.kickoff) >= referenceMs)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const today = upcoming.filter((m) => parisDayKey(m.kickoff) === todayKey);
  const scope = (today.length ? today : upcoming).slice(0, 20);
  if (!scope.length) return null;

  const ranked = scope
    .map((match) => {
      const h = formPoints(match.formHome);
      const a = formPoints(match.formAway);
      const hasForm = Boolean(match.formHome || match.formAway);
      const diff = h - a;
      const side = diff >= 0 ? "home" : "away";
      const strength = Math.abs(diff) + (hasForm ? Math.max(h, a) * 0.15 : 0);
      return { match, h, a, diff, side, strength, hasForm };
    })
    .sort((x, y) => y.strength - x.strength || x.match.kickoff.localeCompare(y.match.kickoff));

  const best = ranked[0];
  if (!best) return null;

  const homePick = best.side === "home";
  const chosen = homePick ? best.match.home.name : best.match.away.name;
  const opponent = homePick ? best.match.away.name : best.match.home.name;
  const confidence = best.hasForm
    ? Math.max(0.5, Math.min(0.62, 0.5 + Math.abs(best.diff) * 0.012))
    : 0.5;

  return {
    matchId: best.match.id,
    home: best.match.home.name,
    away: best.match.away.name,
    competition: best.match.competition,
    kickoff: best.match.kickoff,
    label: homePick ? "1 — Domicile" : "2 — Extérieur",
    odds: null,
    fairOdds: null,
    modelProb: confidence,
    ev: 0,
    opportunityScore: 0,
    decision: "WATCH",
    premium: false,
    grade: "STANDARD_DATA",
    rationale: best.hasForm
      ? `Forme récente disponible : ${chosen} ${homePick ? best.match.formHome ?? "n/a" : best.match.formAway ?? "n/a"} contre ${opponent} ${homePick ? best.match.formAway ?? "n/a" : best.match.formHome ?? "n/a"}.`
      : "Aucun signal de forme suffisamment riche : choix de secours basé sur l'affiche disponible, sans prétendre à une value.",
    limitation:
      "Choix de secours conversationnel uniquement : pas de cote bookmaker exploitable et pas de validation Premium. À vérifier avant toute mise réelle.",
  };
}

export function renderDailyChatPick(pick: ChatDailyPick): string {
  const level =
    pick.grade === "PREMIUM"
      ? "PREMIUM"
      : pick.grade === "STANDARD"
        ? "STANDARD"
        : pick.grade === "STANDARD_FALLBACK"
          ? "STANDARD — fallback modèle, non premium"
          : pick.grade === "STANDARD_MODEL"
            ? "STANDARD MODÈLE — non premium, cote live indisponible"
            : "STANDARD DATA — non premium, choix de secours";
  const prob = `${Math.round(pick.modelProb * 100)} %`;
  const oddsLine =
    pick.odds != null
      ? `Cote disponible : ${pick.odds.toFixed(2)} chez ${pick.book || "bookmaker"}`
      : pick.fairOdds != null
        ? `Cote disponible : indisponible · cote juste modèle : ${pick.fairOdds.toFixed(2)}`
        : "Cote disponible : indisponible · aucune cote juste calculée";
  const evLine =
    pick.odds != null
      ? `EV modèle : ${pick.ev >= 0 ? "+" : ""}${(pick.ev * 100).toFixed(1)} %`
      : pick.grade === "STANDARD_DATA"
        ? "EV modèle : non calculée pour ce fallback data."
        : "EV modèle : non validable sans cote bookmaker disponible.";

  return [
    "SÉLECTION AUTOMATIQUE BETGPT — À UTILISER DANS LA RÉPONSE",
    `Niveau : ${level}`,
    `Match : ${pick.home} – ${pick.away} · ${pick.competition}`,
    `Pari à prendre : ${pick.label}`,
    oddsLine,
    pick.grade === "STANDARD_DATA" ? `Indice data : ${prob}` : `Probabilité modèle : ${prob}`,
    evLine,
    pick.rationale ? `Pourquoi : ${pick.rationale}` : "",
    pick.limitation ? `Limite principale : ${pick.limitation}` : "",
    "Instruction : réponds directement avec cette sélection. Ne demande jamais à l'utilisateur de fournir les affiches si ce bloc existe.",
  ]
    .filter(Boolean)
    .join("\n");
}
