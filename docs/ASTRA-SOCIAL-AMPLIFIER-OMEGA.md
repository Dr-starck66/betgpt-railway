# ASTRA SOCIAL AMPLIFIER Ω — 0 € spend guard

Autonomous **per-site** social syndication triggered after publication on the real public website. This is independent from, and does not modify, editorial release or Google Discover pipelines.

## Status / proof

- `plan` fetches live News sitemaps, article sitemaps (only for explicit article paths) and RSS feeds. A site is first **baselined**, never blasts old articles. Only newly observed, recent public articles become jobs.
- `claim` reserves Instagram jobs **and persists the claim to Git** before attempting any external POST; `deliver` only executes claims from the same GitHub Actions run. An interrupted job is **not retried blindly** (avoids duplicate publishing). A human or explicit recovery process must reconcile stale claims.
- `deliver` verifies Meta's returned media ID and fetches its permalink. `PUBLISHED` requires both. `REMOTE_UNVERIFIED` means Meta accepted a post but the public permalink could not be verified.
- X: text/hashtags/link prepared, but **never posted** via the charged X API. Status `WAIT_X_COST` by design.
- Instagram: `WAIT_AUTH` until authorized, `WAIT_IMAGE` if no valid publicly fetchable OG image, `WAIT_REVIEW` for sensitive content. No unsupported login scraping, browser automation or paid service.
- Stats and status are recorded in `data/social/amplifier-state.json`; secrets and access tokens are never committed or logged. Each post has network-specific UTM parameters.

## Credentials (only after platform authorization)

Set GitHub Actions repository secret `ASTRA_SOCIAL_META_ACCOUNTS_JSON` containing JSON like:

```json
{
  "betgpt": { "instagram": { "accountId": "1784...", "accessToken": "EAA..." } },
  "gamicnews": { "instagram": { "accountId": "1784...", "accessToken": "EAA..." } }
}
```

Only professional Instagram accounts with the official Meta Content Publishing permission can work. Use approved app token handling and replace expired tokens. Do not provide tokens in issues or commit history. Bizarre Sexuality is marked for a policy review before sending adult-theme material to Instagram. Never auto-retry a `CLAIMED` or `REMOTE_UNVERIFIED` job.

## Extend to a new site

Add a new object in `config/astra-social-sites.json` with a true domain, language, article path (if known), and public sitemap/RSS sources. New sources must be backed by real production publishing and verified as HTTP 200 before being marked as connected. Account mapping uses the corresponding site `id`.

Tests: `node --test scripts/astra-social-amplifier.test.mjs`.

**Google Discover placement, social reach, and indexing cannot be guaranteed.** Google News / Discover eligibility is distinct from social promotion.

Billing: standard GitHub-hosted runners for a public repository are free. No external paid API is invoked by default.