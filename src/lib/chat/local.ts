import type { MatchInput } from "../../engine/types.ts";

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function localMatchFacts(question: string, matches: MatchInput[], asOf?: string): string {
  const query = ` ${norm(question)} `;
  const blockedShorts = new Set(["est", "les", "des", "une", "aux", "par", "sur", "the", "and", "for"]);
  const selected = matches.filter((m) => {
    const fullNameMatch = [m.home.name, m.away.name].some((name) => {
      const key = norm(name);
      return key.length >= 3 && query.includes(` ${key} `);
    });
    if (fullNameMatch) return true;
    return [m.home.short, m.away.short].some((short) => {
      const key = norm(short);
      if (key.length < 3 || blockedShorts.has(key)) return false;
      const escaped = String(short).replace(/[.*+?^$()|[\]\\]/g, "\\  const query = ` ${norm(question)} `;
  const selected = matches.filter((m) =>
    [m.home.name, m.away.name, m.home.short, m.away.short].some((name) => {
      const key = norm(name);
      return key.length >= 3 && query.includes(` ${key} `);
    }),
  );");
      return new RegExp(`\\b${escaped}\\b`, "i").test(question);
    });
  });
  const upcoming = matches
    .filter((m) => m.status === "scheduled" && Date.parse(m.kickoff) > Date.now())
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const explicitNamedTarget =
    /\b(?:prochain(?:e)?\s+)?(?:match|rencontre)\s+(?:de|du|des|pour)\b/i.test(question) ||
    /\b(?:analyse|pronostic)\s+(?:de|du|des|pour)?\s*[A-ZÀ-ÖØ-Þ]/u.test(question);
  const asksGeneralSchedule =
    /\b(?:calendrier|programme|matchs?\s+(?:du\s+jour|d['’]aujourd['’]hui|aujourd['’]hui|demain)|prochaines?\s+rencontres?)\b/i.test(question);
  const rows = (
    selected.length ? selected : explicitNamedTarget ? [] : asksGeneralSchedule ? upcoming : []
  ).slice(0, 6);
  const stamp =
    asOf && Number.isFinite(Date.parse(asOf))
      ? new Date(asOf).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      : "horodatage inconnu";
  return [
    `Données disponibles au ${stamp} (heure de Paris). Ce n’est pas un flux garanti en temps réel.`,
    !selected.length
      ? explicitNamedTarget
        ? "Aucune équipe précisément reconnue dans ta question. Je n’utilise pas d’autres matchs à la place."
        : rows.length
          ? "Voici les prochaines rencontres disponibles :"
          : "Aucune équipe précisément reconnue dans ta question."
      : "Rencontres correspondant à ta demande :",
    ...rows.map((m) => {
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
    }),
    !rows.length
      ? "Aucune rencontre exploitable dans le cache. Je ne vais pas inventer un calendrier ou un pronostic."
      : "Les formes récentes ne suffisent pas à établir une probabilité fiable. Vérifie les compositions et les cotes avant toute décision.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
