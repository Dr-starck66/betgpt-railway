export type AbsurdInsult = {
  text: string;
  score: number;
  recipe: string;
};

const OBJECTS = [
  "grille-pain", "aspirateur", "parpaing", "radiateur", "mixeur", "cendrier",
  "micro-ondes", "tabouret", "sèche-cheveux", "frigo", "trombone", "paillasson",
  "bouilloire", "agrafeuse", "tondeuse", "essuie-glace", "ventilateur", "pédalo",
  "chaussette", "multiprise", "caddie", "moule à gaufres", "klaxon", "presse-purée",
];

const CREATURES = [
  "pigeon", "hamster", "lama", "ornithorynque", "marmotte", "canard", "pangolin",
  "suricate", "blaireau", "calamar", "dindon", "chihuahua", "manchot", "ragondin",
  "escargot", "alpaga", "hérisson", "poulpe", "raton laveur", "chèvre",
];

const STATES = [
  "sous caféine", "en orbite", "sous kétamine", "en surchauffe", "en moonwalk",
  "sous Red Bull", "en apesanteur", "en grève", "en roue libre",
  "sous stéroïdes cosmiques", "en télétravail sur Mars", "en burn-out quantique",
  "sous Wi-Fi nucléaire", "en stage chez la NASA", "en RTT intersidéral",
  "en contrôle fiscal galactique",
];

const ADJECTIVES = [
  "cosmique", "quantique", "nucléaire", "interstellaire", "administratif",
  "radioactif", "galactique", "démoniaque", "hydraulique", "électromagnétique",
  "municipal", "transdimensionnel", "carburé au chaos", "certifié ISO n'importe quoi",
];

const ACTIONS = [
  "fait du moonwalk dans une centrale nucléaire",
  "essaie de dribbler avec un ticket de caisse",
  "joue au poker avec une calculatrice cassée",
  "fait des saltos dans le service comptabilité",
  "prend ses décisions avec un dé à vingt faces",
  "cherche la value dans le bac à légumes",
  "défend en tongs sur une patinoire",
  "prépare ses combinés au lance-flammes",
  "regarde les cotes avec des jumelles à l'envers",
  "fait du pressing dans un lave-vaisselle",
];

const FINANCIAL_DISASTERS = [
  "autant donner ta carte bleue et le code à un inconnu et le lâcher dans une boutique Dior",
  "autant confier ton compte bancaire à un hamster avec un abonnement Amazon Prime",
  "autant jeter ton portefeuille dans un volcan et demander un reçu",
  "autant donner ton RIB à un poulpe en costume qui dit « fais-moi confiance »",
  "autant poser ta carte bancaire sur la table et crier « servez-vous, les artistes ! »",
  "autant remplacer ton conseiller bancaire par une roue de casino sous caféine",
  "autant mettre ton salaire dans une enveloppe et l'envoyer à « Monsieur Hasard, planète Mars »",
  "autant laisser un pigeon trader ton livret A depuis un cybercafé",
  "autant donner ton code PIN à un lama dans une bijouterie et partir déjeuner",
  "autant convertir ton budget du mois en tickets à gratter et les lancer depuis un hélicoptère",
];

const COUPLE_CLICHES = [
  "autant donner ta carte bleue à ta femme, le code avec, et la lâcher chez Dior pendant les soldes",
  "autant donner ta carte bleue à ta copine et lui dire « fais-toi plaisir » devant Sephora",
  "autant donner ton salaire à ton mec, le déposer chez Feu Vert et lui dire « prends tout ce qui brille »",
  "autant lâcher ton mari chez Leroy Merlin avec une remorque vide et aucun plafond de carte",
  "autant donner ta CB à ton mec devant un rayon barbecue et partir trois heures sans téléphone",
  "autant envoyer ta femme chez IKEA avec ta carte, le code PIN et la phrase « on a besoin de deux-trois trucs »",
];

const CONTEXT_HOOKS: Array<[RegExp, string[]]> = [
  [/\b(combin[eé]|ticket|pari|mise)\b/i, ["ton ticket", "ton combiné", "ta mise"]],
  [/\b(cote|odds|value)\b/i, ["ta cote", "ta value", "ton calcul"]],
  [/\b(score|20-0|10-0|gagne|perd)\b/i, ["ton scénario", "ton score", "ta prophétie"]],
  [/\b(btts|over|under|handicap)\b/i, ["ton marché", "ton angle", "ton pari"]],
];

const BLOCKED = [
  /n[eè]gr/i,
  /youp/i,
  /bougnoul/i,
  /p[eé]d[eé]/i,
  /tapette/i,
];

function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(xs: readonly T[], rnd: () => number): T {
  return xs[Math.floor(rnd() * xs.length)]!;
}

function contextNoun(context: string, rnd: () => number): string {
  for (const [re, values] of CONTEXT_HOOKS) {
    if (re.test(context)) return pick(values, rnd);
  }
  return pick(["ton raisonnement", "ton idée", "ton analyse", "ton plan"], rnd);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function overlap(a: string, b: string): number {
  const aa = new Set(normalize(a).split(" ").filter((x) => x.length > 3));
  const bb = new Set(normalize(b).split(" ").filter((x) => x.length > 3));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const w of aa) if (bb.has(w)) common++;
  return common / Math.min(aa.size, bb.size);
}

function scoreCandidate(text: string, context: string, recent: string[]): number {
  if (BLOCKED.some((re) => re.test(text))) return 0;

  const words = text.split(/\s+/).length;
  let score = 48;

  if (words >= 7 && words <= 18) score += 16;
  else if (words <= 28) score += 8;

  if (/[!?]{2,}/.test(text)) score += 7;
  if (/\b(cosmique|quantique|nucl[eé]aire|galactique|Mars|NASA|interstellaire)\b/i.test(text)) score += 9;
  if (/\b(grille-pain|pigeon|hamster|lama|parpaing|micro-ondes|poulpe|ragondin)\b/i.test(text)) score += 7;
  if (/\b(carte bleue|code PIN|Dior|Sephora|Leroy Merlin|IKEA|Feu Vert)\b/i.test(text)) score += 8;

  const hook = contextNoun(context, mulberry32(hash32(context + ":hook")));
  if (normalize(text).includes(normalize(hook))) score += 9;

  const repetition = recent.reduce((m, prev) => Math.max(m, overlap(text, prev)), 0);
  score -= Math.round(repetition * 45);

  return Math.max(0, Math.min(100, score));
}

function templates(context: string, rnd: () => number): Array<{ text: string; recipe: string }> {
  const obj = pick(OBJECTS, rnd);
  const animal = pick(CREATURES, rnd);
  const state = pick(STATES, rnd);
  const adj = pick(ADJECTIVES, rnd);
  const action = pick(ACTIONS, rnd);
  const hook = contextNoun(context, rnd);

  return [
    { text: `MAIS T'ES UN ${obj.toUpperCase()} ${adj.toUpperCase()} OU QUOI ?!`, recipe: "objet+adjectif" },
    { text: `QUI A LAISSÉ UN ${animal.toUpperCase()} ${state.toUpperCase()} GÉRER ${hook.toUpperCase()} ?!`, recipe: "animal+état+contexte" },
    { text: `ESPÈCE DE ${obj.toUpperCase()} ${state.toUpperCase()} !!!`, recipe: "objet+état" },
    { text: `${hook.toUpperCase()} ${action.toUpperCase()} !!!`, recipe: "contexte+action-impossible" },
    { text: `ON DIRAIT UN ${animal.toUpperCase()} ${adj.toUpperCase()} QUI ${action.toUpperCase()} !!!`, recipe: "créature+collision+surréalisme" },
    { text: `AVEC ${hook.toUpperCase()}, ${pick(FINANCIAL_DISASTERS, rnd).toUpperCase()} !!!`, recipe: "catastrophe-financière+quotidien" },
    { text: `AVEC ${hook.toUpperCase()}, ${pick(COUPLE_CLICHES, rnd).toUpperCase()} !!!`, recipe: "cliché-couple+catastrophe-financière" },
  ];
}

export function generateAbsurdInsult(
  context: string,
  recent: string[] = [],
  salt = "",
): AbsurdInsult {
  const baseSeed = hash32(`${context}\\n${salt}\\n${recent.slice(-8).join("\\n")}`);
  const candidates: AbsurdInsult[] = [];

  for (let round = 0; round < 12; round++) {
    const rnd = mulberry32(baseSeed ^ Math.imul(round + 1, 0x9e3779b1));
    for (const item of templates(context, rnd)) {
      candidates.push({
        text: item.text,
        score: scoreCandidate(item.text, context, recent),
        recipe: item.recipe,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "fr"));
  return candidates[0] ?? {
    text: "ESPÈCE DE GRILLE-PAIN COSMIQUE !!!",
    score: 70,
    recipe: "fallback",
  };
}

export function absurdInsultCreativeBrief(context: string, recent: string[] = []): string {
  const seedA = generateAbsurdInsult(context, recent, "A");
  const seedB = generateAbsurdInsult(context, [...recent, seedA.text], "B");
  const seedC = generateAbsurdInsult(context, [...recent, seedA.text, seedB.text], "C");

  return [
    "ASTRA INSULT LAB — contraintes créatives :",
    "- Fabrique une image absurde neuve, courte, mémorisable et liée au message.",
    "- Collision recommandée : objet banal + univers incompatible + état impossible + détail football/paris.",
    "- Utilise aussi des comparaisons de catastrophe financière très visuelles : carte bleue, code PIN, salaire, boutique de luxe, casino, banque.",
    "- Les scènes de couple caricaturales sont permises si elles restent des gags de situation précis et non des affirmations générales sur les femmes ou les hommes.",
    "- Évite les insultes haineuses, discriminatoires, menaçantes ou visant une caractéristique personnelle sensible.",
    "- Ne copie pas les graines ci-dessous mot pour mot : elles servent seulement à fixer le niveau d'absurdité.",
    `- Graine A : ${seedA.text}`,
    `- Graine B : ${seedB.text}`,
    `- Graine C : ${seedC.text}`,
    "- Si tu peux faire plus inattendu, fais-le. Une bonne punchline doit donner envie d'être capturée et partagée.",
  ].join("\\n");
}

export function shouldDropAbsurdInsult(context: string, recent: string[] = []): boolean {
  const text = context.trim();
  if (text.length < 8) return false;
  if (/\b(suicide|mourir|mort|deuil|cancer|maladie|agression|viol|urgence)\b/i.test(text)) return false;

  if (/\b(20-0|10-0|100%|s[uû]r|certain|impossible de perdre|all[- ]?in|tapis|combin[eé].*(8|9|10|11|12))\b/i.test(text)) {
    return true;
  }

  return hash32(`${text}\\n${recent.slice(-3).join("\\n")}`) % 5 === 0;
}
