import type { MatchInput } from "@/engine/types";
import { hasScore, statusLabel, strictStatus, type StrictStatus } from "@/lib/serp/status";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

type ParisParts = { y: string; mo: number; d: number; hh: string; mm: string };

function parisParts(iso: string): ParisParts | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const mo = Number(bag.month);
  const d = Number(bag.day);
  if (!bag.year || !mo || !d) return null;
  return { y: bag.year, mo, d, hh: bag.hour ?? "00", mm: bag.minute ?? "00" };
}

export function parisDayLong(iso: string): string {
  const p = parisParts(iso);
  if (!p) return "";
  return `${p.d} ${MONTHS[p.mo - 1]} ${p.y}`;
}

export function parisTime(iso: string): string {
  const p = parisParts(iso);
  if (!p) return "";
  return `${p.hh} h ${p.mm}`;
}

export function parisLong(iso: string): string {
  const day = parisDayLong(iso);
  const time = parisTime(iso);
  return day && time ? `${day} à ${time}` : "";
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scorersShort(match: MatchInput): string {
  const goals = (match.incidents ?? []).filter((i) => i.kind === "goal" || i.kind === "penalty" || i.kind === "own_goal");
  if (!goals.length) return "";
  return goals
    .slice(0, 6)
    .map((g) => `${g.player}${g.minute ? ` ${g.minute}` : ""}`)
    .join(", ");
}

export function answerFirst(match: MatchInput, opts?: { stale?: boolean }): string {
  const home = match.home.name;
  const away = match.away.name;
  const status = strictStatus(match);
  const when = parisLong(match.kickoff);
  if (status === "POSTPONED") {
    return when ? `${home} – ${away} est reporté. Coup d’envoi initialement prévu le ${when}.` : `${home} – ${away} est reporté.`;
  }
  if (status === "CANCELLED") return `${home} – ${away} est annulé.`;
  if (status === "SUSPENDED" && hasScore(match)) {
    return `${home} ${match.scoreHome}–${match.scoreAway} ${away}. Le match est suspendu.`;
  }
  if ((status === "LIVE" || status === "HALFTIME") && hasScore(match)) {
    const clock = status === "HALFTIME" ? " — mi-temps" : match.clock ? ` — ${match.clock}` : "";
    if (opts?.stale) {
      return `${home} ${match.scoreHome}–${match.scoreAway} ${away}${clock}. Dernier score connu : la collecte est en retard.`;
    }
    const state = status === "HALFTIME" ? "Le match est à la mi-temps." : "Le match est actuellement en cours.";
    return `${home} ${match.scoreHome}–${match.scoreAway} ${away}${clock}. ${state}`;
  }
  if (status === "FINISHED" && hasScore(match)) {
    const gh = match.scoreHome as number;
    const ga = match.scoreAway as number;
    const day = parisDayLong(match.kickoff);
    const verb =
      gh > ga
        ? `${home} a battu ${away} ${gh} buts à ${ga}`
        : ga > gh
          ? `${away} a battu ${home} ${ga} buts à ${gh}`
          : `${home} et ${away} se sont séparés sur un nul ${gh}–${ga}`;
    return `${home} ${gh}–${ga} ${away} : résultat final. ${verb}${day ? ` le ${day}` : ""}.`;
  }
  return `${home} – ${away} débute le ${when || "une date à confirmer"}.`;
}

export function serpH1(match: MatchInput, opts?: { stale?: boolean }): string {
  const home = match.home.name;
  const away = match.away.name;
  const status = strictStatus(match);
  if ((status === "LIVE" || status === "HALFTIME") && hasScore(match) && opts?.stale) {
    return `${home} ${match.scoreHome}–${match.scoreAway} ${away} : dernier score connu`;
  }
  if (status === "HALFTIME" && hasScore(match)) {
    return `${home} – ${away} à la mi-temps : score, buts et statistiques`;
  }
  if (status === "LIVE" && hasScore(match)) {
    return `${home} – ${away} en direct : score, buts et statistiques`;
  }
  if (status === "FINISHED" && hasScore(match)) {
    return `${home} ${match.scoreHome}-${match.scoreAway} ${away} : résultat, buts, statistiques et résumé`;
  }
  if (status === "POSTPONED") return `${home} – ${away} reporté`;
  if (status === "CANCELLED") return `${home} – ${away} annulé`;
  if (status === "SUSPENDED") return `${home} – ${away} suspendu`;
  return `${home} – ${away} : heure, chaîne, compositions, statistiques et pronostic`;
}

export function serpTitle(match: MatchInput, opts?: { stale?: boolean }): string {
  const home = match.home.name;
  const away = match.away.name;
  const status = strictStatus(match);
  if ((status === "LIVE" || status === "HALFTIME") && hasScore(match) && opts?.stale) {
    return `${home} ${match.scoreHome}-${match.scoreAway} ${away} : dernier score connu | BetGPT`;
  }
  if (status === "HALFTIME" && hasScore(match)) {
    return `${home} – ${away} à la mi-temps : score, buts et statistiques | BetGPT`;
  }
  if (status === "LIVE" && hasScore(match)) {
    return `${home} – ${away} en direct : score, buts et statistiques | BetGPT`;
  }
  if (status === "FINISHED" && hasScore(match)) {
    return `${home} ${match.scoreHome}-${match.scoreAway} ${away} : résultat, buts, statistiques et résumé | BetGPT`;
  }
  return `${home} – ${away} : heure, chaîne, compositions, statistiques et pronostic | BetGPT`;
}

export function serpDescription(match: MatchInput, opts?: { stale?: boolean }): string {
  const home = match.home.name;
  const away = match.away.name;
  const status = strictStatus(match);
  const when = parisLong(match.kickoff);
  if ((status === "LIVE" || status === "HALFTIME") && hasScore(match)) {
    if (opts?.stale) {
      return `Dernier score connu ${home} - ${away} : ${match.scoreHome}-${match.scoreAway}. La collecte est en retard.`;
    }
    const minute = status === "HALFTIME" ? ", mi-temps" : match.clock ? `, minute ${match.clock}` : "";
    return `${home} – ${away} en direct : score ${match.scoreHome}-${match.scoreAway}${minute}. Buts et statistiques.`;
  }
  if (status === "FINISHED" && hasScore(match)) {
    const scorers = scorersShort(match);
    return `Résultat ${home} ${match.scoreHome}-${match.scoreAway} ${away}${scorers ? `. Buteurs : ${scorers}` : ". Buts, statistiques et résumé"}.`;
  }
  if (status === "POSTPONED") return `${home} – ${away} est reporté. ${match.competition}.`;
  if (status === "CANCELLED") return `${home} – ${away} est annulé. ${match.competition}.`;
  const channel = frenchChannel(match);
  const lineups = frenchLineups(match);
  return `${home} – ${away}, ${when || "heure à confirmer"}. ${channel} ${lineups} Pronostic et statistiques.`;
}

export function frenchChannel(match: MatchInput): string {
  const note = (match.notes ?? []).find((n) => /chaîne|diffusion|TF1|M6|Canal|beIN|Ligue 1\+|RMC|DAZN/i.test(n));
  if (!note) return "La chaîne de diffusion en France n’est pas confirmée.";
  return note;
}

export function frenchLineups(match: MatchInput): string {
  const named = Boolean(match.notes?.some((n) => /titulaire|onze|composition confirm/i.test(n)));
  if (!named) return "Les compositions ne sont pas confirmées. BetGPT n’invente pas le onze.";
  return "Les compositions listées viennent du flux, pas d’une feuille inventée.";
}

const SPANISH_LEAK = /\b(horario|alineaciones|alineación|clasificación|clasificacion|d[oó]nde ver|resultado)\b/i;

/** French public copy must not ship Spanish search vocabulary. */
export function hasSpanishSearchLeak(text: string): boolean {
  return SPANISH_LEAK.test(text);
}

export function factRows(match: MatchInput, opts?: { stale?: boolean }): { label: string; value: string }[] {
  const status = strictStatus(match);
  const rows = [
    { label: "Match", value: `${match.home.name} – ${match.away.name}` },
    {
      label: "Score",
      value: hasScore(match) && status !== "SCHEDULED" ? `${match.scoreHome}–${match.scoreAway}` : "pas encore",
    },
    { label: "Statut", value: statusLabel(status, opts?.stale) },
    { label: "Date", value: parisDayLong(match.kickoff) || "inconnue" },
    { label: "Heure", value: parisTime(match.kickoff) || "inconnue" },
    { label: "Chaîne", value: frenchChannel(match) },
    { label: "Compositions", value: frenchLineups(match) },
    { label: "Compétition", value: match.competition },
  ];
  if (match.venue && match.venue !== "Stade") rows.push({ label: "Stade", value: match.venue });
  const scorers = scorersShort(match);
  if (scorers) rows.push({ label: "Buteurs", value: scorers });
  return rows;
}

export function snippetQuestions(match: MatchInput, opts?: { stale?: boolean }): { q: string; a: string }[] {
  const home = match.home.name;
  const away = match.away.name;
  const pair = `${home} - ${away}`;
  const status = strictStatus(match);
  const out: { q: string; a: string }[] = [];
  if ((status === "LIVE" || status === "HALFTIME" || status === "FINISHED" || status === "SUSPENDED") && hasScore(match)) {
    out.push({ q: `Quel est le score de ${pair} ?`, a: answerFirst(match, opts) });
  }
  const when = parisLong(match.kickoff);
  if (when) {
    out.push({
      q: `À quelle heure et sur quelle chaîne voir ${pair} ?`,
      a: `${home} – ${away} : ${when}. ${frenchChannel(match)}`,
    });
  }
  out.push({
    q: `Quelle est la composition de ${pair} ?`,
    a: frenchLineups(match),
  });
  if (status === "FINISHED" && hasScore(match)) {
    const gh = match.scoreHome as number;
    const ga = match.scoreAway as number;
    const a =
      gh > ga ? `${home} a gagné ${gh}–${ga}.` : ga > gh ? `${away} a gagné ${ga}–${gh}.` : `Match nul ${gh}–${ga}.`;
    out.push({ q: `Qui a gagné ${pair} ?`, a });
  }
  const scorers = scorersShort(match);
  if (scorers) out.push({ q: `Quels sont les buteurs de ${pair} ?`, a: scorers });
  return out.slice(0, 6);
}

export type SnippetCheck = { id: string; pass: boolean };

/** Internal template score. Not a probability of earning a featured snippet. */
export function featuredSnippetReadiness(input: {
  answer: string;
  h1: string;
  home: string;
  away: string;
  status: StrictStatus;
  hasTable: boolean;
  canonical: boolean;
  indexable: boolean;
  scoreVisible: boolean;
  aboveFold: boolean;
}): { score: number; checks: SnippetCheck[]; note: string } {
  const words = wordCount(input.answer);
  const blob = `${input.h1} ${input.answer}`;
  const checks: SnippetCheck[] = [
    { id: "ANSWER_PRESENT", pass: input.answer.trim().length > 10 },
    { id: "ANSWER_ABOVE_FOLD", pass: input.aboveFold },
    { id: "ANSWER_UNDER_50_WORDS", pass: words > 0 && words <= 50 },
    {
      id: "FACTS_VERIFIED",
      pass:
        input.answer.includes(input.home) &&
        input.answer.includes(input.away) &&
        !(input.status === "FINISHED" && /actuellement en cours/i.test(input.answer)) &&
        !(input.status === "SCHEDULED" && /en direct/i.test(input.answer)),
    },
    { id: "H1_CONTEXT", pass: input.h1.includes(input.home) },
    { id: "SEMANTIC_HTML", pass: input.hasTable },
    { id: "CANONICAL", pass: input.canonical },
    { id: "INDEXABLE", pass: input.indexable },
    {
      id: "VISIBLE_SCORE",
      pass: input.status === "SCHEDULED" || input.status === "POSTPONED" || input.status === "CANCELLED" || input.scoreVisible,
    },
    { id: "STATUS_CONSISTENT", pass: !(input.status === "FINISHED" && /en direct/i.test(blob)) },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return {
    score,
    checks,
    note: "Préparation interne du modèle de page. Ce n’est pas une probabilité de position zéro.",
  };
}
