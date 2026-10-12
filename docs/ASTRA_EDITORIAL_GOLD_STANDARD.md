# ASTRA EDITORIAL GOLD STANDARD Ω — Permanent publication contract

**Approved on 12 October 2026 for ALL FUTURE BetGPT football news, analysis, previews and post-match articles.**

Canonical reference article (approved by the site owner):
`https://betgpt.live/actualites/manchester-city-18-points-verdict-financier-appel-sanctions-2026-10-12`

Code reference: `src/lib/editorial/manual-city-verdict-2026-10-12.ts`.

## What made this article acceptable

- A *specific, original journalistic question* or contradiction in the news; no generic date-based recap.
- A genuinely helpful opening: facts, people, date, consequences, and what is / is not decided.
- At least **1,500 useful French words** with **7+ coherent H2 sections**; H3 where natural.
- **3+ independent, verifiable strong sources**, preferably a primary official publication, with paragraphs attached to named sources and transparent uncertainties.
- Rich factual analysis: chronology, real context, impact, reasoned distinctions, what is established and what remains unresolved.
- Correct large licensed or authorized contextual image, >=1200 px wide, attribution and alt. Actual image availability/licensing must also be verified at publication time.
- SEO/Discover ready *without claiming Discover inclusion*: real H1, metadata, links, news sitemap when eligible, no clickbait, no duplicated paragraphs and no generic AI text.
- No false attribution, invented quotes, fictitious results, simulated bookmaker odds presented as observed, or unsupported confident claims.
- No filler to satisfy minimum length. If sources do not support a substantial piece, do **not** publish.

## Automated enforcement

`src/lib/editorial/gold-standard.ts`: fail-closed minimum bar.
`src/lib/editorial/engine.ts`: applies to **new materialized automatic articles before publication**.
`scripts/astra-editorial-corpus-audit.ts`: CI positive reference and two negative controls.
The test is on future generated candidates only; this guard does not retroactively erase archived public URLs.

## Acceptance / fail status

PASS only if: supported facts, original reporting angle, sufficient depth, evidence trail, approved contextual image, functional public HTML, indexable metadata, valid relevant sitemap and source citations are all proven.
PARTIAL when a code gate passes but production checks or individual assets cannot be independently verified.
FAIL for generic news padding, sources irrelevant to claim, false headlines, images unavailable, or weak content.
UNVERIFIED when the relevant independent proof is unavailable.

## Editorial immutability

This document and reference anchor must persist in the Git repository, not just conversation memory. Changes should never silently weaken this bar. Quality takes precedence over the number of daily publications. The newsroom may intentionally skip an edition rather than publish short generic copy. Google Discover / Google News distribution is never guaranteed.
