# BetGPT — Hedge Live Proof V4

## Objectif
Passer du backtest historique à une preuve réelle pré-match, sans activer automatiquement de mise de couverture.

## Scope immuable
Une seule couverture éventuelle :
- 1–1 ; ou
- victoire 2–1 de l'équipe que BetGPT donnait perdante (1–2 après un pick HOME, 2–1 après un pick AWAY).

Tout autre score exact est hors scope.

## Ce que V4 ajoute
1. Extraction des vraies cotes de score exact déjà présentes dans les `BookOdds.cs` du flux live (notamment Unibet lorsqu'elles sont publiées).
2. Orientation automatique du 2–1 adverse selon le sens du pari principal.
3. Registre SHADOW horodaté : cote principale, bookmaker, cote du hedge, mise théorique, EV modèle, décision.
4. Règlement en double comptabilité sur le même match : portefeuille sans hedge et portefeuille hedgé.
5. ROI calculé sur le capital réellement engagé ; le taux de tickets récupérés ne suffit jamais.
6. Gate de promotion existant réutilisé : profit et ROI doivent battre le sans-hedge, drawdown ne doit pas empirer, échantillon minimal obligatoire.

## Règle de production
Le mode reste SHADOW. Une cote reconstruite par le modèle ne peut pas servir de preuve LIVE. Sans cote bookmaker exacte pré-match, la décision est NO_HEDGE.

## Promotion
SHADOW -> ACTIVE uniquement après un échantillon réel suffisant, chronologique, avec un benchmark identique sans couverture. Les résultats historiques ne sont pas une garantie de rendement futur.
