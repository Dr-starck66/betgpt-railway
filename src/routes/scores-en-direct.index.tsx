import { createFileRoute, Link } from "@tanstack/react-router";
import { ScoresHub } from "@/components/scores-hub";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";
import { ld } from "@/lib/ld";

const H1 = "Score en direct football : matchs et résultats";

export const Route = createFileRoute("/scores-en-direct/")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Score en direct football : matchs, livescore et résultats | BetGPT" },
      {
        name: "description",
        content:
          "Score en direct football aujourd’hui : matchs en cours, minute, statut et résultats. Ligue 1, Premier League, Liga, Bundesliga, Serie A et coupes d’Europe.",
      },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: "Score en direct football aujourd’hui | BetGPT" },
      { property: "og:url", content: `${SITE_URL}/scores-en-direct` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/scores-en-direct` }],
  }),
  component: () => {
    const data = Route.useLoaderData();
    const n = data.matches.filter((m) => m.status === "live").length;
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Où suivre le score en direct des matchs de football ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "La page Score en direct de BetGPT affiche les matchs suivis, leur statut, l’heure de Paris et le dernier score disponible lorsqu’un match est en cours.",
          },
        },
        {
          "@type": "Question",
          name: "Que se passe-t-il quand un match est terminé ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Le match passe dans les résultats football et sa fiche conserve le score final lorsqu’il est disponible.",
          },
        },
      ],
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(faq) }} />
        <ScoresHub
          title={H1}
          lead={
            n > 0
              ? `${n} match${n > 1 ? "s" : ""} en cours. Suis le score en direct, le statut et les fiches match depuis une seule page.`
              : "Aucun match n’est en direct pour le moment. Les rencontres à venir et les derniers résultats restent accessibles ci-dessous, sans fabriquer de score."
          }
          data={data}
          path="/scores-en-direct"
        />
        <section className="surface-card mt-8 space-y-3 p-5 text-sm leading-relaxed text-mist sm:p-6">
          <h2 className="text-base font-semibold text-paper">Score en direct football aujourd’hui : comment lire la page</h2>
          <p>
            Les matchs marqués en direct affichent le dernier score et le dernier statut disponibles. Si la collecte devient trop ancienne,
            BetGPT le signale au lieu de présenter un score figé comme un direct confirmé à la seconde.
          </p>
          <p>
            Après le coup de sifflet final, retrouve les scores dans les <Link to="/resultats-football" className="underline">résultats football</Link>.
            Pour les rencontres à venir, les <Link to="/pronostics-football" className="underline">pronostics football</Link> séparent estimation 1N2,
            probabilité et cote.
          </p>
        </section>
      </>
    );
  },
});
