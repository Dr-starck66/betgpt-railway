import { SITE_URL } from "./programmatic.ts";

const RULES = `Allow: /

# Technique / privé — pas de crawl
Disallow: /admin
Disallow: /api/
Disallow: /go
Disallow: /lab

# /chat, /championship et /geo-health restent crawlables : noindex est sur la page.
# /match/, /scores-en-direct, /resultats-football, /about, /methodology : crawlables.
# /prono/* et /score/* : alias 301 vers /match/{slug}.
`;

/** Shared robots.txt — used by Nitro (production) and the Vite public-files plugin (dev). */
export function robotsTxt(): string {
  return `User-agent: Googlebot
User-agent: Bingbot
User-agent: OAI-SearchBot
${RULES}
User-agent: *
${RULES}
Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-images.xml
Sitemap: ${SITE_URL}/news-sitemap.xml
`;
}
