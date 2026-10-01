import type { EditorialArticle } from "@/lib/editorial/types";

const ARTICLES: EditorialArticle[] = [
  {
    id: "manual-2026-10-01-real-madrid-mbappe-paris",
    slug: "real-madrid-mbappe-recuperation-paris-2026-10-01",
    slot: "noon",
    articleType: "news",
    status: "PUBLISHED",
    title: "Real Madrid : Mbappé poursuit sa récupération après son passage à Paris | BetGPT",
    h1: "Real Madrid : Mbappé poursuit sa récupération après son passage à Paris",
    lead:
      "Le Real Madrid a indiqué ce jeudi que Kylian Mbappé poursuivait son processus de récupération. Quelques heures plus tôt, Foot Mercato rapportait, en s'appuyant sur AS, que le club avait autorisé son déplacement à Paris.",
    paragraphs: [
      {
        h2: "Le Real Madrid confirme que Mbappé reste en récupération",
        body:
          "Dans son compte rendu de la quatrième séance de la semaine, le Real Madrid précise que Kylian Mbappé fait partie des joueurs qui poursuivent leur processus de récupération, aux côtés de Konaté, Mendy, Valverde et Rodrygo. Le club ne donne pas de date de retour à l'entraînement collectif et ne fixe pas non plus de calendrier public pour sa reprise.",
      },
      {
        h2: "Son déplacement à Paris avait été autorisé",
        body:
          "La question avait pris de l'ampleur dans la matinée après des images et commentaires sur sa présence à Paris alors qu'il était blessé. Foot Mercato a ensuite rapporté que, selon AS, le déplacement avait été validé par le Real Madrid ainsi que par les staffs technique et médical. Cet élément change la lecture de la polémique : l'absence de Valdebebas ne signifie pas, à elle seule, qu'il s'est soustrait au protocole du club.",
      },
      {
        h2: "Le vrai signal à surveiller maintenant",
        body:
          "Le point décisif n'est donc plus son voyage, mais l'évolution de sa récupération. Tant que le Real Madrid ne communique pas sur un retour dans le groupe ou une reprise complète, BetGPT ne fixe aucune date et ne transforme pas les estimations de la presse en certitude. La prochaine information réellement utile sera son retour à l'entraînement collectif, sa présence dans le groupe ou un nouveau point médical officiel.",
      },
    ],
    createdAt: "2026-10-01T15:18:00.000Z",
    publishedAt: "2026-10-01T15:18:00.000Z",
    modifiedAt: "2026-10-01T15:18:00.000Z",
    parisDate: "2026-10-01",
    scheduledTime: "17:18",
    category: "Actualité football",
    section: "la-liga",
    league: "LL",
    teams: ["Real Madrid", "Kylian Mbappé"],
    matchId: null,
    competition: "La Liga",
    sources: [
      {
        id: "realmadrid-training-2026-10-01",
        label: "Real Madrid",
        status: "OFFICIAL",
        note: "Le club indique le 1er octobre 2026 que Kylian Mbappé poursuit son processus de récupération.",
        url: "https://www.realmadrid.com/fr-FR/actualites/football/equipe-premiere/entrainements/el-real-madrid-se-esta-entrenando-01-10-2026",
      },
      {
        id: "footmercato-mbappe-paris-2026-10-01",
        label: "Foot Mercato",
        status: "CORROBORATED",
        note: "Foot Mercato rapporte que le déplacement de Mbappé à Paris avait été autorisé par le Real Madrid et ses staffs, en citant AS.",
        url: "https://www.footmercato.net/a4274985545794925409-le-real-madrid-a-autorise-kylian-mbappe-a-se-rendre-a-paris",
      },
    ],
    newsworthiness: 94,
    discoverOpportunity: {
      freshness: 20,
      frenchInterest: 20,
      entityStrength: 15,
      novelty: 15,
      visual: 10,
      sourceQuality: 10,
      editorialAngle: 10,
      total: 100,
      decision: "PUBLISH",
      reasons: [],
    },
    discoverChecks: {
      INDEXABLE: true,
      LARGE_IMAGE: true,
      IMAGE_GE_1200: true,
      MAX_IMAGE_PREVIEW_LARGE: true,
      HELPFUL_CONTENT: true,
      NON_CLICKBAIT_TITLE: true,
      ORIGINAL_VALUE: true,
      MOBILE_TEMPLATE: true,
    },
    discoverReadiness: 100,
    topStories: "TOP_STORIES_ELIGIBILITY_READY",
    image: {
      src: "/blog/discover/inline-action.jpg",
      alt: "Joueurs de football en action, photo d'illustration libre de droits",
      width: 1200,
      height: 675,
      credit:
        "Illustration libre de droits (Unsplash ou Pexels), recadrée par BetGPT en 1200×675. Ce n'est pas une photo de Kylian Mbappé.",
    },
    links: [
      { href: "/actualites/la-liga", label: "Actualités La Liga" },
      { href: "/la-liga", label: "La Liga" },
      { href: "/scores-en-direct", label: "Scores en direct" },
      { href: "/methodology", label: "Méthode BetGPT" },
      { href: "/auteurs/betgpt-editorial", label: "BetGPT Editorial" },
    ],
    related: [],
    quality: { pass: true, reasons: [] },
    duplicateScore: 0,
    corrections: [],
    sourceChanges: [],
    factHash: "manual-mbappe-paris-2026-10-01-v1",
    keywords: "Kylian Mbappé, Real Madrid, Paris, La Liga, blessure Mbappé",
  },
];

export function manualEditorialArticles(): EditorialArticle[] {
  return ARTICLES.map((article) => ({
    ...article,
    paragraphs: article.paragraphs.map((part) => ({ ...part })),
    sources: article.sources.map((source) => ({ ...source })),
    links: article.links.map((link) => ({ ...link })),
    related: article.related.map((item) => ({ ...item })),
    corrections: article.corrections.map((item) => ({ ...item })),
    sourceChanges: article.sourceChanges.map((item) => ({ ...item })),
    image: { ...article.image },
    quality: { ...article.quality, reasons: [...article.quality.reasons] },
    discoverOpportunity: {
      ...article.discoverOpportunity,
      reasons: [...article.discoverOpportunity.reasons],
    },
    discoverChecks: { ...article.discoverChecks },
  }));
}

export function manualEditorialArticleBySlug(slug: string): EditorialArticle | null {
  return manualEditorialArticles().find((article) => article.slug === slug) ?? null;
}
