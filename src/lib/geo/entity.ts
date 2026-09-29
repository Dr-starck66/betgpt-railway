import { SITE_URL } from "@/lib/programmatic";

/** Editorial revision of these pages. Not refreshed per request. */
export const GEO_REVISION = "2026-09-23";

export type GeoSection = {
  h2: string;
  paragraphs: string[];
  items?: string[];
};

export type GeoDoc = {
  path: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  updated: string;
  indexable: boolean;
  sections: GeoSection[];
  links: { href: string; label: string }[];
};

export const GEO_PAGES: GeoDoc[] = [
  {
    path: "/about",
    title: "À propos de BetGPT — analyse football",
    description:
      "BetGPT est une plateforme d’analyse et de pronostics football. Elle ne prend pas de mises. Les chiffres publics sont ceux du bilan, avec la taille d’échantillon.",
    h1: "Qu’est-ce que BetGPT ?",
    answer:
      "BetGPT est une plateforme d’analyse et de pronostics football assistée par des modèles. Elle publie des estimations avant le coup d’envoi, les scores lorsqu’ils sont connus, et un bilan des pronostics enregistrés. BetGPT n’est pas un bookmaker et n’accepte pas de mises.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Ce que BetGPT fait",
        paragraphs: [
          "Le site couvre les matchs présents dans son bureau : Ligue 1, Premier League, La Liga, Bundesliga, Serie A, Ligue des champions et Ligue Europa, lorsque les données de calendrier sont disponibles.",
          "Chaque fiche de match sépare le pronostic (issue 1-N-2 la plus probable selon le modèle), une mise value éventuelle, et le score exact traité comme un filet distinct.",
        ],
      },
      {
        h2: "Ce que BetGPT ne fait pas",
        paragraphs: [
          "BetGPT ne prend pas de paris, ne garantit aucun gain, et ne publie pas un taux de réussite marketing sans l’échantillon correspondant.",
          "Aucune biographie de journaliste n’est inventée. Les textes de match sont compilés à partir des sorties du modèle et des faits de la fiche (équipes, horaire, score s’il existe).",
        ],
      },
      {
        h2: "Limites",
        paragraphs: [
          "Une probabilité n’est pas une certitude. Un classement Score Hunter 0–100 n’est pas la probabilité qu’un score exact se réalise.",
          "Si un score, une cote ou une statistique n’est pas dans les données, la page doit le dire ou masquer la section. Elle ne doit pas fabriquer une valeur plausible.",
        ],
      },
    ],
    links: [
      { href: "/methodology", label: "Méthodologie" },
      { href: "/data-sources", label: "Sources de données" },
      { href: "/editorial-policy", label: "Politique éditoriale" },
      { href: "/prediction-history", label: "Historique des pronostics" },
      { href: "/ledger", label: "Bilan chiffré" },
      { href: "/press", label: "Citer BetGPT" },
    ],
  },
  {
    path: "/methodology",
    title: "Méthodologie BetGPT — modèles et limites",
    description:
      "Comment BetGPT estime un match : Poisson / Dixon-Coles, archive de scores, séparation entre modèle et texte. Sans taux de réussite inventé.",
    h1: "Comment BetGPT produit une estimation",
    answer:
      "BetGPT estime un match avec un modèle de buts de type Poisson / Dixon-Coles, alimenté par l’historique de scores lorsqu’il est disponible, puis rédige la fiche à partir de ces sorties. Le texte ne modifie pas la probabilité.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Séparation stricte",
        paragraphs: [
          "Les données (calendrier, score, cotes listées) restent distinctes du modèle (probabilités) et de la présentation (titre, article, FAQ).",
          "Une optimisation de page ne change pas une probabilité. Le compilateur éditorial n’a pas le droit d’arrondir un résultat sportif qui n’est pas dans la fiche.",
        ],
      },
      {
        h2: "Score Hunter",
        paragraphs: [
          "Le score 0–100 de Score Hunter mélange l’estimation du modèle (70 %), la fréquence de ligue si l’échantillon atteint 30 matchs (20 %) et un ajustement clubs (10 %). Un échantillon trop petit ramène le score vers 50.",
          "Ce score classe des matchs entre eux. La probabilité du score exact est affichée à part, quand le modèle l’a calculée.",
        ],
      },
      {
        h2: "Validation",
        paragraphs: [
          "Un pronostic publié avant le coup d’envoi est conservé, y compris s’il est perdant. Après le coup d’envoi il est verrouillé.",
          "Le bilan public compte les issues 1-N-2 éligibles. Le score exact (filet) est une simulation séparée, sur une fraction de mise, et n’est pas le pronostic principal.",
          "Les métriques affichées sur le bilan (taux de hits, ROI, Brier, taille d’échantillon) viennent du registre calculé. Cette page ne recopie aucun pourcentage figé.",
        ],
      },
    ],
    links: [
      { href: "/data-sources", label: "Sources" },
      { href: "/ledger", label: "Bilan" },
      { href: "/prediction-history", label: "Registre" },
      { href: "/score-hunter", label: "Score Hunter" },
    ],
  },
  {
    path: "/editorial-policy",
    title: "Politique éditoriale BetGPT",
    description:
      "Règles de publication BetGPT : avant-match et résultat connus sont distingués, les données manquantes ne sont pas inventées, les textes automatiques sont assumés.",
    h1: "Politique éditoriale",
    answer:
      "BetGPT distingue une analyse d’avant-match d’un résultat déjà connu. Une donnée absente reste absente. Les articles de match sont produits automatiquement à partir du modèle et des faits de la fiche, sans auteur humain inventé.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Avant le match et après",
        paragraphs: [
          "Avant le coup d’envoi, la page donne le pronostic, la probabilité et la date de génération lorsqu’elles existent.",
          "Quand le score final est connu, la page le montre et indique si le pronostic enregistré est gagnant, perdant ou remboursé. Elle ne réécrit pas le pronostic d’origine.",
        ],
      },
      {
        h2: "Ce qui est interdit",
        paragraphs: [
          "Inventer un score, une cote, un effectif, un témoignage, un partenariat, une certification ou un nombre d’utilisateurs.",
          "Publier un pourcentage de réussite sans la taille de l’échantillon affichée à côté.",
        ],
        items: [
          "Pas de journaliste fictif.",
          "Pas de citation ChatGPT, Gemini ou Perplexity fabriquée.",
          "Pas de texte identique d’un match à l’autre pour remplir la page.",
        ],
      },
    ],
    links: [
      { href: "/redaction", label: "Page rédaction" },
      { href: "/methodology", label: "Méthodologie" },
      { href: "/about", label: "À propos" },
    ],
  },
  {
    path: "/data-sources",
    title: "Sources de données BetGPT",
    description:
      "Sources réellement utilisées par BetGPT : scores et calendriers ESPN, cotes des books français lorsqu’elles sont listées, modèle interne. Pas de source inventée.",
    h1: "D’où viennent les données",
    answer:
      "Les calendriers, scores et écussons proviennent des flux publics ESPN lorsque le bureau les a récupérés. Les cotes affichées sont celles des opérateurs français listées sur la fiche. Le modèle interne estime les probabilités. Si une source n’a pas répondu, la donnée est manquante.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Scores et calendrier",
        paragraphs: [
          "L’archive et le direct s’appuient sur les événements ESPN (identifiants de match, scores, statut). Un match absent de cette base n’est pas inventé pour compléter une page.",
        ],
      },
      {
        h2: "Cotes",
        paragraphs: [
          "Les cotes viennent des opérateurs français intégrés au bureau (par exemple Unibet) au moment de la collecte. Une cote absente n’est pas remplacée par une cote plausible.",
        ],
      },
      {
        h2: "Fréquence",
        paragraphs: [
          "Le bureau live est rafraîchi quand le serveur le relit. La date affichée sur une fiche est celle de la donnée, pas une date de modification artificielle à chaque visite.",
          "Si la collecte a plus de trois minutes pendant un match encore indiqué en cours, la page parle de dernier score connu. Elle ne présente pas un score figé comme un direct confirmé à la seconde.",
          "Un changement de score ou de statut entre deux collectes est journalisé (ancienne valeur, nouvelle valeur, heure). Ce journal n’est pas une page publique de marketing.",
        ],
      },
      {
        h2: "Ce qui n’est pas une source",
        paragraphs: [
          "BetGPT n’affirme pas un partenariat officiel avec un diffuseur, une ligue ou un opérateur au-delà de l’affichage des cotes et des liens d’affiliation marqués comme tels.",
        ],
      },
    ],
    links: [
      { href: "/methodology", label: "Méthodologie" },
      { href: "/scores-en-direct", label: "Scores en direct" },
      { href: "/resultats-football", label: "Résultats football" },
      { href: "/score-data-methodology", label: "Méthode des scores" },
      { href: "/ledger", label: "Bilan" },
    ],
  },
  {
    path: "/prediction-history",
    title: "Historique des pronostics BetGPT",
    description:
      "Comment lire l’historique BetGPT : pronostic enregistré avant le coup d’envoi, verrouillage, résultat réel, données manquantes laissées vides.",
    h1: "Historique des pronostics",
    answer:
      "Chaque pronostic éligible est enregistré avant le coup d’envoi avec son marché, sa probabilité, sa cote et un horodatage. Après le coup d’envoi il n’est plus modifié en silence. Le résultat réel n’est inscrit que lorsqu’un score est connu.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Champs conservés",
        paragraphs: [
          "Lorsqu’ils existent dans le registre : match, compétition, coup d’envoi, équipes, type de marché, probabilité annoncée, cote, date d’enregistrement, version du moteur, hash, score final, issue gagné / perdu / remboursé.",
        ],
        items: [
          "generatedAt : recordedAt",
          "modelVersion : engineVersion quand il est stocké",
          "identifiant immuable : predictionHash quand le pronostic est antérieur au coup d’envoi",
          "settledAt : le score n’est écrit qu’une fois connu",
        ],
      },
      {
        h2: "Lecture du bilan",
        paragraphs: [
          "Les pourcentages et le ROI du bilan sont calculés sur les lignes éligibles, avec l’échantillon affiché. Cette page ne republie pas un taux figé.",
          "Une ligne sans score final reste non évaluée. Elle n’est pas complétée avec un score inventé.",
        ],
      },
    ],
    links: [
      { href: "/ledger", label: "Bilan vérifié" },
      { href: "/methodology", label: "Méthodologie" },
      { href: "/changelog", label: "Journal des pages" },
    ],
  },
  {
    path: "/press",
    title: "Presse et citations — BetGPT",
    description:
      "Comment citer BetGPT : description, logo, URL canonique et méthodologie. Aucun article de presse n’est inventé ici.",
    h1: "Citer BetGPT",
    answer:
      "BetGPT est une plateforme d’analyse football assistée par modèle, publiée sur https://betgpt.live. Pour citer : « BetGPT (betgpt.live) ». Cette page ne liste aucune retombée presse qui n’a pas été observée.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Description courte",
        paragraphs: [
          "BetGPT publie des estimations de matchs de football, les scores lorsqu’ils sont connus, et un bilan des pronostics enregistrés avant le coup d’envoi.",
        ],
      },
      {
        h2: "Description longue",
        paragraphs: [
          "Le site couvre les grandes compétitions européennes présentes dans son bureau. Les probabilités viennent d’un modèle de buts. Les textes de fiche sont compilés automatiquement à partir de ces sorties et des faits disponibles. BetGPT n’est pas un opérateur de jeux.",
        ],
      },
      {
        h2: "Éléments de marque",
        paragraphs: [
          "Nom : BetGPT. URL canonique : https://betgpt.live. Langue : français. Logo : /logo-betgpt-pronostics-football.png.",
        ],
        items: [
          "Méthodologie : /methodology",
          "Sources : /data-sources",
          "Bilan : /ledger",
        ],
      },
      {
        h2: "Demandes de marque, sans manipulation",
        paragraphs: [
          "Des formulations utiles existent : BetGPT, BetGPT pronostic, BetGPT football, BetGPT avis, BetGPT analyse match. Elles décrivent le site. BetGPT ne génère pas de fausses recherches, de clics artificiels, ni de suggestions Google.",
        ],
      },
    ],
    links: [
      { href: "/about", label: "À propos" },
      { href: "/methodology", label: "Méthodologie" },
      { href: "/pronostics-sportifs", label: "Pronostics sportifs" },
      { href: "/rapports/precision", label: "Rapport de précision" },
      { href: "/logo-betgpt-pronostics-football.png", label: "Logo" },
    ],
  },
  {
    path: "/changelog",
    title: "Journal des modifications BetGPT",
    description:
      "Dates de création et de modification des pages d’entité BetGPT, et où voir les changements de pronostic par match.",
    h1: "Journal des modifications",
    answer:
      "Les pages d’explication (à propos, méthode, sources, politique, presse) ont une date de révision éditoriale fixe. Les changements de pronostic d’un match sont portés par les versions enregistrées sur la fiche, pas par une date rafraîchie à chaque visite.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Pages d’entité",
        paragraphs: [
          "La révision éditoriale de cette couche est le 23 septembre 2026. Elle n’est pas avancée automatiquement à chaque requête.",
        ],
      },
      {
        h2: "Pronostics",
        paragraphs: [
          "Sur une fiche de match, les versions conservent un horodatage, une version de modèle, un hash d’entrée et une raison de changement lorsqu’ils ont été enregistrés.",
          "Un résultat sportif manquant reste non évalué.",
        ],
      },
    ],
    links: [
      { href: "/changelog.json", label: "Version machine (JSON)" },
      { href: "/prediction-history", label: "Historique des pronostics" },
    ],
  },
  {
    path: "/score-data-methodology",
    title: "Méthode des scores BetGPT",
    description:
      "D’où viennent les scores BetGPT, à quelle fréquence ils sont relus, comment une correction est tracée, et ce que le site ne garantit pas.",
    h1: "Comment BetGPT affiche un score",
    answer:
      "Un score BetGPT est celui reçu du bureau, lui-même alimenté par les événements ESPN lorsqu’ils ont été collectés. S’il n’y a pas de score, la page ne met pas 0–0 à la place. Un match en direct dont la collecte est en retard est présenté comme dernier score connu.",
    updated: GEO_REVISION,
    indexable: true,
    sections: [
      {
        h2: "Source",
        paragraphs: [
          "Les calendriers, statuts et scores viennent des flux publics ESPN quand le serveur les a lus. BetGPT n’est pas le détenteur officiel du match et n’invente pas un buteur, un carton ou une minute absents du flux.",
        ],
      },
      {
        h2: "Fraîcheur",
        paragraphs: [
          "La fiche garde l’heure de collecte du bureau. Pendant un match, un âge supérieur à trois minutes retire l’étiquette de direct confirmé. dateModified d’une page ne change pas à chaque rechargement visiteur.",
        ],
      },
      {
        h2: "Corrections",
        paragraphs: [
          "Si le score ou le statut change entre deux collectes, l’ancienne et la nouvelle valeur sont enregistrées avec l’heure. Une correction de fournisseur n’est pas réécrite en silence dans un journal public de performance.",
        ],
      },
      {
        h2: "Couverture et limites",
        paragraphs: [
          "La couverture est celle des compétitions présentes dans le bureau : Ligue 1, Premier League, La Liga, Bundesliga, Serie A, Ligue des champions, Ligue Europa. Un match absent n’est pas créé pour remplir une page de résultats.",
          "La latence dépend du fournisseur et du serveur. Un score peut être en retard ou corrigé. Ce n’est pas une garantie d’exactitude à la seconde.",
        ],
      },
    ],
    links: [
      { href: "/data-sources", label: "Sources de données" },
      { href: "/scores-en-direct", label: "Scores en direct" },
      { href: "/resultats-football", label: "Résultats football" },
      { href: "/methodology", label: "Méthodologie du modèle" },
    ],
  },
];

export function geoDoc(path: string): GeoDoc | undefined {
  return GEO_PAGES.find((p) => p.path === path);
}

export function geoCanonical(path: string): string {
  return `${SITE_URL}${path}`;
}
