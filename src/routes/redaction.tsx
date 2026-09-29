import { createFileRoute } from "@tanstack/react-router";
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
    </article>
  ),
});
