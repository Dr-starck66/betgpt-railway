export function trackedUrl(book: string, url: string, matchId?: string): string {
  const q = new URLSearchParams({ b: book });
  if (matchId) q.set("m", matchId);
  if (url) q.set("u", url);
  return `/api/go?${q.toString()}`;
}
