import type { BlogArticle } from "@/lib/blog";
import { CLUSTER_MEILLEUR_SITE, CLUSTER_PRONO_GRATUIT, CLUSTER_XG } from "@/lib/blog";
import { blogImageSeo, type ImageSeo } from "@/lib/image-seo";

export type BlogImg = ImageSeo;

const CREDIT = "";

type CoverSpec = { alt: string; caption: string; inline: string };

const INLINES: Record<string, { alt: string; caption: string }> = {
  "inline-shot": {
    alt: "Joueur de football frappe le ballon vers le but",
    caption: `Une frappe, une occasion, une proba — pas un score magique. ${CREDIT}`,
  },
  "inline-action": {
    alt: "Joueurs de football en action sur un terrain de stade",
    caption: `Le desk lit le match réel, pas une affiche inventée. ${CREDIT}`,
  },
  "inline-ball": {
    alt: "Ballon de football sur pelouse verte",
    caption: `Le ballon, le prix, la cote : trois choses distinctes. ${CREDIT}`,
  },
  "inline-crowd": {
    alt: "Public d’un stade de football avec drapeaux",
    caption: `L’ambiance ne change pas la cote. Le modèle, si. ${CREDIT}`,
  },
  "inline-night": {
    alt: "Stade de football plein sous les projecteurs, la nuit",
    caption: `Soirée de coupe : rotations, voyage, onze B. ${CREDIT}`,
  },
  "inline-pitch": {
    alt: "Ballon de football posé sur la pelouse d’un stade",
    caption: `Terrain, xG, cote : on relie, on ne mélange pas. ${CREDIT}`,
  },
  "inline-aerial": {
    alt: "Vue aérienne d’un stade de football et de sa pelouse",
    caption: `Le tableau (classement, xG) se lit de haut, le ticket se joue en bas. ${CREDIT}`,
  },
  "inline-empty": {
    alt: "Stade de football vide, pelouse et tribunes",
    caption: `Sans agrément, sans 18+, il n’y a pas de « meilleur site ». ${CREDIT}`,
  },
  "inline-live": {
    alt: "Supporters en tribune pendant un match de football",
    caption: `En live, le score d’abord. La cote ensuite. ${CREDIT}`,
  },
  "inline-flags": {
    alt: "Fumigènes et public dans un stade de football",
    caption: `Le bruit du stade n’est pas une value. ${CREDIT}`,
  },
  "inline-desk": {
    alt: "Bureau avec ordinateur portable, analyse de chiffres",
    caption: `Comparer un prix, ce n’est pas cliquer le bonus le plus bruyant. ${CREDIT}`,
  },
  "inline-phone": {
    alt: "Téléphone mobile tenu en main, usage en déplacement",
    caption: `La meilleure cote du match, book nommé, depuis le téléphone. ${CREDIT}`,
  },
  "inline-goal": {
    alt: "Ballon de football sur la pelouse, but flou en fond",
    caption: `But marqué ≠ xG. Filet 50 % ≠ 1-1 automatique. ${CREDIT}`,
  },
  "inline-ref": {
    alt: "Arbitre de football brandit un carton jaune",
    caption: `1, N ou 2 : un marché, une décision. Pas trois tickets sur la même affiche. ${CREDIT}`,
  },
  "inline-money": {
    alt: "Calculatrice et documents de comptes",
    caption: `Cote nette, pas bonus à recirculer. Affiliation affichée. ${CREDIT}`,
  },
  "inline-packed": {
    alt: "Tribunes pleines d’un stade de football",
    caption: `Grosse affiche, même moteur : calendrier réel, cotes FR. ${CREDIT}`,
  },
};

const COVERS: Record<string, CoverSpec> = {
  "pronostic-football-aujourdhui": {
    alt: "Deux joueurs de football se disputent le ballon en match",
    caption: `Pronostic football aujourd’hui : une affiche réelle, une cote FR, une décision. ${CREDIT}`,
    inline: "inline-action",
  },
  "meilleures-cotes-football": {
    alt: "Ballon de football sur la pelouse, stade en fond",
    caption: `La meilleure cote, c’est le prix le plus haut sur le même marché, book FR. ${CREDIT}`,
    inline: "inline-phone",
  },
  "value-bet-football": {
    alt: "Tableaux et graphiques d’analyse sur un écran",
    caption: `Un value bet, c’est un écart cote / proba — pas un gain assuré. ${CREDIT}`,
    inline: "inline-desk",
  },
  "score-en-direct-ligue-1": {
    alt: "Action de football près du but dans un stade plein",
    caption: `Score en direct Ligue 1 : le chiffre, les buteurs, pas toute la page qui saute. ${CREDIT}`,
    inline: "inline-live",
  },
  "pronostic-ligue-des-champions": {
    alt: "Stade de football plein la nuit sous les projecteurs",
    caption: `Pronostic Ligue des champions : même moteur que le championnat, affiche réelle. ${CREDIT}`,
    inline: "inline-night",
  },
  "pronostic-ligue-europa": {
    alt: "Public d’un stade de football pendant un match européen",
    caption: `Ligue Europa : plus de rotations, plus de pièges, pas de 1,40 forcé. ${CREDIT}`,
    inline: "inline-flags",
  },
  "classement-ligue-1": {
    alt: "Vue aérienne d’un grand stade de football et de sa pelouse",
    caption: `Le classement Ligue 1 oriente, il ne remplace pas le 1N2. ${CREDIT}`,
    inline: "inline-aerial",
  },
  "pari-couverture-score-exact": {
    alt: "Ballon de football coincé dans un filet de but",
    caption: `Couverture 50 % : un score exact calculé, pas le 1-1 par réflexe. ${CREDIT}`,
    inline: "inline-goal",
  },
  "cote-1n2-ou-moins-de-2-5": {
    alt: "Ballon de football au premier plan, pelouse et stade flous",
    caption: `1N2 ou moins de 2,5 : on retient le marché où l’écart est net. ${CREDIT}`,
    inline: "inline-ref",
  },
  "jeu-responsable-paris-sportifs": {
    alt: "Stade de football vide la nuit, pelouse éclairée",
    caption: `Paris sportifs : 18+. BetGPT n’est pas un bookmaker. Aide 09 74 75 13 13. ${CREDIT}`,
    inline: "inline-empty",
  },
  "meilleur-site-paris-sportif-en-ligne": {
    alt: "Téléphone mobile tenu en main pour consulter un service en ligne",
    caption: `Le meilleur site, c’est la meilleure cote sur TON match, book agréé. ${CREDIT}`,
    inline: "inline-desk",
  },
  "sites-paris-sportifs-legaux-france": {
    alt: "Personne en entretien professionnel, cadre légal et sérieux",
    caption: `Légal d’abord : agrément ANJ côté opérateur, 18+ partout. ${CREDIT}`,
    inline: "inline-empty",
  },
  "comparatif-bookmakers-football-france": {
    alt: "Bureau avec ordinateur portable pour comparer des chiffres",
    caption: `Comparatif bookmakers : on classe les cotes du match, pas un logo. ${CREDIT}`,
    inline: "inline-money",
  },
  "meilleures-cotes-ou-bonus-paris-sportifs": {
    alt: "Calculatrice et billets, comparaison d’un prix",
    caption: `Une cote 2,10 contre 1,90 pèse plus qu’un bonus à recirculer. ${CREDIT}`,
    inline: "inline-phone",
  },
  "meilleur-site-parier-ligue-1": {
    alt: "Stade de football plein vu des tribunes, pelouse au centre",
    caption: `Ligue 1 : volume d’affiches, écarts de cotes, scores live à côté. ${CREDIT}`,
    inline: "inline-packed",
  },
  "meilleur-site-parier-ligue-des-champions": {
    alt: "Vue plongeante sur un stade de football plein et sa pelouse",
    caption: `C1 : le book de la meilleure cote FR sur l’affiche, pas le plus de pubs. ${CREDIT}`,
    inline: "inline-night",
  },
  "unibet-betclic-netbet-winamax-cotes": {
    alt: "Documents, calculatrice et chiffres à comparer",
    caption: `Unibet, Betclic, NetBet, Winamax : on écrit le nom du book qui paie. ${CREDIT}`,
    inline: "inline-desk",
  },
  "comment-choisir-site-paris-sportifs": {
    alt: "Personne qui lit et prend des notes devant un ordinateur",
    caption: `Choisir un site : ANJ, cote, foot, live, jeu responsable. ${CREDIT}`,
    inline: "inline-money",
  },
  "liens-affiliation-paris-sportifs": {
    alt: "Billets en euros, modèle économique affiché",
    caption: `« Parier » est un lien sponsorisé. La cote affichée n’est pas vendue. ${CREDIT}`,
    inline: "inline-desk",
  },
  "paris-sportifs-live-meilleur-site": {
    alt: "Joueurs de football au duel près de la surface de réparation",
    caption: `Live : score juste d’abord, cote ensuite. Le cash-out est chez le book. ${CREDIT}`,
    inline: "inline-live",
  },
  "pronostic-football-gratuit": {
    alt: "Attaquant en pleine frappe au but sur un terrain de football",
    caption: `Pronostic football gratuit : sans compte, sans pack VIP. 18+. ${CREDIT}`,
    inline: "inline-shot",
  },
  "pronostic-ligue-1-gratuit": {
    alt: "Joueurs de football sur la pelouse d’un stade plein",
    caption: `Pronostic Ligue 1 gratuit : le calendrier live, pas une journée inventée. ${CREDIT}`,
    inline: "inline-packed",
  },
  "pronostic-c1-gratuit": {
    alt: "Stade de football bondé la nuit, match sous projecteurs",
    caption: `Pronostic C1 gratuit : phase, meilleure opportunité, cotes FR. ${CREDIT}`,
    inline: "inline-night",
  },
  "pronostic-europa-gratuit": {
    alt: "Stade de football plein le soir, pelouse éclairée",
    caption: `Pronostic Europa gratuit : même régime que la C1, autre hub. ${CREDIT}`,
    inline: "inline-flags",
  },
  "pronostic-football-gratuit-fiable": {
    alt: "Match de football en cours sous les projecteurs d’un stade",
    caption: `Fiable = un bilan publié, pas une phrase sûre. ${CREDIT}`,
    inline: "inline-action",
  },
  "pronostic-gratuit-vs-payant": {
    alt: "Graphique de marché financier sur un écran",
    caption: `Payant n’est pas plus vrai. Ici le prono est public ; le clic Parier est de l’affiliation. ${CREDIT}`,
    inline: "inline-money",
  },
  "pronostic-gratuit-value-bet": {
    alt: "Ordinateur portable affichant des graphiques d’analyse",
    caption: `Gratuit ≠ tout jouer. Mise seulement s’il y a value. ${CREDIT}`,
    inline: "inline-desk",
  },
  "pronostic-football-du-jour-gratuit": {
    alt: "Match de football dans un stade, joueurs et public",
    caption: `Pari du jour = un ticket. Opportunités = tous les Mise. ${CREDIT}`,
    inline: "inline-shot",
  },
  "pronostic-score-exact-gratuit": {
    alt: "Ballon de football dans les filets d’un but",
    caption: `Score exact gratuit : le filet 50 %, calculé, pas un 1-1 partout. ${CREDIT}`,
    inline: "inline-goal",
  },
  "pronostic-1n2-gratuit": {
    alt: "Arbitre de football sort un carton jaune pendant un match",
    caption: `1, N ou 2 : un marché. Le nul rarement Mise, sauf cote vraiment large. ${CREDIT}`,
    inline: "inline-ball",
  },
  "xg-football-cest-quoi": {
    alt: "Joueur de football frappe une occasion au but",
    caption: `xG : la chance qu’une occasion finisse au fond. Pas le score. ${CREDIT}`,
    inline: "inline-goal",
  },
  "xg-vs-buts": {
    alt: "Gros plan d’un ballon de football sur la pelouse",
    caption: `xG vs buts : on peut « mériter » 2,1 et marquer 0. ${CREDIT}`,
    inline: "inline-shot",
  },
  "xg-ligue-1": {
    alt: "Stade de football plein vu du ciel, pelouse et tribunes",
    caption: `xG Ligue 1 : les occasions valent plus qu’un week-end de classement. ${CREDIT}`,
    inline: "inline-aerial",
  },
  "xg-ligue-des-champions": {
    alt: "Vue aérienne d’un match de football dans un grand stade",
    caption: `Un 0-0 de C1 à 1,8–1,6 xG n’est pas un nul mort. ${CREDIT}`,
    inline: "inline-night",
  },
  "xg-et-pronostic-football": {
    alt: "Joueur de football en pleine frappe, stade en fond",
    caption: `Le xG nourrit le prono. La cote décide si on mise. ${CREDIT}`,
    inline: "inline-pitch",
  },
  "xg-et-cotes": {
    alt: "Pelouse de stade de football, lignes et but au loin",
    caption: `Les books voient le xG. Un écart d’occasions n’est pas toujours une cote généreuse. ${CREDIT}`,
    inline: "inline-desk",
  },
  "xg-domicile-exterieur": {
    alt: "Grand stade de football plein au coucher du soleil",
    caption: `xG domicile ≠ xG extérieur. Pas +0,3 but magique pour tout le monde. ${CREDIT}`,
    inline: "inline-packed",
  },
  "xg-pour-xg-contre": {
    alt: "Joueurs de football au milieu de terrain, stade plein",
    caption: `xG pour = créé. xG contre = subi. Les deux, pas seulement l’attaque. ${CREDIT}`,
    inline: "inline-shot",
  },
  "xg-en-direct": {
    alt: "Stade de football bondé la nuit pendant un match",
    caption: `xG live : un 0-0 à 1,4–0,2 n’est pas le même 0-0. ${CREDIT}`,
    inline: "inline-live",
  },
  "limites-du-xg": {
    alt: "Stade de football vu du ciel, pelouse vide de contexte",
    caption: `Le xG ignore l’expulsion, le vent, le gardien hors norme. On le borne. ${CREDIT}`,
    inline: "inline-empty",
  },
};

export function blogCover(a: BlogArticle): BlogImg {
  const spec = COVERS[a.slug];
  const src = `/blog/discover/${a.slug}.jpg`;
  if (!spec) {
    return blogImageSeo(
      "/blog/discover/pronostic-football-aujourdhui.jpg",
      `${a.h1} — football`,
      `${a.h1} : analyse football, données et contexte sur BetGPT.`,
    );
  }
  return blogImageSeo(src, spec.alt, spec.caption);
}

export function blogInline(a: BlogArticle): BlogImg {
  const spec = COVERS[a.slug];
  const key = spec?.inline ?? "inline-action";
  const meta = INLINES[key] ?? INLINES["inline-action"];
  return blogImageSeo(`/blog/discover/${key}.jpg`, meta.alt, meta.caption);
}

export function blogTakeaways(a: BlogArticle): string[] {
  return [
    a.lead.replace(/\s+/g, " ").trim(),
    a.paragraphs[0]?.body.split(". ").slice(0, 1).join(". ") ?? "Le desk ne invente pas les matchs.",
    "BetGPT n’est pas un bookmaker. 18+. Joueurs Info Service 09 74 75 13 13.",
  ];
}

export type BlogTable = { caption: string; headers: string[]; rows: string[][] };

export function blogTable(a: BlogArticle): BlogTable {
  if (a.cluster === CLUSTER_MEILLEUR_SITE) {
    return {
      caption: "Comment juger un site de paris sportif en ligne (France)",
      headers: ["Critère", "Chez BetGPT", "À éviter"],
      rows: [
        ["Légal", "Books accessibles FR, ANJ côté opérateur", "Sites hors circuit, DraftKings"],
        ["Prix", "Meilleure cote du match, book nommé", "Bonus hurlant, cote vendue"],
        ["Lien", "Parier = affiliation vers l’affiche", "404, page d’accueil déguisée"],
        ["Rôle", "Comparateur + médias", "Prise de mise, « 500 € → 1 500 € »"],
      ],
    };
  }
  if (a.cluster === CLUSTER_PRONO_GRATUIT) {
    return {
      caption: "Où lire un pronostic football gratuit sur BetGPT",
      headers: ["Page", "Ce que tu y trouves", "Payant ?"],
      rows: [
        ["Opportunités", "Tickets Mise, Premium, filet 50 %", "Non"],
        ["Pari du jour", "Le ticket unique du desk", "Non"],
        ["Fiche match", "Prono, analyse, cotes FR, score live", "Non"],
        ["Bilan", "Tickets passés, justes, filet", "Non"],
      ],
    };
  }
  if (a.cluster === CLUSTER_XG) {
    return {
      caption: "xG : ce que ça mesure, ce que ça ne dit pas",
      headers: ["Indicateur", "Dit", "Ne dit pas"],
      rows: [
        ["xG pour", "Occasions créées", "Le score final"],
        ["xG contre", "Occasions subies", "Un carton rouge"],
        ["xG live", "Occasions dans le match", "Le tweet du vestiaire"],
        ["Cote", "Prix du book", "Que le xG a « raison »"],
      ],
    };
  }
  return {
    caption: "Pages BetGPT utiles après cet article",
    headers: ["Page", "Rôle", "18+"],
    rows: [
      ["Opportunités", "Value bets du jour", "Oui"],
      ["Scores en direct", "Score, buteurs, super pari", "Oui"],
      ["Comparer les cotes", "Prix FR alignés", "Oui"],
      ["Jeu responsable", "Limites, aide, ANJ", "Oui"],
    ],
  };
}

export function sectionSubs(h2: string, body: string): { h3: string; text: string }[] {
  const sentences = body.split(/(?<=\.)\s+/).filter((s) => s.trim().length > 20);
  const first = sentences[0] ?? body;
  const rest = sentences.slice(1).join(" ") || body;
  return [
    { h3: `À retenir — ${h2}`, text: first },
    { h3: `Concrètement sur BetGPT`, text: rest },
  ];
}

export const INLINE_LINKS: { phrase: string; href: string }[] = [
  { phrase: "meilleur site de paris sportif en ligne", href: "/blog/meilleur-site-paris-sportif-en-ligne" },
  { phrase: "pronostic football gratuit", href: "/blog/pronostic-football-gratuit" },
  { phrase: "pronostic football aujourd’hui", href: "/blog/pronostic-football-aujourdhui" },
  { phrase: "paris football", href: "/paris-football" },
  { phrase: "meilleures cotes", href: "/blog/meilleures-cotes-football" },
  { phrase: "value bet", href: "/blog/value-bet-football" },
  { phrase: "jeu responsable", href: "/jeu-responsable" },
  { phrase: "Pari du jour", href: "/pari-du-jour" },
  { phrase: "Opportunités", href: "/opportunities" },
  { phrase: "Ligue des champions", href: "/ligue-des-champions" },
  { phrase: "Ligue Europa", href: "/ligue-europa" },
  { phrase: "Ligue 1", href: "/ligue-1" },
  { phrase: "xG football", href: "/blog/xg-football-cest-quoi" },
  { phrase: "scores en direct", href: "/scores-en-direct" },
  { phrase: "comparer les cotes", href: "/comparer-cotes" },
  { phrase: "Calculateur de mise", href: "/calculateur-mise" },
  { phrase: "classement", href: "/classement" },
  { phrase: "calendrier", href: "/calendrier" },
  { phrase: "forum", href: "/forum" },
  { phrase: "Premier League", href: "/premier-league" },
];

export function slugHeading(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

