import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Radar, Search, Target } from "lucide-react";
import { CoconMesh } from "@/components/cocon-mesh";
import { Methodology } from "@/components/methodology";
import { getScoreExplorer } from "@/lib/hunter.functions";
import { meshHub } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { ld } from "@/lib/ld";
import { collectionJsonLd, SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/statistics/")({
  loader: () => getScoreExplorer({ data: { season: "all" } }),
  head: () => {
    const title = "Statistiques football : scores fréquents et radar 0-0 | BetGPT";
    const desc =
      "Scores exacts les plus fréquents, ligues les plus et les moins 0-0, archive ESPN. Données réelles, échantillon affiché.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:url", content: `${SITE_URL}/statistics` },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/statistics` }],
    };
  },
  component: StatsHub,
});

function StatsHub() {
  const data = Route.useLoaderData();
  return (
    <article className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld(collectionJsonLd("Statistiques football BetGPT", `${SITE_URL}/statistics`, "Fréquences de scores et radar 0-0.")),
        }}
      />

      <section className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Data football</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Explorer les scores réels</h1>
        <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
          Archive ESPN : {data.historyN.toLocaleString("fr-FR")} matches. Aucun chiffre inventé. La taille de l’échantillon reste visible pour lire chaque statistique avec le bon niveau de confiance.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip-pill"><BarChart3 size={15} />{data.historyN.toLocaleString("fr-FR")} matchs</span>
          <span className="chip-pill"><Target size={15} />Scores exacts</span>
          <span className="chip-pill"><Radar size={15} />Radar 0-0</span>
        </div>
      </section>

      <ul className="grid gap-4 md:grid-cols-2">
        <StatCard href="/statistics/most-common-scores" icon={BarChart3} title="Scores les plus fréquents" text="1-1, 1-0, 2-1… toutes ligues ou une compétition." />
        <StatCard href="/statistics/leagues/lowest-0-0" icon={Radar} title="Radar 0-0 — plus rares" text="Ligues et clubs avec le moins de 0-0." />
        <StatCard href="/statistics/leagues/highest-0-0" icon={Target} title="Radar 0-0 — plus fréquents" text="Où le 0-0 sort le plus souvent." />
        <li>
          <Link to="/score-hunter" className="surface-card group flex h-full gap-4 p-5 sm:p-6">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage/12 text-link"><Search size={22} /></span>
            <div><h2 className="text-lg font-semibold group-hover:text-link">Score Hunter</h2><p className="mt-2 text-sm leading-relaxed text-mist">Classer les matches du soir pour un scénario.</p></div>
          </Link>
        </li>
      </ul>

      <section className="surface-card p-5 sm:p-6">
        <p className="eyebrow">Navigation par ligue</p>
        <h2 className="mt-1 text-2xl font-semibold">Statistiques par compétition</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {data.leagues.map((l) => (
            <li key={l.id}>
              <a href={`/statistics/${l.slug}/most-common-scores`} className="chip-pill hover:border-sage/30 hover:text-link">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Methodology n={data.historyN} extra={`Fenêtre : ${data.seasonLabel}. ${data.source}.`} />
      <CoconMesh {...meshHub("/statistics", "Statistiques football", [], "prono")} />
    </article>
  );
}

function StatCard({ href, icon: Icon, title, text }: { href: string; icon: typeof Radar; title: string; text: string }) {
  return (
    <li>
      <a href={href} className="surface-card group flex h-full gap-4 p-5 sm:p-6">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sage/12 text-link"><Icon size={22} /></span>
        <div><h2 className="text-lg font-semibold group-hover:text-link">{title}</h2><p className="mt-2 text-sm leading-relaxed text-mist">{text}</p></div>
      </a>
    </li>
  );
}
