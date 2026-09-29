/** Index a fixture page only when the identity of the match is real. */
export function fixtureIndexable(match: {
  home?: { name?: string };
  away?: { name?: string };
  kickoff?: string;
}): { index: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!match.home?.name?.trim() || !match.away?.name?.trim()) reasons.push("équipes manquantes");
  const kick = Date.parse(match.kickoff ?? "");
  if (!match.kickoff || Number.isNaN(kick)) reasons.push("coup d'envoi manquant");
  return { index: reasons.length === 0, reasons };
}

export const SITEMAP_BLOCKED: RegExp[] = [
  /^\/admin(?:\/|$)/,
  /^\/api(?:\/|$)/,
  /^\/go(?:\/|$)/,
  /^\/lab(?:\/|$)/,
  /^\/chat(?:\/|$)/,
  /^\/championship(?:\/|$)/,
  /^\/geo-health(?:\/|$)/,
  /^\/prono\//,
  /^\/score\//,
  /^\/resultat\//,
];

export function sitemapAllowed(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return !SITEMAP_BLOCKED.some((re) => re.test(path));
}
