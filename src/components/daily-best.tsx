import { Link } from "@tanstack/react-router";
import type { MarketQuote, PredictionRecord } from "@/engine/types";
import { valueExplain } from "@/lib/plain";
import { teamPath } from "@/lib/programmatic";
import { fmtOdds, fmtPct, fmtSignedPct } from "@/lib/utils";
import { BookLinks, PrimaryParier } from "./book-links";
import { CoverBet } from "./cover-bet";
import { Crest } from "./crest";
import { DecisionBadge, PremiumBadge } from "./ui/badge";
import { Meter } from "./meters";
import { formatMatchHeadline } from "./match-board";

export function DailyBest({
  prediction,
  market,
}: {
  prediction: PredictionRecord;
  market: MarketQuote;
}) {
  const book = market.bestBook.replace(/\s·\s.*$/, "");
  const pick = market.label
    .replace("1 — Domicile", "Victoire à domicile")
    .replace("2 — Extérieur", "Victoire à l'extérieur")
    .replace("X — Nul", "Match nul");
  return (
    <section className="fade-up overflow-hidden rounded-md border border-line bg-surface shadow-soft">
      <div className="border-b-4 border-sage bg-header px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sage">
          {market.premium ? "Opportunité premium du jour" : "Opportunité du jour"}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          {market.premium ? <PremiumBadge /> : null}
          <DecisionBadge decision={market.decision} />
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <a href={teamPath(prediction.home.name)} title={`Pronostic ${prediction.home.name}`}>
              <Crest
                name={prediction.home.name}
                short={prediction.home.short}
                logo={prediction.home.logo}
                color={prediction.home.color}
                id={prediction.home.id}
                size={48}
                competition={prediction.competition}
              />
            </a>
            <span className="text-muted">–</span>
            <a href={teamPath(prediction.away.name)} title={`Pronostic ${prediction.away.name}`}>
              <Crest
                name={prediction.away.name}
                short={prediction.away.short}
                logo={prediction.away.logo}
                color={prediction.away.color}
                id={prediction.away.id}
                size={48}
                competition={prediction.competition}
              />
            </a>
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-paper sm:text-3xl">
            {formatMatchHeadline({
              home: prediction.home.name,
              away: prediction.away.name,
              competition: prediction.competition,
              kickoff: prediction.kickoff,
            })}
          </h2>
          <p className="mt-1 text-sm text-muted">{prediction.venue}</p>
          <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-mist">
            {valueExplain(prediction, market)}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Meter
              label="Tout le monde est d'accord"
              value={prediction.consensus.directionalAgreement}
              tone="sage"
            />
            <Meter label="Ça discute" value={prediction.consensus.disagreement} tone="clay" />
            <Meter label="Risque de se tromper" value={prediction.devil.predictionChallengeScore} tone="rust" />
          </div>
          {market.cover ? (
            <div className="mt-5">
              <CoverBet cover={market.cover} matchId={prediction.matchId} />
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PrimaryParier
              links={prediction.bookLinks}
              matchId={prediction.matchId}
              book={book}
              odds={market.bestOdds}
              pick={pick}
            />
            <Link
              to="/match/$matchId"
              params={{ matchId: prediction.matchId }}
              className="inline-flex min-h-10 items-center rounded-md border border-line px-4 text-sm font-semibold text-paper"
            >
              Dossier
            </Link>
            <BookLinks links={prediction.bookLinks} matchId={prediction.matchId} />
            <Link
              to="/chat"
              reloadDocument
              search={{
                q: `L'opportunité du jour : ${prediction.home.name} contre ${prediction.away.name}, ${market.label}. T'es d'accord ?`,
              }}
              className="text-sm text-mist underline-offset-4 hover:text-paper hover:underline"
            >
              En parler au chat
            </Link>
          </div>
        </div>
        <aside className="border-t border-line bg-raised/60 p-5 lg:border-t-0 lg:border-l">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Le pari</p>
          <p className="mt-2 text-sm font-medium text-paper">{pick}</p>
          <p className="sage-pulse mt-4 inline-block rounded-md px-1 font-mono text-4xl font-medium tabular tracking-tight text-sage">
            {fmtOdds(market.bestOdds)}
          </p>
          <p className="mt-1 text-sm text-mist">{book}</p>
          <dl className="mt-5 space-y-2 text-sm">
            <Row k="Nos chances" v={`${Math.round(market.modelProb * 100)} %`} />
            <Row k="Écart" v={fmtSignedPct(market.edge)} hot={market.edge > 0} />
            <Row k="Gain estimé" v={fmtSignedPct(market.ev)} hot={market.ev > 0} />
            <Row k="Mise" v={market.decision === "BET" ? fmtPct(market.stakePct) : "Rien"} />
          </dl>
        </aside>
      </div>
    </section>
  );
}

function Row({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`tabular ${hot ? "font-medium text-sage" : "text-paper"}`}>{v}</span>
    </div>
  );
}
