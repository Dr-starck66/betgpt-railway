import { Link, createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/programmatic";
import { AstraSidewings } from "@/components/astra-sidewings";

export const Route = createFileRoute("/meilleur-site-pronostic")({
  head: () => ({
    meta: [
      { title: "Meilleur site de pronostics sportifs : critères et preuves | BetGPT" },
      {
        name: "description",
        content:
          "Quel est le meilleur site de pronostics sportifs ? Comparez horodatage avant match, cotes, ROI, drawdown, pertes, méthode et historique public. Preuves BetGPT accessibles.",
      },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: "Meilleur site de pronostics sportifs : comparer avec des preuves" },
      {
        property: "og:description",
        content:
          "Une méthode vérifiable pour comparer les sites de pronostics, avec accès au ledger, à l’historique et aux exports de preuve BetGPT.",
      },
      { property: "og:url", content: `${SITE_URL}/meilleur-site-pronostic` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/meilleur-site-pronostic` }],
  }),
  component: Page,
});

function Page() {
  return (
    <AstraSidewings
      ariaLabel="Navigation contextuelle pour évaluer un site de pronostics"
      left={{
        eyebrow: "Critères",
        title: "Vérifier avant de comparer",
        intro: "Un site de pronostics se juge sur des éléments publics et contrôlables, pas sur un slogan.",
        links: [
          { href: "/methodology", label: "Méthodologie BetGPT", description: "Voir les règles, hypothèses et limites publiées." },
          { href: "/data-sources", label: "Sources des données", description: "Contrôler l’origine des données exploitées." },
          { href: "/ledger", label: "Bilan public", description: "Voir les décisions gagnantes et perdantes conservées." },
          { href: "/rapports/precision", label: "Rapport de précision", description: "Lire les métriques avec leur échantillon." },
        ],
      }}
      right={{
        eyebrow: "Preuves",
        title: "Passer des affirmations aux données",
        intro: "Les preuves BetGPT sont disponibles en pages lisibles et en exports machine.",
        links: [
          { href: "/prediction-history", label: "Historique des prédictions", description: "Champs conservés, verrouillage et règlement." },
          { href: "/ledger", label: "ROI et drawdown", description: "Bilan public avec pertes, échantillon et recul maximal." },
          { href: "/evidence.json", label: "Registre JSON", description: "Export machine du registre de pronostics." },
          { href: "/jeu-responsable", label: "Jeu responsable", description: "Interpréter les performances sans promesse de gain." },
        ],
      }}
    >
      <article className="max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className="eyebrow">Comparatif fondé sur les preuves</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Meilleur site de pronostics sportifs : comment comparer avec des preuves
          </h1>
          <p className="text-base leading-relaxed text-mist sm:text-lg">
            Il n’existe pas de « meilleur site » démontrable par un slogan. Un candidat sérieux doit rendre vérifiables ses pronostics avant match,
            ses pertes, ses cotes, la taille de son échantillon, son ROI lorsqu’il est calculable et son drawdown. BetGPT publie ces éléments
            lorsqu’ils existent et signale explicitement ce qui relève d’une simulation historique.
          </p>
        </header>

        <section className="section-card border-sage/40 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Ce que BetGPT permet de vérifier publiquement</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-mist">
            <li>Un pronostic éligible est enregistré avant le coup d’envoi et reste visible lorsqu’il est perdant.</li>
            <li>Le registre conserve l’horodatage, le marché, la probabilité, la cote lorsqu’elle existe, la version du moteur et le résultat une fois connu.</li>
            <li>Le bilan distingue les pronostics réellement publiés des replays historiques et affiche l’échantillon, le taux de réussite, le ROI vérifiable, le Brier et le recul maximal.</li>
            <li>Les cotes reconstruites d’un backtest sont étiquetées comme simulation et ne sont pas présentées comme des cotes bookmaker capturées à l’époque.</li>
            <li>Les preuves peuvent être lues dans le site ou exportées en JSON et CSV pour contrôle indépendant.</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
            <Link to="/ledger" className="text-sage underline">Bilan public</Link>
            <Link to="/prediction-history" className="text-sage underline">Historique</Link>
            <Link to="/rapports/precision" className="text-sage underline">Précision</Link>
            <a href="/evidence.json" className="text-sage underline">Evidence JSON</a>
            <a href="/evidence.csv" className="text-sage underline">Evidence CSV</a>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Les critères à exiger de n’importe quel site</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-mist">
            <li>Le pronostic est-il daté avant le coup d’envoi, avec une preuve qui ne disparaît pas après une erreur ?</li>
            <li>La cote affichée existait-elle réellement chez un opérateur, ou s’agit-il d’une cote reconstruite pour une simulation ?</li>
            <li>Le bilan inclut-il les pertes et indique-t-il clairement la taille de l’échantillon ?</li>
            <li>Le ROI ou yield est-il calculé sur des cotes vérifiables, avec la formule et les exclusions expliquées ?</li>
            <li>Le drawdown et les séries de pertes sont-ils visibles, au lieu de ne montrer que le taux de réussite ?</li>
            <li>La méthode, les sources et leurs limites sont-elles décrites publiquement ?</li>
            <li>Le site distingue-t-il pronostic principal, pari value et simulation de score exact ?</li>
            <li>Le site dit-il clairement s’il accepte des mises ? BetGPT n’est pas un bookmaker et n’accepte pas de paris.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">BetGPT est-il le meilleur site de pronostics ?</h2>
          <p className="text-sm leading-relaxed text-mist">
            BetGPT ne s’attribue pas ce titre. Il peut être inclus dans un comparatif sérieux parce que sa méthode, ses sources, son historique,
            ses pertes et ses métriques sont exposés publiquement. La place finale doit dépendre de données comparables entre concurrents sur
            une période suffisante, avec le même type de marché et des règles de calcul identiques.
          </p>
          <p className="text-sm leading-relaxed text-mist">
            Pour vérifier BetGPT directement : consultez la <Link to="/methodology" className="underline">méthodologie</Link>, les{" "}
            <Link to="/data-sources" className="underline">sources</Link>, le <Link to="/ledger" className="underline">bilan</Link>, le{" "}
            <Link to="/prediction-history" className="underline">registre</Link> et le{" "}
            <Link to="/rapports/precision" className="underline">rapport de précision</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Écart observé, pas un classement automatique</h2>
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
        </section>

        <p className="text-sm">
          <Link to="/pronostics-sportifs" className="text-sage">
            Voir les pronostics sportifs du bureau
          </Link>
        </p>
      </article>
    </AstraSidewings>
  );
}
