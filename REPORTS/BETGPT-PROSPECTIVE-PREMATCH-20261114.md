# ASTRA BetGPT Ω — Capture prospective du 14 novembre 2026

**PASS technique pour la capture et les contrôles ; PARTIAL pour l’exécution du code six-modèles ; UNVERIFIED pour la performance prédictive future.**

## Preuve principale

- Capture réelle : **2026-11-13T23:55:40.009Z**, soit le **14 novembre 2026 à 00:55:40 Europe/Paris**, plusieurs jours avant le premier match.
- **9 rencontres réelles de Premier League** des 21 et 22 novembre 2026, identifiants officiels ESPN.
- Six fonctions originales chargées depuis src/engine/models.ts : Poisson, Dixon-Coles, Elo, xG, GLM et marketModel, via runStatisticalStack avec rho fixe -0,1.
- Les données d'équipes observées (classement ESPN, matchs, buts, points, calendrier) sont conservées avec leurs horaires et empreintes. Mais les autres champs sont **estimés ou absents** : xG, PPDA, possession, repos, blessures, absences. Les profils d'entrée sont reconstruits par l'adaptateur de recherche ; ils ne sont pas les profils complets de la production.
- **Aucune cote de bookmaker authentifiée.** marketModel utilise le remplacement Poisson. Ces six sorties ne sont donc PAS six sources indépendantes, et elles ne prouvent ni le fonctionnement live complet ni un avantage commercial.
- Aucun pari, dépense autorisée, automatisation nouvelle ou déploiement de production.

## Archive vérifiable et immuable par commit

Chemin : REPORTS/BETGPT-PREMATCH-FROZEN-20261114.json.gz.b64

Il s'agit d'une chaîne Base64 d'une archive gzip qui décompresse un JSON complet de **40 692 octets**, avec les entrées exactes, versions des sous-modèles, probabilités, horaires et blocages commerciaux de chaque match.

- SHA-256 JSON décompressé : **ea80ee761f5bf295f83d4f327afd9fa0ab8278a1ce52437c9c5b35446e51b995**
- SHA-256 gzip : **ebcb15fa54f86a117ac67622bc2f8dcdc8645c8ca120f255759dbac86a75a3b2**
- SHA-256 des neuf vecteurs de probabilités gelés : **efb3b7f78a32bc7e11dd84917133341b33cfb0ec6e56c548c4f905d8ab48ca4a**
- Commit GitHub du code à l'instant de capture : **eb2daf39a1dd9da17f671b24187d73703bd3378f**
- Commit d'archivage GitHub : **90849db1717eef584d7a8af507a69686d5962bab**
- Contrôle indépendant : relecture HTTP 200 sur raw.githubusercontent.com, décodage, décompression, confirmation des **9 prévisions** et du **SHA-256 du JSON identique**, code de sortie 0.

Empreintes des réponses ESPN originales au moment de la capture :

| Source | SHA-256 |
|---|---|
| Premier League — classement | e83fbf2b9dc8c9164414f9794d902b65f7c8596789e09bf3cfa59669e874d6e9 |
| Calendrier 21/11/2026 | 3322bf95988615a2e3bb02da29df8182309c4d73d2cde3e89fcb41dab8acbe46 |
| Calendrier 22/11/2026 | 676d9b8666641b77a8413f63fcbf8754e0460073648465b6fb6fe1a6243e9540 |

Les empreintes désignent les réponses effectivement reçues ; les réponses brutes complètes du fournisseur ne sont pas redistribuées. Les valeurs effectivement utilisées pour chaque match sont présentes dans l'archive.

## Prévisions de recherche gelées — NON commerciales

Probabilités 1X2 d'ensemble ; ce ne sont ni des cotes, ni des recommandations de mise.

| Domicile — Extérieur | Coup d'envoi UTC | 1 | N | 2 |
|---|---|---:|---:|---:|
| Manchester City — Fulham | 21/11 12:30 | 58,38 % | 21,62 % | 20,00 % |
| AFC Bournemouth — Nottingham Forest | 21/11 15:00 | 53,41 % | 23,17 % | 23,42 % |
| Aston Villa — Sunderland | 21/11 15:00 | 54,25 % | 22,42 % | 23,33 % |
| Chelsea — Leeds United | 21/11 15:00 | 45,36 % | 25,09 % | 29,55 % |
| Coventry City — Crystal Palace | 21/11 15:00 | 47,12 % | 23,52 % | 29,36 % |
| Tottenham Hotspur — Ipswich Town | 21/11 15:00 | 44,97 % | 24,47 % | 30,56 % |
| Newcastle United — Arsenal | 21/11 17:30 | 25,77 % | 24,29 % | 49,93 % |
| Hull City — Brighton & Hove Albion | 22/11 14:00 | 21,73 % | 22,67 % | 55,60 % |
| Liverpool — Manchester United | 22/11 16:30 | 57,22 % | 21,41 % | 21,36 % |

## Test post-match : réalisé dès le jour de capture

- Fichiers : scripts/betgpt-prematch-freeze.mjs, scripts/betgpt-prematch-settle.mjs, scripts/betgpt-prematch-register.mjs, scripts/betgpt-prematch-hooks.mjs et leurs deux suites de tests.
- **11/11 tests PASS** capture, **11/11 tests PASS** évaluateur, donc **22/22 PASS**, sous Node 24, code de sortie 0.
- Contrôles négatifs : horodatage tardif, match déjà terminé, doublon, classement manquant, identifiant d'équipe contradictoire, prix artificiel, incohérence du résultat, copie altérée des probabilités, décision de clôture prématurée.
- Essai réel : relecture de l'archive GitHub + fetch ESPN des deux jours + évaluation. Résultat **AWAITING_OFFICIAL_RESULTS**, **9 EN ATTENTE, 0 TERMINÉ, 0 REJET**, code 0. Aucun Brier prospectif mesurable pour le moment.
- Le scoreur futur n'altère jamais l'archive des prédictions, et calcule Brier/log-loss/top1 uniquement pour les résultats officiellement terminés et appariés.
- **Aucune nouvelle automatisation n'a été installée** et aucune exécution future autonome n'est prétendue.

## Verdict — contrôle ASTRA

| Preuve attendue | Statut |
|---|---|
| Vraies données de calendrier et classement observées avant coup d'envoi | **PASS** |
| Preuve pré-match persistée et relue depuis GitHub avec SHA-256 | **PASS** |
| Calcul effectif des six fonctions du moteur statistique | **PASS technique** |
| Données d'entrée réellement observées pour chacun des six modèles | **FAIL** : profils approximatifs, marché non observé |
| Capture et règlement avec garde-fous | **PASS technique**, 22/22 |
| Précision prospective établie | **UNVERIFIED** : 0 résultat terminé |
| Value bets réels, ROI, CLV, production | **UNVERIFIED** |

**Ne pas fusionner comme fonctionnalité commerciale ni déclencher de pari.** La priorité scientifique qui demeure est de capturer le même objet MatchInput effectivement calculé par la production avec provenance de toutes les variables, notamment les cotes horodatées et les données xG/absences réelles, puis d'accumuler des résultats prospectifs suffisants avant toute calibration ou comparaison commerciale.
