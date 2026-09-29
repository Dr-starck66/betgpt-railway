import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/jeu-responsable")({
  head: () => ({
    meta: [
      { title: "Jeu responsable | BetGPT" },
      {
        name: "description",
        content:
          "Interdit aux mineurs. Joueurs Info Service 09 74 75 13 13. BetGPT n’est pas un opérateur de paris.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/jeu-responsable` }],
  }),
  component: () => (
    <LegalLayout title="Jeu responsable">
      <p className="font-semibold">Interdit aux moins de 18 ans.</p>
      <p>
        Le jeu d’argent peut créer une dépendance. Ne mise pas l’argent du loyer, ne « te refais »
        pas, fixe un plafond, arrête si ça n’est plus un loisir.
      </p>
      <p>
        Aide gratuite et anonyme :{" "}
        <a href="https://www.joueurs-info-service.fr" className="text-sage underline">
          Joueurs Info Service
        </a>{" "}
        — 09 74 75 13 13 (appel non surtaxé). Autorité :{" "}
        <a href="https://anj.fr" className="text-sage underline">
          ANJ
        </a>
        .
      </p>
      <p>
        BetGPT publie des comparaisons de cotes et des modèles statistiques. Ce n’est pas un conseil
        personnalisé, ni une promesse de gain. Les operators liés sont agréés en France.
      </p>
      <p>
        Auto-exclusion et plafonds : à activer sur le site du bookmaker, pas ici. Nous ne tenons aucun
        compte de jeu.
      </p>
    </LegalLayout>
  ),
});
