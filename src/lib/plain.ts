import type { MarketKind, MarketQuote, MatchInput, PredictionRecord } from "@/engine/types";
import { compileArticle } from "@/engine/article";

function bookName(_p: PredictionRecord, m: MarketQuote): string {
  const raw = m.bestBook.replace(/\s·\s.*$/, "").trim();
  if (/betclic/i.test(raw)) return "Betclic";
  if (/unibet/i.test(raw)) return "Unibet";
  if (/netbet/i.test(raw)) return "NetBet";
  if (/winamax/i.test(raw)) return "Winamax";
  if (/vbet/i.test(raw)) return "Vbet";
  if (/pmu/i.test(raw)) return "PMU";
  return raw || "le book";
}

function sayMarket(p: PredictionRecord, kind: MarketKind): string {
  switch (kind) {
    case "1X2_H":
      return `la victoire de ${p.home.name} à domicile`;
    case "1X2_D":
      return `le match nul entre ${p.home.name} et ${p.away.name}`;
    case "1X2_A":
      return `la victoire de ${p.away.name}`;
    case "DC_1X":
      return `${p.home.name} ne perd pas`;
    case "DC_X2":
      return `${p.away.name} ne perd pas`;
    case "DC_12":
      return `un vainqueur (pas de nul)`;
    case "DNB_H":
      return `${p.home.name} sans le nul`;
    case "DNB_A":
      return `${p.away.name} sans le nul`;
    case "OU_15_O":
      return `au moins 2 buts`;
    case "OU_25_O":
      return `au moins 3 buts`;
    case "OU_35_O":
      return `au moins 4 buts`;
    case "OU_25_U":
      return `2 buts ou moins`;
    case "BTTS_Y":
      return `les deux équipes marquent`;
    case "BTTS_N":
      return `au moins une équipe ne marque pas`;
  }
}

/** Scout report for match pages. Football first, numbers second. */
export function tacticalBrief(match: MatchInput, p: PredictionRecord): string {
  const article = compileArticle(match, p);
  const why = article.sections.find((s) => s.id === "pourquoi");
  const forme = article.sections.find((s) => s.id === "forme");
  return [article.lead, ...(why?.paragraphs ?? []), ...(forme?.paragraphs ?? [])].filter(Boolean).join("\n\n");
}

/** Mathematical value-bet copy. Opportunities only. */
export function valueExplain(p: PredictionRecord, m: MarketQuote): string {
  const target = sayMarket(p, m.market);
  const us = Math.round(m.modelProb * 100);
  const them = Math.round(m.implied * 100);
  const book = bookName(p, m);
  const odds = m.bestOdds.toFixed(2).replace(".", ",");
  const edgePts = (m.edge * 100).toFixed(1).replace(".", ",");
  const evPts = (m.ev * 100).toFixed(1).replace(".", ",");
  const stake = (m.stakePct * 100).toFixed(1).replace(".", ",");

  const lines: string[] = [];
  if (m.decision === "BET") {
    lines.push(`Value bet : ${target}.`);
  } else if (m.decision === "WATCH") {
    lines.push(`Pas encore un value bet net sur ${target}. On surveille le prix.`);
  } else {
    lines.push(`Pas de value bet sur ${target}.`);
  }

  lines.push(
    `Proba modèle ${us} %. Implicite book ${them} % (cote ${odds} chez ${book}). Écart ${edgePts} pts. Espérance ${evPts} %.`,
  );

  if (m.decision === "BET" && m.stakePct > 0) {
    lines.push(
      `Mise ${stake} % du bankroll (Kelly fractionné)${m.premium ? ", ticket premium" : ""}. ` +
        (m.cover
          ? `Couverture ${m.cover.label} à ${m.cover.odds.toFixed(2).replace(".", ",")} chez ${m.cover.book.replace(/\s·\s.*$/, "")} pour 50 % de la mise.`
          : ""),
    );
  } else if (m.rejectionReason) {
    lines.push(m.rejectionReason);
  }

  return lines.filter(Boolean).join("\n\n");
}

export function valueLine(m: MarketQuote): string {
  const us = Math.round(m.modelProb * 100);
  const them = Math.round(m.implied * 100);
  const edge = (m.edge * 100).toFixed(1).replace(".", ",");
  const ev = (m.ev * 100).toFixed(1).replace(".", ",");
  return `Value : modèle ${us} % vs book ${them} % · edge ${edge} pts · EV ${ev} %`;
}

/** @deprecated match pages use tacticalBrief; opportunities use valueExplain */
export function plainExplain(p: PredictionRecord, m: MarketQuote): string {
  return valueExplain(p, m);
}

export function stripMarkup(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/^[*\-•]\s+/gm, "")
    .replace(/__|\*_/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/`+/g, "")
    .replace(
      /\b(USER_IS_CONFIDENTLY_WRONG|USER_IS_REPEATING_A_BAD_IDEA|USER_IS_CHALLENGING_BETGPT|EXTREMELY_ABSURD|GENIUS_MOVE|COMEDIC_REACTION|SUSPICIOUS)\b[:\s]*/gi,
      "",
    )
    .replace(/\bslate\b/gi, "matchs du jour")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
