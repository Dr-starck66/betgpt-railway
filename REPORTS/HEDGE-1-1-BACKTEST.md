# BetGPT — Backtest couverture score exact 1–1

Date du test: 2026-09-27

## Question testée
Comparer un pari principal 1X2 domicile/extérieur à cote >= 1,80 avec le même pari accompagné d'une couverture score exact 1–1 placée AVANT le match.

La mise de couverture est dimensionnée pour annuler la perte de la mise principale si le score final est exactement 1–1:

`hedgeStake = mainStake / (odds11 - 1)`

Le test principal utilise 1 unité de mise principale par pari. Les résultats sont donc directement scalables.

## Dataset principal
Archive BetGPT 2020–2026, replay chronologique avec le modèle Elo/Poisson-Dixon utilisé par le backtest BetGPT. Les paris nuls sont exclus car 1–1 n'est pas une couverture indépendante d'un pari nul.

### Zone cible 1,80–2,50
- Paris: 8 310
- Gagnants principaux: 4 172 (50,20 %)
- Perdants principaux: 4 138
- Pertes finissant 1–1: 1 028 (24,84 % des pertes)

### Sans couverture
- Profit: +704,47 unités
- ROI: +8,48 %
- Drawdown max: 78,81 unités

### Couverture 1–1 systématique — prix BetGPT synthétique
- Mise moyenne de couverture: 0,1508 unité par pari principal
- Profit: +634,70 unités
- ROI sur capital total engagé: +6,64 %
- Drawdown max: 84,31 unités
- Différence de profit vs sans couverture: -69,78 unités

### Stress test des prix du 1–1
Le dataset ne contient pas les cotes bookmaker historiques exactes du score 1–1. Le test ci-dessus emploie donc la cote synthétique BetGPT. En réduisant cette cote pour simuler une marge bookmaker, la couverture se dégrade encore:

| Hypothèse prix 1–1 | Profit couvert | ROI couvert |
|---|---:|---:|
| BetGPT synthétique | +634,70 | +6,64 % |
| Prix théorique sans marge | +532,39 | +5,50 % |
| ~10 % de marge | +374,15 | +3,79 % |
| ~15 % de marge | +278,27 | +2,79 % |
| ~20 % de marge | +167,84 | +1,66 % |

Le portefeuille sans couverture reste à +704,47 unités / +8,48 % dans chacun de ces scénarios.

## Dataset large: toutes les cotes >= 1,80
- Paris: 11 163
- Pertes principales: 5 880
- Pertes finissant 1–1: 1 373 (23,35 %)
- Sans couverture: +771,65 unités, ROI +6,91 %
- Avec couverture BetGPT synthétique: +653,73 unités, ROI +5,08 %

Sur ce dataset large, la couverture réduit légèrement le drawdown sous l'hypothèse de prix synthétique BetGPT (117,69 -> 114,71 unités), mais réduit davantage le profit et le ROI.

## Test anti-surapprentissage
Une règle sélective simple a été apprise sur les premiers 70 % de la zone 1,80–2,50 et testée sur les 30 % chronologiquement suivants.

La meilleure règle trouvée sur train avec le prix synthétique (`p11 >= 14 %`) améliore légèrement le train (+3,43 unités), mais sur le holdout:
- Sans hedge: +230,76 unités, ROI +9,26 %
- Hedge sélectif: +213,84 unités, ROI +7,76 %
- Dégradation: -16,93 unités

=> faux PASS / surapprentissage détecté.

## Conclusion
Sur les données actuellement disponibles, la meilleure stratégie est **sans couverture 1–1 systématique**.

Le 1–1 est bien surreprésenté parmi les défaites du pari principal (environ 23–25 %), donc l'intuition est réelle. Mais une couverture pré-match répétée paie une prime trop souvent; elle réduit le ROI et le profit net. Elle ne doit être activée que si BetGPT trouve à l'avenir un sous-segment hors-échantillon où la cote 1–1 réellement proposée par le bookmaker est suffisamment supérieure à la probabilité estimée.

## Limitation importante
Les archives BetGPT n'enregistrent pas les cotes bookmaker historiques réelles du score exact 1–1 pour chaque match. Les résultats de couverture utilisent donc une cote 1–1 reconstruite/synthétique. Avant promotion en production, il faut brancher et stocker la vraie cote 1–1 pré-match horodatée puis refaire exactement ce test.
