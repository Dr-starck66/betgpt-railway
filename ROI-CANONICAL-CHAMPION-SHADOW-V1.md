# BetGPT — Canonical Champion + Expansion Shadow V1

## Champion protégé

- ROI canonique hedgé : **35,676679 %**
- Paris : **178**
- Max drawdown : **5,00 unités**
- Validation chronologique 20 % : **32,225207 %**
- Paris validation : **57**
- Drawdown validation : **3,287 unités**

## Championnats challengers

ER (Eredivisie), PT (Primeira Liga), SC (Premiership écossaise) et TR (Süper Lig) restent disponibles pour collecte, analyse, pages, historique et apprentissage, mais sont désormais **SHADOW**. Toute décision BET issue de ces ligues est transformée en NO_BET avec mise 0 tant qu'une preuve canonique comparable n'existe pas.

## Promotion fail-closed

Une ligue challenger ne peut être promue que si le replay canonique complet, avec exactement les mêmes règles ROI5/xG/hedge, respecte simultanément :

- ROI global >= champion + 0,5 point ;
- ROI de validation >= 32,225207 % ;
- échantillon global et validation au moins aussi grands ;
- drawdown global et validation <= 1,15x le champion.

Le screening OpenFootball positif n'est **pas** considéré comme une preuve canonique suffisante.

## Vérifications

- 74/74 tests ciblés PASS.
- Replay canonique recalculé : 35,676679 %, identique au champion.
- Suite globale : mêmes 6 sous-tests SSR/SEO 404 connus ; aucune nouvelle régression.
- Routes, public et serveur conservés ; fichiers robots/sitemaps/config SEO critiques byte-for-byte identiques au MASTER précédent.
