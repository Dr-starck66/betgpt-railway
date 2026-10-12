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
## One-time OAuth consent and automatic renewal (v2)

**NEVER request, store or transmit social network passwords to ASTRA.** The account owner logs in directly on Instagram's official consent screen. ASTRA receives only a revocable authorization code, exchanges it for a long-lived access token, stores AES-256-GCM ciphertext, and refreshes it before expiration.

Files and protections:
- `scripts/astra-social-oauth-vault.mjs`: `enroll`, `renew`, `health` commands; no tokens or passwords in logs
- `data/social/account-vault.json`: only encrypted tokens and public metadata. Initial state is empty
- `ASTRA_SOCIAL_VAULT_KEY`: one 32-byte base64 key kept in GitHub Actions secrets; **not** in Git, email, chat, URL or client-side JavaScript
- `ASTRA_SOCIAL_INSTAGRAM_APP_ID` / `ASTRA_SOCIAL_INSTAGRAM_APP_SECRET`: confidential Meta app configuration used at first authorization; never publish the secret
- `ASTRA_SOCIAL_IG_SITE_ID`, `ASTRA_SOCIAL_IG_AUTHORIZATION_CODE`, `ASTRA_SOCIAL_IG_REDIRECT_URI`: one-time server-side code exchange inputs; `enroll` needs these on the protected backend. The authorization code must NOT be added as a plaintext `workflow_dispatch` input, issue, or repository variable.

The GitHub workflow executes `renew` on each run, persisting **encrypted ciphertext only** before any remote posting, then publishes using the renewed credentials. When Meta returns invalid/revoked credentials, the account is marked `RECONNECT_REQUIRED` (no repeated failing posts). When an upstream timeout occurs, `RETRY_REFRESH` is recorded. The statuses mean exactly what happened, never a fabricated PASS. A 60-day token renewal must run before the grant expires; external platform revocation can still require another human approval.

The Meta authorization screen and callback backend are **NOT YET DEPLOYED**. Until those are provisioned with the proper Meta app, registered redirect URI, secure authenticated callback and GitHub secret, a one-click login is **NOT** live. This repository does **not** support importing passwords or session cookies. Avoid publishing a fake "Connect Instagram" button.

Compatibility: encrypted vault entries with `authMode=instagram_login` use `graph.instagram.com` for publishing; legacy `ASTRA_SOCIAL_META_ACCOUNTS_JSON` entries continue using the older `graph.facebook.com` Page Login route. X remains `WAIT_X_COST` under the zero-extra-spend policy; its OAuth refresh flow does not waive the network's posting charges.

Do not commit the app secret, account password, plaintext OAuth token, or callback authorization code.
