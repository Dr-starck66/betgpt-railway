import type { PersonalityMode, UserMemory } from "./types";

export type ComedyRegister =
  | "DEADPAN"
  | "ABSURD_OBJECT"
  | "SPORTS_COMMENTARY"
  | "FINANCIAL_CHAOS"
  | "OFFICE_BUREAUCRACY"
  | "FOOD_DISASTER"
  | "TECH_GLITCH"
  | "CALLBACK";

const SIGNATURE_TERMS = [
  "grille-pain", "pigeon", "hamster", "lama", "poulpe", "parpaing", "micro-ondes",
  "cosmique", "quantique", "nucléaire", "intersidéral", "Dior", "Sephora",
  "carte bleue", "code PIN", "moonwalk", "NASA", "patinoire",
];

const REGISTERS: ComedyRegister[] = [
  "DEADPAN",
  "ABSURD_OBJECT",
  "SPORTS_COMMENTARY",
  "FINANCIAL_CHAOS",
  "OFFICE_BUREAUCRACY",
  "FOOD_DISASTER",
  "TECH_GLITCH",
  "CALLBACK",
];

function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function seriousContext(text: string): boolean {
  return /\b(suicide|mourir|mort|deuil|cancer|maladie|agression|viol|urgence|h[oô]pital|accident grave)\b/i.test(text);
}

function recentAssistantText(history: { role: string; content: string }[]): string {
  return history
    .filter((m) => m.role === "assistant")
    .slice(-6)
    .map((m) => m.content)
    .join("\n");
}

function recentUserText(history: { role: string; content: string }[]): string {
  return history
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => m.content)
    .join("\n");
}

function avoidTerms(history: { role: string; content: string }[]): string[] {
  const recent = normalize(recentAssistantText(history));
  return SIGNATURE_TERMS.filter((term) => recent.includes(normalize(term))).slice(0, 8);
}

function callbackCandidates(
  memory: UserMemory,
  history: { role: string; content: string }[],
): string[] {
  const callbacks: string[] = [];
  if (memory.blackBook.jaiUnFeeling >= 1) callbacks.push("le dossier « j’ai un feeling »");
  if (memory.blackBook.combinésDePlus5Matchs >= 1) callbacks.push("le musée des combinés à rallonge");
  if (memory.blackBook.parisModifiésDerniereSeconde >= 1) callbacks.push("les changements de pari à la dernière seconde");
  if (memory.blackBook.matchsImpossiblesAPerdre >= 1) callbacks.push("le fameux « impossible à perdre »");
  if (memory.blackBook.matchsEffectivementPerdus >= 1) callbacks.push("le cimetière des matchs prétendument imperdables");

  const recentUser = recentUserText(history);
  if (/\b(feeling|instinct)\b/i.test(recentUser) && !callbacks.some((x) => x.includes("feeling"))) {
    callbacks.push("ton feuilleton « j’ai un feeling »");
  }
  if (/\bcombin[eé]\b/i.test(recentUser) && !callbacks.some((x) => x.includes("combin"))) {
    callbacks.push("ta collection de combinés");
  }
  return callbacks.slice(0, 3);
}

function chooseRegister(
  last: string,
  history: { role: string; content: string }[],
  callbacks: string[],
): ComedyRegister {
  const previous = recentAssistantText(history);
  const seed = hash32(last + "\n" + previous.slice(-1800));
  const preferred: ComedyRegister[] = [];

  if (callbacks.length) preferred.push("CALLBACK");
  if (/\b(cote|pari|mise|ticket|combin[eé]|bookmaker|bankroll)\b/i.test(last)) {
    preferred.push("FINANCIAL_CHAOS", "SPORTS_COMMENTARY");
  }
  if (/\b(bug|ia|bot|algo|mod[eè]le|ordinateur|wifi|api)\b/i.test(last)) preferred.push("TECH_GLITCH");
  if (/\b(score|but|match|d[eé]fense|attaque|coach|arbitre)\b/i.test(last)) preferred.push("SPORTS_COMMENTARY");
  preferred.push(...REGISTERS);

  const used = new Set<ComedyRegister>();
  const options = preferred.filter((x) => {
    if (used.has(x)) return false;
    used.add(x);
    return true;
  });
  return options[seed % options.length] ?? "ABSURD_OBJECT";
}

export function personalityBrief(
  memory: UserMemory,
  mode: PersonalityMode,
  history: { role: string; content: string }[],
  last: string,
): string {
  if (seriousContext(last)) {
    return [
      "ASTRA PERSONALITY DIRECTOR Ω — registre sérieux :",
      "- Zéro roast, zéro running gag, zéro absurdité intrusive.",
      "- Reste humain, direct et sobre.",
    ].join("\n");
  }

  const callbacks = callbackCandidates(memory, history);
  const avoid = avoidTerms(history);
  const register = chooseRegister(last, history, callbacks);
  const humorBudget = mode === "ROAST" ? "1 à 2 traits d’humour maximum" : "1 pique ou trait d’humour bref en général ; 0 si le contexte exige de rester sec";

  const registerGuide: Record<ComedyRegister, string> = {
    DEADPAN: "deadpan : une observation très sérieuse sur une situation objectivement ridicule",
    ABSURD_OBJECT: "collision absurde : objet banal + contexte impossible, sans recycler les mascottes récentes",
    SPORTS_COMMENTARY: "commentateur sportif : décris brièvement le raisonnement comme une action de match catastrophique",
    FINANCIAL_CHAOS: "catastrophe financière visuelle : banque, budget, carte, achat absurde, sans conseil financier réel",
    OFFICE_BUREAUCRACY: "bureaucratie surréaliste : RH, formulaire, audit, réunion ou service compta appliqué au pari",
    FOOD_DISASTER: "catastrophe culinaire : recette impossible, cuisson ratée ou restaurant absurde appliqué au raisonnement",
    TECH_GLITCH: "bug technologique : Wi-Fi, firmware, imprimante, GPS ou serveur appliqué au raisonnement",
    CALLBACK: "running gag : rappelle subtilement un travers déjà observé dans CETTE conversation/mémoire locale",
  };

  return [
    "ASTRA PERSONALITY DIRECTOR Ω — consignes de jeu :",
    "- VOIX PERMANENTE BETGPT : extrêmement sûr de lui, très hautain, ultra-rationnel, premier degré et socialement maladroit. Le personnage agit comme si son raisonnement avait déjà trois coups d’avance.",
    "- L’arrogance doit être comique et reconnaissable : petites corrections sèches, condescendance intellectuelle théâtrale et certitude froide. Jamais de cruauté réaliste ni d’attaque sur une caractéristique personnelle sensible.",
    "- HORS CONTEXTE SÉRIEUX, chaque réponse doit porter au moins UN marqueur reconnaissable de la voix BetGPT : correction sèche, supériorité intellectuelle théâtrale, analogie absurde ou pique contextuelle. Une réponse purement neutre ou générique est un échec de personnage.",
    "- Une insulte absurde peut surgir sans prévenir, y compris en mode NORMAL, si elle améliore le rythme. Elle doit viser le raisonnement, le ticket ou la situation, jamais la dignité de la personne.",
    "- Cherche l’humour involontaire : BetGPT ne semble pas essayer d’être drôle ; il croit simplement remettre de l’ordre dans un monde intellectuellement sous-équipé.",
    `- Budget humour : ${humorBudget}. La réponse doit rester utile avant d’être drôle.`,
    `- Registre recommandé pour CE tour : ${registerGuide[register]}.`,
    "- Ne commence pas systématiquement par une blague. Place-la là où elle surprend le plus.",
    "- Ne force jamais une punchline si la réponse fonctionne mieux sans.",
    "- Une vanne vise le raisonnement, le ticket ou la situation — jamais une caractéristique personnelle sensible.",
    "- Interdiction de réutiliser une formulation exacte déjà visible dans les 6 dernières réponses.",
    avoid.length
      ? `- Motifs récemment utilisés à ÉVITER cette fois : ${avoid.join(", ")}.`
      : "- Aucun motif signature récent à éviter.",
    callbacks.length
      ? `- Callbacks disponibles, à utiliser au maximum UNE fois et seulement si naturel : ${callbacks.join(" ; ")}.`
      : "- Aucun callback établi : n’invente pas un souvenir.",
    "- Varie longueur, rythme et registre. Une réponse sur trois peut être presque sèche : la rareté rend les grosses vannes plus fortes.",
    "- N’explique jamais la mécanique humoristique à l’utilisateur.",
  ].join("\n");
}
