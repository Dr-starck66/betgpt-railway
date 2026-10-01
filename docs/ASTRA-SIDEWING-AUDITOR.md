# ASTRA SIDEWING AUDITOR Ω — V2

Reusable UX + SEO decision engine for deciding where Sidewings are useful, whether existing Sidewings need optimization, and which internal-link families may be injected safely.

## Core outputs

Every audited page receives:

- **Sidewing Need (0–100)**: visual/UX need for lateral support.
- **SEO Opportunity (0–100)**: potential gain from better contextual internal linking and information architecture.
- **Confidence (0–100)**: confidence in the recommendation given the available signals.
- **Verdict**: `PRIORITY`, `RECOMMENDED`, `OPTIMIZE`, `OPTIONAL`, or `SKIP`.
- **Link families**: which semantic families belong left/right.
- **Link budget**: maximum number of links the page should receive from Sidewings.
- **SEO risks**: duplicate-link saturation, noindex/canonical issues, thin content, freshness issues.
- **Safeguards**: crawlable links, mobile parity, visible-content/schema parity, deduplication, no doorway-style link clouds.

`OPTIMIZE` means Sidewings already exist: the engine audits their SEO quality instead of recommending a second set.

## Link families

- `parent_silo`: topic parent / breadcrumb-like return path.
- `sibling_pages`: semantically close pages at the same level.
- `entity_links`: teams, people, destinations, products, categories, etc.
- `related_content`: genuinely related articles/guides.
- `comparison`: odds, prices, alternatives, tables, comparisons.
- `trust_proof`: methodology, sources, authorship, public evidence.
- `next_step`: the logical action after consuming the current page.
- `freshness_live`: live/current destinations, only when freshness is verified.

## Link planner

`astra-sidewing-planner.ts` consumes the audit plus candidate internal URLs and produces left/right link plans.

It rejects:

- external URLs;
- self-links;
- noindex targets;
- non-self-canonical targets;
- link families not authorized by the audit;
- unverified live/freshness links;
- duplicate targets;
- candidates above per-family or global link budgets.

Candidates are ranked by topical relevance first, then business value, verified freshness, entity specificity and family priority. Already-linked destinations are penalized to avoid boilerplate repetition.

## Hard exclusions

Redirect routes are always `SKIP`. Non-self-canonical pages are `SKIP`. Noindex pages cannot receive a `PRIORITY` SEO verdict.

## Automated route scan

Run:

```
npm run sidewings:audit
```

The scanner writes `reports/astra-sidewing-audit.json` and prints the highest-priority routes.

Static scanning is intentionally conservative. It is the triage layer. The same engine accepts measured DOM/view data later, so a browser crawler can replace heuristics without replacing the scoring model.

## Tests

Run:

```
npm run test:sidewings
```

GitHub Actions also runs the tests and scanner automatically for every change to `astra-sidewing-*.ts`, the route scanner, routes or package scripts.

## Reuse on other sites

The scoring engine and planner are domain-agnostic. Only the candidate resolver changes:

- hotel site → hotels, destinations, neighborhoods, comparisons, travel guides;
- review site → brands, products, alternatives, methodology, related reviews;
- media site → topics, people, teams, competitions, articles;
- ecommerce → categories, compatible products, comparison pages, guides.

The same safety gates, budgets and scoring logic stay unchanged.
