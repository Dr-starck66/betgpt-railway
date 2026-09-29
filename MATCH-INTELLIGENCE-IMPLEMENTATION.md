# BetGPT Match Intelligence V1

Ajouté le 26 septembre 2026.

## Ce qui est intégré

- panneau public « BetGPT Match Intelligence » sur chaque page match ;
- probabilités calibrées 1/N/2, Over 2,5 et BTTS ;
- confiance globale /10 avec bande faible, modérée ou élevée ;
- détail de qualité : complétude, fraîcheur, accord des sources, accord modèles, compositions, marché, calibration ;
- buts attendus explicitement présentés comme sorties modèle et non comme xG observés ;
- scores les plus probables ;
- preuves disponibles et inconnus/non vérifiés séparés ;
- scénarios conditionnels sans faux pourcentage d'occurrence ;
- liens vers l'historique public et le rapport de précision ;
- test unitaire anti-faux-PASS dédié.

## Fichiers ajoutés

- `src/engine/match-intelligence-panel.ts`
- `src/engine/match-intelligence-panel.test.ts`
- `src/components/match-intelligence-panel.tsx`

## Fichiers modifiés

- `src/components/match-detail.tsx`
- `package.json`

## Vérifications

- Tests dédiés Match Intelligence : 3/3 PASS.
- Suite globale avant modification : 204 PASS / 6 FAIL, les 6 échecs étant les tests SSR SEO qui reçoivent 404 dans cet environnement sans serveur SSR actif.
- Typecheck/build complet non certifié dans ce conteneur : l'archive source n'incluait pas `node_modules` et la restauration `npm ci` n'a pas pu finir avant le timeout réseau du runtime.

Aucun PASS global n'est revendiqué tant que typecheck + build + vérification production ne sont pas exécutés dans l'environnement de déploiement réel.
