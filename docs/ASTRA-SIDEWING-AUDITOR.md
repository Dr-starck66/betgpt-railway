# ASTRA SIDEWING AUDITOR Ω

Reusable UX + SEO decision engine for deciding where Sidewings are useful and what they should contain.

## Outputs

Every audited page receives:

- **Sidewing Need (0–100)**: visual/UX need for lateral support.
- **SEO Opportunity (0–100)**: potential gain from better contextual internal linking and information architecture.
- **Confidence (0–100)**: confidence in the recommendation given the available signals.
- **Verdict**: `PRIORITY`, `RECOMMENDED`, `OPTIONAL`, or `SKIP`.
- **Link families**: which semantic families belong left/right.
- **Link budget**: maximum number of links the page should receive from Sidewings.
- **SEO risks**: duplicate-link saturation, noindex/canonical issues, thin content, freshness issues.
- **Safeguards**: crawlable links, mobile parity, visible-content/schema parity, deduplication, no doorway-style link clouds.

## Link families

- `parent_silo`: topic parent / breadcrumb-like return path.
- `sibling_pages`: semantically close pages at the same level.
- `entity_links`: teams, people, destinations, products, categories, etc.
- `related_content`: genuinely related articles/guides.
- `comparison`: odds, prices, alternatives, tables, comparisons.
- `trust_proof`: methodology, sources, authorship, public evidence.
- `next_step`: the logical action after consuming the current page.
- `freshness_live`: live/current destinations, only when freshness is verifiable.

## Hard exclusions

Redirect routes are always `SKIP`. Non-self-canonical pages are `SKIP`. Noindex pages cannot receive a `PRIORITY` SEO verdict.

## Automated route scan

Run:

```
npm run sidewings:audit
```

The scanner writes `reports/astra-sidewing-audit.json` and prints the highest-priority routes.

The scanner intentionally uses conservative static heuristics. It is a triage layer, not a substitute for a rendered-page audit. A future browser pass can feed measured viewport/content widths and real DOM link counts into the same engine.

## Reuse on other sites

The engine is domain-agnostic. A hotel site can map entities to hotels/destinations, a review site to products/brands, and a media site to topics/people/articles. Only the link-family resolver changes; scoring and safeguards remain identical.
