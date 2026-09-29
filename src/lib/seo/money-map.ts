/** Editorial keyword portfolio. Volume, CPC, difficulty and live rank are UNKNOWN until a measured source exists. */

export type SearchIntent = "commercial" | "transactional" | "comparative" | "informational";

export type KeywordRow = {
  keyword: string;
  cluster: string;
  intent: SearchIntent;
  volume: "UNKNOWN";
  difficulty: "UNKNOWN";
  cpc: "UNKNOWN";
  currentPosition: "UNKNOWN";
  currentURL: null;
  targetURL: string | null;
  competitorURL: string | null;
  /** Editorial priority 1–5. Not a search-volume or CPC figure. */
  businessValue: 1 | 2 | 3 | 4 | 5;
  priority: "P1" | "P2" | "P3";
  status: "page" | "no-data";
  lastChecked: "2026-09-24";
  primary: boolean;
};

export const PRONO_LEAGUES: { slug: string; league: "L1" | "PL" | "LL" | "BL" | "SA" | "CL" | "EL"; title: string }[] = [
  { slug: "ligue-1", league: "L1", title: "Ligue 1" },
  { slug: "premier-league", league: "PL", title: "Premier League" },
  { slug: "liga", league: "LL", title: "La Liga" },
  { slug: "bundesliga", league: "BL", title: "Bundesliga" },
  { slug: "serie-a", league: "SA", title: "Serie A" },
  { slug: "champions-league", league: "CL", title: "Ligue des champions" },
  { slug: "europa-league", league: "EL", title: "Ligue Europa" },
];

export const GUIDES: { slug: string; title: string; description: string; h1: string; paragraphs: string[]; links: { href: string; label: string }[] }[] = [
  {
    slug: "comment-lire-un-pronostic",
    title: "Comment lire un pronostic BetGPT",
    description: "Probabilité modèle, cote, écart et limites : ce qu’un pronostic BetGPT dit, et ce qu’il ne promet pas.",
    h1: "Comment lire un pronostic football",
    paragraphs: [
      "Un pronostic BetGPT est une estimation, pas une instruction de mise. La probabilité modèle est la sortie du moteur Poisson / Dixon-Coles. La cote, lorsqu’elle est listée, vient d’un bookmaker observé. L’écart est la différence entre les deux. S’il n’y a pas de cote, l’écart n’est pas affiché.",
      "Le score de confiance résume la qualité des données et l’accord des modèles. Un chiffre élevé ne veut pas dire que le résultat est certain. Après le coup d’envoi, la fiche ne doit plus réécrire le pronostic en silence : le bilan public ne compte que les lignes enregistrées avant le coup d’envoi.",
    ],
    links: [
      { href: "/pronostics-sportifs", label: "Pronostics sportifs du jour" },
      { href: "/methodology", label: "Méthodologie" },
      { href: "/ledger", label: "Bilan" },
    ],
  },
  {
    slug: "probabilite-implicite",
    title: "Probabilité implicite d’une cote",
    description: "Convertir une cote décimale en probabilité implicite, sans inventer la marge du bookmaker.",
    h1: "Calculer une probabilité implicite",
    paragraphs: [
      "Pour une cote décimale D supérieure à 1, la probabilité implicite brute est 1/D. Elle inclut la marge du bookmaker. Sans la cote opposée, BetGPT ne fabrique pas une probabilité « no vig ».",
      "Comparer 1/D à la probabilité du modèle donne un écart. Un écart positif ne garantit ni gain, ni que le modèle a raison.",
    ],
    links: [
      { href: "/outils/value-bet", label: "Calculateur d’écart" },
      { href: "/outils/convertisseur-cotes", label: "Convertisseur de cotes" },
    ],
  },
  {
    slug: "value-bet",
    title: "Value bet : définition et limites",
    description: "Une value bet est un écart entre une probabilité estimée et une cote. Ce n’est pas un pari sûr.",
    h1: "Qu’est-ce qu’une value bet",
    paragraphs: [
      "On parle d’écart de valeur quand la probabilité estimée dépasse la probabilité implicite de la cote. L’espérance sur une mise unitaire est p×cote − 1. Elle peut être positive et le pari perdre quand même.",
      "BetGPT n’affiche une value que si la cote est réellement listée et au moins égale au plancher de mise du site. Aucune cote n’est inventée pour remplir une page.",
    ],
    links: [
      { href: "/outils/value-bet", label: "Calculateur value" },
      { href: "/opportunities", label: "Opportunités du bureau" },
    ],
  },
  {
    slug: "critere-de-kelly",
    title: "Critère de Kelly pour une cote",
    description: "Formule de Kelly, demi-Kelly et quart-Kelly. La fraction peut être nulle ou négative.",
    h1: "Critère de Kelly",
    paragraphs: [
      "Avec une cote décimale D et une probabilité p, la fraction de Kelly est ( (D−1)×p − (1−p) ) / (D−1). Si le résultat est négatif, la formule dit de ne pas miser. Demi-Kelly et quart-Kelly divisent cette fraction.",
      "Kelly suppose que p est juste et que les paris sont indépendants. Les deux sont faux en pratique. Ce n’est pas un conseil de bankroll.",
    ],
    links: [
      { href: "/outils/kelly", label: "Calculateur Kelly" },
      { href: "/calculateur-mise", label: "Mises du bureau, plafonnées" },
    ],
  },
  {
    slug: "lire-une-cote",
    title: "Lire une cote décimale, fractionnaire ou américaine",
    description: "Trois écritures de la même cote, et la probabilité implicite brute qui en découle.",
    h1: "Comment lire une cote",
    paragraphs: [
      "La cote décimale est le retour total pour 1 unité misée, mise comprise. La forme fractionnaire exprime le profit seul. La forme américaine est positive quand la cote est supérieure à 2, négative sinon.",
      "Aucune de ces écritures n’est une probabilité. Il faut encore calculer 1/D, et se souvenir que le bookmaker prélève une marge.",
    ],
    links: [{ href: "/outils/convertisseur-cotes", label: "Convertisseur" }],
  },
  {
    slug: "erreurs-de-paris",
    title: "Erreurs fréquentes devant une cote",
    description: "Confondre cote et probabilité, ignorer l’échantillon, et prendre un modèle pour une certitude.",
    h1: "Erreurs qui faussent un pronostic",
    paragraphs: [
      "La première erreur est de lire une cote de 1,40 comme « presque sûr ». La seconde est de juger un modèle sur trois matchs. La troisième est de ne regarder que les bons résultats.",
      "BetGPT publie les lignes perdantes dans le bilan lorsqu’elles ont été enregistrées avant le coup d’envoi. Une page de pronostic sans score final ne doit pas être complétée après coup.",
    ],
    links: [
      { href: "/ledger", label: "Bilan" },
      { href: "/prediction-history", label: "Comment lire l’historique" },
      { href: "/jeu-responsable", label: "Jeu responsable" },
    ],
  },
];

/** Old or external slugs → one canonical guide. Not indexable themselves. */
export const GUIDE_ALIASES: Record<string, string> = {
  "comment-faire-un-pronostic-football": "comment-lire-un-pronostic",
  "comment-calculer-probabilite-implicite": "probabilite-implicite",
  "kelly-criterion": "critere-de-kelly",
  "comment-lire-les-cotes": "lire-une-cote",
  "erreurs-paris-sportifs": "erreurs-de-paris",
};

const FIXTURE_QUERIES: { keyword: string; a: string[]; b: string[] }[] = [
  { keyword: "pronostic psg marseille", a: ["psg", "paris saint-germain", "paris sg"], b: ["marseille"] },
  { keyword: "pronostic real madrid barcelone", a: ["real madrid"], b: ["barcelone", "barcelona"] },
  { keyword: "pronostic liverpool arsenal", a: ["liverpool"], b: ["arsenal"] },
];

function foldName(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function sideHit(team: { name: string; short?: string }, aliases: string[]): boolean {
  const blob = foldName(`${team.name} ${team.short ?? ""}`);
  return aliases.some((alias) => blob.includes(foldName(alias)));
}

/** Match queries point at /match/ only when that fixture is on the desk. Otherwise no page. */
export function fixtureKeywords(
  matches: { id: string; slug?: string; home: { name: string; short?: string }; away: { name: string; short?: string } }[],
): KeywordRow[] {
  return FIXTURE_QUERIES.map((query) => {
    const hit = matches.find(
      (match) =>
        (sideHit(match.home, query.a) && sideHit(match.away, query.b)) ||
        (sideHit(match.home, query.b) && sideHit(match.away, query.a)),
    );
    const target = hit ? `/match/${hit.slug || hit.id}` : null;
    return row(query.keyword, "E", "transactional", target, null, 4, "P2", true, target ? "page" : "no-data");
  });
}

const ST = "https://www.sportytrader.com/pronostics/";

export const MONEY_KEYWORDS: KeywordRow[] = [
  row("pronostics sportifs", "A", "commercial", "/pronostics-sportifs", ST, 5, "P1", true),
  row("pronostic sportif", "A", "commercial", "/pronostics-sportifs", ST, 4, "P1", false),
  row("pronostics football", "A", "commercial", "/pronostics-football", "https://www.sportytrader.com/pronostics/football/", 5, "P1", true),
  row("pronostic football", "A", "commercial", "/pronostics-football", "https://www.sportytrader.com/pronostics/football/", 4, "P1", false),
  row("pronostic foot", "A", "commercial", "/pronostics-football", "https://www.sportytrader.com/pronostics/football/", 4, "P1", true),
  row("pronos football du jour", "A", "transactional", "/pronos-football", null, 4, "P1", true),
  row("prono foot", "A", "transactional", "/pronos-football", null, 3, "P2", true),
  row("pari sportif", "A", "commercial", "/paris-football", null, 3, "P2", true),
  row("paris sportifs", "A", "commercial", "/paris-football", null, 3, "P2", false),
  row("meilleur site pronostic sportif", "B", "comparative", "/meilleur-site-pronostic", ST, 4, "P1", true),
  row("site pronostic fiable", "B", "comparative", "/meilleur-site-pronostic", ST, 3, "P2", true),
  row("pronostic football gratuit", "B", "commercial", "/pronostics-football", null, 3, "P2", true),
  row("pronostic gratuit", "B", "commercial", "/pronostics-football", null, 2, "P2", false),
  row("pronostic du jour", "C", "transactional", "/pronostics-football/aujourdhui", null, 5, "P1", true),
  row("pronostics aujourd’hui", "C", "transactional", "/pronostics-football/aujourdhui", null, 4, "P1", false),
  row("pronostics football aujourd’hui", "C", "transactional", "/pronostics-football/aujourdhui", null, 4, "P1", true),
  row("pronostic foot aujourd’hui", "C", "transactional", "/pronostics-football/aujourdhui", null, 4, "P1", false),
  row("pronostic match ce soir", "C", "transactional", "/pronostics-football/aujourdhui", null, 3, "P2", true),
  row("pronostics demain", "C", "transactional", "/pronostics-football/demain", null, 4, "P1", true),
  row("pari du jour", "C", "transactional", "/pari-du-jour", null, 4, "P1", true),
  row("pronostic ligue 1", "D", "transactional", "/pronostics-football/ligue-1", null, 5, "P1", true),
  row("pronostic champions league", "D", "transactional", "/pronostics-football/champions-league", null, 5, "P1", true),
  row("pronostic premier league", "D", "transactional", "/pronostics-football/premier-league", null, 4, "P1", true),
  row("pronostic liga", "D", "transactional", "/pronostics-football/liga", null, 4, "P2", true),
  row("pronostic serie a", "D", "transactional", "/pronostics-football/serie-a", null, 3, "P2", true),
  row("pronostic bundesliga", "D", "transactional", "/pronostics-football/bundesliga", null, 3, "P2", true),
  row("pronostic europa league", "D", "transactional", "/pronostics-football/europa-league", null, 4, "P2", true),
  row("pronostic score exact", "F", "informational", "/score-hunter", null, 3, "P2", true),
  row("pronostic over under", "F", "informational", "/score-hunter/over-2-5", null, 3, "P2", true),
  row("pronostic les deux équipes marquent", "F", "informational", "/score-hunter/btts", null, 3, "P2", true),
  row("pronostic btts", "F", "informational", "/score-hunter/btts", null, 3, "P2", true),
  row("pronostic 1n2", "F", "informational", "/pronostics-football", null, 3, "P2", true),
  row("pronostic buteur", "F", "informational", null, null, 2, "P3", true, "no-data"),
  row("pronostic corners", "F", "informational", null, null, 1, "P3", true, "no-data"),
  row("pronostic double chance", "F", "informational", null, null, 2, "P3", true, "no-data"),
  row("value bet", "G", "transactional", "/outils/value-bet", null, 4, "P1", true),
  row("calculateur value bet", "G", "transactional", "/outils/value-bet", null, 4, "P1", true),
  row("qu’est-ce qu’une value bet", "G", "informational", "/guides/value-bet", null, 3, "P2", true),
  row("value betting", "G", "informational", "/guides/value-bet", null, 3, "P2", true),
  row("critère de kelly", "G", "informational", "/outils/kelly", null, 3, "P1", true),
  row("calculateur kelly pari", "G", "transactional", "/outils/kelly", null, 3, "P2", true),
  row("calculateur cote pari", "G", "transactional", "/outils/convertisseur-cotes", null, 3, "P2", true),
  row("probabilité implicite bookmaker", "G", "informational", "/guides/probabilite-implicite", null, 3, "P2", true),
  row("calculateur roi pari", "G", "transactional", "/outils/roi", null, 2, "P2", true),
  row("meilleures cotes football", "H", "comparative", "/meilleures-cotes", null, 4, "P1", true),
  row("comparateur cotes football", "H", "comparative", "/comparer-cotes", null, 3, "P2", true),
  row("meilleur bookmaker", "H", "comparative", null, null, 2, "P3", true, "no-data"),
  row("comparatif bookmaker", "H", "comparative", null, null, 2, "P3", true, "no-data"),
  row("probabilités football", "A", "informational", "/statistics", null, 3, "P2", true),
];

function row(
  keyword: string,
  cluster: string,
  intent: SearchIntent,
  targetURL: string | null,
  competitorURL: string | null,
  businessValue: KeywordRow["businessValue"],
  priority: KeywordRow["priority"],
  primary: boolean,
  status: KeywordRow["status"] = targetURL ? "page" : "no-data",
): KeywordRow {
  return {
    keyword,
    cluster,
    intent,
    volume: "UNKNOWN",
    difficulty: "UNKNOWN",
    cpc: "UNKNOWN",
    currentPosition: "UNKNOWN",
    currentURL: null,
    targetURL,
    competitorURL,
    businessValue,
    priority,
    status,
    lastChecked: "2026-09-24",
    primary,
  };
}

const INTENT_WEIGHT: Record<SearchIntent, number> = {
  commercial: 25,
  transactional: 22,
  comparative: 18,
  informational: 12,
};

/** Prioritization score from known editorial inputs only. Volume and rank are not guessed. */
export function bankableScore(keyword: KeywordRow): { score: number; unknowns: string[] } {
  let score = INTENT_WEIGHT[keyword.intent];
  if (keyword.status === "page" && keyword.targetURL) score += 25;
  if (keyword.businessValue >= 4) score += 20;
  else score += keyword.businessValue * 4;
  if (keyword.priority === "P1") score += 15;
  else if (keyword.priority === "P2") score += 8;
  if (keyword.cluster === "G" || keyword.cluster === "H") score += 10;
  return {
    score: Math.min(100, score),
    unknowns: ["volume", "difficulty", "cpc", "currentPosition"],
  };
}

export function primaryCollisions(rows: KeywordRow[] = MONEY_KEYWORDS): string[] {
  const seen = new Map<string, string | null>();
  const bad: string[] = [];
  for (const row of rows.filter((r) => r.primary)) {
    const prev = seen.get(row.keyword);
    if (prev !== undefined && prev !== row.targetURL) bad.push(row.keyword);
    else seen.set(row.keyword, row.targetURL);
  }
  return bad;
}

export function siloIndexable(kind: "pillar" | "day" | "league" | "football", matchCount: number): boolean {
  if (kind === "day" || kind === "league") return matchCount > 0;
  return true;
}

export function onPublicBoard(match: { kickoff?: string; status?: string }, now = Date.now()): boolean {
  const ko = Date.parse(match.kickoff ?? "");
  if (!Number.isFinite(ko) || match.status === "cancelled") return false;
  if (match.status === "finished") return parisDay(match.kickoff ?? "") === parisOffsetDay(0, now);
  if (match.status === "live") return now - ko < 3 * 36e5;
  return ko >= now - 20 * 60e3;
}

export function moneySitemapPaths(matches?: { league?: string; kickoff?: string; status?: string }[]): { path: string; title: string }[] {
  const counted = Array.isArray(matches);
  const visible = counted ? matches.filter((match) => onPublicBoard(match)) : [];
  const leagueCounts = new Map<string, number>();
  if (counted) {
    for (const match of visible) {
      if (match.league) leagueCounts.set(match.league, (leagueCounts.get(match.league) ?? 0) + 1);
    }
  }
  const leagues = PRONO_LEAGUES.filter((league) => !counted || (leagueCounts.get(league.league) ?? 0) > 0).map((league) => ({
    path: `/pronostics-football/${league.slug}`,
    title: `Pronostic ${league.title}`,
  }));
  return [
    { path: "/pronostics-sportifs", title: "Pronostics sportifs" },
    { path: "/pronostics-football", title: "Pronostics football" },
    ...leagues,
    { path: "/meilleur-site-pronostic", title: "Critères d’un site de pronostics" },
    { path: "/guides", title: "Guides pronostics" },
    ...GUIDES.map((guide) => ({ path: `/guides/${guide.slug}`, title: guide.h1 })),
    { path: "/outils", title: "Outils de cotes" },
    { path: "/outils/value-bet", title: "Calculateur value bet" },
    { path: "/outils/kelly", title: "Calculateur Kelly" },
    { path: "/outils/convertisseur-cotes", title: "Convertisseur de cotes" },
    { path: "/outils/roi", title: "Calculateur de ROI" },
    { path: "/rapports/precision", title: "Rapport de précision" },
  ];
}

export function parisDay(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

export function parisOffsetDay(offset: number, now = Date.now()): string {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const [y, m, d] = today.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + offset);
  return new Date(utc).toISOString().slice(0, 10);
}
