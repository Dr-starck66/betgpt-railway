# ASTRA BetGPT Ω — Évaluation chronologique des probabilités (14 novembre 2026)

**État : PASS pour le noyau Elo–Poisson historique testé, PARTIAL pour la qualité scientifique, UNVERIFIED pour le modèle complet en production et tout avantage de pari.**

## Périmètre exact

Cette expérience reproduit le **noyau de probabilité Elo–Poisson de src/engine/backtest.ts**, avec les paramètres historiques inchangés, en réutilisant la fonction **goalMatrix** déjà présente dans src/engine/math.ts. **Elle ne teste pas le modèle live complet à six modèles** de src/engine/models.ts ; pour cela il manque les entrées pré-match historiques datées (xG, absences, profils d'équipes, PPDA, cotes observées, etc.). Aucune entrée absente n'a été inventée.

Sources : Football-Data.co.uk Premier League, CSV E0.

| Saison | Rôle | Matchs | SHA-256 du CSV réel |
|---|---|---:|---|
| 2023/24 | Initialisation Elo et fréquence naïve | 380 | b2e057b0ed959f198b0f63d2391c01239f3608e6de5db68edab3f88e04d07ff3 |
| 2024/25 | Test chronologique 1 | 380 | a0fb4e281b6f0e0fce66ac4c6bca53e54686d2db6054b5eb49b90decf161c12f |
| 2025/26 | Test chronologique 2 | 380 | 25b1ecbf34c961fbe9a3a3b3bf906a6c7cf76121d4605ed11a1106cc4d15de7f |

380 + 380 + 380 = 1 140 observations, dont **760 évaluées hors initialisation**. Aucune ligne historique rejetée, aucun doublon. Source réelle récupérée via HTTPS dans un Sandbox Vercel isolé.

## Prévention vérifiée des fuites temporelles

- Seuls la date de match, les deux équipes, leurs classements Elo calculés depuis les matchs précédents et les fréquences d'issues antérieures interviennent avant prédiction.
- Les coefficients historiques restent fixés ; avantage Elo domicile +55, mise à jour Elo K=16, facteur Dixon-Coles rho −0,1.
- **Toutes les rencontres d'un même jour sont prédites avant de révéler le moindre score de ce jour.** Les ratings ne sont mis à jour qu'après la journée.
- Scores finaux, issue FTR et cotes de clôture sont interdits à la prédiction. Les prix Bet365 de clôture sont utilisés uniquement après la prédiction, pour une comparaison rétrospective non tradable.
- Les scores finaux incohérents avec FTR sont rejetés, de même que deux rencontres d'un même club le même jour ou des doublons.
- Contrôle adversarial sur les 760 matchs réels : toutes les cotes Bet365 de clôture mises à zéro ; **SHA des prédictions inchangé, Brier du modèle inchangé, comparateur rétrospectif supprimé**. Code de sortie 0.

SHA-256 déterministe du flux de probabilités des 760 rencontres :
bbe3267c91679a44190e853f2a650892863e7d436f9df7373234bdde5773f346

## Mesures réellement calculées

Plus bas est meilleur pour Brier et log-loss. Brier calculé sur trois issues domicile/nul/extérieur.

| Indicateur | 2024/25 (380) | 2025/26 (380) | Total (760) |
|---|---:|---:|---:|
| Brier Elo–Poisson BetGPT | 0,623144 | 0,619951 | **0,621547** |
| Brier référence fréquence historique | 0,656344 | 0,656163 | 0,656254 |
| Brier Bet365 clôture, diagnostic a posteriori | 0,575775 | 0,608243 | **0,592009** |
| Delta Brier modèle − fréquence historique | −0,033200 | −0,036212 | **−0,034706** |
| Intervalle bootstrap exploratoire par journée sur le delta Brier | [−0,047153 ; −0,019551] | [−0,050378 ; −0,021802] | **[−0,044254 ; −0,024313]** |
| Delta Brier modèle − marché à la clôture | +0,047369 | +0,011708 | **+0,029539** |
| Log-loss Elo–Poisson | 1,036136 | 1,031684 | 1,033910 |
| Bonne prédiction de l'issue la plus probable | 47,8947 % | 49,7368 % | **48,8158 %** |

Les deux saisons montrent une amélioration par rapport à une référence très simple ; le marché à la clôture reste meilleur. L'intervalle bootstrap à 95 % (2 000 rééchantillonnages de **journées complètes**, graine figée) est **exploratoire** : les dépendances entre les rencontres successives des mêmes équipes ne sont pas intégralement prises en compte.

### Calibration par issue, 760 matchs

| Issue | Moyenne prédite | Fréquence observée |
|---|---:|---:|
| Domicile | 41,3426 % | 41,7105 % |
| Nul | **30,1764 %** | **25,9211 %** |
| Extérieur | **28,4810 %** | **32,3684 %** |

ECE top-classe, 10 classes de confiance : **0,056585**. **Défaut non masqué : surestimation des nuls de +4,2553 points et sous-estimation des victoires extérieures de −3,8874 points.**

## Preuve → correction → retest

- Première exécution de l'auditeur : **8/10 PASS, 2 FAIL** (absence de rejet d'un FTR incohérent, faux excès de confiance statistique sur un seul match).
- Corrections : cohérence FTR/buts, rejet du double emploi d'une équipe dans la même journée, bootstrap par journées avec refus si moins de 100 matchs ou de 50 journées ; libellé de résultat explicitement exploratoire.
- Nouvelle exécution : **11/11 PASS** pour le nouveau module, puis **55/55 PASS** pour l'ensemble des composants Pinnacle. Commandes exécutées réellement sous Node.js 24.22.3 :
  - node --test scripts/betgpt-elo-walk-forward.test.mjs scripts/audit-pinnacle-historical.test.mjs scripts/probe-pinnacle-odds.test.mjs src/engine/pinnacle-odds-api-adapter.test.ts src/engine/pinnacle-value-research.test.ts
  - node scripts/betgpt-elo-walk-forward.mjs
- Codes de sortie : **SUITE_EXIT=0**, **REAL_EXIT=0** sur le commit d0ca519.
- Contrôle adversarial sur les 760 vrais matchs : **samePredictionHash=true**, **samePredictiveBrier=true**, **marketComparatorWithheld=true**, code de sortie 0.
- Aucune modification de la production, aucun secret, aucun pari automatique, aucune fusion.

## Conclusion et limites

**PASS logiciel et reproductibilité** : noyau historique Elo–Poisson, ordre causal, 760 observations réelles, métriques, absence d'utilisation prédictive des cotes de clôture.

**PARTIAL scientifique** : supériorité exploratoire face à une fréquence naïve, mais scores inférieurs au benchmark de clôture, et biais de calibration sur nuls et victoires extérieures. Cela ne valide pas une supériorité économique.

**UNVERIFIED** : vraie validation hors échantillon du stack complet de BetGPT, disponibilité de données pré-match autorisées, cotes Pinnacle actuelles, value bets, ROI, CLV, performance en production.

**Étape scientifique prioritaire** : constituer une série de snapshots pré-match horodatés de toutes les entrées du stack live, avec provenance et droits de diffusion vérifiés, puis une évaluation prospectivement figée. Aucun signal de mise ne doit être autorisé à partir de ce rapport historique seul.
