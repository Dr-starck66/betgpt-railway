"use client";

import type { PersonalityMode, UserMemory } from "./types";

export type ChatDiplomaId =
  | "D01"
  | "D02"
  | "D03"
  | "D04"
  | "D05"
  | "D06"
  | "D07"
  | "D08"
  | "D09"
  | "D10";

export type ChatDiploma = {
  id: ChatDiplomaId;
  title: string;
  image: string;
  portraitImage: string;
  unlock: string;
};

export const CHAT_DIPLOMAS: Record<ChatDiplomaId, ChatDiploma> = {
  D01: {
    id: "D01",
    title: "Plus nul parieur de l’univers",
    image: "/diplomes/diplome-01-plus-nul-parieur-univers.svg",
    portraitImage: "/diplomes/portrait/diplome-01-plus-nul-parieur-univers-portrait.svg",
    unlock: "Régularité catastrophique détectée.",
  },
  D02: {
    id: "D02",
    title: "Pire pronostiqueur de l’année",
    image: "/diplomes/diplome-02-pire-pronostiqueur-annee.svg",
    portraitImage: "/diplomes/portrait/diplome-02-pire-pronostiqueur-annee-portrait.svg",
    unlock: "La boule de cristal demande un congé.",
  },
  D03: {
    id: "D03",
    title: "Maître absolu du pari perdant",
    image: "/diplomes/diplome-03-maitre-pari-perdant.svg",
    portraitImage: "/diplomes/portrait/diplome-03-maitre-pari-perdant-portrait.svg",
    unlock: "Un ticket vient de rejoindre les archives du désastre.",
  },
  D04: {
    id: "D04",
    title: "Génie du mauvais choix",
    image: "/diplomes/diplome-04-genie-mauvais-choix.svg",
    portraitImage: "/diplomes/portrait/diplome-04-genie-mauvais-choix-portrait.svg",
    unlock: "Le bouton opposé était manifestement le bon.",
  },
  D05: {
    id: "D05",
    title: "Roi du « J’étais sûr pourtant »",
    image: "/diplomes/diplome-05-roi-j-etais-sur-pourtant.svg",
    portraitImage: "/diplomes/portrait/diplome-05-roi-j-etais-sur-pourtant-portrait.svg",
    unlock: "Confiance maximale, résultat expérimental.",
  },
  D06: {
    id: "D06",
    title: "Parieur qui aurait mieux fait de dormir",
    image: "/diplomes/diplome-06-mieux-fait-dormir.svg",
    portraitImage: "/diplomes/portrait/diplome-06-mieux-fait-dormir-portrait.svg",
    unlock: "La sieste présentait un meilleur rendement ajusté au risque.",
  },
  D07: {
    id: "D07",
    title: "Docteur honoris causa en mauvais pronostics",
    image: "/diplomes/diplome-07-docteur-mauvais-pronostics.svg",
    portraitImage: "/diplomes/portrait/diplome-07-docteur-mauvais-pronostics-portrait.svg",
    unlock: "Une thèse entière pour arriver au mauvais côté.",
  },
  D08: {
    id: "D08",
    title: "Champion de la cote qui ne passe jamais",
    image: "/diplomes/diplome-08-cote-ne-passe-jamais.svg",
    portraitImage: "/diplomes/portrait/diplome-08-cote-ne-passe-jamais-portrait.svg",
    unlock: "Même une petite cote vient de demander une protection policière.",
  },
  D09: {
    id: "D09",
    title: "Plus grand destructeur de combinés",
    image: "/diplomes/diplome-09-destructeur-combines.svg",
    portraitImage: "/diplomes/portrait/diplome-09-destructeur-combines-portrait.svg",
    unlock: "Le dernier match a encore choisi la violence.",
  },
  D10: {
    id: "D10",
    title: "Parieur certifié sans instinct de survie",
    image: "/diplomes/diplome-10-sans-instinct-survie.svg",
    portraitImage: "/diplomes/portrait/diplome-10-sans-instinct-survie-portrait.svg",
    unlock: "Le mot ALL-IN a déclenché l’alarme incendie.",
  },
};

type SelectInput = {
  userText: string;
  assistantText?: string;
  punchline?: string;
  memory: UserMemory;
  mode: PersonalityMode;
  avoid?: ChatDiplomaId;
  recent?: ChatDiplomaId[];
};

function add(scores: Record<ChatDiplomaId, number>, id: ChatDiplomaId, value: number) {
  scores[id] += value;
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export function selectChatDiploma(input: SelectInput): ChatDiplomaId | undefined {
  const text = [input.userText, input.assistantText ?? "", input.punchline ?? ""]
    .join(" ")
    .toLowerCase();

  const scores: Record<ChatDiplomaId, number> = {
    D01: 0, D02: 0, D03: 0, D04: 0, D05: 0,
    D06: 0, D07: 0, D08: 0, D09: 0, D10: 0,
  };

  const loss = /\b(perdu|perdre|défaite|defaite|raté|rate|foiré|foire|ticket mort|ticket cramé|ticket crame)\b/i.test(text);
  const explicitBet = /\b(pari|ticket|mise|cote|combiné|combine|pronostic|prono|parier)\b/i.test(text);

  if (/\b(all[- ]?in|tapis|je mets tout|je mise tout|bankroll entière|bankroll entiere|tout mon solde)\b/i.test(text)) {
    add(scores, "D10", 16); add(scores, "D03", 10); add(scores, "D01", 8); add(scores, "D05", 7);
  }
  if (/\bcombin[eé]\b/i.test(text)) {
    add(scores, "D09", 10); add(scores, "D03", 8); add(scores, "D01", 7); add(scores, "D07", 7);
  }
  if (/\b(?:8|9|1[0-9]|2[0-9])\s*(?:matchs?|sélections?|selections?)\b/i.test(text)) add(scores, "D09", 8);
  if (/\b(dernier match|dernière sélection|derniere selection|une seule.*perd|14.*correct|15.*match)\b/i.test(text)) add(scores, "D09", 8);

  if (/\b(100\s*%|impossible de perdre|s[uû]r(?:e)?(?: à| a)? 100|j['’]étais sûr|j['’]etais sur|certain)\b/i.test(text)) {
    add(scores, "D05", 14); add(scores, "D02", 9); add(scores, "D07", 8); add(scores, "D01", 7);
  }
  if (/\b(cote|odd)\s*(?:de\s*)?1[,.](?:0[1-9]|1\d|2\d|30)\b/i.test(text) || /\bpetite cote\b/i.test(text)) {
    add(scores, "D08", 13); add(scores, "D03", 9); add(scores, "D02", 8); add(scores, "D01", 7);
  }

  if (/\b(finalement|je change|j['’]ai changé|j['’]ai change|mauvais choix|j['’]aurais dû|j['’]aurais du|autre option)\b/i.test(text)) {
    add(scores, "D04", 11); add(scores, "D05", 8); add(scores, "D06", 7);
  }
  if (/\b(pronostic|prono|prédiction|prediction|j['’]avais dit|je pensais que|je voyais)\b/i.test(text) && loss) {
    add(scores, "D02", 10); add(scores, "D07", 8); add(scores, "D03", 8);
  }
  if (/\b(analyse|statistiques?|modèle|modele|xg|algorithme|étudié|etudie)\b/i.test(text) && loss) {
    add(scores, "D07", 10); add(scores, "D02", 8); add(scores, "D03", 8);
  }

  if (/\b(dormir|sommeil|nuit|3h|4h|5h|tard|fatigué|fatigue|insomnie)\b/i.test(text) && (explicitBet || loss)) {
    add(scores, "D06", 11); add(scores, "D04", 7); add(scores, "D10", 7);
  }
  if (loss && explicitBet) { add(scores, "D03", 8); add(scores, "D02", 7); }
  if (/\b(encore perdu|toujours perdu|je perds tout le temps|jamais un pari)\b/i.test(text)) {
    add(scores, "D01", 12); add(scores, "D03", 9); add(scores, "D02", 8);
  }

  if (input.memory.blackBook.matchsEffectivementPerdus >= 3) add(scores, "D01", 6);
  if (input.memory.blackBook.matchsImpossiblesAPerdre >= 2) add(scores, "D05", 5);
  if (input.memory.blackBook.combinésDePlus5Matchs >= 2) add(scores, "D09", 5);
  if (input.memory.blackBook.parisModifiésDerniereSeconde >= 2) add(scores, "D04", 5);
  if (input.memory.blackBook.niveauDeConfianceInjustifie >= 2) add(scores, "D10", 4);

  if (input.mode === "ROAST" && loss && explicitBet) {
    add(scores, "D03", 2);
    add(scores, "D01", 1);
  }

  const ranked = (Object.keys(scores) as ChatDiplomaId[])
    .filter((id) => scores[id] >= 7)
    .sort((a, b) => scores[b] - scores[a]);

  if (!ranked.length) return undefined;

  const recent = new Set([...(input.recent ?? []).slice(-5), ...(input.avoid ? [input.avoid] : [])]);
  const maxScore = scores[ranked[0]];
  const relevantBand = ranked.filter((id) => scores[id] >= Math.max(7, maxScore - 7));
  const unseen = relevantBand.filter((id) => !recent.has(id));
  const pool = unseen.length ? unseen : relevantBand;
  const seed = [input.userText, input.assistantText ?? "", input.punchline ?? "", [...recent].join(",")].join("|");
  const weighted: ChatDiplomaId[] = [];
  for (const id of pool) {
    const copies = Math.max(1, Math.min(5, Math.ceil((scores[id] - 6) / 3)));
    for (let i = 0; i < copies; i += 1) weighted.push(id);
  }
  return weighted[hashText(seed) % weighted.length];
}
