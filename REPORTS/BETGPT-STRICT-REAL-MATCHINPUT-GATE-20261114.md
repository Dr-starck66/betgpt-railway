# ASTRA BetGPT Ω — Verdict du gate strict sur vrais MatchInput (14/11/2026)

**Exécution réelle et reproductible — 12 MatchInput capturés, 0 entrée commerciale admise, 12 refus explicites.**

## Preuve source

- Source : fonction de recherche en lecture seule `astraReadOnlyEspnMatchInputs`, qui réutilise **fetchLeague / parseEvents du moteur original** dans `src/engine/live.ts`. Elle ne prouve pas que la totalité des enrichissements de la production a été réexécutée.
- Archive figée et relue : `REPORTS/BETGPT-ORIGINAL-MATCHINPUT-20261114.json.gz.b64`.
- Horodatage de capture : **2026-11-14T00:16:16.453Z** (14/11 à 01:16:16 Paris). 19 réponses ESPN HTTP 200. **40 objets MatchInput construits**, 12 futurs conservés.
- Taille JSON décompressé : **146 754 octets**.
- SHA-256 du contenu décompressé : **067356381def92c21896a4b13adf6d1fbfa44e694e6981dfcad65b8dd4a92ea4**, vérifié de nouveau le 14/11 dans un Sandbox indépendant sur GitHub commit `4d5522899815490e6d37d1b27e9de682ddff1491`.
- Chaque MatchInput conserve son objet initial, son SHA-256, les sources et dates d'ingestion, les étiquettes de provenance, les éventuelles offres brutes rejetées et une copie de calcul dont `current=[]` et `opening.home/draw/away=0` tant que les cotes ne sont pas certifiées.

## Gate strict de non-commercialisation

Nouveau module : `scripts/betgpt-original-matchinput-strict-gate.mjs`; tests : `scripts/betgpt-original-matchinput-strict-gate.test.mjs`.

Ce contrôle exige **toutes** les conditions suivantes pour envisager un dossier admissible :
1. Identité d'événement et match futur vérifiés, copie originale identique à son SHA-256.
2. Cotes 1X2 réellement observées dans les 5 minutes précédant la capture et avant le coup d'envoi, chaque trio fini et plausible.
3. **Preuve séparée de la réponse brute authentifiée du bookmaker** reliée par ID d'événement, horodatage, nom du bookmaker et SHA-256, avec droits d'utilisation vérifiés. Une simple propriété `observedAt` n'est pas cette preuve.
4. Sources/provider-observed horodatées et fiches de provenance pour repos, déplacement, congestion, importance et absences, **sans faire passer les valeurs synthétiques pour des observations**.
5. Sources observées et vérifiables pour les profils d'équipes, xG et PPDA ; aucun remplacement par les constantes ou l'estimation du moteur.
6. Autorisation commerciale explicite (distincte de la réussite de tests logiciels).

### Sortie effective sur l'archive réelle

```json
{
  "status": "BLOCKED_NO_VERIFIED_MATCHINPUT",
  "archivedSha256": "067356381def92c21896a4b13adf6d1fbfa44e694e6981dfcad65b8dd4a92ea4",
  "checked": 12,
  "accepted": 0,
  "rejected": 12,
  "reasonsCount": {
    "NO_LINKED_AUTHENTICATED_TIMESTAMPED_1X2_QUOTE": 12,
    "MISSING_OBSERVED_CONTEXT": 12,
    "MISSING_PROVIDER_OBSERVED_TEAM_PROFILES": 12,
    "FULLY_OBSERVED_NOT_VERIFIED": 12,
    "COMMERCIAL_READINESS_NOT_VERIFIED": 12
  }
}
```

Code de sortie **0** : la vérification s'est exécutée et a correctement refusé toutes les entrées. `accepted=0` n'est pas une réussite commerciale.

## Audit, régression et contrôles négatifs

- **11/11 PASS** : tests de collecte des vrais MatchInput et régression du défaut de cotations manquantes dans l'historique.
- **9/9 PASS** : nouveaux tests du gate strict, y compris falsification d'une cote avec une marque et un horodatage apparemment légitimes, falsification des observations de profil, altération du MatchInput, mauvaise empreinte et absence de lien authentifié.
- **106/106 PASS** : retest consolidé des tests de collecte, validation prospective, calibration et Pinnacle, sur la branche de recherche (commande Node.js avec chargeurs d'isolation déjà présents, code de sortie `0`).
- Aucune cote absente inventée, aucune donnée estimée promue en observée, aucune clé API ni secret consulté, aucun appel payant.
- Aucune fusion vers main, aucun pari, aucune automatisation ni publication de production.

## Limites réelles

**PASS** : les 12 vrais objets MatchInput du constructeur BetGPT sont archivés avec leur identité et leur intégrité vérifiées, leurs champs estimés signalés et le gate strict testé.

**PARTIAL** : il s'agit de l'étape de construction ESPN du moteur, pas d'un instantané intégral du pipeline enrichi de production. Le stockage brut des réponses ESPN n'est pas garanti par les seules empreintes, bien que les entrées calculées soient archivées.

**FAIL — commercial** : **0 cote de bookmaker authentifiée**, 12/12 dossiers rejetés à cause de preuves de marché et de variables observées insuffisantes. Ce FAIL est la décision souhaitée tant que les données n'existent pas.

**UNVERIFIED** : disponibilité d'un flux bookmaker autorisé et horodaté, entrée MatchInput entièrement observée en production, calibration du modèle complet, rentabilité et ROI.

**Action prioritaire unique** : dans l'environnement BetGPT effectivement autorisé, collecter un *vrai reçu* de cote 1X2 pré-match daté chez un fournisseur licencié et le relier à l'ID de la rencontre et à son MatchInput, sans divulguer la clé et sans engager de frais. Tant que ce reçu n'existe pas, le système conserve **NO_BET**.
