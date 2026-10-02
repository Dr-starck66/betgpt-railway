import type { MatchInput } from "../../engine/types.ts";

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type ChatIntent =
  | "CASUAL"
  | "NAMED_MATCH"
  | "TODAY_PICKS"
  | "GENERAL_SCHEDULE"
  | "FOOTBALL_GENERAL";

export function classifyChatIntent(question: string): ChatIntent {
  const q = norm(question);
  const compact = q.replace(/\s+/g, " ").trim();

  const casual =
    /^(bonjour|salut|hello|coucou|bonsoir|yo|hey)(\s|$)/.test(compact) &&
    !/\b(match|pari|prono|pronostic|cote|score|football|foot|btts|ticket)\b/.test(compact);
  if (casual) return "CASUAL";

  const todayPicks =
    /\b(ticket du jour|pari du jour|prono du jour|pronostic du jour|meilleur pari|meilleure cote|match le plus interessant|mises? aujourd|joues? aujourd|paries? aujourd)\b/.test(compact) ||
    /\b(?:quels?|quelles?|quoi|donne|cherche|trouve|analyse)\b.{0,60}\b(?:aujourd hui|ce soir|btts|0 0|2 1)\b/.test(compact) ||
    /\b(?:btts|0 0|2 1)\b.{0,30}\b(?:aujourd hui|ce soir)\b/.test(compact);
  if (todayPicks) return "TODAY_PICKS";

  const generalSchedule =
    /\b(calendrier|programme|matchs? du jour|matchs? aujourd hui|matchs? demain|prochaines? rencontres?)\b/.test(
      compact,
    );
  if (generalSchedule) return "GENERAL_SCHEDULE";

  const named =
    /\b(?:prochain(?:e)?\s+)?(?:match|rencontre)\s+(?:de|du|des|pour)\b/i.test(question) ||
    /\b(?:analyse|pronostic)\s+(?:de|du|des|pour)?\s*[A-ZÀ-ÖØ-Þ]/u.test(question);
  if (named) return "NAMED_MATCH";

  return "FOOTBALL_GENERAL";
}

function parisDayKey(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function localMatchFacts(question: string, matches: MatchInput[], asOf?: string): string {
  const query = ` ${norm(question)} `;
  const blockedShorts = new Set([
    "est",
    "les",
    "des",
    "une",
    "aux",
    "par",
    "sur",
    "mon",
    "ton",
    "son",
    "mes",
    "tes",
    "ses",
    "nos",
    "vos",
    "the",
    "and",
    "for",
  ]);
  const selected = matches.filter((m) => {
    const fullNameMatch = [m.home.name, m.away.name].some((name) => {
      const key = norm(name);
      return key.length >= 3 && query.includes(` ${key} `);
    });
    if (fullNameMatch) return true;
    return [m.home.short, m.away.short].some((short) => {
      const key = norm(short);
      return key.length >= 3 && !blockedShorts.has(key) && query.includes(` ${key} `);
    });
  });

  const reference = asOf && Number.isFinite(Date.parse(asOf)) ? new Date(asOf) : new Date();
  const referenceMs = reference.getTime();
  const todayKey = parisDayKey(reference);
  const upcoming = matches
    .filter((m) => m.status === "scheduled" && Date.parse(m.kickoff) >= referenceMs)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const today = upcoming.filter((m) => parisDayKey(m.kickoff) === todayKey);

  const intent = selected.length ? "NAMED_MATCH" : classifyChatIntent(question);
  const strictNamedTarget = intent === "NAMED_MATCH";
  const rows = (
    selected.length
      ? selected
      : strictNamedTarget
        ? []
        : intent === "TODAY_PICKS"
          ? today.length
            ? today
            : upcoming
          : intent === "GENERAL_SCHEDULE"
            ? upcoming
            : []
  ).slice(0, 8);

  const stamp = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(reference);

  const intro =
    intent === "CASUAL" || (intent === "FOOTBALL_GENERAL" && !selected.length)
      ? "Aucune donnée de match n’est nécessaire pour répondre à cette question générale."
      : `Données sportives disponibles au ${stamp} (heure de Paris). Le cache n’est pas un flux garanti en temps réel.`;

  const heading = selected.length
    ? "Rencontres correspondant à la demande :"
    : strictNamedTarget
      ? "Cible nommée non trouvée : aucune équipe précisément reconnue. Ne substitue pas un autre match."
      : intent === "TODAY_PICKS"
        ? today.length
          ? "Matchs du jour disponibles pour construire une réponse :"
          : rows.length
            ? "Aucun match du jour trouvé dans le cache ; prochains matchs disponibles :"
            : "Aucun match exploitable trouvé dans le cache."
        : intent === "GENERAL_SCHEDULE"
          ? rows.length
            ? "Prochaines rencontres disponibles :"
            : "Aucune prochaine rencontre exploitable dans le cache."
          : "Question générale : réponds naturellement sans forcer une analyse de match.";

  const rendered = rows.map((m) => {
    const date = Number.isFinite(Date.parse(m.kickoff))
      ? new Date(m.kickoff).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      : "date inconnue";
    const status = {
      scheduled: "programmé",
      live: "en cours au dernier relevé",
      finished: "terminé",
      cancelled: "annulé",
    }[m.status ?? "scheduled"];
    const forms = [
      m.formHome ? `${m.home.name} : ${m.formHome}` : "",
      m.formAway ? `${m.away.name} : ${m.formAway}` : "",
    ]
      .filter(Boolean)
      .join(" ; ");
    return `${m.home.name} – ${m.away.name} · ${m.competition} · ${date} · ${status}${forms ? `\nForme enregistrée (W victoire, D nul, L défaite) : ${forms}` : ""}`;
  });

  const footer =
    rows.length > 0
      ? "Les formes récentes seules ne suffisent pas à établir une probabilité ni une value bet. Utilise les autres données du desk si elles existent."
      : strictNamedTarget
        ? "Je n’invente ni adversaire, ni date, ni cote, ni score."
        : "";

  return [intro, heading, ...rendered, footer].filter(Boolean).join("\n\n");
}
