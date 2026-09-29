import { loadArchiveHistory } from "../../engine/archive.ts";
import { leagueTableFor, scenarioBySlug } from "../../engine/hunter.ts";
import { officialHistory } from "../../engine/stats.ts";

/** Read-only historical evidence: no forecast generation, delivery or paid call. */
export function historyFacts(question: string): string | null {
  const q = question.toLowerCase();
  const slug = /btts|deux équipes marquent/.test(q) ? "btts" : /2-1/.test(q) ? "2-1" : /1-1/.test(q) ? "1-1" : /0-0|hunter/.test(q) ? "0-0" : /over|plus de 2/.test(q) ? "over-2-5" : null;
  if (!slug) return null;
  const scenario = scenarioBySlug(slug)!;
  const history = officialHistory(loadArchiveHistory()).filter(m => Date.parse(m.kickoff) < Date.now());
  if (!history.length) return "Archive indisponible : aucune statistique historique calculable.";
  const table = leagueTableFor(scenario, history).filter(r => r.n > 0);
  if (/moins|faible/.test(q)) table.sort((a,b) => a.freq - b.freq);
  const dates = history.map(m => m.kickoff).sort();
  return [`Archive — ${scenario.label}. Période enregistrée : ${dates[0]?.slice(0,10)} au ${dates.at(-1)?.slice(0,10)}.`,
    ...table.map(r => `${r.label} : ${(r.freq * 100).toFixed(1).replace(".", ",")} % sur ${r.n} matchs.`),
    "Fréquences calculées dans l’archive, pas probabilités d’un prochain match. Le score Hunter /100 n’est pas un taux de réussite.",
  ].join("\n");
}
