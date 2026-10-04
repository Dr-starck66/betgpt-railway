import { createFileRoute, Link } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { getPublicDesk } from "@/lib/desk.functions";
import { bestThreeWay } from "@/lib/money";
import { SITE_URL } from "@/lib/programmatic";
import { fmtOdds } from "@/lib/utils";
import { bookmakerDestination } from "@/lib/bookmaker-url";
import type { MatchInput } from "@/engine/types";


function OddsCell({
  line,
  match,
}: {
  line: { odds: number; book: string; url?: string };
  match: MatchInput;
}) {
  const href = bookmakerDestination(line.book, match.league, line.url);
  if (!href) {
    return (
      <>
        <strong className="tabular text-paper">{fmtOdds(line.odds)}</strong>
        <div className="text-xs text-muted">{line.book}</div>
      </>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex min-h-[4.25rem] w-full min-w-0 max-w-[9rem] flex-col items-center justify-center rounded-xl border border-sage/70 bg-sage px-2 py-2 text-center text-ink shadow-[0_8px_20px_rgba(124,194,58,0.22)] transition hover:-translate-y-0.5 hover:brightness-95"
      aria-label={`Voir la meilleure cote chez ${line.book}, cote ${fmtOdds(line.odds)}`}
      title={`Ouvrir ${line.book} · cote ${fmtOdds(line.odds)} · 18+`}
    >
      <strong className="tabular text-base font-black leading-none">{fmtOdds(line.odds)}</strong>
      <span className="mt-1 max-w-full truncate text-[11px] font-bold">{line.book}</span>
      <span className="mt-1 text-[9px] font-black uppercase tracking-[0.08em]">Voir la cote →</span>
    </a>
  );
}

export const Route = createFileRoute("/comparer-cotes")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Comparer les cotes football France | BetGPT" },
      {
        name: "description",
        content:
          "Comparateur de cotes 1N2 football : meilleures cotes disponibles par match et bookmaker. 18+. Pas un opérateur de paris.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/comparer-cotes` }],
  }),
  component: OddsCompare,
});

function OddsCompare() {
  const data = Route.useLoaderData();
  const matches = data.matches
    .filter((m) => m.status !== "finished" && m.status !== "cancelled")
    .slice()
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));

  const rows = matches.map((m) => ({ m, best: bestThreeWay(m) }));
  const withOdds = rows.filter((row) => row.best).length;

  return (
    <article className="min-w-0 space-y-6">
      <header className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Comparateur 1N2</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Comparer les cotes football</h1>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-mist sm:text-lg">
          Les matchs disponibles sont affichés directement ici avec leurs équipes, leurs écussons et la meilleure cote
          observée pour 1, N et 2. Quand aucune cote exploitable n’est disponible, BetGPT l’écrit au lieu de laisser la page vide.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
          <span className="chip-pill">{matches.length} matchs affichés</span>
          <span className="chip-pill">{withOdds} avec cotes comparables</span>
          <span className="chip-pill">18+</span>
          <Link to="/jeu-responsable" className="chip-pill hover:text-link">Jeu responsable</Link>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="surface-card p-6">
          <h2 className="font-semibold text-paper">Aucun match à comparer pour l’instant</h2>
          <p className="mt-2 text-sm text-mist">
            Le comparateur n’invente pas de rencontres ni de cotes. Les prochains matchs apparaîtront dès qu’ils seront présents dans le bureau BetGPT.
          </p>
        </div>
      ) : (
        <div className="surface-card min-w-0 overflow-hidden">
          <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[680px] table-fixed text-left text-sm md:min-w-0">
              <thead className="bg-raised text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-[38%] px-2 py-2 sm:px-3">Match</th>
                  <th className="w-[14%] px-2 py-2 sm:px-3">1</th>
                  <th className="w-[14%] px-2 py-2 sm:px-3">N</th>
                  <th className="w-[14%] px-2 py-2 sm:px-3">2</th>
                  <th className="w-[20%] px-2 py-2 sm:px-3">Détail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ m, best }) => (
                  <tr key={m.id} className="border-t border-line align-middle">
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <Link to="/cotes/$matchId" params={{ matchId: m.slug ?? m.id }} className="block min-w-0 hover:text-sage">
                        <TeamLine home={m.home} away={m.away} size={28} names="auto" competition={m.competition} league={m.league} className="max-w-full" />
                      </Link>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted">
                        <span className="min-w-0 truncate">{m.competition}</span>
                        <span>·</span>{" "}
                        {new Date(m.kickoff).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      {best ? (
                        <OddsCell line={best.home} match={m} />
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      {best ? (
                        <OddsCell line={best.draw} match={m} />
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      {best ? (
                        <OddsCell line={best.away} match={m} />
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="min-w-0 px-2 py-3 sm:px-3">
                      <Link
                        to="/cotes/$matchId"
                        params={{ matchId: m.slug ?? m.id }}
                        className="inline-flex min-h-9 max-w-full items-center whitespace-nowrap rounded-md border border-line px-2.5 text-xs font-semibold text-paper hover:border-sage hover:text-sage"
                      >
                        Voir les cotes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <section className="surface-card p-5 text-sm leading-relaxed text-mist sm:p-6">
        <h2 className="text-base font-semibold text-paper">Lecture simple</h2>
        <p className="mt-2">
          <strong>1</strong> = victoire à domicile, <strong>N</strong> = match nul, <strong>2</strong> = victoire à l’extérieur.
          Le nom sous la cote indique le bookmaker qui fournit la meilleure valeur observée parmi les données disponibles.
        </p>
        <p className="mt-2 text-xs text-muted">
          Comparatif informatif. Les cotes peuvent évoluer. 18+. Aucun gain n’est garanti.
        </p>
      </section>
    </article>
  );
}
