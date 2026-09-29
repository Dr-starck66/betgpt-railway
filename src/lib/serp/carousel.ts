export type GoogleDecision = "ELIGIBLE_CANDIDATE" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "UNKNOWN";

export type CarouselItem = { id: string; ok: boolean; evidence: string };

/**
 * Internal readiness for Google's EEA sports-scores ecosystem carousel.
 * googleDecision stays UNKNOWN until a real submission or Google response exists.
 * This is not an acceptance.
 */
export function ecosystemCarousel(): {
  googleDecision: GoogleDecision;
  readiness: "ELIGIBLE_CANDIDATE";
  note: string;
  items: CarouselItem[];
} {
  const items: CarouselItem[] = [
    { id: "eea-served", ok: true, evidence: "Pages françaises publiques sur betgpt.live, sans geo-block dans le code." },
    { id: "sports-provider", ok: true, evidence: "Hub /scores-en-direct et fiches /match/{slug} affichent les scores du bureau." },
    { id: "live-scores", ok: true, evidence: "Statut LIVE distinct de FINISHED. Un flux en retard n’est plus étiqueté direct confirmé." },
    { id: "result-pages", ok: true, evidence: "/resultats-football et la même URL de match après le coup de sifflet." },
    { id: "canonical", ok: true, evidence: "Canonical stable https://betgpt.live/match/{slug}, alias /score et /resultat en 301." },
    { id: "timestamps", ok: true, evidence: "Coup d’envoi ISO. dateModified suit les versions, pas chaque rafraîchissement visiteur." },
    { id: "data-source", ok: true, evidence: "/data-sources et /score-data-methodology décrivent ESPN et les limites." },
    { id: "methodology", ok: true, evidence: "/methodology décrit le modèle. Les scores affichés restent ceux du fournisseur." },
    { id: "organization", ok: true, evidence: "Identité BetGPT sur /about et le graphe Organization existant." },
    { id: "crawlability", ok: true, evidence: "robots.txt laisse crawler /scores-en-direct, /resultats-football et /match/." },
    { id: "uptime", ok: false, evidence: "Aucun sondeur d’uptime externe n’est branché. Uptime UNVERIFIED." },
    { id: "mobile", ok: true, evidence: "Tableaux scrollables, score en texte HTML. Viewport 390×844 non remesuré ici." },
    { id: "performance", ok: false, evidence: "Pas de nouvelle mesure LCP/CLS de laboratoire dans ce changement." },
    { id: "score-freshness", ok: true, evidence: "Âge de collecte liveAsOf. Seuil de retard : 180 secondes." },
    { id: "score-accuracy", ok: true, evidence: "Aucun score fabriqué. Corrections de statut/score journalisées si la collecte change." },
    { id: "match-coverage", ok: true, evidence: "Un match absent du bureau n’est pas ajouté pour remplir une page." },
    { id: "competition-coverage", ok: true, evidence: "Hubs Ligue 1, Premier League, Liga, Serie A, Bundesliga, C1, Europa quand la ligue a des matchs." },
  ];
  return {
    googleDecision: "UNKNOWN",
    readiness: "ELIGIBLE_CANDIDATE",
    note: "Préparation interne seulement. Aucune preuve de formulaire Google soumis, ni d’acceptation, ni de rejet. La décision Google est UNKNOWN.",
    items,
  };
}

export const SERP_OPPORTUNITIES: { family: string; queries: string; status: "UNVERIFIED"; missing: string }[] = [
  { family: "scores", queries: "score, direct, live", status: "UNVERIFIED", missing: "Search Console non connectée : impressions, clics, CTR, position." },
  { family: "results", queries: "résultat, résultats", status: "UNVERIFIED", missing: "Search Console non connectée." },
  { family: "matches", queries: "équipe A équipe B score", status: "UNVERIFIED", missing: "Search Console non connectée." },
  { family: "video", queries: "vidéo, résumé", status: "UNVERIFIED", missing: "Aucune vidéo curatée n’est encore associée. Search Console non connectée." },
];

export const SEARCH_INTENT: { query: string; path: string }[] = [
  { query: "scores en direct", path: "/scores-en-direct" },
  { query: "résultats football", path: "/resultats-football" },
  { query: "résultat ligue 1", path: "/resultats-football/ligue-1" },
  { query: "résultats champions league", path: "/resultats-football/champions-league" },
  { query: "score [équipe A] [équipe B]", path: "/match/{slug}" },
  { query: "[équipe A] [équipe B] résumé vidéo", path: "/match/{slug}#video" },
];
