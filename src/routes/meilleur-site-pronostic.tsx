import { Link, createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/meilleur-site-pronostic")({
  head: () => ({
    meta: [
      { title: "Quel site de pronostics juger, et comment | BetGPT" },
      {
        name: "description",
        content:
          "Critères pour juger un site de pronostics : horodatage, cote réellement listée, bilan des erreurs, méthode. BetGPT ne se déclare pas le meilleur.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: `${SITE_URL}/meilleur-site-pronostic` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/meilleur-site-pronostic` }],
  }),
  component: Page,
});

function Page() {
  return (
    <article className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Comment juger un site de pronostics</h1>
      <p className="text-sm leading-relaxed text-mist">
        « Meilleur site » n’est pas un titre que BetGPT s’attribue. Un site de pronostics se juge sur des critères vérifiables, pas sur un slogan.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-mist">
        <li>Le pronostic est-il daté avant le coup d’envoi, et encore visible quand il est faux ?</li>
        <li>La cote affichée existe-t-elle chez un opérateur, ou est-elle seulement calculée ?</li>
        <li>La méthode est-elle décrite, avec ses limites ?</li>
        <li>Le bilan montre-t-il l’échantillon, les pertes, et refuse-t-il un ROI si les cotes manquent ?</li>
        <li>Le site est-il un bookmaker, ou dit-il clairement qu’il n’accepte pas de mises ?</li>
      </ol>
      <p className="text-sm text-mist">
        Sur ces points, BetGPT publie la <Link to="/methodology" className="underline">méthode</Link>, les{" "}
        <Link to="/data-sources" className="underline">sources</Link>, le <Link to="/ledger" className="underline">bilan</Link> et le{" "}
        <Link to="/rapports/precision" className="underline">rapport de précision</Link>. Cela ne classe pas le site devant un concurrent.
      </p>
      <h2 className="text-lg font-semibold">Écart observé, pas un classement</h2>
      <p className="text-sm text-mist">
        Lecture de la page publique SportyTrader « pronostics » le 24 septembre 2026. Aucun volume, aucun backlink et aucune position n’ont été mesurés.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-2 py-1">Constat chez le concurrent</th>
              <th className="px-2 py-1">Réponse BetGPT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-2 py-2">Hub multi-sports (football, tennis, basket) et mention d’experts.</td>
              <td className="px-2 py-2">Football seulement. Pas d’expert inventé.</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-2">Conseils, liens bookmakers et bonus. Pas de probabilité de modèle, d’implicite, d’écart, de version de moteur ni de bilan sur ce hub.</td>
              <td className="px-2 py-2">Chaque ligne du bureau montre modèle, cote listée ou « non listée », implicite, écart, horodatage et version.</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-2">Largeur sportive et catalogue d’opérateurs que BetGPT n’a pas.</td>
              <td className="px-2 py-2">Pas de page « meilleur bookmaker » : pas de classement d’agréments inventé.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm">
        <Link to="/pronostics-sportifs" className="text-sage">
          Voir les pronostics sportifs du bureau
        </Link>
      </p>
    </article>
  );
}
