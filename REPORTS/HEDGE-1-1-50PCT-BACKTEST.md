# BetGPT — Backtest couverture 1–1 à 50 %

Date du test: 2026-09-27

## Question testée
Comparer trois stratégies sur exactement les mêmes paris 1X2 domicile/extérieur à cote >= 1,80:

1. Pari principal seul.
2. Pari principal + couverture score exact 1–1 dimensionnée pour récupérer 100 % de la mise principale si 1–1 arrive.
3. Pari principal + couverture score exact 1–1 dimensionnée pour récupérer seulement 50 % de la mise principale si 1–1 arrive.

Pour une mise principale de 1 unité et une cote 1–1 `O`, la couverture 50 % utilise:

`hedgeStake50 = 0.5 / (O - 1)`

Si le pari principal perd précisément sur 1–1, le résultat combiné est donc environ -0,50 unité au lieu de -1,00 unité.

Comme dans le backtest précédent, les archives ne contiennent pas les vraies cotes bookmaker historiques du score 1–1 pour chaque rencontre. Le test emploie donc la cote 1–1 synthétique BetGPT, identique entre les stratégies comparées.

## Zone cible: cote principale 1,80–2,50

Échantillon: 8 310 paris

### Sans couverture
- Profit: +704,47 unités
- ROI: +8,48 %
- Drawdown max: 78,81 unités

### Couverture 1–1 à 100 %
- Mise moyenne de couverture: 0,1508 unité
- Profit: +634,70 unités
- ROI: +6,64 %
- Drawdown max: 84,31 unités

### Couverture 1–1 à 50 %
- Mise moyenne de couverture: 0,0754 unité
- Profit: +669,59 unités
- ROI: +7,49 %
- Drawdown max: 80,09 unités

### Comparaison
- Le hedge 50 % récupère +34,89 unités de profit par rapport au hedge 100 %.
- Il reste -34,89 unités sous la stratégie sans couverture.
- ROI: 7,49 % contre 6,64 % avec hedge 100 %, mais 8,48 % sans hedge.

## Dataset large: toutes les cotes principales >= 1,80

Échantillon: 11 163 paris

### Sans couverture
- Profit: +771,65 unités
- ROI: +6,91 %
- Drawdown max: 117,69 unités

### Couverture 1–1 à 100 %
- Profit: +653,73 unités
- ROI: +5,08 %
- Drawdown max: 114,71 unités

### Couverture 1–1 à 50 %
- Mise moyenne de couverture: 0,0762 unité
- Profit: +712,69 unités
- ROI: +5,93 %
- Drawdown max: 115,97 unités

## Conclusion

La couverture 1–1 à 50 % est une amélioration nette par rapport à la couverture 100 %: elle sacrifie beaucoup moins de rendement tout en amortissant partiellement les défaites qui terminent 1–1.

Cependant, sur les données disponibles, le meilleur profit et le meilleur ROI restent obtenus sans couverture systématique.

Verdict actuel:

- Sans hedge: meilleur rendement global.
- Hedge 50 %: meilleur compromis si l'objectif est de réduire partiellement certaines pertes tout en limitant le coût de l'assurance.
- Hedge 100 %: dominé par le hedge 50 % sur le rendement.

La prochaine voie rationnelle est de ne pas activer le hedge 50 % sur tous les matchs, mais seulement sur les sous-segments où la probabilité pré-match de 1–1 et la cote réellement proposée rendent l'assurance positive hors-échantillon.
