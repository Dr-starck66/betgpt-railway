# ASTRA TRUE LINEUPS BRICK Ω

## But

Récupérer et afficher les vraies compositions de match sans jamais bloquer une page BetGPT ni transformer une composition probable, partielle ou absente en composition officielle.

## Contrat de preuve

- Source primaire actuelle : ESPN Match Summary, résolue par identifiant d'événement ou par date + équipes.
- Statut `CONFIRMED` uniquement si les deux équipes possèdent exactement 11 titulaires uniques marqués comme titulaires par le fournisseur.
- `PARTIAL` si une feuille existe mais qu'au moins un XI est incomplet.
- `UNVERIFIED` si aucune feuille exploitable n'est disponible.
- Les données fournisseur sont récupérées séparément du loader critique de la page match.
- Une panne ou lenteur du fournisseur ne doit jamais empêcher `/match/*` de s'afficher.

## Résilience page match

- Les dossiers historiques sont résolus avant le refresh live.
- L'hydratation de forme d'équipe est bornée par un budget court.
- Le refresh live et les compositions ont chacun un budget distinct.
- La page principale ne dépend pas de la composition pour rendre son HTML.
- Les guards de build recherchent les régressions qui réintroduiraient un blocage ou un faux `CONFIRMED`.

## Tests adversariaux

1. 11 + 11 titulaires uniques : PASS.
2. 10 + 11 : PARTIAL.
3. doublon dans un XI : PARTIAL.
4. aucune feuille : UNVERIFIED.
5. fournisseur lent/indisponible : la page match reste rendue ; seule la brique compositions peut devenir UNVERIFIED.
