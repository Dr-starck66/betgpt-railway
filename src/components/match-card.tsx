import { Link } from "@tanstack/react-router";
import type { MatchInput } from "@/engine/types";
import type { PredictionRecord } from "@/engine/types";
import { betMarket, oddsPlayable } from "@/lib/markets";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { BookLinks, PrimaryParier } from "./book-links";
import { CoverBet } from "./cover-bet";
import { DecisionBadge, PremiumBadge, VerdictBadge } from "./ui/badge";
import { settlePick } from "@/lib/news";
import { MatchBoard, matchHeadline, notrePronoLabel, kickoffLong } from "./match-board";

export function MatchCard({
  match,
  prediction,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
}) {
  const mute = skipEuropeFrenchProno(match);
  const ticket = mute ? null : betMarket(prediction.markets);
  const settled = settlePick(match, prediction);
  const title = matchHeadline(match);
  const ticketLabel = ticket ? notrePronoLabel(match.home.name, match.away.name, ticket.market) : "";

  return (
    <article className="fade-up surface-card min-w-0 overflow-hidden p-5 sm:p-6">
      <Link to="/match/$matchId" params={{ matchId: match.slug ?? match.id }} className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className="chip-pill border-sage/25 bg-sage/10 text-link">{match.competition}</span>
              <span className="chip-pill">{kickoffLong(match.kickoff)}</span>
              {match.phaseLabel ? <span className="chip-pill">{match.phaseLabel}</span> : null}
            </div>
            <h2 className="mt-4 min-w-0 break-words text-lg font-bold leading-snug tracking-tight text-paper sm:text-[1.35rem]">
              {title}
            </h2>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {mute ? (
              <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
                Pas de prono
              </span>
            ) : match.status === "finished" &&
              (settled.verdict === "gagnant" ||
                settled.verdict === "perdant" ||
                settled.verdict === "void") ? (
              <VerdictBadge verdict={settled.verdict} />
            ) : ticket ? (
              <DecisionBadge decision={ticket.decision} />
            ) : (
              <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
                Pas de pari
              </span>
            )}
            {!mute && ticket?.premium ? <PremiumBadge /> : null}
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-line/80 bg-slate-50/70 p-4 sm:p-5">
          <MatchBoard match={match} prediction={prediction} size="md" />
        </div>
      </Link>

      {mute ? (
        <p className="mt-5 rounded-[1rem] border border-line bg-slate-50 px-4 py-3 text-sm text-mist">
          Compétition européenne avec club français : suivi score et contexte uniquement, sans pari mis en avant.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          {ticket &&
          match.status === "scheduled" &&
          ticket.decision === "BET" &&
          ticket.listed &&
          oddsPlayable(ticket.bestOdds) ? (
            <PrimaryParier
              links={prediction.bookLinks}
              matchId={match.id}
              book={ticket.bestBook}
              odds={ticket.bestOdds}
              pick={ticketLabel}
              label="Consulter la cote"
            />
          ) : null}
          <BookLinks links={prediction.bookLinks} compact matchId={match.id} />
          {ticket?.cover && ticket.decision === "BET" ? (
            <CoverBet cover={ticket.cover} compact matchId={match.id} />
          ) : null}
        </div>
      )}
    </article>
  );
}
