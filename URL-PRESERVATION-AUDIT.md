# BetGPT MASTER — URL / SEO Preservation Audit

## Verdict
**PASS sur la préservation de la source de référence.** Aucun fichier de route existant n'a été supprimé et aucun fichier `public/` existant n'a été supprimé.

## Comparaison avec la source de référence
- Routes TanStack d'origine: **101 / 101 conservées**.
- Fichiers `public/`: **230 / 230 conservés**.
- `api/`: **1 / 1 conservé**.
- `server/`: toutes les routes d'origine conservées, avec **1 nouvelle route additive** (`learning-target.json.ts`).
- Seul fichier absent: `.grok/preview.log`, log de preview non-runtime et non-indexable.

## SEO / indexation protégés
Les fichiers suivants sont **byte-for-byte identiques** à la source d'origine :
- `server/routes/sitemap.xml.ts`
- `server/routes/news-sitemap.xml.ts`
- `server/routes/sitemap-images.xml.ts`
- `server/routes/sitemap.html.ts`
- `server/routes/robots.txt.ts`
- `src/lib/sitemap-urls.ts`
- `src/lib/sitemap-metadata.ts`
- `src/lib/robots.ts`
- `vercel.json`
- `vite.config.ts`

Aucune route de page existante n'a été renommée ou supprimée. Les ajouts sont additifs.

## Fichiers existants volontairement modifiés
Seulement cinq fichiers existants diffèrent de la source de référence :
1. `package.json` — scripts/tests supplémentaires.
2. `src/components/match-detail.tsx` — insertion du panneau Match Intelligence.
3. `src/engine/eu-odds.ts` — horodatage `observedAt` des cotes.
4. `src/engine/pipeline.ts` — apprentissage continu + best odds + freshness gates.
5. `src/engine/types.ts` — champ optionnel `observedAt`.

Aucun de ces changements ne supprime une URL existante.

## Tests
- Tests ciblés des nouvelles briques: **48/48 PASS**.
- Suite globale: **204 PASS / 6 FAIL**.
- Les 6 échecs sont tous dans la suite `raw HTML SSR SEO` et retournent 404 parce que l'endpoint SSR attendu par le test n'est pas servi dans cet environnement. C'est le même bloc de défauts/environnement déjà observé; aucun nouveau test fonctionnel ciblé n'échoue.

## Limite de preuve live
Le domaine public `betgpt.live` n'a pas pu être crawlé intégralement depuis cet environnement : résolution directe indisponible et quota du crawler externe insuffisant. Je ne transforme donc pas cela en faux PASS. La garantie ici est une **comparaison exhaustive contre la source BetGPT de référence récupérée avant nos modifications**.

## Règle de déploiement futur
Avant toute mise en production :
1. Snapshot des URLs live + sitemap.
2. Diff exact URL par URL contre ce MASTER.
3. Aucune URL indexable ne peut disparaître sans redirection 301 explicite.
4. Vérifier canonical, robots, sitemap, News sitemap, Image sitemap.
5. Smoke-test des anciennes URLs avant promotion.
6. Rollback immédiat si une ancienne URL passe de 200/301 attendu à 404/5xx.

## XG gate zero-break recheck — 2026-09-27
After integrating the XG/0-0 NO-BET gate, the route/public surface was rechecked against the pristine baseline:
- `src/routes`: 101/101 retained.
- `public`: 230/230 retained.
- Critical sitemap/robots/canonical routing files remain byte-for-byte identical to the pristine baseline.
- No indexed-route removal was introduced by the XG gate work.

## ROI5 gate zero-break recheck — 2026-09-27
Compared with the immediately preceding XG/0-0 MASTER:
- `src/routes`: **101/101 retained**, 0 missing, 0 added.
- `public`: **230/230 retained**, 0 missing, 0 added.
- `api`: **1/1 retained**, 0 missing, 0 added.
- `server`: **23/23 retained**, 0 missing, 0 added.
- `server/routes/sitemap.xml.ts`, `news-sitemap.xml.ts`, `sitemap-images.xml.ts`, `sitemap.html.ts`, `robots.txt.ts`, `src/lib/sitemap-urls.ts`, `src/lib/sitemap-metadata.ts`, `src/lib/robots.ts`, `vercel.json`, and `vite.config.ts` remain byte-for-byte identical to the preceding MASTER.
- Existing runtime files changed by this ROI5 wave: `src/engine/pipeline.ts`; `package.json` only receives test/report scripts.
- New ROI5 files are additive under `src/engine/`, `scripts/`, `data/`, and documentation. No route or public asset was removed.

## ROI5 continuous-learning zero-break recheck — 2026-09-27
Compared with the immediately preceding ROI5 MASTER:
- `src/routes`: **101/101 retained**.
- `public`: **230/230 retained**.
- `api`: **1/1 retained**.
- `server/routes`: **16/16 retained**.
- Critical robots/sitemaps/SEO metadata, `vercel.json`, and `vite.config.ts` remain byte-for-byte identical.
- Runtime change is additive to selection logic only: `src/engine/roi5-continuous-learning.ts` plus an optional policy parameter wired through `src/engine/pipeline.ts`.
- No URL, redirect, public asset, sitemap entry generator, or canonical-routing source was removed or renamed.
