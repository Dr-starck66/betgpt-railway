# FindInsuranceQuotes.net staging branch

Independent insurance comparison/editorial platform inspired by the production discipline of BetGPT, but isolated from BetGPT main.

## Safety gates
- Staging is noindex by default (INDEXABLE must explicitly equal true).
- No fake premiums, affiliate payouts, partner relationships or carrier claims.
- Editorial content is separated from monetization.
- Partner CTAs stay non-commercial until a verified partner URL is configured.
- Health endpoint: /api/health
- SEO: canonical, robots, sitemap, news sitemap, Article/WebSite structured data.

## Production environment
PORT is supplied by Railway.
SITE_URL=https://findinsurancequotes.net after the domain is owned and attached.
INDEXABLE=true only after production-domain, canonical, robots, sitemap and content QA all pass.
