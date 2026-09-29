# BetGPT — Hedge Profitability Benchmark V3

Date: 2026-09-27

## Scope verrouillé
Le hedge score exact BetGPT est limité à :
- 1–1 ;
- victoire 2–1 de l'équipe que BetGPT donnait perdante (1–2 si le pari principal est HOME, 2–1 si le pari principal est AWAY).

Une seule couverture maximum par match. Tous les autres scores sont interdits.

## Benchmark principal
Même portefeuille 1X2, mêmes matchs, mêmes mises principales. Le benchmark obligatoire est le pari principal sans couverture.

### Portefeuille historique complet — 8 310 paris, cote principale 1,80–2,50
- Sans hedge : +704,47 unités ; ROI 8,48 % ; drawdown max 78,81 u.
- 1–1 récupération 50 % systématique : +669,59 u ; ROI 7,49 %.
- 1–1 récupération 100 % systématique : +634,70 u ; ROI 6,64 %.
- 2–1 adverse récupération 50 % systématique : +715,10 u ; ROI 8,35 %.
- 2–1 adverse récupération 100 % systématique : +725,72 u ; ROI 8,23 %.

Conclusion systématique : aucune couverture systématique ne bat le pari simple en ROI. Le 2–1 adverse augmente le profit absolu, mais consomme du capital supplémentaire et reste inférieur au ROI de 8,48 % sans hedge.

## Hedge sélectif — test chronologique 60/20/20
La politique n'est choisie que sur train + validation. Le dernier 20 % reste aveugle jusqu'au test final.

- Train : ROI sans hedge 7,90 % -> hedge sélectif 8,17 % ; profit +25,62 u ; drawdown -1,58 u.
- Validation : 10,87 % -> 11,69 % ; profit +18,40 u ; drawdown -2,18 u.
- Holdout final : 7,82 % -> 8,59 % ; profit +17,01 u ; drawdown -1,64 u.

### Verdict
Sur cet historique, **le hedge sélectif est plus profitable que le pari simple sur le holdout final** :
- +0,77 point de ROI ;
- +17,01 unités de profit ;
- drawdown amélioré de 1,64 unité.

Le résultat est donc PASS en recherche, mais reste SHADOW en production car les archives anciennes ne contiennent pas les vraies cotes bookmaker horodatées des scores exacts. Les cotes rétrospectives utilisées sont reconstruites par le modèle.

## Gate de promotion ajouté
La politique ne peut passer de SHADOW à ACTIVE que si, sur un holdout chronologique suffisant :
1. profit hedgé > profit sans hedge ;
2. ROI hedgé > ROI sans hedge ;
3. drawdown ne se dégrade pas au-delà du seuil autorisé ;
4. échantillon minimal respecté.

Cette règle empêche BetGPT d'activer une couverture qui donne plus de tickets « récupérés » mais détériore le rendement réel.
