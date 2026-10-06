import { Link } from "@tanstack/react-router";
import { SERP_COMPETITIONS } from "@/lib/serp/leagues";
import { parisTime } from "@/lib/serp/answer";
import type { ResultRow } from "@/lib/serp/results";
import { TeamLine } from "@/components/crest";
import { matchPath } from "@/lib/seo";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function ResultCards({ rows, label }: { rows: ResultRow[]; label: string }) {
  if (!rows.length) {
    return (
      <div className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-paper">Aucun match terminé enregistré ce jour.</p>
          <p className="mt-1 text-sm text-mist">Les rencontres en cours restent visibles dans les scores en direct jusqu’à leur coup de sifflet final.</p>
        </div>
        <Link to="/scores-en-direct" className="chip-pill w-fit hover:border-sage/30 hover:text-link">
          Voir les scores en direct
        </Link>
      </div>
    );
  }

  return (
    <ol aria-label={label} className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => (
        <li key={row.slug}>
          <article className="surface-card block p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span className="font-semibold uppercase tracking-[0.12em]">{row.competition}</span>
              <span className="tabular">{parisTime(row.kickoff) || "—"}</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <TeamLine
                home={{ name: row.home, short: row.homeShort, id: row.homeId, logo: row.homeLogo }}
                away={{ name: row.away, short: row.awayShort, id: row.awayId, logo: row.awayLogo }}
                size={30}
                names="auto"
                competition={row.competition}
                league={row.league}
                className="min-w-0 flex-1"
              />
              <span className="shrink-0 text-2xl font-extrabold tabular tracking-tight text-paper sm:text-3xl">
                {row.scoreHome}–{row.scoreAway}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="chip-pill min-h-0 py-1">Terminé</span>
              {row.detailAvailable ? (
                <a href={matchPath(row)} className="text-xs font-semibold text-link hover:underline">
                  Fiche du match →
                </a>
              ) : (
                <span className="text-xs font-medium text-muted">Score fournisseur · dossier non archivé</span>
              )}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface-card px-4 py-4 text-center">
      <div className="text-2xl font-bold tracking-tight text-paper">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
    </div>
  );
}

export function ResultsBoard({
  h1,
  lead,
  sections,
  asOf,
  showSeoGuide = false,
}: {
  h1: string;
  lead: string;
  sections: { id: string; title: string; rows: ResultRow[] }[];
  asOf?: string;
  showSeoGuide?: boolean;
}) {
  const allRows = sections
    .flatMap((section) => section.rows)
    .slice()
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const latest = allRows[0];
  const competitionCount = new Set(allRows.map((row) => row.competition)).size;
  const historyLabel = sections.length > 1 ? "Résultats des 7 derniers jours" : "Résultats détaillés";

  return (
    <div className="space-y-8" data-results-as-of={asOf || ""} data-results-history-days={sections.length}>
      <header className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-end">
          <div className="max-w-4xl">
            <p className="eyebrow">Scores finaux · football</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-paper sm:text-5xl">{h1}</h1>
            <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{lead}</p>

            {asOf ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                <span className="chip-pill min-h-0 py-1.5">Actualisé à {parisTime(asOf) || "l’instant"} · heure de Paris</span>
                {latest ? <span className="chip-pill min-h-0 py-1.5">Dernier résultat : {dayTitle(latest.day)}</span> : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metric value={String(allRows.length)} label="Matchs" />
            <Metric value={String(competitionCount)} label="Compétitions" />
            <Metric value={String(sections.length)} label={sections.length > 1 ? "Jours" : "Vue"} />
          </div>
        </div>

        <nav aria-label="Résultats par date et compétition" className="mt-6 flex flex-wrap gap-2 text-sm">
          <Link to="/scores-en-direct" className="chip-pill hover:border-sage/30 hover:text-link">Scores en direct</Link>
          <a href="/resultats-football" className="chip-pill hover:border-sage/30 hover:text-link">Tous les résultats</a>
          <a href="/resultats-football/aujourdhui" className="chip-pill hover:border-sage/30 hover:text-link">Aujourd’hui</a>
          <a href="/resultats-football/hier" className="chip-pill hover:border-sage/30 hover:text-link">Hier</a>
          {SERP_COMPETITIONS.map((c) => (
            <a key={c.slug} href={c.resultsPath} className="chip-pill hover:border-sage/30 hover:text-link">{c.title}</a>
          ))}
        </nav>
      </header>

      <section className="space-y-6" aria-labelledby="results-history-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Scores finaux</p>
            <h2 id="results-history-title" className="mt-1 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
              {historyLabel}
            </h2>
          </div>
          <span className="chip-pill w-fit">{allRows.length} match{allRows.length > 1 ? "s" : ""} terminé{allRows.length > 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.id} className="space-y-3" aria-labelledby={`results-${section.id}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 id={`results-${section.id}`} className="text-xl font-semibold tracking-tight text-paper">{section.title}</h3>
                <span className="text-sm font-medium text-muted">{section.rows.length} match{section.rows.length > 1 ? "s" : ""}</span>
              </div>
              <ResultCards rows={section.rows} label={section.title} />
            </section>
          ))}
        </div>
      </section>

      {showSeoGuide ? (
        <>
          <section className="surface-card p-6 sm:p-8" aria-labelledby="results-guide-title">
            <p className="eyebrow">Guide résultats</p>
            <h2 id="results-guide-title" className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
              Résultats football : scores finaux, dates et compétitions
            </h2>
            <p className="mt-4 max-w-4xl leading-relaxed text-mist">
              Cette page regroupe les matchs terminés disponibles dans le bureau BetGPT et les classe du plus récent au plus ancien.
              Chaque résultat affiche l’heure de Paris, la compétition, les deux équipes et le score final, avec un accès direct à la fiche du match.
            </p>

            <div className="mt-7 grid gap-6 lg:grid-cols-3">
              <div>
                <h3 className="text-lg font-semibold text-paper">Compétitions suivies</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  Ligue 1, Premier League, La Liga, Bundesliga, Serie A, Ligue des champions, Ligue Europa et autres compétitions couvertes lorsqu’un résultat final est disponible.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-paper">Du direct au score final</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  Pendant une rencontre, consultez les <Link to="/scores-en-direct" className="font-semibold text-link hover:underline">scores en direct</Link>.
                  Après la fin du match, le score rejoint cet historique de résultats.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-paper">Méthode et fraîcheur</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  L’heure de mise à jour est affichée en haut de page. La <a href="/score-data-methodology" className="font-semibold text-link hover:underline">méthodologie des scores</a> et les <a href="/data-sources" className="font-semibold text-link hover:underline">sources de données</a> détaillent le fonctionnement du suivi.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4" aria-labelledby="results-faq-title">
            <div>
              <p className="eyebrow">Questions fréquentes</p>
              <h2 id="results-faq-title" className="mt-1 text-2xl font-semibold tracking-tight text-paper">
                Comprendre la page des résultats football
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <article className="surface-card p-5">
                <h3 className="font-semibold text-paper">Pourquoi un jour peut-il afficher 0 match ?</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  Cela signifie qu’aucune rencontre terminée n’est disponible ce jour-là dans les compétitions suivies. Les matchs en cours restent dans la page des scores en direct.
                </p>
              </article>
              <article className="surface-card p-5">
                <h3 className="font-semibold text-paper">À quelle heure les résultats sont-ils affichés ?</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  Les heures visibles sur cette page sont présentées en heure de Paris. Le bandeau supérieur indique aussi l’heure de la dernière actualisation disponible.
                </p>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export function resultsLead(rows: ResultRow[], label: string): string {
  if (!rows.length) return `Aucun résultat football ${label} n’est disponible pour le moment dans les compétitions suivies.`;
  const bits = rows.slice(0, 4).map((r) => `${r.home} ${r.scoreHome}–${r.scoreAway} ${r.away}`);
  return `Derniers scores ${label} : ${bits.join(" · ")}. Retrouvez ci-dessous les résultats complets, classés par date et compétition.`;
}

export function dayTitle(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return "Date précédente";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
