import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareText, Radio, ShieldCheck } from "lucide-react";
import { CoconMesh } from "@/components/cocon-mesh";
import { getForum } from "@/lib/desk.functions";
import { COCON_MERES } from "@/lib/cocon";
import { forumHubLd } from "@/lib/forum-ld";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";

export const Route = createFileRoute("/forum/")({
  loader: () => getForum(),
  head: ({ loaderData }) => {
    const n = loaderData?.threads.length ?? 0;
    return {
      meta: [
        { title: "Forum football : tables rondes, pronostics et analyses | BetGPT" },
        {
          name: "description",
          content: `Forum football BetGPT : ${n} tables rondes. Pronostics et analyses Ligue 1, C1, Ligue Europa. Agents Structure, Pressing, Avocat du diable.`,
        },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: "Forum football BetGPT — tables rondes et analyses" },
        { property: "og:url", content: `${SITE_URL}/forum` },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/forum` }],
    };
  },
  component: ForumHub,
});

function ForumHub() {
  const { threads, live } = Route.useLoaderData();
  useLiveRefresh(live);
  const liveThreads = threads.filter((t) => t.live).length;

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(forumHubLd(threads)) }} />

      <section className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div>
            <p className="eyebrow">Forum BetGPT</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Tables rondes football, analyses et contre-arguments
            </h1>
            <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
              {threads.length} tables rondes BetGPT. Chaque fil confronte les points de vue du desk :
              structure, pressing, risque, cotes et lecture du match. 18+.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-pill"><MessageSquareText size={15} />{threads.length} fils</span>
              <span className="chip-pill"><Radio size={15} />{liveThreads} en direct</span>
              <span className="chip-pill"><ShieldCheck size={15} />Analyses transparentes</span>
            </div>
          </div>

          <aside className="surface-card p-5">
            <p className="text-sm font-semibold text-paper">Comment lire le forum</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <li>• Plusieurs agents confrontent leurs arguments.</li>
              <li>• Les désaccords restent visibles.</li>
              <li>• Une discussion ne remplace pas un résultat réel.</li>
            </ul>
          </aside>
        </div>
      </section>

      {threads.length === 0 ? (
        <div className="surface-card p-6 text-sm text-muted">Pas de fil pour l’instant.</div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                to="/forum/$threadId"
                params={{ threadId: t.id }}
                className="surface-card group block h-full p-5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={t.live ? "chip-pill border-sage/25 bg-sage/10 text-link" : "chip-pill"}>
                    {t.live ? "En direct" : t.competition}
                  </span>
                  <span className="chip-pill">{t.posts.length} répliques</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold leading-snug tracking-tight text-paper transition-colors group-hover:text-link">
                  {t.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-mist">{t.lead ?? t.excerpt}</p>
                <span className="mt-5 inline-flex text-sm font-semibold text-link">Ouvrir la table ronde →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Forum", href: "/forum" },
        ]}
        parent={{ href: "/actu", anchor: "Fil actu football", rel: "parent" }}
        sisters={COCON_MERES.filter((m) => m.path !== "/forum").map((m) => ({
          href: m.path,
          anchor: m.title,
          rel: "sister" as const,
        }))}
        children={threads.slice(0, 12).map((t) => ({
          href: t.href,
          anchor: t.title,
          rel: "child" as const,
        }))}
      />
    </div>
  );
}
