import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND_LOGO, imageObjectLd } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/seo";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/redaction")({
  head: () => ({
    meta: [
      { title: "Rédaction BetGPT — publication betgpt.live" },
      {
        name: "description",
        content:
          "Charte éditoriale BetGPT. Pronostics, analyses et résultats football publiés en continu sur betgpt.live.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/redaction` }],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "NewsMediaOrganization",
            name: "BetGPT",
            url: SITE_URL,
            publishingPrinciples: `${SITE_URL}/redaction`,
            logo: imageObjectLd(BRAND_LOGO, SITE_URL),
          }),
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Rédaction BetGPT</h1>
      <p className="seo-answer text-base text-paper">
        BetGPT publie sur betgpt.live, du matin au soir : pronostic et analyse avant le match, score en
        direct, résultat dès le coup de sifflet.
      </p>
      <p className="text-sm leading-relaxed text-mist">
        Chaque article est daté, signé BetGPT, libre d'accès. Couverture : Ligue 1, Premier League, Liga,
        Bundesliga, Serie A, Ligue des champions, Ligue Europa. Mise à jour automatique. Jeu responsable
        18+.
      </p>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-paper">Transparence éditoriale</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          La rédaction relie ses publications aux règles éditoriales, aux sources de données et à la méthodologie
          afin que chaque lecteur puisse vérifier comment BetGPT produit et corrige ses contenus.
        </p>
        <nav aria-label="Transparence BetGPT" className="mt-4 flex flex-wrap gap-2">
          <Link to="/editorial-policy" className="chip-pill hover:text-link">Politique éditoriale</Link>
          <Link to="/data-sources" className="chip-pill hover:text-link">Sources des données</Link>
          <Link to="/methodology" className="chip-pill hover:text-link">Méthodologie</Link>
          <Link to="/prediction-history" className="chip-pill hover:text-link">Historique des prédictions</Link>
        </nav>
      </section>
    </article>
  ),
});
