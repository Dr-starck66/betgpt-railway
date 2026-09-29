import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/auteurs_/betgpt-editorial")({
  head: () => ({
    meta: [
      { title: "BetGPT Editorial — rédaction et corrections | BetGPT" },
      {
        name: "description",
        content:
          "BetGPT Editorial signe les articles football sélectionnés automatiquement par betgpt.live. Méthode, sources, responsabilité et corrections.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: "BetGPT Editorial" },
      { property: "og:url", content: `${SITE_URL}/auteurs/betgpt-editorial` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/auteurs/betgpt-editorial` }],
  }),
  component: AuthorPage,
});

function AuthorPage() {
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BetGPT Editorial",
    url: `${SITE_URL}/auteurs/betgpt-editorial`,
    parentOrganization: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL },
    publishingPrinciples: `${SITE_URL}/editorial-policy`,
  };
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(json) }} />
      <h1 className="font-display text-3xl tracking-tight">BetGPT Editorial</h1>
      <p className="text-base leading-relaxed text-paper">
        Les articles d'actualité signés ici sont sélectionnés et produits automatiquement par BetGPT Editorial. Aucun journaliste humain n'est inventé pour les signer.
      </p>
      <h2 className="text-xl font-semibold">Fonctionnement</h2>
      <p className="text-sm leading-relaxed text-mist">
        La rédaction automatique vise trois articles par jour, heure de Paris, sur trois créneaux éditoriaux. Chaque sujet doit franchir un filtre de fraîcheur, intérêt pour le public français, force des entités, originalité, qualité des sources, image et angle éditorial. Si un candidat échoue, le moteur cherche un sujet de remplacement ; il ne doit pas publier un contenu faible uniquement pour remplir un quota.
      </p>
      <h2 className="text-xl font-semibold">Méthode et sources</h2>
      <p className="text-sm leading-relaxed text-mist">
        Les faits viennent du calendrier, des scores et des cotes déjà ingérés par BetGPT. Une cote est un prix observé, pas
        une consigne. Une estimation de modèle est étiquetée comme telle. Une information absente — composition officielle,
        transfert, blessure — n'est pas complétée. Les statuts affichés sont OFFICIAL, HIGH_CONFIDENCE, CORROBORATED,
        UNCONFIRMED ou UNKNOWN.
      </p>
      <h2 className="text-xl font-semibold">Responsabilité</h2>
      <p className="text-sm leading-relaxed text-mist">
        BetGPT n'est pas un bookmaker. Les articles sont de l'information sportive, 18+. Aucune apparition dans Google
        Discover, Google News ou les blocs À la une n'est promise.
      </p>
      <h2 className="text-xl font-semibold">Corrections</h2>
      <p className="text-sm leading-relaxed text-mist">
        Si le score, le statut ou la cote observée change après publication, la même URL est mise à jour et la correction
        est listée. L'heure de première publication ne recule pas et n'est pas rafraîchie artificiellement.
      </p>
      <p className="text-sm text-sage">
        <Link to="/editorial-policy">Politique éditoriale</Link>
        {" · "}
        <Link to="/methodology">Méthodologie</Link>
        {" · "}
        <Link to="/data-sources">Sources de données</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
      </p>
    </article>
  );
}
