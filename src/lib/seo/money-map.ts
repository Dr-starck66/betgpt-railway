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
    description: "Probabilité, cote, EV, horodatage et limites : une grille pour lire un pronostic sans confondre estimation et certitude.",
    h1: "Comment lire un pronostic football sans surinterpréter le modèle",
    paragraphs: [
      "Une fiche BetGPT rassemble plusieurs objets différents : une probabilité produite par le modèle, une cote lorsqu'un prix de marché a réellement été observé, un éventuel écart entre les deux et des métadonnées d'horodatage. Aucun de ces champs ne doit être lu isolément. Le point de départ est toujours la date du calcul et l'état des données au moment où la prévision a été enregistrée.",
      "La probabilité modèle n'est pas une fréquence garantie. Une estimation à 62 % signifie que, si le modèle est correctement calibré, un grand ensemble d'événements comparables devrait se réaliser environ 62 % du temps. Sur un match unique, le résultat reste binaire : l'équipe gagne ou elle ne gagne pas. C'est précisément pourquoi nous conservons un historique plutôt que de juger le moteur sur une soirée.",
      "La cote joue un rôle différent. Elle représente un prix disponible sur un marché à un instant donné. Une cote de 1,80 correspond à une probabilité implicite brute d'environ 55,6 %, avant retrait de la marge du bookmaker. Si BetGPT estime 60 %, l'écart existe mathématiquement, mais il peut disparaître si l'estimation du modèle est seulement quelques points trop optimiste.",
      "L'espérance affichée, lorsqu'elle peut être calculée avec une cote observée, décrit ce que donnerait théoriquement une très longue série de décisions identiques si la probabilité du modèle était juste. Elle ne prédit pas le résultat du match. Une espérance positive peut accompagner une perte, et plusieurs gains consécutifs peuvent provenir d'une estimation médiocre mais chanceuse.",
      "L'horodatage est donc aussi important que le pourcentage. Une prévision publiée après le coup d'envoi ne doit pas entrer dans le même bilan qu'une décision réellement enregistrée avant le match. BetGPT expose cette information dans le registre public afin qu'une fiche héritée ou tardive ne puisse pas être présentée comme une preuve de performance pré-match.",
      "Enfin, regardez ce qui manque. Une cote dérivée, une source absente, une composition non confirmée ou un faible volume historique doivent réduire la confiance que vous accordez à la fiche. Une interface sérieuse doit savoir afficher « non vérifié » plutôt que remplir les blancs avec une valeur plausible.",
      "Pour auditer une fiche, utilisez toujours le même ordre : timestamp, source de cote, probabilité, écart éventuel, statut du match, puis historique du modèle sur un échantillon suffisamment large. Cette séquence évite de commencer par le résultat final et de reconstruire ensuite une histoire qui le justifie."
    ],
    links: [
      { href: "/pronostics-sportifs", label: "Pronostics sportifs du jour" },
      { href: "/methodology", label: "Méthodologie" },
      { href: "/ledger", label: "Registre public" },
      { href: "/prediction-history", label: "Lire l'historique" }
    ],
  },
  {
    slug: "probabilite-implicite",
    title: "Probabilité implicite d’une cote",
    description: "Passer d'une cote décimale à une probabilité implicite, comprendre la marge et éviter de confondre prix de marché et probabilité vraie.",
    h1: "Calculer la probabilité implicite d’une cote — puis comprendre ses limites",
    paragraphs: [
      "Pour une cote décimale D supérieure à 1, la conversion brute est simple : probabilité implicite = 1 / D. Une cote de 2,00 donne 50 %, 1,50 donne environ 66,7 % et 4,00 donne 25 %. Cette opération ne dit pas que l'événement possède réellement cette probabilité ; elle traduit seulement le prix en une échelle plus intuitive.",
      "Le mot « brute » est important parce qu'un bookmaker ajoute une marge. Sur un marché à deux issues, les probabilités implicites des deux prix peuvent par exemple totaliser 105 % au lieu de 100 %. Le dépassement est une façon de mesurer l'overround, mais retirer correctement la marge nécessite de disposer de l'ensemble pertinent des prix et de choisir une méthode de normalisation.",
      "C'est pourquoi BetGPT ne fabrique pas une probabilité « sans marge » lorsqu'il ne possède qu'une seule cote. Soustraire arbitrairement quelques points donnerait un chiffre apparemment précis mais méthodologiquement fragile. Dans ce cas, la probabilité implicite brute reste la seule conversion honnête.",
      "La comparaison avec un modèle se fait ensuite sur la même échelle. Si le marché implique 52 % et que le modèle produit 57 %, l'écart est de cinq points. Cet écart n'est intéressant que si le modèle est suffisamment calibré et si la cote observée est encore réellement disponible au moment de la décision.",
      "Les mouvements de cote comptent aussi. Une analyse faite à 2,05 et consultée plus tard à 1,80 ne décrit plus le même prix. Une bonne fiche conserve donc le timestamp de la cote et évite de présenter une ancienne valeur comme si elle était encore accessible.",
      "Pour comparer plusieurs bookmakers, n'utilisez pas simplement le plus gros nombre trouvé après le match. Il faut une cote observée au moment où le pronostic est enregistré. Sans cette discipline, le bilan peut être artificiellement amélioré en sélectionnant rétrospectivement les meilleurs prix.",
      "La probabilité implicite est finalement un outil de traduction : elle rend les cotes comparables aux probabilités d'un modèle. Elle ne transforme ni le marché ni le modèle en vérité."
    ],
    links: [
      { href: "/outils/value-bet", label: "Calculateur d’écart" },
      { href: "/outils/convertisseur-cotes", label: "Convertisseur de cotes" },
      { href: "/meilleures-cotes", label: "Comparer les prix disponibles" }
    ],
  },
  {
    slug: "value-bet",
    title: "Value bet : définition, calcul et limites",
    description: "Mesurer un écart entre probabilité estimée et cote observée sans transformer une espérance positive en promesse de gain.",
    h1: "Value bet : ce que l’écart modèle-marché signifie vraiment",
    paragraphs: [
      "Une value bet n'est pas un pari qui « va gagner ». C'est une situation dans laquelle une probabilité estimée est supérieure à celle impliquée par le prix de marché, selon un modèle donné. Le concept est donc relatif : si l'estimation est mauvaise, la value calculée l'est aussi.",
      "Avec une cote décimale de 1,95 et une probabilité estimée à 55 %, l'espérance théorique d'une unité est 0,55 × 1,95 − 1, soit 0,0725 : environ +7,25 %. Ce chiffre décrit une moyenne hypothétique sur une grande série si 55 % est une bonne estimation. Le pari individuel peut évidemment perdre.",
      "La principale difficulté n'est pas la multiplication ; c'est la qualité de p. Une erreur de calibration de quelques points suffit à faire disparaître un petit avantage. À 1,95, une estimation réelle de 51 % au lieu de 55 % change complètement l'interprétation.",
      "La seconde difficulté est le timestamp. Une cote de 1,95 peut descendre à 1,75 après une information importante. Un calcul effectué au premier prix ne doit pas être présenté comme encore valable au second. BetGPT associe donc les prix utilisés à un instantané lorsqu'ils sont réellement observés.",
      "Une troisième erreur consiste à chercher une value sur tous les matchs. Un modèle sérieux peut conclure qu'aucun prix disponible ne compense suffisamment son incertitude. L'absence d'opportunité est une sortie normale du système, pas un vide à remplir.",
      "Le closing-line value peut apporter un contrôle complémentaire : si les prix obtenus avant match sont régulièrement meilleurs que les prix de clôture, cela peut indiquer que le modèle ou le timing identifie de l'information avant le marché. Ce signal doit cependant être étudié sur un large échantillon et ne remplace pas le suivi du ROI.",
      "Pour auditer une value, conservez quatre éléments : probabilité du modèle, cote réellement disponible, heure du relevé et règle utilisée pour déclarer l'écart suffisant. Sans ces quatre champs, le mot « value » devient surtout un argument marketing."
    ],
    links: [
      { href: "/outils/value-bet", label: "Calculateur value" },
      { href: "/opportunities", label: "Écarts observés" },
      { href: "/ledger", label: "Registre public" }
    ],
  },
  {
    slug: "critere-de-kelly",
    title: "Critère de Kelly pour une cote",
    description: "Comprendre la formule de Kelly, l'effet d'une probabilité mal estimée et pourquoi les variantes fractionnées existent.",
    h1: "Critère de Kelly : formule, exemple et fragilité face à l’erreur de modèle",
    paragraphs: [
      "Le critère de Kelly cherche à maximiser la croissance logarithmique d'un capital lorsque la probabilité de succès et le prix sont connus. Pour une cote décimale D, on pose b = D − 1, p la probabilité estimée et q = 1 − p. La fraction théorique est (b × p − q) / b.",
      "Exemple : avec une cote de 2,10 et p = 52 %, b vaut 1,10 et q vaut 48 %. Le calcul donne environ 8,36 %. Demi-Kelly donnerait environ 4,18 % et quart-Kelly environ 2,09 %. Ces fractions ne sont pas des recommandations ; elles illustrent seulement la sensibilité de la formule.",
      "Cette sensibilité est le problème central. Si la probabilité réelle n'est pas 52 % mais 49 %, la fraction change fortement et peut devenir négative. Kelly suppose donc une connaissance de p que l'on ne possède jamais exactement dans un modèle sportif.",
      "Les paris ne sont pas toujours indépendants non plus. Plusieurs sélections sur la même équipe, la même compétition ou des marchés liés peuvent partager les mêmes risques. Appliquer Kelly séparément à chaque ligne peut alors sous-estimer l'exposition globale.",
      "Les variantes demi-Kelly ou quart-Kelly réduisent la taille calculée afin d'atténuer l'effet des erreurs d'estimation et de la variance. Elles ne corrigent toutefois pas un modèle mal calibré. Réduire une mauvaise estimation ne la transforme pas en avantage.",
      "Lorsque la fraction est nulle ou négative, la formule ne trouve aucun avantage théorique au prix fourni. Forcer une valeur positive pour remplir une interface contredirait le calcul ; BetGPT préfère afficher zéro ou l'absence de position théorique.",
      "Le critère de Kelly est donc surtout utile pédagogiquement : il montre que la taille d'une exposition dépend conjointement du prix et de la confiance probabiliste. Il rappelle aussi qu'une petite erreur sur la probabilité peut avoir un effet disproportionné sur une décision."
    ],
    links: [
      { href: "/outils/kelly", label: "Calculateur Kelly" },
      { href: "/calculateur-mise", label: "Outils de mise, avec plafonds" },
      { href: "/jeu-responsable", label: "Jeu responsable" }
    ],
  },
  {
    slug: "lire-une-cote",
    title: "Lire une cote décimale, fractionnaire ou américaine",
    description: "Comprendre trois écritures d'un même prix, les convertir et retrouver la probabilité implicite brute.",
    h1: "Comment lire une cote sans la confondre avec une probabilité",
    paragraphs: [
      "Une cote est d'abord un prix. En format décimal, elle indique le retour total pour une unité engagée, mise comprise. À 2,50, une unité gagnante retourne 2,50 unités au total : 1,50 de profit plus l'unité initiale.",
      "Le format fractionnaire exprime principalement le profit par rapport à la mise. Une cote 3/2 correspond à 1,5 unité de profit pour 1 unité engagée, soit 2,50 en décimal. Les deux écritures décrivent le même prix.",
      "Le format américain utilise +X pour les prix supérieurs ou égaux à 2,00 en décimal et −X pour les favoris. +150 correspond à 2,50 décimal. Une cote −200 correspond à 1,50 décimal. Le signe ne décrit pas la qualité du pari ; il appartient seulement au système d'écriture.",
      "Pour comparer un prix à une probabilité de modèle, convertissez d'abord en décimal puis calculez 1 / D. À 2,50, la probabilité implicite brute est 40 %. À 1,50, elle est environ 66,7 %.",
      "Le qualificatif « brute » rappelle que la marge du bookmaker n'a pas encore été retirée. Sur un marché complet, la somme des probabilités implicites dépasse généralement 100 %. Il faut l'ensemble des issues pertinentes pour analyser cette marge proprement.",
      "Une cote basse n'est donc pas synonyme de sécurité. Elle signifie que le marché attribue un prix plus faible à l'événement et, implicitement, une probabilité plus élevée. Un favori peut perdre ; l'enjeu analytique consiste à savoir si le prix est cohérent avec votre estimation.",
      "Enfin, comparez des cotes prises au même moment. Une différence entre deux captures séparées de plusieurs heures peut provenir d'un mouvement de marché, pas d'un bookmaker structurellement plus généreux."
    ],
    links: [
      { href: "/outils/convertisseur-cotes", label: "Convertisseur" },
      { href: "/guides/probabilite-implicite", label: "Probabilité implicite" },
      { href: "/comparer-cotes", label: "Comparer les cotes" }
    ],
  },
  {
    slug: "erreurs-de-paris",
    title: "Erreurs fréquentes devant une cote",
    description: "Les biais qui faussent l'évaluation d'un pronostic : petit échantillon, résultats sélectionnés, prix rétrospectifs et excès de confiance.",
    h1: "Les erreurs qui font paraître un pronostic meilleur qu’il ne l’est",
    paragraphs: [
      "La première erreur est de confondre résultat et qualité de décision. Un pari peut gagner alors que le prix était mauvais, et un pari correctement évalué peut perdre. Si l'on juge uniquement le dernier score, on récompense le hasard autant que la méthode.",
      "La deuxième erreur est le petit échantillon. Une série de cinq ou dix matchs peut produire un taux de réussite spectaculaire sans avantage durable. Plus l'écart revendiqué est faible, plus il faut d'observations pour distinguer un signal d'une fluctuation normale.",
      "La troisième erreur est le biais de survivance. Les captures gagnantes restent visibles, les échecs disparaissent ou sont oubliés. Un registre utile conserve les deux. BetGPT ne compte dans son bilan de performance que les lignes enregistrées selon ses règles de timestamp, et les anciennes fiches tardives doivent rester identifiées comme telles.",
      "La quatrième erreur consiste à utiliser après coup la meilleure cote disponible dans la journée. Une performance ne peut être auditée que si le prix est associé à un instant précis avant le match. Choisir rétrospectivement le meilleur nombre améliore artificiellement l'EV et le ROI.",
      "La cinquième erreur est l'excès de confiance du modèle. Des probabilités de 70 % qui ne se réalisent qu'environ 58 % du temps indiquent un problème de calibration même si le taux global de bons vainqueurs semble correct. Les scores probabilistes et les courbes de calibration sont donc complémentaires du simple hit rate.",
      "La sixième erreur est de modifier la règle après avoir vu le résultat. Un seuil de value, un filtre de cote ou une exclusion de compétition doivent être définis avant l'évaluation. Sinon le backtest apprend les réponses qu'il est censé prédire.",
      "Enfin, évitez de confondre davantage de contenu avec davantage de preuve. Une analyse longue qui répète la même idée n'ajoute rien. Les éléments qui comptent sont ceux que l'on peut vérifier : source, timestamp, prix, probabilité, règle et historique complet."
    ],
    links: [
      { href: "/ledger", label: "Registre public" },
      { href: "/prediction-history", label: "Comment lire l’historique" },
      { href: "/rapports/precision", label: "Rapport de précision" },
      { href: "/jeu-responsable", label: "Jeu responsable" }
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
