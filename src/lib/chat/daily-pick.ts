import type { MatchInput, MarketQuote, PredictionRecord } from "../../engine/types.ts";

export type ChatDailyPick = {
  matchId: string;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  label: string;
  odds: number;
  book: string;
  modelProb: number;
  ev: number;
  opportunityScore: number;
  decision: MarketQuote["decision"];
  premium: boolean;
  grade: "PREMIUM" | "STANDARD" | "STANDARD_FALLBACK";
  limitation?: string;
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

function candidateScore(q: MarketQuote): number {
  const tier = q.decision === "BET" ? (q.premium ? 3 : 2) : 1;
  return (
    tier * 1000 +
    (Number.isFinite(q.opportunityScore) ? q.opportunityScore : 0) * 10 +
    (Number.isFinite(q.modelProb) ? q.modelProb : 0) * 100 +
    (Number.isFinite(q.ev) ? Math.max(-0.2, q.ev) : -0.2) * 10
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

      // Fallback visible in chat only: always keep at least one real listed
      // non-draw 1X2 option when the desk has usable odds. It is explicitly
      // labelled non-premium and never mutates the engine decision.
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
  if (!best) return null;

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

export function renderDailyChatPick(pick: ChatDailyPick): string {
  const level =
    pick.grade === "PREMIUM"
      ? "PREMIUM"
      : pick.grade === "STANDARD"
        ? "STANDARD"
        : "STANDARD — fallback modèle, non premium";
  const prob = `${Math.round(pick.modelProb * 100)} %`;
  const ev = `${pick.ev >= 0 ? "+" : ""}${(pick.ev * 100).toFixed(1)} %`;

  return [
    "SÉLECTION AUTOMATIQUE BETGPT — À UTILISER DANS LA RÉPONSE",
    `Niveau : ${level}`,
    `Match : ${pick.home} – ${pick.away} · ${pick.competition}`,
    `Pari à prendre : ${pick.label}`,
    `Cote disponible : ${pick.odds.toFixed(2)} chez ${pick.book}`,
    `Probabilité modèle : ${prob}`,
    `EV modèle : ${ev}`,
    pick.limitation ? `Limite principale : ${pick.limitation}` : "",
    "Instruction : réponds directement avec cette sélection. Ne demande jamais à l'utilisateur de fournir les affiches si ce bloc existe.",
  ]
    .filter(Boolean)
    .join("\n");
}
