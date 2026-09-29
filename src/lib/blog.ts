export type BlogArticle = {
  slug: string;
  title: string;
  h1: string;
  lead: string;
  keywords: string;
  section: string;
  published: string;
  paragraphs: { h2: string; body: string }[];
  faq: { q: string; a: string }[];
  links: { href: string; label: string }[];
  cluster?: string;
  isNews?: boolean;
};

export const CLUSTER_MEILLEUR_SITE = "meilleur-site";
export const PILLAR_MEILLEUR_SITE = "meilleur-site-paris-sportif-en-ligne";
export const CLUSTER_PRONO_GRATUIT = "prono-gratuit";
export const PILLAR_PRONO_GRATUIT = "pronostic-football-gratuit";
export const CLUSTER_XG = "xg";
export const PILLAR_XG = "xg-football-cest-quoi";

export const CLUSTERS: Record<string, { title: string; pillar: string; pillarH1: string }> = {
  [CLUSTER_MEILLEUR_SITE]: {
    title: "meilleur site de paris sportif en ligne",
    pillar: PILLAR_MEILLEUR_SITE,
    pillarH1: "Meilleur site de paris sportif en ligne",
  },
  [CLUSTER_PRONO_GRATUIT]: {
    title: "pronostic football gratuit",
    pillar: PILLAR_PRONO_GRATUIT,
    pillarH1: "Pronostic football gratuit",
  },
  [CLUSTER_XG]: {
    title: "xG football",
    pillar: PILLAR_XG,
    pillarH1: "xG football : c’est quoi",
  },
};

const DAY = "2026-09-08T08:00:00.000Z";

export const BLOG: BlogArticle[] = [
  {
    slug: "pronostic-football-aujourdhui",
    title: "Pronostic football aujourd’hui : comment lire un match | BetGPT",
    h1: "Pronostic football aujourd’hui : comment lire un match",
    lead: "Un pronostic football aujourd’hui, chez BetGPT, c’est une cote FR, une proba calibrée et une décision Mise / Surveiller / Non. Pas une certitude. 18+.",
    keywords: "pronostic football aujourd'hui, prono foot, analyse match",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Ce que « pronostic aujourd’hui » veut dire ici",
        body: "On ne invente pas les affiches. Le desk prend le calendrier officiel, les scores live, les cotes des books accessibles en France. Le pronostic du jour est la meilleure opportunité au-dessus du seuil, pas « tous les matchs à jouer ». Pour le prix, voir aussi les meilleures cotes ; pour l’écart modèle / marché, le value bet.",
      },
      {
        h2: "Où le trouver",
        body: "Page Opportunités pour la liste. Pari du jour pour le ticket unique. Chaque match a sa fiche : pronostic, analyse, cotes. Le forum reprend le débat des agents.",
      },
      {
        h2: "Ce que ça n’est pas",
        body: "Ce n’est pas un gain garanti, ni un conseil personnalisé. Une cote à 1,90 n’est pas « sûre ». 18+, jeu responsable.",
      },
    ],
    faq: [
      { q: "Où voir les pronostics football du jour ?", a: "Sur betgpt.live : Opportunités, Pari du jour, et la fiche de chaque match." },
      { q: "Les pronos sont-ils gratuits ?", a: "Oui, le desk est lisible sans compte. Les liens Parier sont de l’affiliation." },
    ],
    links: [
      { href: "/opportunities", label: "Opportunités du jour" },
      { href: "/pari-du-jour", label: "Pari du jour" },
      { href: "/pronos-football", label: "Tous les pronos" },
    ],
  },
  {
    slug: "meilleures-cotes-football",
    title: "Meilleures cotes football France : comparer sans se tromper de book | BetGPT",
    h1: "Meilleures cotes football : comparer les books accessibles en France",
    lead: "La meilleure cote football, c’est le prix le plus haut sur le même marché, chez un book accessible depuis la France. BetGPT aligne Unibet, Betclic, NetBet et les autres du desk. 18+.",
    keywords: "meilleures cotes football, comparer cotes, cotes France",
    section: "Cotes",
    published: DAY,
    paragraphs: [
      {
        h2: "Pourquoi la cote change tout",
        body: "Même pronostic, deux cotes : 2,05 ou 1,85. Le ticket n’a pas le même sens. On affiche le book de la cote retenue, pas un nom au hasard.",
      },
      {
        h2: "Où comparer",
        body: "Meilleures cotes, Comparer les cotes, et la fiche /cotes de chaque match. Lien sponsorisé : tu quittes BetGPT vers le book agréé.",
      },
      {
        h2: "France, pas le monde",
        body: "Pas de DraftKings ni de books hors circuit FR. Si un lien 404, on retombe sur l’accueil du book, pas sur une page morte présentée comme le match.",
      },
    ],
    faq: [
      { q: "Quel site a les meilleures cotes ?", a: "Ça change à chaque match. On prend le max du desk FR, match par match." },
      { q: "BetGPT est-il un bookmaker ?", a: "Non. Outil d’information et d’affiliation. 18+." },
    ],
    links: [
      { href: "/meilleures-cotes", label: "Tableau des cotes" },
      { href: "/comparer-cotes", label: "Comparer les cotes" },
      { href: "/opportunities", label: "Value bets" },
    ],
  },
  {
    slug: "value-bet-football",
    title: "Value bet football : définition, edge et quand on ne mise pas | BetGPT",
    h1: "Value bet football : c’est quoi, et quand on passe",
    lead: "Un value bet, c’est une cote plus généreuse que la proba du modèle. Chez BetGPT : edge et EV au-dessus du seuil, sinon Surveiller ou Non. Pas un gain assuré. 18+.",
    keywords: "value bet football, value betting, edge cote",
    section: "Value",
    published: DAY,
    paragraphs: [
      {
        h2: "La définition utile",
        body: "Proba modèle 40 %, cote 3,00 (implicite 33 %). Il y a un écart. S’il est trop petit, on ne joue pas. Le détail mathématique est sur Opportunités ; l’analyse tactique est sur la fiche match.",
      },
      {
        h2: "Premium",
        body: "Les tickets plus nets sont marqués Premium. Mise fixe identique sur tout, ça n’a aucun sens : le desk pondère.",
      },
      {
        h2: "Filet",
        body: "Couverture 50 % de la mise, score exact calculé — pas 1-1 par réflexe si le prono est le nul.",
      },
    ],
    faq: [
      { q: "Un value bet gagne toujours ?", a: "Non. C’est un écart de prix, pas une promesse." },
      { q: "Où sont les value bets du jour ?", a: "Page Opportunités, colonnes Mise et Premium." },
    ],
    links: [
      { href: "/opportunities", label: "Opportunités" },
      { href: "/calculateur-mise", label: "Calculateur de mise" },
    ],
  },
  {
    slug: "score-en-direct-ligue-1",
    title: "Score en direct Ligue 1 : suivre le match et le prono live | BetGPT",
    h1: "Score en direct Ligue 1 : le match, les buteurs, le super pari",
    lead: "Le score en direct Ligue 1 s’affiche dès le coup d’envoi sur BetGPT, avec buteurs et un super pari si le contexte live le justifie. 18+.",
    keywords: "score en direct ligue 1, résultat ligue 1 live, live foot",
    section: "Live",
    published: DAY,
    paragraphs: [
      {
        h2: "Où regarder",
        body: "Bureau, Scores en direct, fiche match. Le score ne doit pas faire sauter toute la page : seul le chiffre bouge.",
      },
      {
        h2: "SEO live",
        body: "Chaque fiche a un résumé live (score, buteurs) pour les requêtes « résultat X Y ». Le forum coupe aussi dès qu’il y a un but.",
      },
      {
        h2: "Super pari",
        body: "En cours de match, un ticket live peut s’ajouter. Ce n’est pas le prono d’avant-match recopié.",
      },
    ],
    faq: [
      { q: "Les scores sont-ils officiels ?", a: "Ils viennent du calendrier live du desk. Un léger décalage reste possible." },
      { q: "Il y a la Ligue 1 seulement ?", a: "Non : cinq grands championnats, C1, Ligue Europa." },
    ],
    links: [
      { href: "/scores-en-direct", label: "Tous les scores" },
      { href: "/ligue-1", label: "Ligue 1" },
      { href: "/pari-en-direct", label: "Pari en direct" },
    ],
  },
  {
    slug: "pronostic-ligue-des-champions",
    title: "Pronostic Ligue des champions : lire une affiche C1 | BetGPT",
    h1: "Pronostic Ligue des champions : méthode BetGPT",
    lead: "Un pronostic Ligue des champions sur BetGPT, c’est le même moteur que le championnat, plus une meilleure opportunité par phase. Cotes FR, pas de match inventé. 18+.",
    keywords: "pronostic ligue des champions, prono C1, analyse champions league",
    section: "Coupes",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Phase de ligue",
        body: "À chaque phase, une meilleure opportunité C1 entre dans Opportunités. Le forum a un fil dédié à la phase, dix répliques minimum.",
      },
      {
        h2: "Rotations",
        body: "En C1 le banc et le calendrier pèsent. L’agent Gestion le dit. L’avocat du diable casse si on sur-interprète un onze.",
      },
      {
        h2: "Liens books",
        body: "Les liens Parier C1 doivent viser le match, sinon l’accueil du book — jamais un 404 vendu comme l’affiche.",
      },
    ],
    faq: [
      { q: "Où sont les pronos C1 ?", a: "Hub Ligue des champions, Opportunités (pastille C1), forum de la phase." },
      { q: "C1 et Ligue 1, même modèle ?", a: "Oui, le moteur est le même. La C1 a en plus le ticket de phase." },
    ],
    links: [
      { href: "/ligue-des-champions", label: "Hub C1" },
      { href: "/forum", label: "Forum C1" },
      { href: "/opportunities", label: "Opportunités" },
    ],
  },
  {
    slug: "pronostic-ligue-europa",
    title: "Pronostic Ligue Europa : affiches, cotes et phase | BetGPT",
    h1: "Pronostic Ligue Europa : ce qu’on publie",
    lead: "Pronostic Ligue Europa : calendrier réel, cotes FR, meilleure opportunité de phase, scores live. Même régime que la C1. 18+.",
    keywords: "pronostic ligue europa, prono europa league, analyse europa",
    section: "Coupes",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Pourquoi l’Europa est bruyante",
        body: "Rotations, voyages, écarts de niveau. Plus de « pièges » qu’en C1. On ne force pas un 1N2 à 1,40.",
      },
      {
        h2: "Où cliquer",
        body: "Hub Ligue Europa, Opportunités, forum de phase, scores live comme les autres matchs.",
      },
    ],
    faq: [
      { q: "Y a-t-il un ticket Europa du jour ?", a: "S’il passe le seuil, oui, dans Opportunités avec pastille Europa." },
    ],
    links: [
      { href: "/ligue-europa", label: "Hub Europa" },
      { href: "/scores-en-direct", label: "Scores" },
    ],
  },
  {
    slug: "classement-ligue-1",
    title: "Classement Ligue 1 : lire le tableau avant de pronostiquer | BetGPT",
    h1: "Classement Ligue 1 : à quoi il sert pour un prono",
    lead: "Le classement Ligue 1 sur BetGPT est le tableau à jour. Il ne remplace pas le prono, il évite de parler dans le vide. 18+.",
    keywords: "classement ligue 1, tableau ligue 1, standing ligue 1",
    section: "Classements",
    published: DAY,
    paragraphs: [
      {
        h2: "Ce qu’on affiche",
        body: "Points, matchs, différence. Mis à jour avec le desk. Pages sœurs : calendrier Ligue 1, pronos Ligue 1, scores.",
      },
      {
        h2: "Ce qu’il ne dit pas",
        body: "Un 3e n’est pas « forcément favori à l’extérieur ». Le modèle 1N2 et les cotes restent le cœur.",
      },
    ],
    faq: [
      { q: "Le classement est-il officiel ?", a: "Il suit le live du desk. En cas d’écart, le site de ligue fait foi." },
    ],
    links: [
      { href: "/classement/ligue-1", label: "Classement Ligue 1" },
      { href: "/calendrier/ligue-1", label: "Calendrier Ligue 1" },
      { href: "/ligue-1", label: "Pronos Ligue 1" },
    ],
  },
  {
    slug: "pari-couverture-score-exact",
    title: "Pari de couverture 50 % : score exact, pas le 1-1 par réflexe | BetGPT",
    h1: "Pari de couverture : 50 % de la mise, score exact calculé",
    lead: "La couverture BetGPT, c’est 50 % de la mise sur un score exact choisi selon le prono — pas 1-1 si le ticket est le nul. 18+.",
    keywords: "pari couverture, score exact, hedge pari sportif",
    section: "Méthode",
    published: DAY,
    paragraphs: [
      {
        h2: "Pourquoi 50 %",
        body: "Le filet n’est pas un second 1N2. Il vise le cas où le prono principal tombe, sans tout perdre, sans viser +50 % magiques.",
      },
      {
        h2: "Pourquoi pas toujours 1-1",
        body: "Si le prono est le nul, 1-1 est le même scénario, pas une couverture. Le score exact vient des lambdas et du plan de jeu.",
      },
    ],
    faq: [
      { q: "La couverture gagne si le prono perd ?", a: "Parfois. Filet, pas assurance tous risques." },
    ],
    links: [
      { href: "/opportunities", label: "Voir les filets" },
      { href: "/calculateur-mise", label: "Calculateur" },
    ],
  },
  {
    slug: "cote-1n2-ou-moins-de-2-5",
    title: "Cote 1N2 ou moins de 2,5 buts : quel marché choisir | BetGPT",
    h1: "1N2 ou moins de 2,5 : quel marché le desk retient",
    lead: "BetGPT compare 1N2 et totaux (dont moins de 2,5). On retient le marché où l’écart cote / modèle est net, pas « le plus joli ». 18+.",
    keywords: "moins de 2.5 buts, cote 1N2, over under football",
    section: "Marchés",
    published: DAY,
    paragraphs: [
      {
        h2: "1N2",
        body: "Victoire domicile, nul, extérieur. Cœur du desk. Les nuls trop souvent pris ont mal vieilli sur l’historique : on les touche si la cote est vraiment large.",
      },
      {
        h2: "Moins de 2,5",
        body: "Marché de volume. Un edge +11 % n’est un ticket que s’il passe calibration et avocat du diable.",
      },
    ],
    faq: [
      { q: "Vous jouez tous les moins de 2,5 ?", a: "Non. Seulement si le marché gagne le classement d’opportunité." },
    ],
    links: [
      { href: "/opportunities", label: "Marchés du jour" },
      { href: "/paris-football", label: "Paris football" },
    ],
  },
  {
    slug: "jeu-responsable-paris-sportifs",
    title: "Jeu responsable et paris sportifs : règles BetGPT, 18+, ANJ | BetGPT",
    h1: "Jeu responsable : ce que BetGPT affiche, et ce qu’on ne promet pas",
    lead: "Paris sportifs : interdit aux mineurs. BetGPT n’est pas un opérateur. Aide : Joueurs Info Service 09 74 75 13 13. Aucun gain n’est garanti. 18+.",
    keywords: "jeu responsable, paris sportifs 18, ANJ, joueurs info service",
    section: "Légal",
    published: DAY,
    paragraphs: [
      {
        h2: "Ce qu’on est",
        body: "Média et comparateur de cotes. Liens Parier = affiliation. Books agréés ANJ de leur côté.",
      },
      {
        h2: "Ce qu’on n’est pas",
        body: "Pas de comptes, pas de mises chez nous, pas de « 500 € → 1500 € en un mois » comme promesse produit.",
      },
      {
        h2: "Aide",
        body: "Joueurs Info Service, gratuit, anonyme. Auto-exclusion : sur le site du bookmaker.",
      },
    ],
    faq: [
      { q: "BetGPT prend des paris ?", a: "Non." },
      { q: "Numéro d’aide ?", a: "09 74 75 13 13 — joueurs-info-service.fr" },
    ],
    links: [
      { href: "/jeu-responsable", label: "Page jeu responsable" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Meilleur site de paris sportif en ligne" },
    ],
  },
  {
    slug: "meilleur-site-paris-sportif-en-ligne",
    title: "Meilleur site de paris sportif en ligne : comparatif France 2026 | BetGPT",
    h1: "Meilleur site de paris sportif en ligne : comment on le juge",
    lead: "Le meilleur site de paris sportif en ligne, en France, n’est pas un slogan : c’est un book agréé ANJ, des cotes hautes sur le match, un lien qui ouvre la bonne affiche. BetGPT compare. On n’accepte aucune mise. 18+.",
    keywords: "meilleur site de paris sportif en ligne, meilleur site paris sportifs, comparatif paris sportifs France",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Ce que « meilleur » veut dire ici",
        body: "Pas le plus gros bonus. La cote la plus haute sur le marché retenu, chez un opérateur accessible depuis la France. Le détail : comparatif bookmakers football, sites légaux ANJ, et cotes ou bonus.",
      },
      {
        h2: "BetGPT n’est pas ce site",
        body: "On est le comparateur. Le « site où tu paries » c’est Betclic, Unibet, NetBet, Winamax, etc. Notre page Meilleures cotes aligne les prix. Liens sponsorisés.",
      },
      {
        h2: "Cinq critères",
        body: "Légal, cote, live, foot (Ligue 1, C1), mobile. Méthode dans comment choisir un site de paris sportifs.",
      },
    ],
    faq: [
      { q: "Quel est le meilleur site de paris sportif en ligne ?", a: "Celui qui propose la meilleure cote sur TON match, parmi les books FR agréés. Ça change à chaque affiche." },
      { q: "BetGPT est-il un site de paris ?", a: "Non. Comparateur et médias. 18+." },
    ],
    links: [
      { href: "/comparer-cotes", label: "Comparer les cotes" },
      { href: "/meilleures-cotes", label: "Meilleures cotes" },
      { href: "/blog/sites-paris-sportifs-legaux-france", label: "Sites légaux France" },
    ],
  },
  {
    slug: "sites-paris-sportifs-legaux-france",
    title: "Sites de paris sportifs légaux en France (ANJ) | BetGPT",
    h1: "Sites de paris sportifs légaux en France",
    lead: "Un site de paris sportifs légal en France est agréé ANJ. BetGPT ne liste que des books accessibles depuis la France. 18+. Joueurs Info Service 09 74 75 13 13.",
    keywords: "sites paris sportifs légaux, ANJ, bookmaker France",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Légal d’abord",
        body: "Sans agrément, pas de « meilleur site ». Le pilier meilleur site de paris sportif en ligne part de là. Liste ANJ côté opérateurs, pas chez nous.",
      },
      {
        h2: "Ce qu’on relie",
        body: "Unibet, Betclic, NetBet, Winamax et les autres du desk. Lien sponsorisé vers le book, pas une fausse fiche match.",
      },
    ],
    faq: [
      { q: "DraftKings est légal en France ?", a: "Non pour le circuit FR du desk. On ne le pousse pas." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Meilleur site en ligne" },
      { href: "/jeu-responsable", label: "Jeu responsable" },
    ],
  },
  {
    slug: "comparatif-bookmakers-football-france",
    title: "Comparatif bookmakers football France : cotes, pas le logo | BetGPT",
    h1: "Comparatif bookmakers football France",
    lead: "Comparatif bookmakers football : on classe les cotes 1N2 du match, pas une note marketing. Le meilleur site de paris sportif en ligne, c’est souvent celui qui paie le plus CE soir. 18+.",
    keywords: "comparatif bookmakers, comparatif sites paris sportifs, cotes football France",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Tableau, pas podium figé",
        body: "Voir Meilleures cotes et la fiche /cotes du match. Unibet / Betclic / NetBet / Winamax : le premier change.",
      },
      {
        h2: "Ligue 1 et C1",
        body: "Même méthode. Guides : parier Ligue 1, parier Ligue des champions.",
      },
    ],
    faq: [
      { q: "Qui gagne le comparatif ?", a: "Personne en dur. La cote du match." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier meilleur site" },
      { href: "/blog/unibet-betclic-netbet-winamax-cotes", label: "Unibet Betclic NetBet Winamax" },
      { href: "/meilleures-cotes", label: "Tableau cotes" },
    ],
  },
  {
    slug: "meilleures-cotes-ou-bonus-paris-sportifs",
    title: "Meilleures cotes ou bonus : ce qui fait le meilleur site de paris | BetGPT",
    h1: "Meilleures cotes ou bonus : ce qui compte",
    lead: "Le bonus n’est pas le meilleur site de paris sportif en ligne. Une cote 2,10 au lieu de 1,90, match après match, pèse plus qu’un bonus à recirculer. 18+.",
    keywords: "bonus paris sportifs, meilleures cotes, meilleur bookmaker",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Le bonus ment souvent",
        body: "Conditions, mises à x5, marchés exclus. On affiche la cote nette. Voir aussi value bet.",
      },
      {
        h2: "Où regarder le prix",
        body: "Comparer les cotes, Opportunités. Affiliation : on est payés au clic, pas pour te vendre le bonus le plus bruyant.",
      },
    ],
    faq: [
      { q: "Vous conseillez les bonus ?", a: "Non. On compare les cotes." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Meilleur site en ligne" },
      { href: "/blog/value-bet-football", label: "Value bet" },
      { href: "/comparer-cotes", label: "Comparer" },
    ],
  },
  {
    slug: "meilleur-site-parier-ligue-1",
    title: "Meilleur site pour parier sur la Ligue 1 | BetGPT",
    h1: "Meilleur site pour parier sur la Ligue 1",
    lead: "Pour la Ligue 1, le meilleur site de paris sportif en ligne est celui qui affiche la meilleure cote 1N2 du match, book FR. BetGPT aligne. 18+.",
    keywords: "parier ligue 1, meilleur site ligue 1, cotes ligue 1",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Ligue 1 = volume",
        body: "Beaucoup de matchs, beaucoup d’écarts de cotes. Scores live et classement Ligue 1 à côté du prono.",
      },
      {
        h2: "Même cocon",
        body: "Revenir au pilier meilleur site de paris sportif en ligne, puis au comparatif bookmakers.",
      },
    ],
    faq: [
      { q: "Un book est-il toujours meilleur en Ligue 1 ?", a: "Non. Match par match." },
    ],
    links: [
      { href: "/ligue-1", label: "Pronos Ligue 1" },
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
      { href: "/classement/ligue-1", label: "Classement Ligue 1" },
    ],
  },
  {
    slug: "meilleur-site-parier-ligue-des-champions",
    title: "Meilleur site pour parier sur la Ligue des champions | BetGPT",
    h1: "Meilleur site pour parier sur la Ligue des champions",
    lead: "C1 : le meilleur site de paris sportif en ligne est encore celui de la meilleure cote FR sur l’affiche, pas le plus de pubs. BetGPT, phase par phase. 18+.",
    keywords: "parier ligue des champions, cotes C1, bookmaker champions league",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Cotes C1",
        body: "Les books se battent sur les grosses affiches. Lien match, pas 404. Voir pronostic Ligue des champions.",
      },
      {
        h2: "Europa aussi",
        body: "Même logique, autre hub. Le cocon revient au pilier meilleur site.",
      },
    ],
    faq: [
      { q: "C1 et Ligue 1, même book ?", a: "Souvent non, la cote max change." },
    ],
    links: [
      { href: "/ligue-des-champions", label: "Hub C1" },
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
      { href: "/blog/pronostic-ligue-des-champions", label: "Prono C1" },
    ],
  },
  {
    slug: "unibet-betclic-netbet-winamax-cotes",
    title: "Unibet, Betclic, NetBet, Winamax : on compare les cotes | BetGPT",
    h1: "Unibet, Betclic, NetBet, Winamax : les cotes, pas le fanion",
    lead: "Unibet, Betclic, NetBet, Winamax : quatre books FR du desk. Aucun n’est « le » meilleur site de paris sportif en ligne en permanence. On prend le prix. 18+.",
    keywords: "Unibet Betclic NetBet Winamax, comparatif cotes, books France",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Pas un classement d’amour",
        body: "Le bouton Parier porte le nom du book qui a la cote. Si Unibet est à 2,20 et Betclic à 2,05, on écrit Unibet.",
      },
      {
        h2: "D’autres books",
        body: "Le desk en ajoute quand ils sont accessibles FR. Voir sites légaux.",
      },
    ],
    faq: [
      { q: "Vous êtes payés par Unibet ?", a: "Liens d’affiliation, plusieurs books. La cote affichée n’est pas vendue au plus offrant." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
      { href: "/blog/liens-affiliation-paris-sportifs", label: "Affiliation" },
      { href: "/opportunities", label: "Opportunités" },
    ],
  },
  {
    slug: "comment-choisir-site-paris-sportifs",
    title: "Comment choisir un site de paris sportifs en France | BetGPT",
    h1: "Comment choisir un site de paris sportifs",
    lead: "Choisir un site de paris sportifs : ANJ, cote, foot, live, retrait. BetGPT sert le critère cote. 18+.",
    keywords: "comment choisir site paris sportifs, avis bookmaker France",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Les 5 points",
        body: "1 légal 2 cote 3 compétitions 4 live 5 jeu responsable. Le pilier meilleur site de paris sportif en ligne les pose. Ici on détaille.",
      },
      {
        h2: "Ne pas choisir au bonus",
        body: "Article cotes ou bonus. Plafonds et auto-exclusion : chez le book, pas ici.",
      },
    ],
    faq: [
      { q: "Un seul compte suffit ?", a: "Plusieurs books = plus souvent la meilleure cote. À toi de voir la charge." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
      { href: "/blog/meilleures-cotes-ou-bonus-paris-sportifs", label: "Cotes ou bonus" },
      { href: "/blog/jeu-responsable-paris-sportifs", label: "Jeu responsable" },
    ],
  },
  {
    slug: "liens-affiliation-paris-sportifs",
    title: "Liens d’affiliation paris sportifs : ce que BetGPT touche | BetGPT",
    h1: "Liens d’affiliation : on le dit, on compare quand même",
    lead: "BetGPT vit de l’affiliation. « Parier » est un lien sponsorisé. Ça n’empêche pas d’afficher la meilleure cote. Meilleur site de paris sportif en ligne = prix, pas le partenaire unique. 18+.",
    keywords: "affiliation paris sportifs, lien sponsorisé, comparateur cotes",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Transparence",
        body: "Bandeau 18+, mentions, CGU. On ne cache pas le modèle. Sans SIRET / IDs affiliés dans Réglages, pas de commission.",
      },
      {
        h2: "Indépendance du prix",
        body: "Si NetBet a la cote, on écrit NetBet. Voir Unibet Betclic NetBet Winamax.",
      },
    ],
    faq: [
      { q: "Le comparatif est-il vendu ?", a: "La cote affichée suit le desk, pas un contrat exclusif." },
    ],
    links: [
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
      { href: "/mentions-legales", label: "Mentions" },
    ],
  },
  {
    slug: "paris-sportifs-live-meilleur-site",
    title: "Paris sportifs live : quel site pour le cash-out et la cote | BetGPT",
    h1: "Paris sportifs live : cote et score, pas le gadget",
    lead: "En live, le meilleur site de paris sportif en ligne est celui dont la cote bouge sans te piéger, pendant que le score est juste. BetGPT affiche le live et un super pari. 18+.",
    keywords: "paris sportifs live, better live, cote live football",
    section: "Comparatif",
    published: DAY,
    cluster: CLUSTER_MEILLEUR_SITE,
    paragraphs: [
      {
        h2: "Score d’abord",
        body: "Sans score fiable, le live est du bruit. Page scores en direct, fiche match, pari en direct.",
      },
      {
        h2: "Cash-out",
        body: "C’est le book, pas nous. On n’est pas l’opérateur. Retour au pilier meilleur site.",
      },
    ],
    faq: [
      { q: "Vous cash-out ?", a: "Non. Chez le bookmaker." },
    ],
    links: [
      { href: "/pari-en-direct", label: "Pari en direct" },
      { href: "/scores-en-direct", label: "Scores" },
      { href: "/blog/meilleur-site-paris-sportif-en-ligne", label: "Pilier" },
    ],
  },
  {
    slug: "pronostic-football-gratuit",
    title: "Pronostic football gratuit : lire les pronos sans payer | BetGPT",
    h1: "Pronostic football gratuit : sans compte, sans abonnement",
    lead: "Un pronostic football gratuit, chez BetGPT, se lit sans payer : cote FR, Mise / Surveiller / Non, fiche match. Pas une certitude. 18+.",
    keywords: "pronostic football gratuit, prono foot gratuit, pronostics gratuits",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Gratuit, pas magique",
        body: "Le desk est public. Tu n’achètes pas un « pack VIP ». Le prono du jour est sur Pari du jour et Opportunités. Fiabilité : voir pronostic football gratuit fiable.",
      },
      {
        h2: "Aujourd’hui, Ligue 1, C1, Europa",
        body: "Même moteur. Guides : pronostic du jour gratuit, Ligue 1 gratuit, C1 gratuit, Europa gratuit, 1N2 gratuit.",
      },
      {
        h2: "Après le prono",
        body: "Si tu cliques Parier, tu vas sur un book FR (lien sponsorisé). BetGPT ne prend pas la mise.",
      },
    ],
    faq: [
      { q: "Les pronostics BetGPT sont-ils gratuits ?", a: "Oui. Pas de paywall. 18+." },
      { q: "Gratuit = moins bon ?", a: "Non. Le modèle est le même. Voir gratuit vs payant." },
    ],
    links: [
      { href: "/opportunities", label: "Opportunités" },
      { href: "/blog/pronostic-football-gratuit-fiable", label: "Fiable ?" },
      { href: "/pronos-football", label: "Tous les pronos" },
    ],
  },
  {
    slug: "pronostic-ligue-1-gratuit",
    title: "Pronostic Ligue 1 gratuit aujourd’hui | BetGPT",
    h1: "Pronostic Ligue 1 gratuit",
    lead: "Pronostic Ligue 1 gratuit sur BetGPT : chaque affiche du calendrier, cote FR, score live. Sans abonnement. 18+.",
    keywords: "pronostic ligue 1 gratuit, prono ligue 1 aujourd'hui, prono ligue 1 gratuit",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Où cliquer",
        body: "Hub Ligue 1, classement, calendrier. Le pilier pronostic football gratuit recadre : ce n’est pas un VIP.",
      },
      {
        h2: "Journée",
        body: "Le forum a un fil par journée, dix répliques. Le desk n’invente pas les matchs.",
      },
    ],
    faq: [
      { q: "Tous les matchs de Ligue 1 ?", a: "Oui, ceux du calendrier live. Mise seulement au-dessus du seuil." },
    ],
    links: [
      { href: "/ligue-1", label: "Hub Ligue 1" },
      { href: "/blog/pronostic-football-gratuit", label: "Prono gratuit" },
      { href: "/blog/pronostic-football-du-jour-gratuit", label: "Du jour" },
    ],
  },
  {
    slug: "pronostic-c1-gratuit",
    title: "Pronostic Ligue des champions gratuit | BetGPT",
    h1: "Pronostic Ligue des champions gratuit",
    lead: "Pronostic C1 gratuit : phase, meilleure opportunité, cotes FR. Même chose que le guide Ligue des champions, sans payer. 18+.",
    keywords: "pronostic ligue des champions gratuit, prono C1 gratuit",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Phase de ligue",
        body: "Un ticket C1 entre dans Opportunités. Détail méthode : pronostic Ligue des champions. Pilier : pronostic football gratuit.",
      },
    ],
    faq: [
      { q: "C1 payante ailleurs ?", a: "Chez nous, non." },
    ],
    links: [
      { href: "/ligue-des-champions", label: "Hub C1" },
      { href: "/blog/pronostic-ligue-des-champions", label: "Méthode C1" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier gratuit" },
    ],
  },
  {
    slug: "pronostic-europa-gratuit",
    title: "Pronostic Ligue Europa gratuit | BetGPT",
    h1: "Pronostic Ligue Europa gratuit",
    lead: "Pronostic Europa gratuit : affiches réelles, cotes FR, phase. 18+.",
    keywords: "pronostic ligue europa gratuit, prono europa gratuit",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Même régime que la C1",
        body: "Voir pronostic Ligue Europa et le pilier pronostic football gratuit.",
      },
    ],
    faq: [
      { q: "Europa dans Opportunités ?", a: "Si le ticket passe le seuil, oui." },
    ],
    links: [
      { href: "/ligue-europa", label: "Hub Europa" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
    ],
  },
  {
    slug: "pronostic-football-gratuit-fiable",
    title: "Pronostic football gratuit fiable : comment juger | BetGPT",
    h1: "Pronostic football gratuit fiable : les chiffres, pas le ton",
    lead: "Un pronostic football gratuit « fiable », c’est un historique (bilan, Brier), pas une phrase sûre. BetGPT publie le bilan. 18+.",
    keywords: "pronostic football fiable, prono gratuit sérieux, fiabilité pronostics",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Où vérifier",
        body: "Page Bilan : tickets, justes, filet. Pas 100 %. Gratuit vs payant n’est pas un argument de vérité.",
      },
      {
        h2: "Ce qui trompe",
        body: "Un prono à 1,50 « qui passe souvent » n’est pas de la value. Voir value bet et 1N2 gratuit.",
      },
    ],
    faq: [
      { q: "Vous affichez les erreurs ?", a: "Oui, le bilan ne garde pas que les réussites." },
    ],
    links: [
      { href: "/ledger", label: "Bilan" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
      { href: "/blog/pronostic-gratuit-vs-payant", label: "Gratuit vs payant" },
    ],
  },
  {
    slug: "pronostic-gratuit-vs-payant",
    title: "Pronostic football gratuit vs payant | BetGPT",
    h1: "Pronostic gratuit vs payant : ce que tu achètes vraiment",
    lead: "Un pronostic football payant n’est pas plus vrai. Chez BetGPT le prono est gratuit ; le clic Parier est de l’affiliation. 18+.",
    keywords: "pronostic payant, pronostic gratuit vs payant, tipster",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Le paywall vend de la rareté",
        body: "Le calendrier est public. Notre modèle aussi, sur le desk. Voir pronostic football gratuit fiable.",
      },
      {
        h2: "On gagne comment",
        body: "Liens sponsorisés, pas un abonnement prono. Article affiliation.",
      },
    ],
    faq: [
      { q: "Un VIP est-il interdit ?", a: "Non. Ici on n’en vend pas." },
    ],
    links: [
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
      { href: "/blog/liens-affiliation-paris-sportifs", label: "Affiliation" },
    ],
  },
  {
    slug: "pronostic-gratuit-value-bet",
    title: "Pronostic football gratuit et value bet | BetGPT",
    h1: "Pronostic gratuit et value bet : le même desk",
    lead: "Le pronostic football gratuit BetGPT n’est un ticket que s’il y a value. Sinon : Surveiller. 18+.",
    keywords: "pronostic value bet, prono gratuit value, edge football",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Gratuit ≠ tout jouer",
        body: "Opportunités sépare Mise et le reste. Guide value bet football.",
      },
    ],
    faq: [
      { q: "Tous les pronos gratuits sont-ils à miser ?", a: "Non." },
    ],
    links: [
      { href: "/blog/value-bet-football", label: "Value bet" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
      { href: "/opportunities", label: "Opportunités" },
    ],
  },
  {
    slug: "pronostic-football-du-jour-gratuit",
    title: "Pronostic football du jour gratuit | BetGPT",
    h1: "Pronostic football du jour gratuit",
    lead: "Le pronostic football du jour gratuit, c’est le ticket unique du desk (Pari du jour) plus la liste Opportunités. 18+.",
    keywords: "pronostic football du jour, prono du jour gratuit, prono aujourd'hui gratuit",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Deux pages",
        body: "Pari du jour = un match. Opportunités = tous les Mise. Voir aussi pronostic football aujourd’hui.",
      },
    ],
    faq: [
      { q: "Et s’il n’y a pas de Mise ?", a: "On ne force pas. Message vide plutôt qu’un faux ticket." },
    ],
    links: [
      { href: "/pari-du-jour", label: "Pari du jour" },
      { href: "/blog/pronostic-football-aujourdhui", label: "Aujourd’hui" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
    ],
  },
  {
    slug: "pronostic-score-exact-gratuit",
    title: "Pronostic score exact gratuit | BetGPT",
    h1: "Pronostic score exact gratuit (couverture)",
    lead: "Le score exact gratuit BetGPT, c’est surtout le filet 50 %, calculé, pas un 1-1 automatique. 18+.",
    keywords: "pronostic score exact gratuit, score exact football, couverture pari",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "Pas le 1N2 recopié",
        body: "Guide pari de couverture. Le 1N2 gratuit est un autre article.",
      },
    ],
    faq: [
      { q: "Vous donnez le score exact de tous les matchs ?", a: "Le filet, sur les tickets Mise. Pas un score magique partout." },
    ],
    links: [
      { href: "/blog/pari-couverture-score-exact", label: "Couverture" },
      { href: "/blog/pronostic-1n2-gratuit", label: "1N2 gratuit" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
    ],
  },
  {
    slug: "pronostic-1n2-gratuit",
    title: "Pronostic 1N2 gratuit : lire la cote | BetGPT",
    h1: "Pronostic 1N2 gratuit",
    lead: "Pronostic 1N2 gratuit : 1, N ou 2, cote FR, décision Mise ou pas. BetGPT. 18+.",
    keywords: "pronostic 1N2, 1N2 gratuit, cote 1N2 football",
    section: "Pronostics",
    published: DAY,
    cluster: CLUSTER_PRONO_GRATUIT,
    paragraphs: [
      {
        h2: "1, N, 2",
        body: "Article 1N2 ou moins de 2,5. Pilier pronostic football gratuit.",
      },
    ],
    faq: [
      { q: "Le nul est-il souvent Mise ?", a: "Rarement. Cote trop juste, historique mauvais. Sauf cote vraiment large." },
    ],
    links: [
      { href: "/blog/cote-1n2-ou-moins-de-2-5", label: "1N2 ou 2,5" },
      { href: "/blog/pronostic-football-gratuit", label: "Pilier" },
    ],
  },
  {
    slug: "xg-football-cest-quoi",
    title: "xG football : c’est quoi l’expected goals | BetGPT",
    h1: "xG football : c’est quoi",
    lead: "Le xG (expected goals), c’est la chance qu’une occasion finisse au fond. Chez BetGPT il nourrit le modèle, pas un score magique. 18+.",
    keywords: "xG football, expected goals c'est quoi, xG foot",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Une occasion, une proba",
        body: "Penalty ≈ 0,76 xG. Frappé des 25 mètres, beaucoup moins. La somme sur un match, c’est le xG équipe. Voir xG vs buts, xG pour et contre.",
      },
      {
        h2: "Pourquoi c’est ouvert",
        body: "Peu de pages FR claires. On relie au pronostic et aux cotes, pas à un jargon de labo.",
      },
      {
        h2: "Limites",
        body: "Article dédié. L’avocat du diable : un xG 2,4–0,6 et 0-1 au tableau, ça arrive.",
      },
    ],
    faq: [
      { q: "xG = buts ?", a: "Non. Chance de but. Voir xG vs buts." },
      { q: "BetGPT publie le xG de chaque match ?", a: "Le modèle s’en sert (lambdas). Le prono reste 1N2 / marchés, 18+." },
    ],
    links: [
      { href: "/blog/xg-vs-buts", label: "xG vs buts" },
      { href: "/blog/xg-et-pronostic-football", label: "xG et prono" },
      { href: "/pronos-football", label: "Pronos" },
    ],
  },
  {
    slug: "xg-vs-buts",
    title: "xG vs buts : pourquoi le tableau ment | BetGPT",
    h1: "xG vs buts : quand le score et les occasions divergent",
    lead: "xG vs buts : une équipe peut « mériter » 2,1 xG et marquer 0. Le score n’est pas le procès. 18+.",
    keywords: "xG vs buts, expected goals vs score, occasions football",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Variance",
        body: "Un match, c’est trop court. Sur une saison, xG et buts se rapprochent. Guide xG Ligue 1.",
      },
      {
        h2: "Pour le prono",
        body: "Un 3-0 volé, on ne sur-réagit pas. Voir limites du xG et xG domicile.",
      },
    ],
    faq: [
      { q: "Le xG a toujours raison ?", a: "Non. Article limites du xG." },
    ],
    links: [
      { href: "/blog/xg-football-cest-quoi", label: "xG c’est quoi" },
      { href: "/blog/limites-du-xg", label: "Limites" },
    ],
  },
  {
    slug: "xg-ligue-1",
    title: "xG Ligue 1 : lire les occasions du championnat | BetGPT",
    h1: "xG Ligue 1",
    lead: "xG Ligue 1 : les occasions valent plus que le classement d’un week-end. Pronos Ligue 1 à côté. 18+.",
    keywords: "xG ligue 1, expected goals ligue 1, stats ligue 1",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Classement et xG",
        body: "Un 5e qui sous-marque, ça rattrape souvent. Page classement Ligue 1 + pilier xG.",
      },
    ],
    faq: [
      { q: "Vous avez un tableau xG Ligue 1 ?", a: "Le desk oriente le prono. Le classement public reste les points." },
    ],
    links: [
      { href: "/ligue-1", label: "Pronos Ligue 1" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier xG" },
      { href: "/classement/ligue-1", label: "Classement" },
    ],
  },
  {
    slug: "xg-ligue-des-champions",
    title: "xG Ligue des champions : occasions et C1 | BetGPT",
    h1: "xG Ligue des champions",
    lead: "xG C1 : une affiche à 0-0 peut être un 1,8–1,6 d’occasions. Utile avant de crier au nul mort. 18+.",
    keywords: "xG ligue des champions, xG C1, stats champions league",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Rotations",
        body: "Le xG d’une titularisation B n’est pas celui du onze A. Prono C1 + xG en direct.",
      },
    ],
    faq: [
      { q: "C1 plus de variance ?", a: "Souvent, moins de matchs. Voir limites du xG." },
    ],
    links: [
      { href: "/ligue-des-champions", label: "Hub C1" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
      { href: "/blog/xg-en-direct", label: "xG live" },
    ],
  },
  {
    slug: "xg-et-pronostic-football",
    title: "xG et pronostic football : comment on s’en sert | BetGPT",
    h1: "xG et pronostic football",
    lead: "Le xG entre dans le prono BetGPT (forces d’attaque / défense), pas à la place de la cote. 18+.",
    keywords: "xG pronostic, expected goals prono, modèle football",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Du xG à la cote",
        body: "Article xG et cotes. Le ticket reste un value bet, pas « plus de xG = 1 ».",
      },
    ],
    faq: [
      { q: "Vous publiez le xG dans le prono ?", a: "Le modèle oui. La fiche parle 1N2, marchés, risques." },
    ],
    links: [
      { href: "/blog/xg-et-cotes", label: "xG et cotes" },
      { href: "/blog/pronostic-football-gratuit", label: "Prono gratuit" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
  {
    slug: "xg-et-cotes",
    title: "xG et cotes bookmakers : le marché a déjà regardé | BetGPT",
    h1: "xG et cotes bookmakers",
    lead: "Les books voient le xG. Un écart xG énorme n’est pas toujours une cote généreuse. D’où le value bet. 18+.",
    keywords: "xG cotes, expected goals bookmaker, marché football",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Le marché n’est pas stupide",
        body: "Comparer les cotes. Si tout le monde a le même xG, l’edge est ailleurs (blessure, onze).",
      },
    ],
    faq: [
      { q: "Un xG élevé = cote basse ?", a: "Souvent. Pas toujours assez pour Mise." },
    ],
    links: [
      { href: "/comparer-cotes", label: "Comparer" },
      { href: "/blog/value-bet-football", label: "Value bet" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
  {
    slug: "xg-domicile-exterieur",
    title: "xG domicile et extérieur | BetGPT",
    h1: "xG domicile / extérieur",
    lead: "Le xG domicile n’est pas le xG extérieur. L’ajustement terrain entre dans le prono. 18+.",
    keywords: "xG domicile, xG extérieur, home advantage xG",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Pas +0,3 but magique",
        body: "Ça dépend de l’équipe. Voir xG pour et contre.",
      },
    ],
    faq: [
      { q: "Tout le monde marque plus à domicile ?", a: "En moyenne. Pas chaque club, chaque saison." },
    ],
    links: [
      { href: "/blog/xg-pour-xg-contre", label: "xG pour / contre" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
  {
    slug: "xg-pour-xg-contre",
    title: "xG pour et xG contre : attaque et bloc | BetGPT",
    h1: "xG pour et xG contre",
    lead: "xG pour = occasions créées. xG contre = occasions subies. Les deux, pas seulement l’attaque. 18+.",
    keywords: "xG pour, xG contre, xGA football",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Un bloc bas",
        body: "Peu de xG contre, peu de xG pour. Matchs à moins de 2,5. Guide marchés.",
      },
    ],
    faq: [
      { q: "xGA ?", a: "xG against : xG contre." },
    ],
    links: [
      { href: "/blog/cote-1n2-ou-moins-de-2-5", label: "Moins de 2,5" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
  {
    slug: "xg-en-direct",
    title: "xG en direct pendant un match | BetGPT",
    h1: "xG en direct",
    lead: "xG live : les occasions s’empilent pendant le match. Un 0-0 à 1,4–0,2 xG n’est pas le même 0-0. Super pari sur la fiche. 18+.",
    keywords: "xG live, xG en direct, live stats football",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Score + occasions",
        body: "Page scores en direct, fiche match. Le super pari live lit le contexte, pas seulement le 0-0.",
      },
    ],
    faq: [
      { q: "Vous affichez un compteur xG live ?", a: "Le live, ce sont score, buteurs, incidents. Le modèle ajuste." },
    ],
    links: [
      { href: "/scores-en-direct", label: "Scores" },
      { href: "/pari-en-direct", label: "Pari en direct" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
  {
    slug: "limites-du-xg",
    title: "Limites du xG : ce que l’indicateur ne dit pas | BetGPT",
    h1: "Limites du xG",
    lead: "Le xG ignore le contexte (expulsion, 10 contre 11, vent). BetGPT : agents + avocat du diable. 18+.",
    keywords: "limites xG, xG pas fiable, critique expected goals",
    section: "xG",
    published: DAY,
    cluster: CLUSTER_XG,
    paragraphs: [
      {
        h2: "Ce qui casse le xG",
        body: "Un but contre son camp, un penalty sifflé, un gardien hors norme. xG vs buts le montre.",
      },
      {
        h2: "Donc",
        body: "On s’en sert. On ne prie pas. Retour au pilier xG football.",
      },
    ],
    faq: [
      { q: "Vous jetez le xG ?", a: "Non. On le borne." },
    ],
    links: [
      { href: "/blog/xg-vs-buts", label: "xG vs buts" },
      { href: "/forum", label: "Forum agents" },
      { href: "/blog/xg-football-cest-quoi", label: "Pilier" },
    ],
  },
];

export function blogBySlug(slug: string): BlogArticle | undefined {
  return BLOG.find((a) => a.slug === slug);
}

export function relatedArticles(slug: string): BlogArticle[] {
  const cur = BLOG.find((a) => a.slug === slug);
  const rest = BLOG.filter((a) => a.slug !== slug);
  if (!cur?.cluster) return rest;
  return [
    ...rest.filter((a) => a.cluster === cur.cluster),
    ...rest.filter((a) => a.cluster !== cur.cluster),
  ];
}

export function clusterArticles(cluster: string): BlogArticle[] {
  return BLOG.filter((a) => a.cluster === cluster);
}
