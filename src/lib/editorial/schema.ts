import { BRAND_LOGO, absImg, imageObjectLd } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";
import type { EditorialArticle } from "@/lib/editorial/types";

function articleUrl(slug: string): string {
  return `${SITE_URL}/actualites/${slug}`;
}

export function newsArticleLd(article: EditorialArticle): Record<string, unknown> {
  const url = articleUrl(article.slug);
  const published = article.publishedAt ?? article.createdAt;
  const modified = article.modifiedAt && article.publishedAt && article.modifiedAt > article.publishedAt ? article.modifiedAt : published;
  const image = absImg(article.image.src);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.h1,
    description: article.lead,
    datePublished: published,
    dateModified: modified,
    inLanguage: "fr-FR",
    articleSection: article.category,
    keywords: article.keywords,
    isAccessibleForFree: true,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      primaryImageOfPage: imageObjectLd(
        {
          src: article.image.src,
          alt: article.image.alt,
          title: article.h1,
          description: article.lead,
          filename: article.image.src.split("/").pop() ?? "image-article-football.jpg",
          caption: article.image.credit,
          width: article.image.width,
          height: article.image.height,
        },
        url,
      ),
    },
    image: {
      "@type": "ImageObject",
      url: image,
      width: article.image.width,
      height: article.image.height,
      caption: article.image.credit,
    },
    author: {
      "@type": "Organization",
      name: "BetGPT Editorial",
      url: `${SITE_URL}/auteurs/betgpt-editorial`,
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "BetGPT",
      url: SITE_URL,
      logo: imageObjectLd(BRAND_LOGO, SITE_URL),
    },
    about: article.teams.map((name) => ({ "@type": "SportsTeam", name })),
    mentions: article.competition ? [{ "@type": "SportsOrganization", name: article.competition }] : [],
  };
}

export function breadcrumbLd(article: EditorialArticle): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "BetGPT", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Actualités", item: `${SITE_URL}/actualites` },
      { "@type": "ListItem", position: 3, name: article.h1, item: articleUrl(article.slug) },
    ],
  };
}
