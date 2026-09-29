import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CoconMesh } from "@/components/cocon-mesh";
import { FollowStar } from "@/components/follow-star";
import { Methodology } from "@/components/methodology";
import { AdSlot } from "@/components/ad-slot";
import { getHunterIndex } from "@/lib/hunter.functions";
import { meshHub } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { ld } from "@/lib/ld";
import { collectionJsonLd, itemListJsonLd, SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/score-hunter/")({
  loader: () => getHunterIndex(),
  head: () => {
    const title = "Score Hunter : 0-0, 2-1, BTTS, Over 2.5 | BetGPT";
    const desc =
      "Classement statistique des matches selon un scénario (0-0, 2-1, BTTS, plus de 2,5). Modèle Poisson et archive ESPN. Pas une certitude.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: `${SITE_URL}/score-hunter` },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/score-hunter` }],
    };
  },
  component: HunterIndex,
});

const GROUPS = [
  { id: "all", label: "Tous" },
  { id: "exact", label: "Scores exacts" },
  { id: "over", label: "Buts" },
  { id: "btts", label: "BTTS" },
  { id: "low-exact", label: "Spécial" },
] as const;

function HunterIndex() {
  const data = Route.useLoaderData();
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("all");
  useEffect(() => {
    track("hunter_open", "index");
  }, []);
  const shown = group === "all" ? data.scenarios : data.scenarios.filter((s) => s.kind === group);
  const items = data.scenarios.map((s) => ({
    name: s.label,
    url: `${SITE_URL}/score-hunter/${s.slug}`,
  }));
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            collectionJsonLd("Score Hunter BetGPT", `${SITE_URL}/score-hunter`, "Classement statistique des matches par scénario de score."),
            itemListJsonLd("Scénarios Score Hunter", `${SITE_URL}/score-hunter`, items),
          ]),
        }}
      />
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Score Hunter</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Quel match ressemble à ce score ?</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm leading-relaxed text-paper">
          Le hunter classe les matches du desk pour un scénario (0-0, 2-1, BTTS, plus de 2,5). Le chiffre 0–100
          n’est pas une IA au hasard : modèle Poisson / Dixon-Coles + fréquences réelles sur {data.historyN.toLocaleString("fr-FR")}{" "}
          matches ESPN. L’index n’est pas une probabilité. Estimation, pas une garantie.
        </p>
        {data.degraded ? (
          <p className="mt-2 rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-paper">
            Score Hunter partiellement indisponible{data.error ? ` (${data.error})` : ""}. Pas de chiffres inventés.
          </p>
        ) : null}
      </header>
      <AdSlot slot="hunter-index" />
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Familles de scénarios">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            onClick={() => {
              setGroup(g.id);
              track("hunter_scenario", g.id);
            }}
            className={`min-h-11 rounded-md px-3 text-sm font-semibold ${
              group === g.id ? "bg-sage text-ink" : "border border-line text-mist"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.slug} className="min-w-0 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/score-hunter/$scenario"
                params={{ scenario: s.slug }}
                className="min-w-0 break-words text-base font-semibold hover:text-sage"
              >
                {s.label}
              </Link>
              <FollowStar kind="hunter" id={s.slug} label={s.label} />
            </div>
            {s.top ? (
              <p className="mt-2 break-words text-sm text-mist">
                Tête : {s.top.home.name} – {s.top.away.name}{" "}
                <span className="tabular text-paper">{s.top.score}/100</span>
                {" · "}modèle {fmtPct(s.top.modelP)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-mist">Pas de match à venir pour ce scénario.</p>
            )}
            <p className="mt-1 text-xs text-muted">Prior ligue globale {fmtPct(s.prior)} · {s.n} matches classés</p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        <a href="/statistics/most-common-scores" className="font-semibold text-sage">
          Explorer les scores les plus fréquents
        </a>
        {" · "}
        <a href="/statistics/leagues/lowest-0-0" className="font-semibold text-sage">
          Radar 0-0
        </a>
      </p>
      <Methodology n={data.historyN} asOf={data.asOf} />
      <CoconMesh {...meshHub("/score-hunter", "Score Hunter", [], "prono")} />
    </article>
  );
}
