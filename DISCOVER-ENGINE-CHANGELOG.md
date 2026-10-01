# ASTRA DISCOVER ENGINE Ω V2 — reverse-engineering Foot Mercato (2026-10-01)

## Principe
Le moteur n'essaie plus de remplir mécaniquement trois créneaux. Trois reste un plafond automatique quotidien de sécurité, mais la sélection est pilotée par l'opportunité éditoriale et peut rester inférieure à trois.

## Changements V2
- Radar actualité accéléré : cache 5 min, signaux limités à 24 h, couverture renforcée des grandes entités football.
- Scan d'opportunités GitHub Actions toutes les 30 minutes entre 05:17 et 22:47 UTC.
- Publication fail-closed conservée : un scan peut ne rien publier.
- Détection de **material development** : confirmation, autorisation, démenti, refus, verdict, décision/officiel, etc.
- Une évolution matérielle suffisamment tardive n'est plus fusionnée automatiquement avec la rumeur/polémique précédente.
- Bonus de priorité pour les développements matériels fortement sourcés.
- Une breaking news score >= 88, officielle ou matérielle, peut ouvrir immédiatement le prochain créneau libre sans attendre 08:00 / 13:00 / 19:00.
- Les breaking news fortes peuvent remplacer un candidat plus faible avant publication.
- Réécriture du corps des news : suppression des formulations génériques qui entraient en contradiction avec le filtre anti-remplissage.
- RSS : suppression de la promesse artificielle « trois articles par jour » ; formulation en plafond de trois sans quota de remplissage.
- Admin : affichage explicite de la politique `OPPORTUNITY_DRIVEN_MAX_3`.
- CI : `npm run news` + typecheck sur pull request avant intégration.

## Cas de régression ajouté
Le scénario « polémique sur le déplacement de Kylian Mbappé » puis « le Real Madrid l'avait autorisé » doit former deux développements distincts. Deux sources fortes peuvent ensuite corroborer la résolution sans la refusionner avec l'étape précédente.

## Éléments techniques déjà conformes et conservés
- `max-image-preview:large`.
- Images 1200×675.
- `og:image`, `article:published_time`, `article:modified_time`, canonical.
- Sitemap Google News limité aux articles des deux derniers jours avec titre, date, mots-clés et image.
- Auteur éditorial identifié.
- Maillage interne match/compétition + articles liés.

## État
Branche d'implémentation : `astra-discover-footmercato-v2`.
CI PASS le 2026-10-01 : `npm run news` PASS et `npm run typecheck` PASS sur GitHub Actions. Le déploiement public reste à vérifier séparément après fusion.

---

# BetGPT — Discover Opportunity Engine (France)

## Objectif
Remplacer la logique éditoriale automatique « publier 3 articles » par une logique « 0 à 3 articles, seulement si le sujet mérite publication » orientée public français et Google Discover.

## Changements appliqués
- Suppression des nouveaux candidats `slate`/« Programme du jour » dans le moteur automatique.
- Seuil de sélection porté à 70/100.
- Ajout d'un `Discover Opportunity` détaillé : fraîcheur, intérêt France, force des entités, nouveauté, visuel, qualité des sources, angle éditorial.
- Décision interne `PUBLISH`, `REVIEW` ou `REJECT`.
- Rejet automatique des articles programmes génériques, du jargon interne public (`desk BetGPT`, `score interne`, etc.), du vocabulaire SEO espagnol sur les pages fr-FR, des doublons trop proches, du clickbait et des formulations non sourcées.
- Réécriture des titres/chapôs/articles match en français lecteur, sans exposer le pipeline interne.
- Maintien du mode fail-closed : zéro article est autorisé.
- Affichage du score Discover Opportunity dans l'administration éditoriale.
- Mise à jour des textes publics Auteur / Actualités / RSS pour refléter la règle 0–3 articles.

## Tests ajoutés
- Aucun `slate` automatique n'est publié.
- Aucun titre automatique ne commence par « Programme du ».
- Aucun jargon interne du pipeline dans le texte public.
- Aucun vocabulaire espagnol ciblé dans la copie fr-FR.
- Tous les articles générés ont un Discover Opportunity >= 70 et ne sont pas `REJECT`.

## Validation exécutée
Commande ciblée :

`node --experimental-strip-types --import ./scripts/ts-alias.mjs --test src/lib/editorial/editorial.test.ts`

Résultat : 12 tests / 12 PASS.

## Limite de validation
Le `typecheck` complet n'a pas pu être mené à terme dans l'environnement fourni car l'installation NPM complète a expiré pendant la restauration des dépendances. Les tests du moteur éditorial modifié s'exécutent toutefois réellement et passent.

## Fichiers principaux modifiés
- `src/lib/editorial/engine.ts`
- `src/lib/editorial/quality.ts`
- `src/lib/editorial/types.ts`
- `src/lib/editorial/editorial.test.ts`
- `src/routes/admin_.editorial.tsx`
- `src/routes/auteurs_.betgpt-editorial.tsx`
- `src/routes/actualites.index.tsx`
- `src/routes/actualites.$slug.tsx`
- `src/lib/editorial/feed.ts`

## Refonte design / lisibilité (phase Sportytrader-like)
Objectif : moderniser l'apparence générale, aérer les pages et améliorer la lisibilité perçue afin de se rapprocher d'un site football/pro-betting plus premium.

### Changements UI appliqués
- Refonte du thème global : fond plus clair, cartes plus aérées, ombres plus douces, rayons plus généreux, contrastes améliorés.
- Nouveau header sticky plus premium : ruban responsable séparé, navigation blanche/verre, badges France · fr-FR et approche éditoriale sélective.
- Nouveau footer plus propre et plus lisible.
- Refonte de l'accueil :
  - hero principal plus moderne,
  - bloc “À la une” mis en avant,
  - cartes KPI plus lisibles,
  - blocs d'information plus respirants,
  - filtres sous forme de chips/badges,
  - section live plus claire.
- Refonte des cartes d'actualités : un grand article vedette + cartes secondaires + message éditorial public, sans jargon interne.
- Refonte des pages article :
  - header premium,
  - image hero,
  - meilleure hiérarchie typographique,
  - sidebar avec sources / liens / articles liés,
  - paragraphes plus respirants.
- Refonte de l'index Actualités et des rubriques Actualités pour une présentation en cartes illustrées.
- Refonte des cartes match : badges, meilleur espacement, bloc match plus lisible, CTA séparés.

### Fichiers UI principaux modifiés
- `src/styles.css`
- `src/components/shell.tsx`
- `src/routes/index.tsx`
- `src/components/latest-news.tsx`
- `src/components/news-article.tsx`
- `src/components/match-card.tsx`
- `src/routes/actualites.index.tsx`
- `src/routes/actualites.$slug.tsx`

## News Scout / verrou actualité fraîche (phase 2)
- Ajout de `src/lib/editorial/news-scout.server.ts`.
- Radar gratuit via Google News RSS en français (`hl=fr`, `gl=FR`, `ceid=FR:fr`) + possibilité de fournir des RSS HTTPS personnalisés via `BETGPT_NEWS_RSS_URLS`.
- Hiérarchie de sources : `OFFICIAL`, `TIER1`, `OTHER`.
- Une source officielle suffisamment newsworthy peut ouvrir un sujet ; un média isolé ne suffit pas ; sinon deux sources fortes distinctes sont nécessaires.
- Détection d'entités football prioritaires France / Europe / sélections à forte audience française.
- Détection d'événements : blessure/forfait, transfert, coach, composition, record, qualification, sanction/décision officielle, résultat.
- Clustering/déduplication des signaux pour éviter que le même sujet remplisse plusieurs créneaux.
- Cache serveur 10 minutes ; fenêtre de fraîcheur 36 h ; timeout réseau court et fail-closed.
- Branchement direct dans `editionFromDesk()` : le moteur éditorial reçoit désormais les signaux frais avant de sélectionner ses candidats.
- Réécriture de la copie publique des articles news : faits attribués, contexte sportif, conséquences clairement séparées des faits et prochain élément à surveiller ; suppression du jargon de pipeline.

### Tests News Scout
- Un cluster corroboré n'est publié qu'une fois.
- Une source média isolée n'est pas auto-publiée.
- Une source officielle peut ouvrir un sujet.
- Parsing Google News RSS + classification des sources.
- Suite éditoriale : 16/16 PASS.

## Refonte design / phase 2
- Modernisation supplémentaire des pages Match : hero, navigation d'onglets, panneaux, cartes et espaces.
- Les hubs Scores et Résultats utilisent maintenant le même langage visuel : hero clair, chips, KPI, tables respirantes, cartes de rencontres.
- Design inspiré des patterns de sites de pronostics professionnels (navigation compacte, accès compétition, hiérarchie match/cotes/contexte), sans copie de contenu ou d'identité visuelle tierce.

## Phase 3 — 3 publications automatiques quotidiennes + Vercel durable

### Nouvelle politique de publication
- Objectif quotidien explicite : **3 articles qualifiés par jour**.
- Trois créneaux France : **08:00, 13:00, 19:00 Europe/Paris**.
- Si le premier candidat d'un créneau échoue, le moteur continue à tester les candidats suivants au lieu de publier du remplissage.
- Le filtre Discover Opportunity >= 70 reste obligatoire.
- Les programmes génériques restent interdits comme articles Discover auto.
- Les trois structures éditoriales sont différenciées : matin = clés de l'affiche ; midi = forme/données ; soir = dernières informations avant match.
- Le moteur expose désormais `targetPerDay=3`, `plannedCount` et `targetStatus=MET|DEGRADED`.

### Automatisation Vercel
- Ajout de `/api/editorial-run` pour déclencher l'édition automatiquement.
- Ajout de Cron Jobs Vercel en UTC avec gestion heure d'été / heure d'hiver Paris.
- Mars et octobre utilisent deux invocations de sécurité ; l'idempotence empêche les doublons et la bonne invocation est celle qui tombe après l'ouverture locale du créneau.
- Configuration compatible avec la contrainte Hobby « chaque cron au plus une fois par jour » : plusieurs cron jobs quotidiens distincts déclenchent le même endpoint.

### Persistance
- Ajout de `migrations/0003_editorial_ledger.sql`.
- Le journal éditorial est désormais persisté en base via `DATABASE_URL`/Neon lorsqu'il est disponible, au lieu de dépendre uniquement du filesystem éphémère Vercel.
- Fallback fichier/mémoire conservé pour le développement local.
- Sitemap et homepage relisent le journal durable.

### Horodatage
- Suppression du faux backdating : si Vercel exécute un cron en retard, `datePublished` prend l'heure réelle de la première publication, pas l'heure théorique du créneau.

### Validation
- `npm run news` : **16/16 PASS**.
- Le scénario de journée de test atteint maintenant **3/3 articles** avec Discover Opportunity >= 70.
- `npm run test:repairs` : 14 tests passent ; la suite Chat reste bloquée par le `node_modules` incomplet fourni dans l'archive (`zod` absent). Ce point n'est pas déclaré PASS.

## Refonte UI — vague 2 (pages cœur)
- `Pronostics sportifs` : hero premium, badges d'information, tableau encapsulé en carte, blocs Compétitions / Autres entrées modernisés.
- `Classements` : nouveau hero, navigation compétition par chips, cartes compétitions premium.
- `Calendrier` : nouveau hero, filtres compétitions, cartes par ligue, tableau des prochains coups d'envoi modernisé.
- `Blog` : hero éditorial, article vedette grand format, grille de guides illustrés plus aérée.
- `Scores` et `Résultats` : conservation des composants déjà modernisés lors de la vague précédente.
- Navigation complète préservée : aucune route fonctionnelle retirée.

### Vérification de cette vague
- `npm run news` : 16/16 PASS.
- `src/engine/article.test.ts` : 10/10 PASS lors du test de réparation.
- `src/engine/bet-safety.test.ts` : 4/4 PASS lors du test de réparation.
- Suite `test:repairs` globale interrompue uniquement par `ERR_MODULE_NOT_FOUND` sur `node_modules/zod/index.js` dans le ZIP fourni. Ce point reste UNVERIFIED et n'est pas déclaré PASS.

## Reforme Wave 3 — Forum / Chat / Opportunites / Bilan / Statistiques / Outils / Competitions

### Objectif
Etendre la refonte visuelle premium a toutes les surfaces encore datees sans retirer une seule route ni une seule fonctionnalite.

### Changements appliques
- Forum : hero premium, fils en cartes, compteurs live, meilleure hierarchie, table ronde modernisee.
- Fils Forum : interventions agents en cartes aerées, badges, FAQ lisible, lien match mieux mis en avant.
- Chat : page d'accueil du chat repensee, suggestions visibles, cadre premium, bulles/messages et controles modernises.
- Opportunites : nouveau hero, KPI lisibles, filtres en pills, tables mieux encadrees, blocs C1/Europa harmonises.
- Bilan : nouveau hero de transparence, sections et KPI harmonises, onglets modernes, tables plus lisibles.
- Statistiques : hub transforme en grille de cartes data, hero chiffres, navigation par ligue sous forme de chips.
- Outils : hub moderne en cartes avec icones et CTA explicites.
- Competitions : composant central `CupPage` entierement reforme, donc Ligue 1, Premier League, La Liga, Serie A, Bundesliga, Ligue des champions et Ligue Europa beneficient de la meme refonte.
- ChatPanel : boutons d'actions, modes, champ de saisie, bouton envoyer et bulles modernises.

### Preservation fonctionnelle
- Routes avant la Wave 3 : 101.
- Routes apres la Wave 3 : 101.
- Aucune route supprimee.
- Le moteur editorial automatique 3 articles/jour reste intact.

### Verification
- Editorial engine : 16/16 tests PASS.
- Article + bet-safety : 14/14 tests PASS.
- Analyse syntaxique TypeScript ciblee : aucune erreur de syntaxe JSX/TS detectee dans les fichiers Wave 3.
- Typecheck/build global : UNVERIFIED dans cet environnement car l'installation NPM reste tronquee (`@types/node`, `zod` et autres definitions manquantes apres timeout de restauration). Aucun faux PASS declare.


## Déploiement article test — 2026-10-01
- Publication test Mbappé/Real Madrid intégrée ; déploiement Railway relancé depuis le `main` courant avec Nitro `node-server` explicite.
