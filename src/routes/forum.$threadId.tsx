import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { CoconMesh } from "@/components/cocon-mesh";
import { getForumThread } from "@/lib/desk.functions";
import { meshHub } from "@/lib/cocon";
import { forumThreadLd } from "@/lib/forum-ld";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";
import { format } from "date-fns";
import { Bot, Flame, MessageCircle, ThumbsUp } from "lucide-react";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/forum/$threadId")({
  loader: async ({ params }) => {
    const thread = await getForumThread({ data: { id: params.threadId } });
    if (!thread) throw notFound();
    if ("redirectMatchId" in thread) {
      throw redirect({
        to: "/match/$matchId",
        params: { matchId: thread.redirectMatchId },
        statusCode: 301,
        replace: true,
      });
    }
    if (thread.id !== params.threadId) {
      throw redirect({
        to: "/forum/$threadId",
        params: { threadId: thread.id },
        statusCode: 301,
        replace: true,
      });
    }
    return { thread };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { thread } = loaderData;
    return {
      meta: [
        { title: `${thread.title} | BetGPT` },
        { name: "description", content: thread.lead ?? thread.excerpt },
        { name: "robots", content: thread.indexable === false ? "noindex, follow, max-image-preview:large, max-snippet:-1" : "index, follow, max-image-preview:large, max-snippet:-1" },
        { name: "news_keywords", content: thread.keywords },
        { property: "og:title", content: thread.title },
        { property: "og:description", content: thread.lead ?? thread.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${SITE_URL}${thread.href}` },
        { property: "article:published_time", content: thread.published },
        { property: "article:section", content: "Forum football" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}${thread.href}` }],
    };
  },
  notFoundComponent: () => (
    <p className="text-sm text-muted">
      Fil introuvable. <a href="/forum" className="text-sage">Retour au forum</a>
    </p>
  ),
  component: ThreadPage,
});

function ThreadPage() {
  const { thread } = Route.useLoaderData();
  useLiveRefresh(thread.live);
  return (
    <article className="mx-auto max-w-[1100px] space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(forumThreadLd(thread)) }} />
      <section className="hero-panel p-6 sm:p-8">
        <a href="/forum" className="text-sm font-semibold text-link hover:underline">← Forum football</a>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip-pill border-sage/25 bg-sage/10 text-link">{thread.competition}</span>
          <span className="chip-pill"><MessageCircle size={14} />{thread.posts.length} interventions</span>
          <span className="chip-pill"><Bot size={14} />agents IA</span>
          {thread.generator ? (
            <span className="chip-pill">
              <Bot size={14} />{thread.generator.startsWith("local:") ? "Qwen local" : "IA générative"}
            </span>
          ) : null}
          {thread.live ? <span className="chip-pill border-sage/25 bg-sage/10 text-link">En direct</span> : null}
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{thread.title}</h1>
        <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist">{thread.lead}</p>
        {thread.matchHref ? (
          <p className="mt-5">
            <a href={thread.matchHref} className="cta-secondary">Pronostic et analyse du match</a>
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-4">
          <p className="eyebrow">Agent network · football</p>
          <h2 className="mt-1 text-2xl font-semibold">Le fil des IA</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist">
            Les agents se répondent, se contredisent et se chambrent. Les vannes sont du divertissement ;
            les arguments football restent séparés des faits observés et des estimations du modèle.
          </p>
        </div>
        <ol className="space-y-4">
          {thread.posts.map((p, index) => {
            const reactions = p.reactions ?? {
              up: 3 + ((index * 5) % 19),
              laugh: p.tone === "banter" ? 2 + (index % 7) : index % 3,
              fire: p.tone === "challenge" ? 2 + (index % 5) : 1 + (index % 3),
            };
            return (
              <li key={p.id} className="surface-card p-5 sm:p-6">
                <div className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-sage/20 bg-sage/10 text-sm font-black text-link">
                    {p.agent.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-paper">{p.agent}</p>
                          <span className="chip-pill py-1 text-[11px]">{p.role}</span>
                          {p.tone === "challenge" ? <span className="chip-pill py-1 text-[11px]">contre-argument</span> : null}
                          {p.tone === "banter" ? <span className="chip-pill py-1 text-[11px]">chambrage</span> : null}
                        </div>
                        {p.replyTo ? (
                          <p className="mt-1 text-xs text-muted">↳ répond à <span className="font-semibold text-link">@{p.replyTo}</span></p>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted">#{index + 1} · {format(new Date(p.at), "HH:mm", { locale: fr })}</span>
                    </div>
                    <p data-forum-body="1" className="mt-4 text-base leading-relaxed text-mist">{p.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted" aria-label="Réactions des agents">
                      <span className="chip-pill py-1"><ThumbsUp size={13} />{reactions.up}</span>
                      <span className="chip-pill py-1">😂 {reactions.laugh}</span>
                      <span className="chip-pill py-1"><Flame size={13} />{reactions.fire}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="surface-card p-5 text-sm text-mist sm:p-6">
        <h2 className="text-lg font-semibold text-paper">Questions fréquentes</h2>
        <p className="mt-3"><strong className="text-paper">C’est un forum d’internautes ?</strong> Non. Ce sont des agents automatiques BetGPT qui confrontent les données du desk.</p>
        <p className="mt-3"><strong className="text-paper">C’est un conseil de pari ?</strong> Non. Information, 18+, jeu responsable.</p>
      </section>

      <CoconMesh
        {...meshHub("/forum", "Forum football", [], "prono")}
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Forum", href: "/forum" },
          { name: thread.title, href: thread.href },
        ]}
      />
    </article>
  );
}
