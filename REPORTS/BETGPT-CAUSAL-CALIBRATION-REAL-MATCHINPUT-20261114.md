# ASTRA BetGPT Ω — Correction causale des nuls et véritables MatchInput (14/11/2026)

## Résultat technique et conditions de validité

**PASS** : correction de calibration apprise uniquement sur des saisons antérieures, 760 matchs rejoués dans l'ordre chronologique ; exécution du constructeur original MatchInput de BetGPT avec 19 réponses ESPN 200 et récupération de 12 futurs MatchInput intégraux.

**PARTIAL** : calibration historique améliorée sur Brier global, log-loss global, mais **sans aucun gain de précision top-1** ; entrées du moteur authentiques côté ESPN, mais profils internes en partie estimés et sans enrichissement bookmaker vérifié.

**UNVERIFIED** : modèle complet en production, cotes actuelles de bookmaker authentifiées et horodatées, détection de value bets, résultats prospectifs futurs, ROI.

Aucune modification de production ni fusion. La PR reste en brouillon.

## A. Calibration apprise avant chaque saison

Algorithme : correction pénalisée de l'interception *logit* de la probabilité de nul, en préservant les proportions domicile/extérieur et la somme 1 des trois probabilités. Pénalité ridge fixe 25, correction bornée à ±0,8, 200 matches de formation requis. Paramètres définis dans le code, sans sélection sur les résultats des saisons évaluées.

- **Test 2024/25** : 380 matches de 2023/24 pour ajuster le biais **−0,34249822**. Les 380 matches de 2024/25 servent exclusivement à évaluer.
- **Test 2025/26** : recalibrage avec 760 matches antérieurs des saisons 2023/24 + 2024/25 ; biais **−0,32067410**. Les 380 matches de 2025/26 ne servent pas à ajuster le biais de cette saison.
- Les prédictions Elo–Poisson restent chronologiques. Les cotes Bet365 et Pinnacle de clôture sont exclues de la calibration et utilisées seulement comme diagnostics historiques séparés.
- 9/9 tests de calibration réussis : absence de fuite de labels futurs, exclusion des cotes de marché, simplex 1X2, rejet d'historiques trop petits, maintien des signaux commerciaux désactivés.

### Résultats réellement exécutés sur 760 matches

| Indicateur | Brut | Recalibré | Différence |
|---|---:|---:|---:|
| Brier 1X2 | 0,62154727 | **0,61811160** | **−0,00343567** |
| Log-loss 1X2 | 1,03391027 | **1,03068941** | **−0,00322086** |
| Bonne issue la plus probable | 48,815789 % | **48,815789 %** | **0 point** |
| Probabilité moyenne de nul | **30,176420 %** | **23,682136 %** | −6,494284 points |
| Fréquence réelle de nul | 25,921053 % | 25,921053 % | identique |
| Probabilité moyenne victoire extérieur | 28,480953 % | 31,156923 % | +2,675970 points |
| Fréquence réelle victoire extérieur | 32,368421 % | 32,368421 % | identique |

**Contrôle défavorable à conserver :** la correction **sous-estime désormais les nuls de 2,24 points** en moyenne. Sur 2025/26, elle améliore le Brier (0,61995075 → 0,61928778) mais **dégrade le log-loss** (1,03168435 → 1,03320658) ; elle n'améliore donc pas unanimement les deux scores sur chaque saison. Sur 2024/25, Brier 0,62314379 → 0,61693541 et log-loss 1,03613619 → 1,02817225.

Conclusion : **correction plausible en recherche**, pas une amélioration commerciale confirmée. Le **48,82 % n'augmente pas** et le modèle reste inférieur au comparateur marché à la clôture dans l'audit précédent.

Code : scripts/betgpt-draw-causal-calibration.mjs et scripts/betgpt-draw-causal-calibration.test.mjs. Le moteur chronologique fournit ses probabilités de saison d'initialisation uniquement pour cette calibration antérieure.

## B. Enquête et correction dans le véritable moteur live.ts

Le dépôt contient un ancien fichier data/live-snapshot.json : **schema 37**, horodaté **2026-09-25T07:38:15.710Z**, 216 entrées, aucune rencontre encore future lors de l'audit, **aucune cote avec observedAt**. Il ne prouve donc ni la disponibilité actuelle ni la fraîcheur des prix.

Premier essai direct : **19 sources ESPN HTTP 200**, mais 0 MatchInput. Analyse : la branche historique de parseEvents, dans src/engine/live.ts, essayait d'accéder à books.current[0].home/draw/away même quand aucun bookmaker FR n'avait publié de cotes. L'exception remontait au constructeur fetchLeague, dont le catch rendait une liste vide, masquant une erreur par « aucune rencontre ».

**Correction isolée sur la branche de recherche** : accès conditionnel books.current[0]?.home/draw/away, avec **0 si cote réellement indisponible**. Le zéro signifie UNAVAILABLE, jamais une cote sportive crédible. Aucune autre logique de production modifiée, aucune fusion.

**Retest réel** : même chemin fetchLeague / parseEvents de live.ts, 19 requêtes ESPN succès, **40 MatchInput construits**, **12 rencontres futures retenues**, code de sortie 0. La fonction de recherche ajoutée astraReadOnlyEspnMatchInputs exploite le constructeur initial sans passer par le pipeline de publication et d'enrichissement final. Les 12 objets originaux complets sont conservés sans reconstruire des profils dans un script alternatif.

**Test de régression déterministe** : un match historique terminé sans aucune cote bookmaker n'efface plus le prochain match ; 11/11 tests audit MatchInput réussis, incluant cette régression.

### Archive vérifiée

Fichier : REPORTS/BETGPT-ORIGINAL-MATCHINPUT-20261114.json.gz.b64

- Capture réelle : **2026-11-14T00:16:16.453Z**.
- Fichier JSON décompressé : **146 754 octets**.
- SHA-256 du JSON : **067356381def92c21896a4b13adf6d1fbfa44e694e6981dfcad65b8dd4a92ea4**.
- SHA-256 du gzip : **433d20f559ec9fc7fa246bd76ade736380f607ff72b2b562b983f72108f8eb5e**.
- Archive GitHub enregistrée : commit **da7207ec355b004b54755136d894b527b21ac328**.
- Relecture indépendante depuis la branche GitHub : **intégrité SHA confirmée, 12 MatchInput, 19 réponses sources 200, 0 cote certifiée**.
- Chaque MatchInput contient les valeurs originales, horodatages d'ingestion, sources de données, empreinte individuelle, contrôles de cotation et copie stricte sans cotes non prouvées.

**Précautions de provenance** : le moteur fabrique certaines valeurs xG, PPDA, possession, repos, absences et importance à partir de règles et valeurs statiques. Les timestamps d'ingestion ne transforment pas ces variables en observations sportives. L'auditeur conserve les valeurs mais les étiquette **MODEL_ESTIMATE_OR_MISSING**. Une liste vide d'absences ne prouve pas qu'il n'y a aucun absent.

**Résultat négatif essentiel :** **0 cote pré-match authentifiée**. Toute cote sans date de dernière mise à jour ou sans preuve de réponse bookmaker liée est rejetée. Le flux ESPN actuel n'est pas un substitut au fournisseur autorisé The Odds API : l'accès à sa clé n'a toujours pas été validé dans l'environnement sécurisé. Aucune cote ni valeur attendue n'est inventée.

## C. Chaîne de vérification

1. Script de calibration : 9/9 tests locaux cloud PASS, exécution sur les trois fichiers Football-Data avec code 0.
2. Auditeur du vrai moteur : 11/11 tests PASS, dont contrôle de régression du défaut historique, test réel ESPN 0→40→12 MatchInput et code 0.
3. Archive persistée sur GitHub et décompressée : SHA-256 exact, 12 objets et 0 devises bookmaker certifiées.
4. Les 77 tests de recherche antérieurs restent disponibles sur la même PR ; le contrôle combiné du dernier commit reste à vérifier séparément.
5. Aucun pari, aucune nouvelle automatisation, aucun déploiement, aucun changement DNS, aucune fusion.

## Décision ASTRA

- **PASS** : calibration sans fuite temporelle ; récupération réelle des MatchInput du constructeur BetGPT après correction d'un crash ; conservation des provenance et refus explicite des cotes non datées.
- **PARTIAL** : amélioration Brier historique (sans gain de taux de bonne prédiction) ; comparabilité avec le pipeline final de production.
- **FAIL — entrée commerciale** : cotes observées/authentifiées = 0, plusieurs variables de joueurs et xG non observées.
- **UNVERIFIED** : valeur commerciale, ROI, capacité des six modèles complets en production, supériorité aux cotes disponibles avant match.

Priorité unique restante : raccorder un fournisseur de cotes **déjà autorisé**, avec preuve de réponse horodatée et droits de données, au flux des vrais MatchInput ; tant qu'aucune cote valide n'est présente, signal commercial **NO_BET**.
