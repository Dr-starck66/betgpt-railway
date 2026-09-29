import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/comparer-cotes")({
  head: () => ({
    meta: [
      { title: "Comparer les cotes football France | BetGPT" },
      {
        name: "description",
        content:
          "Outil d’information : comparer les cotes 1N2 des books agréés en France. 18+. Pas un opérateur de paris. Pas de gain garanti.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/comparer-cotes` }],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-sage">18+ · Liens sponsorisés</p>
      <h1 className="text-2xl font-semibold tracking-tight">Comparer les cotes football</h1>
      <p className="text-sm leading-relaxed text-paper">
        BetGPT est un <strong>outil d’information</strong>. On aligne les cotes 1, N, 2 des sites
        accessibles en France. On n’accepte aucune mise. Un écart de cote n’est pas un gain assuré.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-paper">
        <li>Matchs officiels uniquement</li>
        <li>Books agréés ANJ (selon le lien)</li>
        <li>Jeu responsable, mineurs interdits</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link to="/meilleures-cotes" className="inline-flex min-h-11 items-center rounded-md bg-sage px-4 text-sm font-semibold text-ink">
          Voir les cotes du jour
        </Link>
        <Link to="/jeu-responsable" className="inline-flex min-h-11 items-center text-sm text-mist">
          Jeu responsable
        </Link>
      </div>
      <p className="text-xs text-muted">
        Joueurs Info Service 09 74 75 13 13 ·{" "}
        <a href="https://www.joueurs-info-service.fr">joueurs-info-service.fr</a>
      </p>
    </article>
  ),
});
