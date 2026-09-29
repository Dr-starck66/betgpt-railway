import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CoconMesh } from "@/components/cocon-mesh";
import { BlogBody, BlogFaq } from "@/components/blog-body";
import { blogBySlug, relatedArticles, CLUSTERS } from "@/lib/blog";
import { blogCover } from "@/lib/blog-rich";
import { blogArticleLd } from "@/lib/blog-ld";
import { meshBlogArticle } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = blogBySlug(params.slug);
    if (!article) throw notFound();
    return { article, related: relatedArticles(params.slug) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { article: a } = loaderData;
    const url = `${SITE_URL}/blog/${a.slug}`;
    const cover = blogCover(a);
    const img = `${SITE_URL}${cover.src}`;
    return {
      meta: [
        { title: a.title },
        { name: "description", content: a.lead },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { name: "news_keywords", content: a.keywords },
        { property: "og:title", content: a.h1 },
        { property: "og:description", content: a.lead },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: img },
        { property: "og:image:alt", content: cover.alt },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "675" },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "article:published_time", content: a.published },
        { property: "article:section", content: a.section },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: img },
        { name: "twitter:image:alt", content: cover.alt },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <p className="text-sm text-muted">
      Article introuvable.{" "}
      <Link to="/blog" className="text-sage">
        Blog
      </Link>
    </p>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article: a, related } = Route.useLoaderData();
  const cluster = related.filter((x) => x.cluster && x.cluster === a.cluster);
  const rest = related.filter((x) => x.cluster !== a.cluster);
  const meta = a.cluster ? CLUSTERS[a.cluster] : undefined;
  const isChild = Boolean(meta && a.slug !== meta.pillar);
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(blogArticleLd(a)) }} />
      <p>
        <Link to="/blog" className="text-sm text-sage hover:underline">
          ← Blog
        </Link>
      </p>
      <header>
        <p className="text-[11px] uppercase tracking-wider text-muted">{a.section} · 8 sept. 2026 · 6 min</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{a.h1}</h1>
        <p className="seo-answer mt-3 text-base leading-relaxed text-paper">{a.lead}</p>
      </header>
      <BlogBody article={a} />
      <p className="flex flex-wrap gap-3 text-sm">
        {a.links.map((l) => (
          <a key={l.href} href={l.href} className="rounded-md border border-line px-3 py-2 text-sage hover:border-sage">
            {l.label}
          </a>
        ))}
      </p>
      <BlogFaq article={a} />
      <nav id="lire-aussi" className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-xl font-semibold">{meta ? `Pour aller plus loin — ${meta.title}` : "Pour aller plus loin"}</h2>
        {isChild && meta ? (
          <p className="mt-2 text-sm">
            Page mère :{" "}
            <Link to="/blog/$slug" params={{ slug: meta.pillar }} className="text-sage hover:underline">
              {meta.pillarH1}
            </Link>
          </p>
        ) : null}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {cluster.map((x) => (
            <li key={x.slug} className="rounded-md border border-line p-3">
              <Link to="/blog/$slug" params={{ slug: x.slug }} className="text-sm font-medium text-sage hover:underline">
                {x.h1}
              </Link>
              <p className="mt-1 text-xs text-mist">{x.lead}</p>
            </li>
          ))}
        </ul>
        {rest.length ? (
          <>
            <h3 className="mt-6 text-base font-semibold">Autres guides BetGPT</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {rest.slice(0, 8).map((x) => (
                <li key={x.slug}>
                  <Link to="/blog/$slug" params={{ slug: x.slug }} className="text-sm text-sage hover:underline">
                    {x.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
      <p className="text-xs text-muted">18+ · BetGPT n’est pas un opérateur de paris. Joueurs Info Service 09 74 75 13 13.</p>
      <CoconMesh
        {...meshBlogArticle(
          a.slug,
          a.h1,
          a.cluster,
          a.links.map((l) => ({ href: l.href, anchor: l.label, rel: "child" as const })),
        )}
      />
    </article>
  );
}
