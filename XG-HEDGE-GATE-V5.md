# BetGPT ASTRA Ω — XG Hedge Gate V5

## Objectif
Tester l'hypothèse: un hedge exact-score 2-1 adverse ne doit pas être retenu uniquement pour sa grosse cote; le profil pré-match de buts attendus doit rendre ce score plausible.

## Implémentation
Le hedge reste strictement limité à 1-1 ou victoire 2-1 de l'équipe initialement donnée perdante. Pour OPPONENT_2_1, un contexte de scoring optionnel est maintenant accepté avec provenance explicite OBSERVED_XG ou MODEL_LAMBDA. Gate conservateur actuel: total expected goals >= 2.30, expected goals de l'équipe supposée perdante >= 0.92, BTTS >= 0.46 si disponible, Over 2.5 >= 0.40 si disponible. Le 1-1 n'est pas bloqué par ce gate 2-1.

## Replay historique corrigé
Même portefeuille ROI-first que V3, 393 sélections.

- Sans hedge: profit 95.4435 u; capital 393; ROI 24.2859%; max DD 17.2236.
- Hedge sélectif V4: 25 hedges, 5 hits; profit 97.9076 u; capital 396.1905; ROI 24.7123%; max DD 16.3952.
- Hedge + XG Gate V5: 21 hedges, 5 hits; profit 98.1375 u; capital 395.9606; ROI 24.7847%; max DD 16.2811.

Delta V5 vs V4: +0.0724 point de ROI, +0.2300 u de profit, -0.1142 u de drawdown. Le gate retire 4 des 6 hedges 1-2 du replay sans retirer un hedge gagnant dans cet échantillon.

## Faux-PASS / limites
- L'archive BetGPT 2020-2026 ne stocke pas les xG observés pré-match historiques. Le replay utilise donc les lambdas de buts attendus reconstruits chronologiquement par le modèle, pas des xG Understat/Opta observés.
- Le dernier bloc chronologique de 79 sélections contient 0 hedge éligible dans les deux variantes; il ne peut donc pas confirmer l'uplift V5 sur un holdout indépendant.
- Les seuils V5 restent SHADOW et doivent être ré-estimés avec les xG/xGA observés horodatés et les vraies cotes exact-score collectées en live.
- Ce résultat de recherche ne constitue pas une garantie de rendement futur.

## Tests
20/20 PASS sur xG gate + scope hedge + BEST-ODDS cross-bookmaker.
