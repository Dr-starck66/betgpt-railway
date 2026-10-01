# ASTRA SEO SELF-HEAL Ω

Reusable fail-closed SEO repair brick.

## Purpose
Turn a failed SEO/indexability candidate gate into a controlled repair loop:

candidate FAIL -> evidence reports -> deterministic safe repair -> full candidate retest -> commit only if GREEN -> explicit gate rerun.

## Safe repair classes
- Missing sitemap coverage for an already-indexable static route, when a specific title is already known.
- Duplicate literal sitemap entries when the duplicate can be removed as an exact one-line edit.

## Intentionally blocked
- Guessing whether a page should be indexable.
- Removing noindex automatically.
- Rewriting weak content automatically.
- Guessing canonicals.
- Dynamic-route generator changes without an explicit rule.
- Any stale repair when main advanced after the failed candidate.

## Integration contract
1. A zero-weak-page report must identify intended indexable routes.
2. An indexability gate report must classify sitemap coverage failures.
3. The sitemap builder imports a small dedicated repair registry.
4. The self-heal workflow runs only after a failed candidate gate.
5. It must rerun the complete candidate gate before committing.
6. A repair commit must explicitly dispatch the immutable candidate gate again.

The brick is configuration-driven. Adapt report paths, sitemap source and registry source per site; do not copy BetGPT paths blindly.
