import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldAlert, Trophy } from "lucide-react";
import { PrimaryParier } from "./book-links";
import { fmtOdds } from "@/lib/utils";
import type { HomepageBet } from "@/lib/home-bets";

function kickoffInParis(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * First content block on the homepage: bets are taken directly from the
 * production engine. This component cannot fabricate or upgrade WATCH picks.
 */
export function HomeBetsSpotlight({
  bets,
  bettingPaused,
}: {
  bets: HomepageBet[];
  bettingPaused: boolean;
}) {
  return (
    <section
      id="paris-conseilles"
      aria-labelledby="paris-conseilles-heading"
      className="overflow-hidden rounded-[1.75rem] border-2 border-sage/70 bg-header text-white shadow-[0_22px_55px_rgba(15,23,42,.24)]"
    >
      <header className="border-b border-white/15 bg-gradient-to-r from-sage/25 via-sage/10 to-transparent px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-sage/60 bg-sage px-3 py-1 text-xs font-black uppercase tracking-[.14em] text-ink">
            <Trophy size={14} aria-hidden="true" />
            La sélection BetGPT
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            {bets.length} pari{bets.length > 1 ? "s" : ""} validé{bets.length > 1 ? "s" : ""}
          </span>
        </div>
        <h2 id="paris-conseilles-heading" className="mt-3 text-3xl font-black leading-tight tracking-tight !text-white sm:text-4xl lg:text-5xl">
          Paris conseillés — à la une
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
          Uniquement les matchs à venir avec une décision BET du moteur, une cote bookmaker affichée et les contrôles de risque validés. Aucune sélection forcée.
        </p>
      </header>

      {bets.length ? (
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-3 lg:gap-4 lg:p-6">
          {bets.map(({ match, prediction, market }, index) => (
            <article
              key={match.id}
              className={`min-w-0 rounded-2xl border p-5 shadow-lg sm:p-6 ${
                index === 0
                  ? "border-sage/75 bg-white text-paper"
                  : "border-white/15 bg-white/10 text-white"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
                  index === 0 ? "bg-sage text-ink" : "bg-sage/20 text-sage"
                }`}>
                  {index === 0 ? "N°1 du moment" : `Sélection n°${index + 1}`}
                </span>
                <span className={`text-xs font-semibold ${
                  index === 0 ? "text-muted" : "text-white/70"
                }`}>
                  {match.competition}
                </span>
              </div>
              <h3 className={`mt-5 text-xl font-black leading-snug tracking-tight sm:text-2xl ${
                index === 0 ? "!text-paper" : "!text-white"
              }`}>
                {match.home.name} – {match.away.name}
              </h3>
              <p className={`mt-1 text-sm ${
                index === 0 ? "text-mist" : "text-white/70"
              }`}>
                {kickoffInParis(match.kickoff)} · heure de Paris
              </p>
              <div className={`mt-5 rounded-xl px-4 py-4 ${
                index === 0 ? "bg-slate-50" : "bg-black/20"
              }`}>
                <p className={`text-xs font-bold uppercase tracking-[.1em] ${
                  index === 0 ? "text-muted" : "text-white/65"
                }`}>Pronostic conseillé</p>
                <p className={`mt-1 text-lg font-bold ${
                  index === 0 ? "text-paper" : "text-white"
                }`}>{market.label}</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={`text-xs ${
                      index === 0 ? "text-muted" : "text-white/65"
                    }`}>Cote affichée</p>
                    <p className={`text-4xl font-black tabular-nums tracking-tight ${
                      index === 0 ? "text-link" : "text-sage"
                    }`}>{fmtOdds(market.bestOdds)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${
                      index === 0 ? "text-muted" : "text-white/65"
                    }`}>Probabilité modèle</p>
                    <p className={`text-2xl font-black tabular-nums ${
                      index === 0 ? "text-paper" : "text-white"
                    }`}>{Math.round(market.modelProb * 100)} %</p>
                  </div>
                </div>
              </div>
              <p className={`mt-3 text-xs ${
                index === 0 ? "text-muted" : "text-white/70"
              }`}>Cote non garantie · {market.bestBook.replace(/\\s·\\s.*$/, "")} · 18+</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PrimaryParier
                  links={prediction.bookLinks}
                  matchId={match.id}
                  book={market.bestBook}
                  odds={market.bestOdds}
                  pick={market.label}
                  label="Voir la cote"
                />
                <Link
                  to="/match/$matchId"
                  params={{ matchId: match.slug ?? match.id }}
                  className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${
                    index === 0
                      ? "border-line text-paper hover:border-sage"
                      : "border-white/30 text-white hover:border-sage"
                  }`}
                >
                  Analyse <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4 px-5 py-7 sm:px-8 sm:py-9">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 shrink-0 text-sage" aria-hidden="true" />
            <p className="text-xl font-black !text-white sm:text-2xl">
              Aucun pari conseillé à prendre actuellement
            </p>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
            {bettingPaused
              ? "Les mises sont suspendues par le frein de sécurité lié aux résultats récents. Les analyses restent consultables, mais aucun match n’est présenté comme un pari validé."
              : "Aucun match à venir ne franchit actuellement tous les critères du moteur. Les pronostics restent consultables sans être présentés comme des mises conseillées."}
          </p>
          <Link
            to="/pronostics-sportifs"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-sage px-5 text-sm font-black text-ink"
          >
            Consulter les analyses <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 px-5 py-3 text-xs text-white/65 sm:px-8">
        <span>18+ · Risque de perte. Les cotes évoluent et aucune prédiction n’est certaine.</span>
        <Link to="/ledger" className="font-semibold text-sage underline underline-offset-4">
          Vérifier les résultats du modèle
        </Link>
      </footer>
    </section>
  );
}
