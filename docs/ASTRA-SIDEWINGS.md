# ASTRA SIDEWINGS Ω

Reusable UX + contextual SEO rail for content-heavy pages.

## Goal

Turn dead desktop whitespace into useful navigation without degrading the primary content or mobile UX.

## Contract

The component accepts:
- a primary page body;
- an optional left wing for exploration / contextual internal links;
- an optional right wing for quick facts, trust signals and next-step links.

It is domain-agnostic. The host page supplies the wording and URLs.

## SEO rules

1. Links must be contextual and genuinely useful for the current page.
2. Prefer 3–7 strong internal links per wing; never create keyword-stuffed link clouds.
3. Use visible headings and normal crawlable anchors.
4. Dynamic intro copy should contain page-specific entities/facts, not interchangeable filler.
5. Do not duplicate hidden desktop/mobile markup: the same semantic blocks reflow responsively.
6. Keep the primary content first in mobile reading order.
7. Do not put essential content only in the wings; they are an enhancement, not the page's core.
8. Avoid fake ratings, fabricated related content or unverified structured data.
9. Preserve accessibility: semantic aside/nav/section markup and clear aria labels.
10. Validate Core Web Vitals after rollout; the brick has no client data fetch and no image dependency by design.

## UX rules

- Desktop: three-column layout, sticky side rails.
- Tablet/mobile: main content first, wings flow underneath in two columns when space permits.
- No modal, carousel or animation dependency.
- Cards use the host site's design tokens.

## BetGPT first implementation

Prediction pages use:
- left: match page, odds comparison, prediction hub, live scores;
- right: page-specific model facts + history/method/data-sources/public ledger links.

This makes the brick reusable on articles, result pages, guides, hotel pages, reviews or other verticals by changing only the supplied data.
