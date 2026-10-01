# ASTRA ZERO-WEAK-PAGE GUARD Ω

Reusable fail-closed SEO/UX quality gate for every site.

## Contract

Every public route must be classified as one of: indexable content, trust/legal, technical/noindex, redirect, or layout. An indexable page fails if it lacks critical page-level metadata or a credible main-content implementation. Technical pages fail if they remain indexable or are explicitly present in the sitemap source.

The guard intentionally does **not** reward keyword stuffing or raw word count. It combines critical metadata, main-content/H1 evidence, contextual internal links, structured-data support and trust/evidence signals. Rich delegated components can be declared in the config so a thin route wrapper is not confused with a thin public page.

## Reuse on another site

Copy:
- `scripts/astra-zero-weak-page-guard.mjs`
- `config/astra-zero-weak-page-guard.json`
- the CI workflow

Then adapt only the config: route directories, layout files, technical route patterns, head delegates and content delegates. Run:

```
node scripts/astra-zero-weak-page-guard.mjs --strict
```

A PASS is a code-quality gate, not a claim of Google rankings or traffic. Search demand, rankings and Search Console performance remain externally measured evidence.
