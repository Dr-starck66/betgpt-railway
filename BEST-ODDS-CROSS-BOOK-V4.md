# BetGPT — BEST-ODDS ENGINE cross-bookmaker V4

## Objectif
Le pari principal et le hedge sont deux jambes indépendantes. BetGPT doit prendre la meilleure cote disponible pour chaque jambe, même si elles se trouvent chez deux bookmakers différents.

## Règles implémentées
- Comparaison bookmaker par bookmaker pour le 1N2 principal.
- Comparaison indépendante des scores exacts autorisés: 1-1 ou victoire 2-1 de l'équipe initialement donnée perdante (1-2 après un pick domicile, 2-1 après un pick extérieur).
- Horodatage des snapshots Unibet déjà collectés.
- En mode live, une cote sans timestamp est rejetée; âge maximum par défaut: 5 minutes.
- Le floor de cote principale est fourni par le learner ROI dynamique. Aucune cote sous ce floor n'est jouable.
- La cote principale et la cote de hedge peuvent provenir de bookmakers différents.
- Le hedge reste soumis au moteur sélectif et à son EV.
- ROI-FIRST: même un hedge à EV positive est rejeté s'il dilue le ROI attendu du portefeuille par rapport au pari principal seul.
- En absence de cote fraîche vérifiable: NO_BET / NO_HEDGE.

## Compatibilité recherche
Les anciens snapshots historiques sans timestamp peuvent encore être utilisés uniquement lorsque le mode legacy/research est explicitement autorisé. Le chemin live est fail-closed.

## Limite actuelle
La source BetGPT fournie contient aujourd'hui un connecteur live Unibet/Kambi. Le moteur est multi-bookmaker et prêt à agréger plusieurs flux, mais il ne faut pas prétendre comparer plusieurs opérateurs tant que leurs flux réels n'ont pas été branchés et horodatés.
