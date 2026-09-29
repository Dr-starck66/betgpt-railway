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
  const selected = matches.filter((m) =>
    [m.home.name, m.away.name, m.home.short, m.away.short].some((name) => {
      const key = norm(name);
      return key.length >= 3 && query.includes(` ${key} `);
    }),
  );
  const upcoming = matches
    .filter((m) => m.status === "scheduled" && Date.parse(m.kickoff) > Date.now())
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const rows = (selected.length ? selected : upcoming).slice(0, 6);
  const stamp =
    asOf && Number.isFinite(Date.parse(asOf))
      ? new Date(asOf).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
      : "horodatage inconnu";
  return [
    `Données disponibles au ${stamp} (heure de Paris). Ce n’est pas un flux garanti en temps réel.`,
    !selected.length
      ? "Aucune équipe précisément reconnue dans ta question. Voici les prochaines rencontres disponibles :"
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
