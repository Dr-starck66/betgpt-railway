import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/politique-publicite")({
  head: () => ({
    meta: [
      { title: "Politique publicitaire | BetGPT" },
      { name: "description", content: "Publicité Google AdSense, cookies pub, consentement, désinscription." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/politique-publicite` }],
  }),
  component: () => (
    <LegalLayout title="Politique publicitaire">
      <p>
        BetGPT peut afficher des annonces Google AdSense. Les pubs n’apparaissent qu’après
        consentement (bandeau cookies). Refuser ne bloque pas la lecture du site.
      </p>
      <p>
        Google peut utiliser des cookies (dont DoubleClick) pour diffuser et mesurer des annonces.
        Désinscription :{" "}
        <a href="https://www.google.com/settings/ads" className="text-sage underline">
          Paramètres des annonces Google
        </a>{" "}
        et{" "}
        <a href="https://www.youronlinechoices.com/fr/" className="text-sage underline">
          Your Online Choices
        </a>
        .
      </p>
      <p>
        Nous ne demandons jamais de cliquer sur une annonce. Pas de pubs trompeuses « gain garanti ».
        Contenus 18+ : jeu responsable, pas de ciblage mineurs.
      </p>
      <p>
        ads.txt :{" "}
        <a href="/ads.txt" className="text-sage">
          betgpt.live/ads.txt
        </a>
        . Confidentialité :{" "}
        <a href="/confidentialite" className="text-sage">
          /confidentialite
        </a>
        .
      </p>
    </LegalLayout>
  ),
});
