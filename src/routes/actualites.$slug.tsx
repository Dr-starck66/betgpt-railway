import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { NewsArticleView } from "@/components/news-article";
import { getEditorialEdition } from "@/lib/editorial.functions";
import { HUB_SECTIONS, SECTION_MIN, articleUrl, sectionArticles } from "@/lib/editorial/engine";
import { formatParis } from "@/lib/editorial/time";
import { isPublicArticle } from "@/lib/editorial/types";
import { absImg } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";
import { manualEditorialArticleBySlug } from "@/lib/editorial/manual-articles";

export const Route = createFileRoute("/actualites/$slug")({
  loader: async ({ params }) => {
    const edition = await getEditorialEdition();
    const section = HUB_SECTIONS.find((item) => item.slug === params.slug);
    if (section) {
      const articles = sectionArticles(edition, section.slug) ?? [];
      return {
        kind: "section" as const,
        title: section.title,
        slug: section.slug,
        articles,
        indexable: articles.length >= SECTION_MIN,
      };
    }
    const article = edition.articles.find((item) => item.slug === params.slug && isPublicArticle(item)) ?? manualEditorialArticleBySlug(params.slug);
    if (!article) throw notFound();
    return { kind: "article" as const, article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ name: "robots", content: "noindex, follow" }] };
    if (loaderData.kind === "section") {
      const url = `${SITE_URL}/actualites/${loaderData.slug}`;
      return {
        meta: [
          { title: `${loaderData.title} — actualités | BetGPT` },
          {
            name: "description",
            content: loaderData.indexable
              ? `Actualités ${loaderData.title} publiées par BetGPT Editorial.`
              : `Rubrique ${loaderData.title} : pas encore assez d'articles pour une page indexable.`,
          },
          {
            name: "robots",
            content: loaderData.indexable ? "index, follow, max-image-preview:large" : "noindex, follow",
          },
          { property: "og:title", content: `${loaderData.title} — actualités | BetGPT` },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const article = loaderData.article;
    const url = articleUrl(article.slug);
    const image = absImg(article.image.src);
    return {
      meta: [
        { title: article.title },
        { name: "description", content: article.lead },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { name: "news_keywords", content: article.keywords },
        { property: "og:type", content: "article" },
        { property: "og:title", content: article.h1 },
        { property: "og:description", content: article.lead },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: article.image.alt },
        { property: "og:image:width", content: String(article.image.width) },
        { property: "og:image:height", content: String(article.image.height) },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "article:published_time", content: article.publishedAt ?? article.createdAt },
        {
          property: "article:modified_time",
          content: article.modifiedAt ?? article.publishedAt ?? article.createdAt,
        },
        { property: "article:section", content: article.category },
        { property: "article:author", content: `${SITE_URL}/auteurs/betgpt-editorial` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: article.h1 },
        { name: "twitter:description", content: article.lead },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SlugPage,
});

function SlugPage() {
  const data = Route.useLoaderData();
  if (data.kind === "section") {
    return (
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="hero-panel p-6 sm:p-8">
          <p className="text-sm text-mist">
            <Link to="/actualites" className="font-medium text-link">
              Actualités
            </Link>
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">{data.title}</h1>
          {data.indexable ? null : (
            <p className="mt-3 text-sm leading-relaxed text-mist">
              Cette rubrique ne contient pas encore assez de contenu éditorial distinct pour être proposée à l'indexation.
            </p>
          )}
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {data.articles.map((article) => (
            <li key={article.slug}>
              <Link to="/actualites/$slug" params={{ slug: article.slug }} className="surface-card block h-full overflow-hidden">
                <img
                  src={article.image.src}
                  alt={article.image.alt}
                  width={article.image.width}
                  height={article.image.height}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="space-y-2 p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-link">
                    {article.category} · {formatParis(article.publishedAt)}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-paper">{article.h1}</h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-mist">{article.lead}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <NewsArticleView article={data.article} />;
}
