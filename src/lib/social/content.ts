import type { EditorialArticle } from "@/lib/editorial/types";
import { SITE_URL } from "@/lib/programmatic";
import type { SocialPublication } from "@/lib/social/types";

const X_LIMIT = 280;

const COMPETITION_HASHTAGS: Array<[RegExp, string]> = [
  [/ligue\s*1/i, "#Ligue1"],
  [/champions|ligue des champions|c1/i, "#ChampionsLeague"],
  [/premier league/i, "#PremierLeague"],
  [/liga|la liga/i, "#LaLiga"],
  [/serie a/i, "#SerieA"],
  [/bundesliga/i, "#Bundesliga"],
  [/europa/i, "#EuropaLeague"],
  [/ligue des nations/i, "#NationsLeague"],
];

function hashtagToken(value: string): string {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  return clean ? `#${clean}` : "";
}

export function buildHashtags(article: EditorialArticle): string[] {
  const selected: string[] = [];
  for (const team of article.teams.slice(0, 2)) {
    const tag = hashtagToken(team);
    if (tag) selected.push(tag);
  }
  const competitionText = `${article.competition} ${article.category} ${article.keywords}`;
  const competitionTag = COMPETITION_HASHTAGS.find(([pattern]) => pattern.test(competitionText))?.[1];
  if (competitionTag) selected.push(competitionTag);
  const seen = new Set<string>();
  return selected.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

export function trackedArticleUrl(article: EditorialArticle): string {
  const url = new URL(`${SITE_URL}/actualites/${article.slug}`);
  url.searchParams.set("utm_source", "x");
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "editorial_auto");
  url.searchParams.set("utm_content", article.slug);
  return url.toString();
}

function hook(article: EditorialArticle): string {
  const prefix =
    article.articleType === "postmatch"
      ? "⚽"
      : article.articleType === "news"
        ? "🔴"
        : article.articleType === "brief"
          ? "📊"
          : "👀";
  return `${prefix} ${article.h1.trim()}`;
}

function cropAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return "";
  const slice = value.slice(0, Math.max(0, max - 1));
  const cut = slice.lastIndexOf(" ");
  return `${slice.slice(0, cut > 40 ? cut : slice.length).trimEnd()}…`;
}

export function fitXPost(parts: {
  headline: string;
  detail?: string;
  url: string;
  hashtags: string[];
}): { text: string; hashtags: string[] } {
  let tags = [...parts.hashtags];
  const detail = parts.detail?.trim() ?? "";
  const render = (headline: string, body: string, currentTags: string[]) =>
    [headline, body, "À lire sur BetGPT 👇", parts.url, currentTags.join(" ")]
      .filter(Boolean)
      .join("\n\n");

  let text = render(parts.headline, detail, tags);
  while (text.length > X_LIMIT && tags.length > 1) {
    tags = tags.slice(0, -1);
    text = render(parts.headline, detail, tags);
  }
  if (text.length > X_LIMIT && detail) {
    const fixed = render(parts.headline, "", tags).length;
    const allowance = Math.max(0, X_LIMIT - fixed - 2);
    text = render(parts.headline, cropAtWord(detail, allowance), tags);
  }
  if (text.length > X_LIMIT) {
    const fixedWithoutHeadline = render("", "", tags).length;
    const allowance = Math.max(32, X_LIMIT - fixedWithoutHeadline - 2);
    text = render(cropAtWord(parts.headline, allowance), "", tags);
  }
  if (text.length > X_LIMIT && tags.length) {
    tags = [];
    text = render(cropAtWord(parts.headline, 100), "", tags);
  }
  return { text: text.slice(0, X_LIMIT), hashtags: tags };
}

export function buildXPublication(article: EditorialArticle, now = new Date()): SocialPublication {
  const articleUrl = `${SITE_URL}/actualites/${article.slug}`;
  const trackedUrl = trackedArticleUrl(article);
  const hashtags = buildHashtags(article);
  const detail = article.lead.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  const fitted = fitXPost({
    headline: hook(article),
    detail: cropAtWord(detail, 110),
    url: trackedUrl,
    hashtags,
  });
  const createdAt = now.toISOString();
  return {
    id: `x:${article.id}:v1`,
    articleId: article.id,
    articleSlug: article.slug,
    articleTitle: article.h1,
    articleUrl,
    trackedUrl,
    network: "x",
    text: fitted.text,
    hashtags: fitted.hashtags,
    imageUrl: article.image?.src ? `${SITE_URL}${article.image.src}` : null,
    createdAt,
    scheduledAt: article.publishedAt ?? createdAt,
    attemptedAt: null,
    publishedAt: null,
    status: "READY_TO_X",
    remotePostId: null,
    remotePostUrl: null,
    error: null,
    retryCount: 0,
  };
}

export function xIntentUrl(publication: SocialPublication): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(publication.text)}`;
}
