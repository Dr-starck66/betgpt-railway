import { Link, createFileRoute } from "@tanstack/react-router";
import { Calculator, Percent, Repeat2, TrendingUp } from "lucide-react";
import { SITE_URL } from "@/lib/programmatic";

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
  );
}
