import { Link, createFileRoute } from "@tanstack/react-router";
import { Calculator, Percent, Repeat2, TrendingUp } from "lucide-react";
import { SITE_URL } from "@/lib/programmatic";
import { AstraSidewings } from "@/components/astra-sidewings";

const TOOLS = [
  { href: "/outils/value-bet", title: "Écart modèle / cote", text: "Probabilité implicite, écart et espérance à partir de tes chiffres.", icon: TrendingUp },
  { href: "/outils/kelly", title: "Kelly", text: "Fraction complète, moitié et quart. Négatif signifie ne pas miser.", icon: Percent },
  { href: "/outils/convertisseur-cotes", title: "Convertisseur de cotes", text: "Décimale, fraction approchée, américaine, probabilité implicite.", icon: Repeat2 },
  { href: "/outils/roi", title: "ROI saisi", text: "ROI sur les mises et retours que tu entres. Rien n’est prérempli.", icon: Calculator },
];

export const Route = createFileRoute("/outils/")({
  head: () => ({
    meta: [
      { title: "Outils de cotes et de probabilités | BetGPT" },
      { name: "description", content: "Calculateurs gratuits : value, Kelly, conversion de cotes, ROI. Les résultats suivent les nombres saisis." },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: `${SITE_URL}/outils` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/outils` }],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <AstraSidewings
      ariaLabel="Navigation contextuelle des outils BetGPT"
      left={{
        eyebrow: "Apprendre",
        title: "Comprendre avant de calculer",
        intro: "Les calculateurs deviennent plus utiles quand la formule et ses limites sont claires.",
        links: [
          { href: "/guides/probabilite-implicite", label: "Probabilité implicite", description: "Transformer une cote en probabilité brute." },
          { href: "/guides/value-bet", label: "Comprendre la value", description: "Lire l’écart modèle-marché sans promesse de gain." },
          { href: "/guides/critere-de-kelly", label: "Critère de Kelly", description: "Comprendre la logique avant de calculer une fraction." },
          { href: "/guides/lire-une-cote", label: "Lire une cote", description: "Décimale, fractionnaire et américaine." },
        ],
      }}
      right={{
        eyebrow: "Passer aux données",
        title: "Du calcul au contexte réel",
        intro: "Relie les outils aux pages où BetGPT expose réellement prix, historique et méthode.",
        links: [
          { href: "/comparer-cotes", label: "Comparer les cotes", description: "Observer plusieurs prix sur le même marché." },
          { href: "/meilleures-cotes", label: "Meilleures cotes", description: "Voir les meilleurs prix relevés sur le desk." },
          { href: "/opportunities", label: "Opportunités value", description: "Voir où le modèle détecte un écart." },
          { href: "/ledger", label: "Bilan vérifié", description: "Contrôler les résultats et l’historique public." },
          { href: "/methodology", label: "Méthodologie", description: "Comprendre les hypothèses derrière les calculs." },
        ],
      }}
    >
      <article className="space-y-8">
      <section className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Outils BetGPT</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Calculateurs football et paris</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
          Des outils simples et transparents pour vérifier une cote, estimer un écart, convertir un format ou calculer un ROI à partir de tes propres nombres.
        </p>
      </section>

      <ul className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link to={t.href} className="surface-card group flex h-full gap-4 p-5 sm:p-6">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage/12 text-link"><Icon size={22} /></span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight group-hover:text-link">{t.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{t.text}</p>
                  <span className="mt-4 inline-flex text-sm font-semibold text-link">Ouvrir l’outil →</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      </article>
    </AstraSidewings>
  );
}
