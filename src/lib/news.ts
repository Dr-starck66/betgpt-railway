import type { MarketQuote, MatchInput, PredictionRecord } from "@/engine/types";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { marketHits } from "@/engine/settle";
import { BRAND_HERO, BRAND_LOGO, BRAND_OG, imageObjectLd } from "@/lib/image-seo";
import { headlineMarket } from "@/lib/markets";
import { SITE_URL } from "@/lib/programmatic";
import { featuredAnswer, matchPath, scoreLine } from "@/lib/seo";
import { fmtOdds } from "@/lib/utils";

export type PronoVerdict = "gagnant" | "perdant" | "void" | "en_cours" | "attente" | "aucun";

export type SettledPick = {
  label: string;
  odds?: string;
  book?: string;
  verdict: PronoVerdict;
  pick?: MarketQuote;
};

export function pickLabelFr(match: MatchInput, market: string, fallback: string): string {
  if (market === "1X2_H") return `Victoire ${match.home.name}`;
  if (market === "1X2_A") return `Victoire ${match.away.name}`;
  if (market === "1X2_D") return "Match nul";
  return fallback;
}

export function settlePick(m: MatchInput, p?: PredictionRecord): SettledPick {
  if (skipEuropeFrenchProno(m)) return { label: "Pas de prono", verdict: "aucun" };
  if (!p) return { label: "—", verdict: "aucun" };
  const pick = headlineMarket(p.markets);
  const label = pickLabelFr(m, pick.market, pick.label);
  const odds = fmtOdds(pick.bestOdds);
  const book = pick.bestBook.replace(/\s·\s.*$/, "");
  if (m.status === "scheduled" || m.scoreHome == null || m.scoreAway == null) {
    return {
      label,
      odds,
      book,
      verdict: m.status === "live" ? "en_cours" : "attente",
      pick,
    };
  }
  const hit = marketHits(pick.market, m.scoreHome, m.scoreAway);
  const verdict: PronoVerdict = hit === "win" ? "gagnant" : hit === "lose" ? "perdant" : "void";
  return { label, odds, book, verdict, pick };
}

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function editionTitle(iso: string): string {
  return `Résultats football du ${dayLabel(iso)} : scores, pronostics et analyses`;
}

function settledCounts(matches: MatchInput[], preds: Map<string, PredictionRecord>) {
  let won = 0;
  let lost = 0;
  let voided = 0;
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const v = settlePick(m, preds.get(m.id)).verdict;
    if (v === "gagnant") won += 1;
    else if (v === "perdant") lost += 1;
    else if (v === "void") voided += 1;
  }
  return { won, lost, voided };
}

export function editionAnswer(matches: MatchInput[], preds: Map<string, PredictionRecord>): string {
  const live = matches.filter((m) => m.status === "live");
  const done = matches.filter((m) => m.status === "finished");
  const soon = matches.filter((m) => m.status === "scheduled");
  const bits: string[] = [];
  if (done.length) {
    const recap = done
      .slice(0, 4)
      .map((m) => {
        const s = scoreLine(m);
        return s ? `${m.home.name}–${m.away.name} ${s}` : `${m.home.name}–${m.away.name}`;
      })
      .join(" · ");
    bits.push(`Résultats football : ${recap}.`);
    const { won, lost } = settledCounts(done, preds);
    if (won + lost > 0) {
      bits.push(`Pronostics BetGPT : ${won} gagnant${won > 1 ? "s" : ""}, ${lost} perdant${lost > 1 ? "s" : ""}.`);
    }
  }
  if (live.length) {
    bits.push(
      `Scores en direct : ${live
        .slice(0, 3)
        .map((m) => `${m.home.name}–${m.away.name} ${scoreLine(m) ?? "0–0"}`)
        .join(" · ")}.`,
    );
  }
  if (soon.length) {
    const first = soon[0]!;
    const p = preds.get(first.id);
    const pick = p ? settlePick(first, p) : null;
    bits.push(
      `Pronostics du jour : ${soon.length} matchs à venir${pick && pick.verdict !== "aucun" ? `, dont ${first.home.name} – ${first.away.name} (${pick.label}, ${pick.odds})` : ""}.`,
    );
  }
  if (!bits.length) bits.push("Pronostics et résultats football : le fil BetGPT se met à jour du matin au soir.");
  return bits.join(" ");
}

export function editionFaq(matches: MatchInput[], preds: Map<string, PredictionRecord>, day: string): { q: string; a: string }[] {
  const answer = editionAnswer(matches, preds);
  const live = matches.filter((m) => m.status === "live");
  const done = matches.filter((m) => m.status === "finished");
  const { won, lost } = settledCounts(done, preds);
  const label = dayLabel(day);
  return [
    { q: `Quels sont les résultats football du ${label} ?`, a: done.length ? answer : `Pas encore de résultat le ${label}. Les pronostics sont en ligne.` },
    { q: "Résultats football aujourd'hui", a: answer },
    { q: "Quels matchs sont en direct ?", a: live.length ? `En direct : ${live.map((m) => `${m.home.name} – ${m.away.name} ${scoreLine(m) ?? ""}`).join(", ")}.` : "Aucun match en cours pour l'instant." },
    { q: "Pronostics football du jour", a: answer },
    {
      q: "Les pronostics BetGPT du jour sont-ils gagnants ?",
      a:
        won + lost > 0
          ? `Pronostics réglés : ${won} gagnant${won > 1 ? "s" : ""} et ${lost} perdant${lost > 1 ? "s" : ""}.`
          : "Les matchs du jour ne sont pas encore terminés.",
    },
    { q: "Scores en direct aujourd'hui", a: live.length ? answer : `Aucun score en direct. Consulte les résultats et pronostics du ${label}.` },
  ];
}

export function editionJsonLd(
  matches: MatchInput[],
  preds: Map<string, PredictionRecord>,
  day: string,
  url: string,
): object[] {
  const headline = editionTitle(day);
  const answer = editionAnswer(matches, preds);
  const faq = editionFaq(matches, preds, day);
  return [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline,
      description: answer,
      datePublished: `${day}T06:00:00+02:00`,
      dateModified: `${day}T18:00:00+02:00`,
      mainEntityOfPage: url,
      image: [imageObjectLd(BRAND_OG, url), imageObjectLd(BRAND_HERO, url)],
      author: { "@type": "Organization", name: "BetGPT", url: SITE_URL },
      publisher: {
        "@type": "NewsMediaOrganization",
        name: "BetGPT",
        url: SITE_URL,
        logo: imageObjectLd(BRAND_LOGO, SITE_URL),
      },
      articleSection: "Football",
      keywords: "résultats football, pronostics, scores en direct, analyse, gagnant, perdant",
      articleBody: answer,
      inLanguage: "fr-FR",
      isAccessibleForFree: true,
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".seo-answer", "h1"] },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: headline,
      url,
      numberOfItems: matches.length,
      itemListElement: matches.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${matchPath(m)}`,
        name: `${m.home.name} – ${m.away.name}`,
      })),
    },
  ];
}

export function rowProno(m: MatchInput, p?: PredictionRecord): string {
  const s = settlePick(m, p);
  if (s.verdict === "aucun") return s.label;
  const odds = s.odds ? ` · ${s.odds}` : "";
  if (s.verdict === "gagnant") return `${s.label}${odds} · Gagnant`;
  if (s.verdict === "perdant") return `${s.label}${odds} · Perdant`;
  if (s.verdict === "void") return `${s.label}${odds} · Remboursé`;
  if (s.verdict === "en_cours") return `${s.label}${odds} · En cours`;
  return `${s.label}${odds}`;
}

export { featuredAnswer };
