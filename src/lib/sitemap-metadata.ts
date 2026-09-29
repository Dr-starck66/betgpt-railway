/** Omit an unknown/future modification date rather than inventing freshness. */
export function sitemapDate(value?: string | number, now = Date.now()): string {
  if (value == null || value === "") return "";
  const time = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) && time >= 0 && time <= now ? new Date(time).toISOString() : "";
}
