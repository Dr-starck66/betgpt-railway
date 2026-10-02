import type { MatchInput, PredictionRecord } from "./types";
import type { ForumPost } from "./forum";

export type MatchBanterRow = {
  agent: string;
  target: string;
  role: string;
  body: string;
  tone: ForumPost["tone"];
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function choose(seed: string, slot: number, values: readonly string[]): string {
  return values[(hash(seed + ":" + slot) + slot * 17) % values.length] ?? values[0] ?? "";
}

function clean(value: unknown, fallback: string): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return (text || fallback).slice(0, 240);
}

export function buildMatchSpecificBanter(
  match: MatchInput,
  p: PredictionRecord,
  pick: { label: string; bestOdds: number; bestBook: string; edge?: number; decision: string },
  who: string,
): MatchBanterRow[] {
  const seed = [match.id, match.home.name, match.away.name, match.kickoff].join("|");
  const evidence = [
    ...p.coaches.flatMap((c) => [...c.keyReasons, ...c.contradictions]),
    ...p.devil.riskFactors,
    p.devil.alternativeScenario,
    ...p.scenarios.flatMap((s) => [s.label, s.description]),
    ...match.notes,
  ].map((x) => String(x ?? "").trim()).filter(Boolean);

  const fallback = [
    match.home.name + " en " + match.home.formation + " face au " + match.away.formation + " de " + match.away.name,
    "lecture initiale orientée vers " + who,
    "marché " + pick.label + " à " + pick.bestOdds.toFixed(2).replace(".", ","),
    "accord agents " + Math.round(p.consensus.directionalAgreement * 100) + " %",
    "scénario alternatif à surveiller sur " + match.home.name + " – " + match.away.name,
  ];
  const ev = (slot: number) => clean(
    evidence[(hash(seed) + slot * 7) % Math.max(1, evidence.length)],
    fallback[slot % fallback.length]!,
  );
  const hedge = (slot: number) => choose(seed, slot + 100, [
    "Je le garde comme lecture, pas comme fait acquis.",
    "Si le scénario change, cette position doit changer aussi.",
    "Je veux une condition d'invalidation claire.",
    "On garde l'incertitude visible.",
    "Le contexte du match reste prioritaire.",
  ]);
  const jab = (slot: number) => choose(seed, slot + 200, [
    "le terrain ne lit pas ton tableur",
    "évite la religion tactique",
    "une hypothèse propre reste une hypothèse",
    "garde une chaise pour le scénario contraire",
    "le football adore déranger les certitudes",
  ]);
  const signature = (slot: number) => choose(seed, slot + 300, [
    "Sur cette affiche, je veux relier chaque conclusion à un élément vérifiable du dossier.",
    "Ici, la priorité est de distinguer ce qui vient du modèle de ce qui devra être confirmé sur le terrain.",
    "Pour ce duel précis, une objection utile vaut mieux qu'une formule répétée d'un autre match.",
    "Je note ce point comme hypothèse de travail propre à cette rencontre, pas comme vérité générale.",
    "Ce match mérite sa propre lecture: contexte, prix du marché et scénario doivent rester reliés.",
    "Le fil doit pouvoir être relu après coup pour voir quelle hypothèse spécifique a tenu ou cassé.",
    "Je garde une trace séparée de ce signal afin de ne pas importer le récit d'une autre affiche.",
    "Dans ce dossier, la bonne question est ce qui invaliderait notre lecture avant de parler de certitude.",
    "On traite cette rencontre comme un cas distinct: mêmes outils, mais arguments et conditions propres.",
    "Pour cette opposition, je préfère un raisonnement traçable à une punchline interchangeable.",
    "Ce point appartient à ce match-ci; s'il n'est plus vrai en live, on le retire sans sauver les apparences.",
    "La discussion reste ancrée sur cette affiche et sur les informations disponibles pour elle.",
  ]);

  const rows: MatchBanterRow[] = [
    { agent: "Pressing", target: "Structure", role: "Coach", tone: "challenge", body: "@Structure, sur " + match.home.name + "–" + match.away.name + ", je pars de « " + ev(0) + " ». " + jab(0) + ". " + hedge(0) },
    { agent: "Structure", target: "Pressing", role: "Coach", tone: "analysis", body: "@Pressing, pour ce match je garde " + who + " comme axe parce que « " + ev(1) + " ». " + hedge(1) },
    { agent: "Duels", target: "Pressing", role: "Coach", tone: "banter", body: "@Pressing, " + match.home.formation + " contre " + match.away.formation + " et tu veux déjà réciter ton pressing. Réponds plutôt à « " + ev(2) + " »; " + jab(2) + "." },
    { agent: "Bloc", target: "Structure", role: "Coach", tone: "challenge", body: "@Structure, sur " + match.home.name + " je mets un astérisque sur « " + ev(3) + " ». Face à " + match.away.name + ", " + hedge(3).toLowerCase() },
    { agent: "Gestion", target: "Bloc", role: "Coach", tone: "analysis", body: "@Bloc, le scénario " + match.home.name + "–" + match.away.name + " ne se résume pas au coup d'envoi. « " + ev(4) + " ». Si le contexte bouge, on réévalue." },
    { agent: "Avocat du diable", target: "Consensus", role: "Contrôle", tone: "challenge", body: "@Consensus, " + Math.round(p.consensus.directionalAgreement * 100) + " % d'accord ne transforme pas « " + ev(5) + " » en résultat. Je garde cette objection au dossier." },
    { agent: "Consensus", target: "Avocat du diable", role: "Méta", tone: "consensus", body: "@Avocat du diable, reçu. Pour " + match.home.name + "–" + match.away.name + ", la lecture commune reste " + pick.label + ", avec « " + ev(6) + " » comme objection visible." },
    { agent: "Cotes", target: "Consensus", role: "Marché", tone: "analysis", body: "@Consensus, " + pick.label + " est coté " + pick.bestOdds.toFixed(2).replace(".", ",") + " chez " + pick.bestBook.replace(/\s·\s.*$/, "") + ". Je relie ce prix à « " + ev(7) + " », sans garantie." },
    { agent: "Terrain", target: "Cotes", role: "Terrain", tone: "banter", body: "@Cotes, pendant que tu parles en décimales, moi je vérifie si " + match.home.name + "–" + match.away.name + " ressemble encore à « " + ev(8) + " ». " + jab(8) + "." },
    { agent: "Live", target: "Terrain", role: "Terrain", tone: "live", body: "@Terrain, référence avant live: « " + ev(9) + " ». Si le " + match.home.formation + "–" + match.away.formation + " réel s'en éloigne, on corrige le fil." },
    { agent: "Pressing", target: "Duels", role: "Coach", tone: "banter", body: "@Duels, sur " + match.away.name + ", « " + ev(10) + " » vaut mieux qu'un slogan. Réponds au fond; " + jab(10) + "." },
    { agent: "Duels", target: "Pressing", role: "Coach", tone: "challenge", body: "@Pressing, justement: « " + ev(11) + " ». Si ce point se retourne pendant " + match.home.name + "–" + match.away.name + ", ta lecture doit suivre." },
    { agent: "Structure", target: "Gestion", role: "Coach", tone: "analysis", body: "@Gestion, ce qui soutient " + who + ": « " + ev(12) + " ». Ce qui peut casser la lecture: « " + ev(13) + " ». Voilà une thèse vérifiable après le match." },
    { agent: "Avocat du diable", target: "Live", role: "Contrôle", tone: "banter", body: "@Live, garde la capture. Si " + match.home.name + "–" + match.away.name + " invalide « " + ev(14) + " », je ressors mon dossier des objections." },
    { agent: "Gestion", target: "Avocat du diable", role: "Coach", tone: "analysis", body: "@Avocat du diable, ici je surveille surtout « " + ev(15) + " ». Changement de contexte = nouvelle lecture, pas commentaire recyclé." },
    { agent: "Cotes", target: "Gestion", role: "Marché", tone: "analysis", body: "@Gestion, contrôle marché: " + pick.label + ", edge " + ((pick.edge ?? 0) * 100).toFixed(1).replace(".", ",") + " %. « " + ev(16) + " » doit rester cohérent avec le prix." },
    { agent: "Bloc", target: "Cotes", role: "Coach", tone: "challenge", body: "@Cotes, pour " + match.away.name + ", je veux tester « " + ev(17) + " » contre la forme du match. " + hedge(17) },
    { agent: "Consensus", target: "Bloc", role: "Méta", tone: "consensus", body: "@Bloc, contrat final pour " + match.home.name + "–" + match.away.name + ": thèse « " + ev(18) + " », objection « " + ev(19) + " », marché " + pick.label + "." },
  ];
  return rows.map((row, slot) => ({ ...row, body: row.body + " " + signature(slot) }));
}

export function textShingleSimilarity(a: string, b: string, size = 4): number {
  const grams = (value: string) => {
    const words = value.toLowerCase().replace(/[^a-zà-ÿ0-9]+/gi, " ").trim().split(/\s+/).filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i <= words.length - size; i += 1) out.add(words.slice(i, i + size).join(" "));
    return out;
  };
  const aa = grams(a);
  const bb = grams(b);
  if (!aa.size && !bb.size) return 1;
  let common = 0;
  for (const g of aa) if (bb.has(g)) common += 1;
  return common / Math.max(1, aa.size + bb.size - common);
}
