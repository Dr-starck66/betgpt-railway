import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions d’utilisation | BetGPT" },
      { name: "description", content: "CGU de BetGPT : outil d’information, pas un conseil de pari personnalisé." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/cgu` }],
  }),
  component: () => (
    <LegalLayout title="Conditions générales d’utilisation">
      <p>
        BetGPT (betgpt.live) est un site d’information et de comparaison de cotes football. Il ne
        reçoit pas de mises, ne tient pas de comptes joueurs et n’est pas un opérateur de jeux.
      </p>
      <p>
        Les analyses, probabilités et « value bets » sont des estimations statistiques. Elles ne
        garantissent aucun gain. Un pari peut être perdant. Tu es seul responsable de tes mises.
      </p>
      <p>
        Accès réservé aux personnes majeures (18 ans). Les liens vers les bookmakers sont des liens
        sponsorisés. En cliquant, tu quittes BetGPT pour un site agréé ANJ, soumis à ses propres CGU.
      </p>
      <p>
        BetGPT peut modifier, suspendre ou retirer un contenu sans préavis. Le site est fourni « en
        l’état ».
      </p>
      <p>
        Le chat BetGPT transmet tes messages et le contexte statistique du desk à xAI (modèle Grok)
        pour générer une réponse. Ce n’est pas un conseil personnalisé. Politique xAI :{" "}
        <a href="https://x.ai/legal/privacy-policy" className="text-sage">
          x.ai/legal/privacy-policy
        </a>
        .
      </p>
      <p>
        Droit applicable : France. Réclamation : page Contact. Jeu responsable :{" "}
        <a href="/jeu-responsable" className="text-sage">
          jeu-responsable
        </a>
        .
      </p>
    </LegalLayout>
  ),
});
