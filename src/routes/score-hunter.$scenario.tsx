import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdSlot } from "@/components/ad-slot";
import { CoconMesh } from "@/components/cocon-mesh";
import { FollowStar } from "@/components/follow-star";
import { HunterBoard } from "@/components/hunter-board";
import { Methodology } from "@/components/methodology";
import { ShareHunter } from "@/components/share-hunter";
import { getHunterScenario } from "@/lib/hunter.functions";
import { HUNTER_SCENARIOS } from "@/engine/hunter";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { ld } from "@/lib/ld";
import { itemListJsonLd, SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Crosshair } from "lucide-react";

export const Route = createFileRoute("/score-hunter/$scenario")({
  loader: async ({ params }) => {
    const data = await getHunterScenario({ data: { slug: params.scenario } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const sc = loaderData?.scenario;
    const title = `${sc?.label ?? params.scenario} : classement statistique | BetGPT`;
    const desc = sc
      ? `${sc.label} — matches du desk classés 0–100 selon le modèle Poisson et les fréquences ESPN. Estimation, pas une certitude.`
      : "Score Hunter BetGPT.";
    const url = `${SITE_URL}/score-hunter/${params.scenario}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Scénario introuvable.</p>,
  component: HunterScenarioPage,
});

function HunterScenarioPage() {
  const data = Route.useLoaderData();
  const sc = data.scenario;
  useEffect(() => {
    track("hunter_open", sc.slug);
  }, [sc.slug]);
  const url = `${SITE_URL}/score-hunter/${sc.slug}`;
  const items = data.rows.slice(0, 10).map((r, i) => ({
    name: `${i + 1}. ${r.home.name} – ${r.away.name} (${r.score}/100)`,
    url: `${SITE_URL}/match/${r.slug}`,
  }));
  const sisters = HUNTER_SCENARIOS.filter((s) => s.slug !== sc.slug).slice(0, 8);
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            breadcrumbJsonLd([
              { name: "BetGPT", href: "/" },
              { name: "Score Hunter", href: "/score-hunter" },
              { name: sc.label, href: `/score-hunter/${sc.slug}` },
            ]),
            itemListJsonLd(sc.label, url, items),
          ]),
        }}
      />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Score Hunter</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{sc.label}</h1>
          <FollowStar kind="hunter" id={sc.slug} label={sc.label} />
        </div>
        <p className="seo-answer max-w-3xl text-sm leading-relaxed text-paper">
          Classement des matches du desk pour le scénario {sc.short}. Score 0–100 : 70 % estimation modèle, 20 %
          fréquence de ligue (n≥30), 10 % profil clubs. Archive {data.historyN.toLocaleString("fr-FR")} matches.
          Prior global {fmtPct(data.prior)}. Ce n’est pas un pronostic garanti.
        </p>
        {data.degraded ? (
          <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-paper">
            Classement incomplet{data.error ? ` (${data.error})` : ""}. Les lignes vides ne sont pas des zéros.
          </p>
        ) : null}
        <ShareHunter
          title={`BetGPT ${sc.label}`}
          line={
            data.rows[0]
              ? `${data.rows[0].home.name} – ${data.rows[0].away.name} · ${data.rows[0].score}/100`
              : "Classement statistique"
          }
          path={`/score-hunter/${sc.slug}`}
        />
      </header>
      <AdSlot slot={`hunter-${sc.slug}`} />
      <HunterBoard slug={sc.slug} label={sc.label} short={sc.short} rows={data.rows} />
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Fréquence {sc.short} par ligue</h2>
        <p className="mt-1 text-sm text-mist">Historique ESPN. n = nombre de matches dans l’archive filtrée.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ligue</th>
                <th className="px-4 py-3 font-medium">n</th>
                <th className="px-4 py-3 font-medium">Fréquence</th>
              </tr>
            </thead>
            <tbody>
              {data.leagues.map((l) => (
                <tr key={l.league} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    {l.n < 10 ? (
                      l.label
                    ) : (
                      <a href={`/statistics/${leagueSlug(l.league)}/most-common-scores`} className="hover:text-sage">
                        {l.label}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular">{l.n}</td>
                  <td className="px-4 py-3 tabular">{l.n ? fmtPct(l.freq) : "n insuffisant"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="flex flex-wrap gap-2 text-sm">
        {sisters.map((s) => (
          <Link
            key={s.slug}
            to="/score-hunter/$scenario"
            params={{ scenario: s.slug }}
            className="rounded-md border border-line px-3 py-2 hover:border-sage"
          >
            {s.short}
          </Link>
        ))}
      </p>
      <Link to="/chat" search={{ q: data.ask || `Quels matches collent à ${sc.short} ?` }} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-sage px-4 text-sm font-semibold text-ink">
        <Crosshair className="h-4 w-4" />
        Demander à BetGPT
      </Link>
      <p className="text-xs text-muted">Export CSV et alertes custom : BetGPT Pro (bientôt). Le hunter de base reste libre.</p>
      <Methodology n={data.historyN} asOf={data.asOf} extra={`Provenance : ${data.source}. ${data.provenance.from} → ${data.provenance.to}.`} />
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Score Hunter", href: "/score-hunter" },
          { name: sc.label, href: `/score-hunter/${sc.slug}` },
        ]}
        parent={{ href: "/score-hunter", anchor: "Tous les Score Hunters", rel: "parent" }}
        sisters={sisters.map((s) => ({ href: `/score-hunter/${s.slug}`, anchor: s.label, rel: "sister" as const }))}
        children={[
          { href: "/statistics/most-common-scores", anchor: "Scores les plus fréquents", rel: "child" },
          { href: "/statistics/leagues/lowest-0-0", anchor: "Ligues les moins 0-0", rel: "child" },
          { href: "/chat", anchor: "Chat BetGPT", rel: "child" },
        ]}
      />
    </article>
  );
}

function leagueSlug(id: string): string {
  const map: Record<string, string> = {
    L1: "ligue-1",
    PL: "premier-league",
    LL: "la-liga",
    BL: "bundesliga",
    SA: "serie-a",
    CL: "ligue-des-champions",
    EL: "ligue-europa",
    NL: "ligue-des-nations",
  };
  return map[id] ?? id.toLowerCase();
}
