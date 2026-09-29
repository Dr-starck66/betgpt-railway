# BetGPT Hedge Scope Lock V3

## Scope absolu
Le moteur de couverture score exact est volontairement limité à **deux familles** seulement :

1. **1–1** ;
2. **victoire 2–1 de l'équipe que le pronostic principal donnait perdante**.

Orientation obligatoire :
- prono principal **domicile** -> le score adverse autorisé est **1–2** ;
- prono principal **extérieur** -> le score adverse autorisé est **2–1**.

Aucun autre score exact n'est autorisé par ce sous-système. Les scores 0–0, 1–0, 0–1, 2–2, 2–0, 0–2, etc. doivent toujours produire `NO_HEDGE` ici.

## Sélectivité
Même parmi ces deux familles, un hedge n'est pas automatique. Il reste conditionné aux segments validés, au profil du match, à la probabilité modèle, à une vraie cote bookmaker horodatée et à une EV positive. Un score théoriquement autorisé mais non pertinent doit produire `NO_HEDGE`.

## Sécurité
- Une seule couverture maximum par match.
- Jamais de cumul 1–1 + 1–2/2–1.
- Politique actuellement en mode `SHADOW` tant que les cotes exact-score réelles horodatées ne sont pas suffisamment validées.
- L'orientation du 2–1 est vérifiée par invariant : il doit toujours favoriser l'équipe initialement donnée perdante.
