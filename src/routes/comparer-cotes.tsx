import { createFileRoute, Link } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { getPublicDesk } from "@/lib/desk.functions";
import { bestThreeWay } from "@/lib/money";
import { SITE_URL } from "@/lib/programmatic";
import { fmtOdds } from "@/lib/utils";

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
    <article className="space-y-6">
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
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-raised text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">1</th>
                  <th className="px-3 py-2">N</th>
                  <th className="px-3 py-2">2</th>
                  <th className="px-3 py-2">Détail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ m, best }) => (
                  <tr key={m.id} className="border-t border-line align-middle">
                    <td className="px-3 py-3">
                      <Link to="/cotes/$matchId" params={{ matchId: m.slug ?? m.id }} className="hover:text-sage">
                        <TeamLine home={m.home} away={m.away} size={28} names="auto" competition={m.competition} />
                      </Link>
                      <div className="mt-1 text-xs text-muted">
                        {m.competition} ·{" "}
                        {new Date(m.kickoff).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {best ? (
                        <>
                          <strong className="tabular text-paper">{fmtOdds(best.home.odds)}</strong>
                          <div className="text-xs text-muted">{best.home.book}</div>
                        </>
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {best ? (
                        <>
                          <strong className="tabular text-paper">{fmtOdds(best.draw.odds)}</strong>
                          <div className="text-xs text-muted">{best.draw.book}</div>
                        </>
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {best ? (
                        <>
                          <strong className="tabular text-paper">{fmtOdds(best.away.odds)}</strong>
                          <div className="text-xs text-muted">{best.away.book}</div>
                        </>
                      ) : (
                        <span className="text-muted">Non disponible</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to="/cotes/$matchId"
                        params={{ matchId: m.slug ?? m.id }}
                        className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-semibold text-paper hover:border-sage hover:text-sage"
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
