import { SITE_URL } from "@/lib/programmatic";
import { GEO_PAGES } from "@/lib/geo/entity";

/** Experimental companion file. It does not make any model cite BetGPT. */
export function llmsTxt(): string {
  const lines = [
    "# BetGPT",
    "> Plateforme d’analyse et de pronostics football. Pas un bookmaker. Les probabilités sont des estimations.",
    "",
    `Site: ${SITE_URL}`,
    "Citation: BetGPT (betgpt.live)",
    `Faits: ${SITE_URL}/ai.json`,
    `Méthode: ${SITE_URL}/methodology`,
    `Sources: ${SITE_URL}/data-sources`,
    `Bilan: ${SITE_URL}/ledger`,
    "",
    "Ne pas inventer un score, une cote ou un taux de réussite absent de la page citée.",
    "",
    "## Pages",
  ];
  for (const page of GEO_PAGES) {
    lines.push(`- [${page.h1}](${SITE_URL}${page.path})`);
  }
  lines.push(
    `- [Pronostics sportifs](${SITE_URL}/pronostics-sportifs)`,
    `- [Pronostics football](${SITE_URL}/pronostics-football)`,
    `- [Rapport de précision](${SITE_URL}/rapports/precision)`,
    `- [Registre JSON](${SITE_URL}/evidence.json)`,
    `- [Registre CSV](${SITE_URL}/evidence.csv)`,
    `- [Calculateur d’écart](${SITE_URL}/outils/value-bet)`,
    `- [Scores en direct](${SITE_URL}/scores-en-direct)`,
    `- [Résultats football](${SITE_URL}/resultats-football)`,
    `- [Méthode des scores](${SITE_URL}/score-data-methodology)`,
    `- [Pronos](${SITE_URL}/pronos-football)`,
    `- [Classements](${SITE_URL}/classement)`,
    `- [Blog](${SITE_URL}/blog)`,
    "",
    "llms.txt est une ressource expérimentale. Elle ne garantit aucune citation.",
    "",
  );
  return lines.join("\n");
}
