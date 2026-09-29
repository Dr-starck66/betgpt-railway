import type { MarketQuote, MatchInput } from "./types.ts";

/** Last gate: never promote a rejected market, never manufacture positive EV. */
export function enforceBetSafety(
  quotes: MarketQuote[],
  match: Pick<MatchInput, "status" | "kickoff">,
  stale = false,
  now = Date.now(),
): void {
  for (const q of quotes) {
    if (q.decision !== "BET") continue;
    const ev = q.modelProb * q.bestOdds - 1;
    let reason: string | undefined;
    if (stale) reason = "Données anciennes ou non horodatées : mise suspendue.";
    else if (
      match.status !== "scheduled" ||
      !Number.isFinite(Date.parse(match.kickoff)) ||
      Date.parse(match.kickoff) <= now
    )
      reason = "Pas de nouvelle mise pré-match après le coup d’envoi.";
    else if (!q.listed || !Number.isFinite(q.bestOdds) || q.bestOdds < 1.8)
      reason = "Cote trop courte : pas de mise sous 1,80.";
    else if (
      !Number.isFinite(q.modelProb) ||
      q.modelProb <= 0 ||
      q.modelProb >= 1 ||
      !Number.isFinite(ev) ||
      ev <= 0 ||
      !Number.isFinite(q.ev) ||
      q.ev <= 0
    )
      reason = "Espérance positive non établie : aucune mise.";
    else if (!Number.isFinite(q.stakePct) || q.stakePct <= 0) reason = "Mise calculée invalide.";
    if (!reason) continue;
    q.decision = "WATCH";
    q.stakePct = 0;
    q.premium = false;
    q.rejectionReason = reason;
    if (q.cover) {
      q.cover.stakePct = 0;
      q.cover.totalStakePct = 0;
      q.cover.ifMainWins = 0;
      q.cover.ifCoverWins = 0;
    }
  }
}
