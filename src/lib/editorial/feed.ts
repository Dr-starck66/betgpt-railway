import { SITE_URL } from "@/lib/programmatic";
import { absImg } from "@/lib/image-seo";
import type { EditorialArticle, EditorialEdition } from "@/lib/editorial/types";
import { isPublicArticle } from "@/lib/editorial/types";

function articleUrl(slug: string): string {
  return `${SITE_URL}/actualites/${slug}`;
}

export type NewsSitemapEntry = {
  loc: string;
  title: string;
  published: string;
  keywords: string;
  image?: string;
  imageTitle?: string;
};

export function newsEntries(edition: EditorialEdition, now = Date.now()): NewsSitemapEntry[] {
  const cutoff = now - 2 * 24 * 60 * 60 * 1000;
  return edition.articles.filter(isPublicArticle).flatMap((article) => {
    const published = Date.parse(article.publishedAt ?? "");
    if (!Number.isFinite(published) || published < cutoff || published > now + 60_000) return [];
    return [
      {
        loc: articleUrl(article.slug),
        title: article.h1,
        published: article.publishedAt!,
        keywords: article.keywords,
        image: absImg(article.image.src),
        imageTitle: article.image.alt,
      },
    ];
  });
}

export function classicNewsPaths(edition: EditorialEdition): { path: string; title: string; lastmod: string; image?: string }[] {
  const articles = edition.articles.filter(isPublicArticle).map((article) => ({
    path: `/actualites/${article.slug}`,
    title: article.h1,
    lastmod: article.modifiedAt ?? article.publishedAt ?? "",
    image: absImg(article.image.src),
  }));
  const hubs = [{ path: "/actualites", title: "Actualités football", lastmod: edition.generatedAt }];
  const football = edition.articles.filter(isPublicArticle);
  if (football.length >= 3) hubs.push({ path: "/actualites/football", title: "Actualités football", lastmod: edition.generatedAt });
  return [...hubs, ...articles];
}

export function renderNewsSitemap(entries: NewsSitemapEntry[]): string {
  const body = entries.map((item) => `  <url>
    <loc>${esc(item.loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>BetGPT</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${esc(item.published)}</news:publication_date>
      <news:title>${esc(item.title)}</news:title>
      ${item.keywords ? `<news:keywords>${esc(item.keywords)}</news:keywords>` : ""}
    </news:news>${
      item.image
        ? `
    <image:image>
      <image:loc>${esc(item.image)}</image:loc>
      ${item.imageTitle ? `<image:title>${esc(item.imageTitle)}</image:title>` : ""}
    </image:image>`
        : ""
    }
  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body.join("\n")}
</urlset>
`;
}
function esc(value: string): string {
  return value
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

export function actualitesRss(articles: EditorialArticle[]): string {
  const items = articles.filter(isPublicArticle).slice(0, 20).map((article) => {
    const loc = articleUrl(article.slug);
    return `  <item>
    <title>${esc(article.h1)}</title>
    <link>${loc}</link>
    <guid isPermaLink="true">${loc}</guid>
    <pubDate>${new Date(article.publishedAt ?? article.createdAt).toUTCString()}</pubDate>
    <category>${esc(article.category)}</category>
    <description>${esc(article.lead)}</description>
    <enclosure url="${absImg(article.image.src)}" type="image/jpeg" length="0"/>
  </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>BetGPT — actualités football</title>
  <link>${SITE_URL}/actualites</link>
  <description>Actualités football publiées uniquement lorsqu'un développement frais, suffisamment sourcé et distinct franchit les contrôles éditoriaux BetGPT. Plafond de trois publications automatiques par jour, sans quota de remplissage.</description>
  <language>fr</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
</channel>
</rss>
`;
}

export type PerfStatus = "UNKNOWN";

export function performanceRows(articles: EditorialArticle[]): {
  articleId: string;
  publishedAt: string | null;
  topic: string;
  slot: string;
  articleType: string;
  searchImpressions: PerfStatus;
  searchClicks: PerfStatus;
  ctr: PerfStatus;
  averagePosition: PerfStatus;
  discoverImpressions: PerfStatus;
  discoverClicks: PerfStatus;
  organicSessions: PerfStatus;
  readingTime: PerfStatus;
  internalCtr: PerfStatus;
  conversions: PerfStatus;
}[] {
  return articles.filter(isPublicArticle).map((article) => ({
    articleId: article.id,
    publishedAt: article.publishedAt,
    topic: article.h1,
    slot: article.slot,
    articleType: article.articleType,
    searchImpressions: "UNKNOWN",
    searchClicks: "UNKNOWN",
    ctr: "UNKNOWN",
    averagePosition: "UNKNOWN",
    discoverImpressions: "UNKNOWN",
    discoverClicks: "UNKNOWN",
    organicSessions: "UNKNOWN",
    readingTime: "UNKNOWN",
    internalCtr: "UNKNOWN",
    conversions: "UNKNOWN",
  }));
}

export function learnTopics(rows: { league: string; type: string; clicks: number | null }[]): { status: "UNKNOWN" | "READY"; notes: string[] } {
  if (rows.length < 7 || rows.some((row) => row.clicks == null)) {
    return { status: "UNKNOWN", notes: ["Pas assez de mesures pour changer la priorité des sujets."] };
  }
  const byType = new Map<string, number>();
  for (const row of rows) byType.set(row.type, (byType.get(row.type) ?? 0) + (row.clicks ?? 0));
  const best = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    status: "READY",
    notes: best ? [`Le type ${best[0]} totalise ${best[1]} clics mesurés sur la fenêtre. Priorité augmentée, sans exclure les autres compétitions.`] : [],
  };
}
