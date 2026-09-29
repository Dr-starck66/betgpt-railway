import type { Absence, MatchInput, PredictionRecord } from "./types.ts";
import { consensusFromBooks, valueDelta } from "./odds-consensus.ts";
import { skipEuropeFrenchProno } from "./french-clubs.ts";
import { serpDescription, serpH1, serpTitle } from "@/lib/serp/answer.ts";
import { recentLineLabel, type RecentLine } from "./team-form.ts";

export type ArticleSection = {
  id: string;
  h2: string;
  paragraphs: string[];
  items?: string[];
};

export type ArticleFaq = { q: string; a: string };

export type QualityScores = {
  readability: number;
  specificity: number;
  usefulness: number;
  factualGrounding: number;
  seoQuality: number;
  searchIntent: number;
  naturalLanguage: number;
  nonDuplication: number;
  uncertaintyHandling: number;
};

export type QualityReport = {
  scores: QualityScores;
  min: number;
  pass: boolean;
  flags: string[];
};

export type MatchArticle = {
  h1: string;
  title: string;
  metaDescription: string;
  verdictLabel: string;
  likelyScore: string | null;
  likelyScoreP: number | null;
  probs: { home: number; draw: number; away: number } | null;
  confidence10: number | null;
  confidenceLabel: string;
  updatedAt: string;
  lead: string;
  sections: ArticleSection[];
  faq: ArticleFaq[];
  advanced: { label: string; text: string; tooltip?: string }[];
  quality: QualityReport;
  fingerprint: string[];
};

type Strength = "clear" | "moderate" | "slight" | "none";
type Favorite = "home" | "away" | "draw" | "open";
type Scoring = "high" | "medium" | "low";

type FormStory = {
  letters: string[];
  wins: number;
  draws: number;
  losses: number;
  n: number;
  known: boolean;
};

type Facts = {
  home: string;
  away: string;
  pair: string;
  competition: string;
  venue: string;
  kickoff: string;
  status: MatchInput["status"];
  mute: boolean;
  pHome: number | null;
  pDraw: number | null;
  pAway: number | null;
  favorite: Favorite;
  strength: Strength;
  scoring: Scoring;
  lambdaH: number | null;
  lambdaA: number | null;
  likely: { score: string; p: number }[];
  formH: FormStory;
  formA: FormStory;
  recentH: RecentLine[];
  recentA: RecentLine[];
  absH: Absence[];
  absA: Absence[];
  possH: number;
  possA: number;
  xgH: number;
  xgA: number;
  xgaH: number;
  xgaA: number;
  restH: number;
  restA: number;
  marketHome: number | null;
  valueHomePp: number | null;
  confidence10: number | null;
  updatedAt: string;
  notes: string[];
};

const BANNED = [
  "s'annonce passionnant",
  "s’annonce passionnant",
  "les deux équipes voudront gagner",
  "tout peut arriver",
  "le football est imprévisible",
  "promet du spectacle",
  "attendent ce match avec impatience",
  "donneront tout",
  "coup de sifflet final",
  "cette rencontre promet",
];

const JARGON = [
  "ppda",
  "field tilt",
  "coefficient domicile",
  "différentiel défensif",
  "home-strength",
  "isotonic",
  "platt",
  "dixon-coles",
  "lambda",
  "modelprob",
];

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

function num(n: number, d = 1): string {
  return n.toFixed(d).replace(".", ",");
}

function whenLong(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function formOf(raw?: string): FormStory {
  const letters = (raw ?? "")
    .toUpperCase()
    .replace(/[^WDL]/g, "")
    .slice(-6)
    .split("")
    .filter(Boolean);
  return {
    letters,
    wins: letters.filter((x) => x === "W").length,
    draws: letters.filter((x) => x === "D").length,
    losses: letters.filter((x) => x === "L").length,
    n: letters.length,
    known: letters.length >= 1,
  };
}

function topScores(prediction?: PredictionRecord): { score: string; p: number }[] {
  if (prediction?.live?.likelyScores?.length) return prediction.live.likelyScores.slice(0, 3);
  const m = prediction?.ensemble?.matrix;
  if (!m?.length) return [];
  const cells: { score: string; p: number }[] = [];
  for (let h = 0; h < m.length; h++) {
    const row = m[h] ?? [];
    for (let a = 0; a < row.length; a++) {
      const p = row[a] ?? 0;
      if (p > 0) cells.push({ score: `${h}-${a}`, p });
    }
  }
  return cells.sort((x, y) => y.p - x.p).slice(0, 3);
}

function classifyFavorite(h: number, d: number, a: number): { favorite: Favorite; strength: Strength } {
  const max = Math.max(h, d, a);
  const rest = [h, d, a].sort((x, y) => y - x);
  const gap = (rest[0] ?? 0) - (rest[1] ?? 0);
  if (max < 0.4 || gap < 0.05) return { favorite: "open", strength: "none" };
  const side: Favorite = h >= d && h >= a ? "home" : a >= d && a >= h ? "away" : "draw";
  if (max >= 0.62 && gap >= 0.18) return { favorite: side, strength: "clear" };
  if (max >= 0.52 && gap >= 0.1) return { favorite: side, strength: "moderate" };
  return { favorite: side, strength: "slight" };
}

function scoringOf(lh: number | null, la: number | null, over25: number | null): Scoring {
  const sum = (lh ?? 0) + (la ?? 0);
  if (over25 != null && over25 >= 0.62) return "high";
  if (over25 != null && over25 <= 0.42) return "low";
  if (sum >= 3) return "high";
  if (sum > 0 && sum <= 2.2) return "low";
  return "medium";
}

function confidenceLabel(score: number | null): string {
  if (score == null) return "non mesurée";
  if (score >= 7.5) return "bonne";
  if (score >= 6) return "modérée à bonne";
  if (score >= 4.5) return "modérée";
  return "limitée";
}

function extractFacts(match: MatchInput, prediction?: PredictionRecord): Facts {
  const p = prediction?.calibrated;
  const h = p?.home ?? null;
  const d = p?.draw ?? null;
  const a = p?.away ?? null;
  const fav =
    h != null && d != null && a != null ? classifyFavorite(h, d, a) : { favorite: "open" as const, strength: "none" as const };
  const lh = prediction?.live?.expectedGoals.home ?? prediction?.ensemble.lambdaHome ?? null;
  const la = prediction?.live?.expectedGoals.away ?? prediction?.ensemble.lambdaAway ?? null;
  const books = match.current?.length ? match.current : match.opening ? [match.opening] : [];
  const consensus = books.length ? consensusFromBooks(books, match.opening) : null;
  const delta =
    consensus?.fair && h != null && d != null && a != null ? valueDelta({ home: h, draw: d, away: a }, consensus.fair) : null;
  const conf =
    prediction?.live?.confidence10 ??
    (prediction ? Math.round((prediction.intelligence.confidenceScore ?? 0) * 10 * 10) / 10 : null);
  return {
    home: match.home.name,
    away: match.away.name,
    pair: `${match.home.name} – ${match.away.name}`,
    competition: match.competition,
    venue: match.venue,
    kickoff: match.kickoff,
    status: match.status,
    mute: skipEuropeFrenchProno(match),
    pHome: h,
    pDraw: d,
    pAway: a,
    favorite: fav.favorite,
    strength: fav.strength,
    scoring: scoringOf(lh, la, p?.over25 ?? null),
    lambdaH: lh,
    lambdaA: la,
    likely: topScores(prediction),
    formH: formOf(match.formHome),
    formA: formOf(match.formAway),
    recentH: match.recentHome ?? [],
    recentA: match.recentAway ?? [],
    absH: match.absencesHome?.value ?? [],
    absA: match.absencesAway?.value ?? [],
    possH: match.home.possession,
    possA: match.away.possession,
    xgH: match.home.xgFor,
    xgA: match.away.xgFor,
    xgaH: match.home.xgAgainst,
    xgaA: match.away.xgAgainst,
    restH: match.restHome?.value ?? 6,
    restA: match.restAway?.value ?? 6,
    marketHome: consensus?.fair?.home ?? null,
    valueHomePp: delta ? Math.round(delta.home * 1000) / 10 : null,
    confidence10: conf,
    updatedAt: prediction?.timestamp || "",
    notes: match.notes ?? [],
  };
}

function favName(f: Facts): string {
  if (f.favorite === "away") return f.away;
  if (f.favorite === "draw") return "le nul";
  return f.home;
}

function otherName(f: Facts): string {
  return f.favorite === "away" ? f.home : f.away;
}

function verdictLabel(f: Facts): string {
  if (f.pHome == null) return `Pronostic ${f.pair}`;
  if (f.favorite === "open" || f.strength === "none") return "Aucun favori net";
  if (f.favorite === "draw") return "Nul le plus probable";
  const who = favName(f);
  if (f.strength === "clear") return `${who}, favori assez net`;
  if (f.strength === "moderate") return `${who} favori`;
  return `${who} légèrement favori`;
}

function interpretProbs(f: Facts): string {
  if (f.pHome == null || f.pDraw == null || f.pAway == null) {
    return `BetGPT n’a pas encore de probabilités publiées pour ${f.pair}.`;
  }
  const h = pct(f.pHome);
  const d = pct(f.pDraw);
  const a = pct(f.pAway);
  if (f.favorite === "open" || f.strength === "none") {
    return `BetGPT ne dégage pratiquement aucun favori. Les trois issues sont proches (${f.home} ${h}, nul ${d}, ${f.away} ${a}) et il serait trompeur de présenter l’une des deux équipes comme nettement supérieure.`;
  }
  if (f.favorite === "draw") {
    return `Le scénario le plus probable n’est pas une victoire, mais le match nul (${d}). ${f.home} et ${f.away} restent trop proches pour qu’un vainqueur ressorte avec conviction (${f.home} ${h}, ${f.away} ${a}).`;
  }
  const who = favName(f);
  const rival = otherName(f);
  if (f.strength === "clear") {
    return `Le modèle considère ${who} comme un favori assez net. Avec environ ${f.favorite === "home" ? h : a} de probabilité de victoire, l’écart avec les deux autres scénarios est important (nul ${d}, ${rival} ${f.favorite === "home" ? a : h}).`;
  }
  if (f.strength === "moderate") {
    return `${who} ressort comme l’issue la plus probable, avec ${f.favorite === "home" ? h : a} de chances estimées, contre ${d} pour le nul et ${f.favorite === "home" ? a : h} pour ${rival}. L’avantage existe, sans parler de victoire acquise.`;
  }
  return `${who} part avec un avantage, mais pas au point de considérer sa victoire comme acquise. BetGPT estime ses chances autour de ${f.favorite === "home" ? h : a}, contre ${d} pour le nul et ${f.favorite === "home" ? a : h} pour ${rival}. Une probabilité de ${f.favorite === "home" ? h : a} désigne l’issue la plus probable parmi trois, pas une certitude.`;
}

function formParagraph(name: string, story: FormStory, recent: RecentLine[]): string | null {
  if (!story.known && !recent.length) return null;
  const scoreLine = recent.length
    ? ` Scores ESPN enregistrés avant ce match : ${recent.map(recentLineLabel).join(" ; ")}.`
    : "";
  if (!story.known) return `${name} : résultats partiels seulement.${scoreLine}`;
  const { wins, draws, losses, n } = story;
  const base =
    wins === 0 && losses >= 2
      ? `${name} reste sans victoire sur les ${n} rencontres renseignées : ${draws} nul${draws > 1 ? "s" : ""} et ${losses} défaites.`
      : draws > wins && draws > losses
        ? `${name} a surtout partagé les points récemment : ${draws} nuls parmi ${n} résultats, pour ${wins} victoire${wins > 1 ? "s" : ""} et ${losses} défaite${losses > 1 ? "s" : ""}.`
        : wins >= 3
          ? `${name} compte ${wins} victoires, ${draws} nul${draws > 1 ? "s" : ""} et ${losses} défaite${losses > 1 ? "s" : ""} sur ${n} matchs enregistrés.`
          : `${name} : ${wins} victoire${wins > 1 ? "s" : ""}, ${draws} nul${draws > 1 ? "s" : ""} et ${losses} défaite${losses > 1 ? "s" : ""} sur ${n} rencontre${n > 1 ? "s" : ""} renseignée${n > 1 ? "s" : ""}.`;
  return `${base}${scoreLine} Cette série décrit des scores observés, pas la possession ni un xG de fournisseur.`;
}

function factorParagraph(f: Facts): string {
  const probs =
    f.pHome != null && f.pDraw != null && f.pAway != null
      ? `1 ${pct(f.pHome)}, N ${pct(f.pDraw)}, 2 ${pct(f.pAway)}`
      : "probabilités non publiées";
  const formH = f.formH.known ? f.formH.letters.join("") : "non observée";
  const formA = f.formA.known ? f.formA.letters.join("") : "non observée";
  const abs =
    f.absH.length || f.absA.length
      ? `absences listées : ${[...f.absH, ...f.absA].map((x) => x.player).join(", ")}`
      : "absences non vérifiées";
  return [
    `Les probabilités du modèle sont ${probs}.`,
    `${f.home} joue à domicile${f.venue && f.venue !== "Stade" ? ` (${f.venue})` : ""} ; ${f.away} joue à l’extérieur.`,
    `Forme observée : ${f.home} ${formH}, ${f.away} ${formA}.`,
    `Profil d’attaque estimé, pas un xG observé : ${f.home} ${num(f.xgH, 2)}, ${f.away} ${num(f.xgA, 2)}.`,
    `Profil défensif estimé (buts concédés du modèle) : ${f.home} ${num(f.xgaH, 2)}, ${f.away} ${num(f.xgaA, 2)}.`,
    `${abs}.`,
    `Aucun de ces facteurs ne suffit à lui seul, et le lieu du match n’est pas compté deux fois.`,
  ].join(" ");
}

function absencesParagraph(team: string, items: Absence[]): string | null {
  if (!items.length) return null;
  const stars = items.filter((x) => x.role === "star" || x.importance >= 0.7);
  const named = (stars.length ? stars : items).slice(0, 3);
  const list = named
    .map((x) => {
      const why = x.reason === "injury" ? "blessure" : x.reason === "suspension" ? "suspension" : "choix de rotation";
      const role = x.role === "star" ? "cadre" : x.role === "starter" ? "titulaire habituel" : "option de rotation";
      return `${x.player} (${role}, ${why})`;
    })
    .join(", ");
  const uncertain = items.some((x) => x.reason === "rotation");
  const tone = uncertain
    ? `Les absences listées pour ${team} restent à confirmer selon le rôle : ${list}. BetGPT ne transforme pas un doute d’effectif en certitude tactique.`
    : `Du côté de ${team}, les absences listées concernent ${list}. Cela retire des options, surtout si le poste touché n’a pas de relais évident.`;
  return tone;
}

function whyFavorite(f: Facts): string[] {
  if (f.pHome == null) {
    return [`Les probabilités de ${f.pair} ne sont pas encore publiées. BetGPT n’invente pas un favori.`];
  }
  const paras: string[] = [];
  const who = favName(f);
  const rival = otherName(f);
  if (f.favorite === "open") {
    paras.push(
      `Aucun facteur ne ressort assez fort pour désigner un favori. Les probabilités sont trop proches, et les indicateurs disponibles ne racontent pas le même match d’un côté à l’autre.`,
    );
  } else if (f.favorite === "draw") {
    paras.push(
      `BetGPT penche vers le nul parce que ni ${f.home} ni ${f.away} ne se détache clairement. L’écart entre les trois issues reste trop mince pour vendre une victoire.`,
    );
  } else {
    const bits: string[] = [];
    const formWho = f.favorite === "home" ? f.formH : f.formA;
    const formRival = f.favorite === "home" ? f.formA : f.formH;
    if (formWho.known && formWho.wins > formRival.wins) {
      bits.push(`la série récente enregistrée est meilleure du côté de ${who}`);
    }
    if (f.favorite === "home") bits.push(`le fait de jouer à ${f.venue && f.venue !== "Stade" ? f.venue : "domicile"} ajoute un petit avantage de contexte`);
    if (f.xgH !== f.xgA) {
      const attackWho = f.favorite === "home" ? f.xgH : f.xgA;
      const attackRival = f.favorite === "home" ? f.xgA : f.xgH;
      if (attackWho > attackRival + 0.15) {
        bits.push(`les profils estimés, non observés, supposent que ${who} produirait davantage d’occasions ; cette hypothèse reste à confirmer`);
      }
    }
    const defWho = f.favorite === "home" ? f.xgaH : f.xgaA;
    const defRival = f.favorite === "home" ? f.xgaA : f.xgaH;
    if (defRival > defWho + 0.2) {
      bits.push(`${rival} présente une fragilité défensive dans le profil estimé, sans mesure observée permettant de la confirmer`);
    }
    if (!bits.length) {
      bits.push(`l’ensemble des probabilités 1-N-2, pas un seul chiffre isolé`);
    }
    paras.push(
      `Pourquoi cet avantage à ${who} ? D’abord ${bits[0]}.${bits[1] ? ` Ensuite, ${bits[1]}.` : ""}${bits[2] ? ` Enfin, ${bits[2]}.` : ""}`,
    );
    paras.push(
      `Ces éléments décrivent le contexte. Ils n’équivalent pas, à eux seuls, au pourcentage du modèle.`,
    );
  }
  paras.push(factorParagraph(f));
  if (!f.absH.length && !f.absA.length) {
    paras.push(
      `Aucun forfait n’est listé dans les données disponibles. Cela ne prouve pas que les effectifs sont complets ; les compositions restent à vérifier.`,
    );
  }
  if (f.favorite === "home" && f.venue && f.venue !== "Stade") {
    paras.push(
      `Le lieu enregistré est ${f.venue}. L’avantage du terrain est déjà intégré au modèle : il ne faut pas le compter une deuxième fois comme une preuve indépendante.`,
    );
  }
  return paras;
}

function keysOf(f: Facts): { title: string; text: string }[] {
  const keys: { title: string; text: string }[] = [];
  const who = favName(f);
  const rival = otherName(f);
  const possGap = f.possH - f.possA;
  if (Math.abs(possGap) >= 6) {
    const boss = possGap > 0 ? f.home : f.away;
    const other = boss === f.home ? f.away : f.home;
    keys.push({
      title: `${boss} doit transformer son occupation`,
      text: `Le profil de possession estimé, non observé, suppose que ${boss} devrait voir davantage le ballon. La question n’est pas la possession pour la possession : c’est de savoir si cette occupation produit des occasions nettes, ou si ${other} défend assez bas pour que le match s’enlise.`,
    });
  }
  if (f.favorite !== "open" && f.favorite !== "draw") {
    keys.push({
      title: `${rival} doit être efficace`,
      text:
        f.scoring === "low"
          ? `Dans un match plutôt fermé, ${rival} n’aura probablement pas beaucoup d’occasions franches. Gâcher les premières devient immédiatement coûteux.`
          : `Si ${rival} crée peu d’occasions, surtout à ${f.favorite === "home" ? "l’extérieur" : "domicile"}, il ne pourra pas se permettre de les gaspiller.`,
    });
  }
  if (f.scoring === "low" || (f.likely[0] && Number(f.likely[0].score.split("-")[0]) + Number(f.likely[0].score.split("-")[1]) <= 2)) {
    keys.push({
      title: "Le premier but peut changer le scénario",
      text: `Si ${who === "le nul" ? f.home : who} marque tôt, ${rival === "le nul" ? f.away : rival} sera obligé de prendre davantage de risques. À l’inverse, plus le score reste nul longtemps, plus le scénario du match nul prend du poids.`,
    });
  } else if (f.scoring === "high") {
    keys.push({
      title: "Le match peut s’ouvrir vite",
      text: `Les simulations penchent vers un match plus ouvert que la moyenne. Un 0-0 prolongé n’est pas le scénario central : les deux attaques ont assez de volume estimé pour que le score bouge.`,
    });
  }
  if (f.absH.length || f.absA.length) {
    const side = f.absH.length >= f.absA.length ? f.home : f.away;
    keys.push({
      title: `Les absences de ${side} pèsent-elles ?`,
      text: `Les forfaits listés du côté de ${side} retirent des options. Cela ne bascule un match que si le poste concerné est central et mal relayé — BetGPT le traite comme un facteur, pas comme une sentence.`,
    });
  }
  if (Number.isFinite(f.restA) && Number.isFinite(f.restH) && (f.restA <= 3 || f.restH <= 3)) {
    const tired = f.restA <= f.restH ? f.away : f.home;
    keys.push({
      title: `La fraîcheur de ${tired}`,
      text: `Le dossier estime peu de repos pour ${tired}. Vérifier le calendrier réel : ce chiffre ne prouve pas une fatigue ou une baisse d’intensité.`,
    });
  }
  if (keys.length < 3) {
    keys.push({
      title: "Garder le match dans le bon rythme",
      text:
        f.strength === "slight" || f.favorite === "open"
          ? `L’écart est trop mince pour que l’une des deux équipes impose son scénario d’entrée. Celui qui accepte le rythme de l’autre prend un risque immédiat.`
          : `${who} doit empêcher ${rival} de transformer la rencontre en match de transitions. Si le favori perd le contrôle du rythme, sa cote de victoire fond vite.`,
    });
  }
  return keys.slice(0, 3);
}

function scoreParagraphs(f: Facts): string[] {
  const top = f.likely[0];
  if (!top) {
    return [
      `BetGPT ne publie pas de score exact inventé pour ${f.pair} : la distribution n’est pas assez nette pour isoler un 1-0 ou un 2-1 comme s’il s’agissait d’une prévision certaine.`,
    ];
  }
  const p = pct(top.p);
  const second = f.likely[1];
  const third = f.likely[2];
  const closed = Number(top.score.split("-")[0]) + Number(top.score.split("-")[1]) <= 2;
  const paras = [
    `Le ${top.score.replace("-", "-")} ressort comme le score exact individuel le plus probable, mais seulement dans environ ${p} des simulations. Autrement dit, BetGPT privilégie ${closed ? "un match relativement fermé" : "un match où le score peut bouger"} plutôt qu’un score exact réellement prévisible.`,
  ];
  const alts = [second, third].filter(Boolean) as { score: string; p: number }[];
  if (alts.length) {
    paras.push(
      `${alts.map((x) => `Le ${x.score.replace("-", "-")} (${pct(x.p)})`).join(" et ")} font également partie des scénarios crédibles. Un score exact n’est jamais une certitude : c’est le scénario qui revient le plus souvent, pas « le » résultat.`,
    );
  }
  return paras;
}

function oddsParagraph(f: Facts): string | null {
  if (f.mute || f.pHome == null || f.marketHome == null || f.valueHomePp == null) return null;
  const abs = Math.abs(f.valueHomePp);
  if (abs < 3) {
    return `Le modèle et le marché (cotes ramenées hors marge) sont proches sur ${f.home}. L’écart existe, mais il reste trop faible pour parler d’opportunité évidente. Désaccord de modèle n’est pas gain garanti.`;
  }
  const dir = f.valueHomePp > 0 ? "plus optimiste" : "plus prudent";
  return `Le modèle BetGPT est ${dir} sur ${f.home} que le marché : il estime ses chances à ${pct(f.pHome)}, contre environ ${pct(f.marketHome)} après normalisation des cotes disponibles. L’écart est notable, sans devenir une « value » automatique.`;
}

function riskParagraphs(f: Facts): string[] {
  const rival = otherName(f);
  const who = favName(f);
  if (f.favorite === "open") {
    return [
      `Le principal risque, ici, est de forcer un favori qui n’existe pas. Les trois issues restent crédibles : un 0-0, une victoire de ${f.home} ou de ${f.away} ne serait pas une surprise statistique.`,
    ];
  }
  if (f.strength === "slight" || f.favorite === "draw") {
    return [
      `Le principal risque pour ce pronostic vient du faible écart entre ${who === "le nul" ? "le nul" : who} et les autres issues. Si ${rival === "le nul" ? f.away : rival} ralentit le rythme et empêche les occasions franches, un 0-0 ou un 1-1 devient rapidement plausible.`,
    ];
  }
  const extra =
    f.absH.length || f.absA.length
      ? ` Une composition différente de celle listée, ou une absence de dernière minute, peut aussi déplacer les probabilités.`
      : ` Une composition inattendue avant le coup d’envoi pourrait également modifier les probabilités.`;
  return [
    `Même avec un favori ${f.strength === "clear" ? "assez net" : "identifié"}, le pronostic peut se tromper si ${rival} marque tôt : ${who} devrait alors s’ouvrir, et le scénario du match change.${extra}`,
  ];
}

function usefulStats(f: Facts): string[] {
  const lines: string[] = [];
  if (f.formH.known) {
    lines.push(
      `${f.home} : ${f.formH.wins} victoire${f.formH.wins > 1 ? "s" : ""}, ${f.formH.draws} nul${f.formH.draws > 1 ? "s" : ""}, ${f.formH.losses} défaite${f.formH.losses > 1 ? "s" : ""} sur ${f.formH.n} matchs listés.`,
    );
  }
  if (f.formA.known) {
    lines.push(
      `${f.away} : ${f.formA.wins} victoire${f.formA.wins > 1 ? "s" : ""}, ${f.formA.draws} nul${f.formA.draws > 1 ? "s" : ""}, ${f.formA.losses} défaite${f.formA.losses > 1 ? "s" : ""} sur ${f.formA.n} matchs listés.`,
    );
  }
  if (f.pHome != null && f.pDraw != null && f.pAway != null) {
    lines.push(`Probabilités BetGPT : ${f.home} ${pct(f.pHome)} · nul ${pct(f.pDraw)} · ${f.away} ${pct(f.pAway)}.`);
  }
  if (f.likely[0]) {
    lines.push(`Score exact le plus fréquent dans les simulations : ${f.likely[0].score} (${pct(f.likely[0].p)}).`);
  }
  if (f.absH.length) lines.push(`Absents listés ${f.home} : ${f.absH.map((x) => x.player).join(", ")}.`);
  if (f.absA.length) lines.push(`Absents listés ${f.away} : ${f.absA.map((x) => x.player).join(", ")}.`);
  return lines;
}

function advancedOf(f: Facts, prediction?: PredictionRecord): MatchArticle["advanced"] {
  const rows: MatchArticle["advanced"] = [];
  if (f.lambdaH != null && f.lambdaA != null) {
    rows.push({
      label: "Buts attendus (modèle)",
      text: `${f.home} ${num(f.lambdaH, 2)} · ${f.away} ${num(f.lambdaA, 2)}.`,
      tooltip:
        "Les buts attendus estiment la qualité des occasions. Ce n’est pas le nombre de buts réellement marqués, et ce n’est pas un xG de fournisseur observé.",
    });
  }
  rows.push({
    label: "Possession estimée",
    text: `${f.home} ${Math.round(f.possH)} % · ${f.away} ${Math.round(f.possA)} %. Indicateur de profil d’équipe, pas une observation du match.`,
  });
  if (f.marketHome != null && f.pHome != null) {
    rows.push({
      label: "Marché vs modèle",
      text: `Fair marché ${f.home} ${pct(f.marketHome)} · BetGPT ${pct(f.pHome)}.`,
      tooltip: "Les cotes sont ramenées hors marge (no-vig). Un écart n’est pas un gain.",
    });
  }
  if (prediction) {
    rows.push({
      label: "Plus de 2,5 buts / BTTS",
      text: `Plus de 2,5 : ${pct(prediction.calibrated.over25)} · Les deux équipes marquent : ${pct(prediction.calibrated.bttsYes)}.`,
    });
  }
  return rows;
}

function faqOf(match: MatchInput, f: Facts): ArticleFaq[] {
  const vs = f.pair;
  const score =
    match.status === "live" && match.scoreHome != null
      ? `Le score en direct de ${vs} est ${match.scoreHome}–${match.scoreAway}${match.clock ? `, ${match.clock}` : ""}.`
      : match.status === "finished" && match.scoreHome != null
        ? `Le résultat de ${vs} est ${match.scoreHome}–${match.scoreAway}.`
        : `${f.home} joue contre ${f.away} le ${whenLong(f.kickoff)}. Le score n’est pas encore ouvert.`;
  const favQ =
    f.pHome == null
      ? `BetGPT n’a pas encore publié de favori pour ${vs}.`
      : f.favorite === "open"
        ? `BetGPT ne dégage pas de favori net entre ${f.home} et ${f.away}. Les trois issues restent proches.`
        : `BetGPT donne actuellement ${f.strength === "clear" ? "un avantage assez net" : f.strength === "slight" ? "un léger avantage" : "l’avantage"} à ${favName(f)}. Le nul conserve une probabilité de ${f.pDraw != null ? pct(f.pDraw) : "—"}.`;
  const scoreQ = f.likely[0]
    ? `Le ${f.likely[0].score} constitue le score exact individuel le plus probable (${pct(f.likely[0].p)}). Cela décrit surtout ${f.scoring === "low" ? "un match assez fermé" : f.scoring === "high" ? "un match où le score peut bouger" : "un scénario médian"}, pas une certitude.`
    : `Aucun score exact n’est isolé avec assez de netteté pour ${vs}.`;
  const whyQ =
    f.favorite === "open"
      ? `Les probabilités et la forme récente ne suffisent pas à désigner un favori.`
      : `Les facteurs lisibles sont les probabilités 1-N-2${f.formH.known || f.formA.known ? ", la forme observée" : ""}${f.favorite === "home" ? " et le fait de recevoir" : ""}. Le détail chiffré est dans l’analyse.`;
  const absQ =
    f.absH.length || f.absA.length
      ? [
          f.absH.length ? `${f.home} : ${f.absH.map((x) => x.player).join(", ")}` : null,
          f.absA.length ? `${f.away} : ${f.absA.map((x) => x.player).join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(". ") + "."
      : `Aucun forfait n’est listé de source fiable pour ${vs}. BetGPT n’invente pas de feuille de match.`;
  const out: ArticleFaq[] = [
    { q: `Qui est favori entre ${f.home} et ${f.away} ?`, a: favQ },
    { q: `Quel score prévoir pour ${f.home} – ${f.away} ?`, a: scoreQ },
    { q: `Pourquoi ${favName(f) === "le nul" ? "le nul" : favName(f)} est-il devant ?`, a: whyQ },
    { q: `Quels joueurs manqueront ${vs} ?`, a: absQ },
    { q: `Quand joue ${f.home} contre ${f.away} ?`, a: `${vs} : coup d’envoi le ${whenLong(f.kickoff)}, ${f.competition}, ${f.venue}.` },
    { q: `Quel est le score de ${f.home} ${f.away} ?`, a: score },
  ];
  if (match.status === "live" || match.status === "finished") {
    out.unshift({ q: `Résultat ${f.home} ${f.away}`, a: score });
  }
  return out;
}

function leadOf(match: MatchInput, f: Facts): string {
  if (f.mute) {
    if (match.status === "live" && match.scoreHome != null) {
      return `${f.pair} : ${match.scoreHome}–${match.scoreAway}${match.clock ? ` (${match.clock})` : ""}. Pas de pronostic BetGPT : club français en coupe d’Europe.`;
    }
    if (match.status === "finished" && match.scoreHome != null) {
      return `Résultat ${f.pair} : ${match.scoreHome}–${match.scoreAway}. Pas de pronostic BetGPT (club français en C1/Europa).`;
    }
    return `${f.pair} : pas de pronostic BetGPT. Club français en Ligue des champions ou Ligue Europa. Score et calendrier seulement.`;
  }
  if (match.status === "live" && match.scoreHome != null) {
    return `Score en direct ${f.pair} : ${match.scoreHome}–${match.scoreAway}${match.clock ? ` (${match.clock})` : ""}. ${interpretProbs(f)}`;
  }
  if (match.status === "finished" && match.scoreHome != null) {
    return `Résultat ${f.pair} : ${match.scoreHome}–${match.scoreAway}. Avant le match, BetGPT affichait ${verdictLabel(f).toLowerCase()}.`;
  }
  const conf =
    f.confidence10 != null ? ` Confiance ${num(f.confidence10)}/10 — ${confidenceLabel(f.confidence10)}.` : "";
  return `${interpretProbs(f)}${conf}`;
}

function titleOf(match: MatchInput, _f: Facts): string {
  return serpTitle(match);
}

function h1Of(match: MatchInput, _f: Facts): string {
  return serpH1(match);
}

function metaOf(match: MatchInput, _f: Facts): string {
  return serpDescription(match);
}

function fingerprintOf(text: string, names: string[]): string[] {
  let cleaned = text.toLowerCase();
  for (const n of names) cleaned = cleaned.replaceAll(n.toLowerCase(), "equipe");
  cleaned = cleaned
    .replace(/aucun forfait n[’']est listé[\s\S]{0,120}feuille de match\./g, " ")
    .replace(/18\+[^.]*\./g, " ")
    .replace(/betgpt n[’']accepte pas de paris\./g, " ")
    .replace(/un écart de modèle n[’']est pas un conseil de mise\./g, " ")
    .replace(/[^a-zàâäçéèêëîïôùûü0-9 ]/gi, " ");
  const stop = new Set(["equipe", "pour", "dans", "avec", "cette", "sont", "plus", "mais", "pas", "une", "des", "les", "que", "qui", "par", "sur", "match"]);
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3 && !stop.has(w));
  const grams: string[] = [];
  for (let i = 0; i < words.length - 2; i++) grams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return grams.slice(0, 180);
}

function countHits(text: string, needles: string[]): number {
  const t = text.toLowerCase();
  return needles.reduce((n, s) => n + (t.includes(s) ? 1 : 0), 0);
}

function avgSentence(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return 0;
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  return words / sentences.length;
}

function scoreQuality(article: Omit<MatchArticle, "quality" | "fingerprint">, f: Facts): QualityReport {
  const main = [article.lead, ...article.sections.flatMap((s) => s.paragraphs)].join(" ");
  const flags: string[] = [];
  const scores: QualityScores = {
    readability: 9,
    specificity: 9,
    usefulness: 9,
    factualGrounding: 9,
    seoQuality: 9,
    searchIntent: 9,
    naturalLanguage: 9,
    nonDuplication: 8,
    uncertaintyHandling: 9,
  };
  const avg = avgSentence(main);
  if (avg > 32) {
    scores.readability -= 2;
    flags.push("phrases longues");
  } else if (avg > 26) scores.readability -= 1;
  if (countHits(main, JARGON)) {
    scores.readability -= 3;
    scores.naturalLanguage -= 3;
    flags.push("jargon");
  }
  if (countHits(main, BANNED)) {
    scores.naturalLanguage -= 4;
    scores.nonDuplication -= 3;
    flags.push("filler");
  }
  if (!main.includes(f.home) || !main.includes(f.away)) {
    scores.specificity -= 4;
    flags.push("noms manquants");
  }
  if (f.pHome != null && !/\d+\s*%/.test(main)) {
    scores.specificity -= 2;
    flags.push("pas de %");
  }
  if (article.sections.length < 3) {
    scores.usefulness -= 2;
    flags.push("sections maigres");
  }
  const intentHead = `${article.lead} ${article.verdictLabel}`;
  if (f.pHome != null && !/\d+\s*%/.test(intentHead) && !/favori|nul|ouvert/i.test(intentHead)) {
    scores.searchIntent -= 3;
    flags.push("intention trop bas");
  }
  if (f.strength === "slight" && /(?:est une certitude|victoire est acquise|favori écrasant|gagné d’avance)/i.test(main)) {
    scores.uncertaintyHandling -= 4;
    flags.push("surconfiance");
  }
  if (f.absH.length === 0 && f.absA.length === 0 && /diakhaby|blessé confirmé/i.test(main)) {
    scores.factualGrounding -= 8;
    flags.push("absence inventée");
  }
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pairHits = (main.toLowerCase().match(new RegExp(`${escapeRegex(f.home.toLowerCase())}[^.]{0,12}${escapeRegex(f.away.toLowerCase())}`, "g")) ?? []).length;
  if (pairHits > 10) {
    scores.seoQuality -= 3;
    flags.push("keyword stuffing");
  }
  if (!article.h1.toLowerCase().includes(f.home.toLowerCase())) scores.seoQuality -= 2;
  const vals = Object.values(scores).map((n) => Math.max(0, Math.min(10, n)));
  const named = { ...scores };
  (Object.keys(named) as (keyof QualityScores)[]).forEach((k, i) => {
    named[k] = vals[i] ?? named[k];
  });
  const min = Math.min(...vals);
  return { scores: named, min, pass: min >= 8 && flags.every((x) => x !== "absence inventée" && x !== "filler" && x !== "jargon"), flags };
}

function buildSections(f: Facts): ArticleSection[] {
  const sections: ArticleSection[] = [];
  const kickoff = Number.isFinite(Date.parse(f.kickoff)) ? new Date(f.kickoff).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "date à confirmer";
  sections.push({ id: "contexte", h2: `Quand se joue ${f.pair} ?`, paragraphs: [
    `${f.competition} · ${kickoff} (heure de Paris)${f.venue && f.venue !== "Stade" ? ` · ${f.venue}` : ""}.`,
    f.status === "finished" ? "Rencontre terminée. Cette analyse est une lecture du modèle, potentiellement recalculée après le match ; elle ne constitue pas la preuve d’un pronostic publié avant le coup d’envoi." : f.status === "cancelled" ? "Rencontre annulée : aucune nouvelle mise ne doit être proposée." : "Analyse automatisée : les probabilités et profils tactiques sont des estimations. Les formes récentes et absences correspondent uniquement aux informations enregistrées.",
  ] });
  const why = whyFavorite(f);
  sections.push({
    id: "pourquoi",
    h2:
      f.favorite === "open"
        ? `Pourquoi ${f.pair} reste ouvert`
        : `Pourquoi BetGPT donne l’avantage à ${favName(f)}`,
    paragraphs: why,
  });
  const formParas = [formParagraph(f.home, f.formH, f.recentH), formParagraph(f.away, f.formA, f.recentA)].filter(
    Boolean,
  ) as string[];
  if (formParas.length) {
    sections.push({
      id: "forme",
      h2: `Forme récente de ${f.home} et ${f.away}`,
      paragraphs: formParas,
    });
  }
  const absParas = [absencesParagraph(f.home, f.absH), absencesParagraph(f.away, f.absA)].filter(Boolean) as string[];
  if (absParas.length) {
    sections.push({
      id: "absents",
      h2: `Les absents peuvent-ils changer ${f.pair} ?`,
      paragraphs: absParas,
    });
  }
  const keys = keysOf(f);
  sections.push({
    id: "cles",
    h2: `Les 3 clés de ${f.pair}`,
    paragraphs: [],
    items: keys.map((k) => `${k.title} — ${k.text}`),
  });
  sections.push({
    id: "score",
    h2: `Quel score prévoir pour ${f.home} – ${f.away} ?`,
    paragraphs: scoreParagraphs(f),
  });
  const odds = oddsParagraph(f);
  if (odds && !f.mute) {
    sections.push({
      id: "pari",
      h2: `Quel pari envisager sur ${f.pair} ?`,
      paragraphs: [
        odds,
        `Un écart de modèle n’est pas un conseil de mise. 18+, jeu responsable. BetGPT n’accepte pas de paris.`,
      ],
    });
  }
  sections.push({
    id: "risque",
    h2: `Pourquoi ce pronostic peut se tromper`,
    paragraphs: riskParagraphs(f),
  });
  const stats = usefulStats(f);
  if (stats.length) {
    sections.push({
      id: "stats",
      h2: `Que disent vraiment les statistiques ?`,
      paragraphs: [
        `Les chiffres ci-dessous soutiennent l’analyse ; ils ne la remplacent pas. Les indicateurs d’occasions sont des estimations de modèle, pas des xG observés par un fournisseur.`,
      ],
      items: stats,
    });
  }
  return sections.filter((s) => s.paragraphs.length + (s.items?.length ?? 0) > 0);
}

export function compileArticle(match: MatchInput, prediction?: PredictionRecord): MatchArticle {
  const f = extractFacts(match, prediction);
  const draft: Omit<MatchArticle, "quality" | "fingerprint"> = {
    h1: h1Of(match, f),
    title: titleOf(match, f),
    metaDescription: metaOf(match, f).slice(0, 168),
    verdictLabel: verdictLabel(f),
    likelyScore: f.likely[0]?.score ?? null,
    likelyScoreP: f.likely[0]?.p ?? null,
    probs: f.pHome != null && f.pDraw != null && f.pAway != null ? { home: f.pHome, draw: f.pDraw, away: f.pAway } : null,
    confidence10: f.confidence10,
    confidenceLabel: confidenceLabel(f.confidence10),
    updatedAt: f.updatedAt,
    lead: leadOf(match, f),
    sections: buildSections(f),
    faq: faqOf(match, f),
    advanced: advancedOf(f, prediction),
  };
  const body = [draft.lead, ...draft.sections.flatMap((s) => [...s.paragraphs, ...(s.items ?? [])])].join("\n");
  let quality = scoreQuality(draft, f);
  if (!quality.pass && quality.flags.includes("jargon")) {
    draft.sections = draft.sections.map((s) => ({
      ...s,
      paragraphs: s.paragraphs.filter((p) => !countHits(p, JARGON)),
      items: s.items?.filter((p) => !countHits(p, JARGON)),
    }));
    quality = scoreQuality(draft, f);
  }
  return {
    ...draft,
    quality,
    fingerprint: fingerprintOf(body, [f.home, f.away, f.home.split(" ")[0] ?? "", f.away.split(" ")[0] ?? ""]),
  };
}

export function articlePlainText(article: MatchArticle): string {
  return [
    article.lead,
    ...article.sections.flatMap((s) => [s.h2, ...s.paragraphs, ...(s.items ?? [])]),
  ].join("\n\n");
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export function hasBannedFiller(text: string): boolean {
  return countHits(text, BANNED) > 0;
}

export function hasMainJargon(text: string): boolean {
  return countHits(text, JARGON) > 0;
}
