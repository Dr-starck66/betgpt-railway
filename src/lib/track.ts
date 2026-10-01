export function trackedUrl(book: string, url: string, matchId?: string): string {
  const q = new URLSearchParams({ b: book });
  if (matchId) q.set("m", matchId);
  if (url) q.set("u", url);
  return `/api/go?${q.toString()}`;
}


export function trackedPublicUrl(
  book: string,
  url: string,
  matchId?: string,
  siteUrl = process.env.PUBLIC_SITE_URL?.trim() || "https://betgpt.live",
): string {
  const path = trackedUrl(book, url, matchId);
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : siteUrl + "/").href;
}
