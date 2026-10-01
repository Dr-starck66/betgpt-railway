import { hubByLeague, SITE_URL, teamPath } from "@/lib/programmatic";
import { imageFor } from "@/lib/editorial/images";
import { autoPublishableCluster, clusterSignals, isMaterialDevelopment, type NewsCluster } from "@/lib/editorial/news-cluster";
import { discoverChecks, factHash, qualityGate, readinessScore, sourceQualityScore } from "@/lib/editorial/quality";
import { DEFAULT_TIMES, dayLabel, formatParis, instantParisDate, optimizeTimes, parisDate, slotInstant } from "@/lib/editorial/time";
import type {
  ArticleType,
  CandidateView,
  EditorialArticle,
  EditorialEdition,
  EditorialLink,
  EditorialMatch,
  EditorialModel,
  EditorialNewsSignal,
  EditorialSource,
  SkippedSlot,
  SlotId,
  SlotMetrics,
  TimeChange,
} from "@/lib/editorial/types";
import { isPublicArticle } from "@/lib/editorial/types";

const MIN_ODDS = 1.8;
const LEAGUE_WEIGHT: Record<string, number> = {
  CL: 94,
  L1: 92,
  PL: 90,
  LL: 80,
  BL: 78,
  SA: 78,
  EL: 70,
  NL: 64,
};

const NOTABLE = new Set(
  [
    "france",
    "bresil",
    "brésil",
    "argentine",
    "espagne",
    "angleterre",
    "allemagne",
    "portugal",
    "senegal",
    "sénégal",
    "maroc",
    "nigeria",
    "nigéria",
    "belgique",
    "italie",
    "croatie",
    "pays-bas",
    "psg",
    "paris",
    "marseille",
    "lyon",
    "real madrid",
    "barcelone",
    "barcelona",
    "manchester city",
    "liverpool",
    "bayern",
    "inter",
    "juventus",
  ].map((name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
);

type Candidate = {
  id: string;
  match: EditorialMatch | null;
  news: NewsCluster | null;
  articleType: ArticleType;
  score: number;
  slotFit: SlotId;
  title: string;
};

export type EditionInput = {
  now?: Date;
  matches: EditorialMatch[];
  models?: EditorialModel[];
  times?: Partial<Record<SlotId, string>>;
  metrics?: SlotMetrics;
  timeChanges?: TimeChange[];
  frozen?: EditorialArticle[];
  signals?: EditorialNewsSignal[];
};

function fr(n: number, digits = 2): string {
  return n.toFixed(digits).replace(".", ",");
}

function pct(n: number): string {
  return `${Math.round(n * 100)}\u00a0%`;
}

function kickMs(match: EditorialMatch): number {
  const ms = Date.parse(match.kickoff);
  return Number.isFinite(ms) ? ms : NaN;
}

function notable(match: EditorialMatch): boolean {
  const names = `${match.home.name} ${match.away.name}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const token of NOTABLE) if (names.includes(token)) return true;
  return false;
}

function listedOdds(match: EditorialMatch): { book: string; home: number; draw: number; away: number } | null {
  const row = match.current?.find((book) => book.home && book.draw && book.away) ?? null;
  const home = row?.home ?? match.opening?.home;
  const draw = row?.draw ?? match.opening?.draw;
  const away = row?.away ?? match.opening?.away;
  if (!home || !draw || !away) return null;
  if (home < 1.01 || draw < 1.01 || away < 1.01) return null;
  return { book: row?.book || match.oddsSource || match.opening?.book || "desk", home, draw, away };
}

function trustedAbsences(block: EditorialMatch["absencesHome"]): string[] {
  if (!block || (block.confidence ?? 0) < 0.6) return [];
  if (/non observ|non branch|inconnu/i.test(block.source ?? "")) return [];
  return (block.value ?? []).map((row) => row.player).filter((name): name is string => Boolean(name));
}

function scoreMatch(match: EditorialMatch, now: number, type: ArticleType): number {
  const kick = kickMs(match);
  if (!Number.isFinite(kick)) return 0;
  const hours = Math.abs(kick - now) / 36e5;
  let score = hours <= 6 ? 22 : hours <= 18 ? 18 : hours <= 36 ? 14 : hours <= 60 ? 10 : 6;
  score += Math.round((LEAGUE_WEIGHT[match.league] ?? 50) * 0.28);
  score += Math.round(Math.max(0, Math.min(1, match.importance?.value ?? 0.4)) * 12);
  if (notable(match)) score += 10;
  if (listedOdds(match)) score += 6;
  score += 10;
  if (type === "postmatch" && hours < 20) score += 8;
  if (type === "brief") score += 6;
  score += 4;
  return Math.max(0, Math.min(100, score));
}

function inWindow(match: EditorialMatch, now: number, day: string): boolean {
  const kick = kickMs(match);
  if (!Number.isFinite(kick)) return false;
  if (!match.home?.name || !match.away?.name) return false;
  if (match.status === "cancelled") return false;
  const hours = (kick - now) / 36e5;
  if (hours >= -30 && hours <= 72) return true;
  return instantParisDate(match.kickoff) === day;
}

function slotFit(type: ArticleType): SlotId {
  if (type === "slate" || type === "preview") return "morning";
  if (type === "brief" || type === "news") return "noon";
  return "evening";
}

function preferred(slot: SlotId): ArticleType[] {
  if (slot === "morning") return ["news", "preview", "brief", "postmatch"];
  if (slot === "noon") return ["news", "brief", "preview"];
  return ["news", "postmatch", "brief", "preview"];
}

function newsSlug(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .replace(/-$/g, "");
}

function matchHref(match: EditorialMatch): string {
  return `/match/${match.slug || match.id}`;
}

function deskLinks(match: EditorialMatch | null, competition: string): EditorialLink[] {
  const links: EditorialLink[] = [];
  if (match) {
    links.push({ href: matchHref(match), label: `${match.home.name} – ${match.away.name}` });
    if (match.home.name) links.push({ href: teamPath(match.home.name), label: match.home.name });
    if (match.away.name) links.push({ href: teamPath(match.away.name), label: match.away.name });
    const hub = hubByLeague(match.league);
    links.push({ href: hub.path, label: hub.title });
    if (match.status === "finished") links.push({ href: "/resultats-football", label: "Résultats football" });
    else links.push({ href: "/scores-en-direct", label: "Scores en direct" });
  } else if (competition) {
    links.push({ href: "/scores-en-direct", label: "Scores en direct" });
    links.push({ href: "/pronostics-sportifs", label: "Pronostics sportifs" });
  }
  links.push({ href: "/methodology", label: "Méthode BetGPT" });
  links.push({ href: "/auteurs/betgpt-editorial", label: "BetGPT Editorial" });
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

function oddsSentence(match: EditorialMatch): { text: string; source: EditorialSource } | null {
  const odds = listedOdds(match);
  if (!odds) return null;
  const low = Math.min(odds.home, odds.draw, odds.away);
  const base = `Le desk observe des cotes 1N2 chez ${odds.book} : ${match.home.name} ${fr(odds.home)}, nul ${fr(odds.draw)}, ${match.away.name} ${fr(odds.away)}.`;
  const guard =
    low < MIN_ODDS
      ? ` La cote la plus basse est à ${fr(low)}, sous 1,80. BetGPT ne la met pas en avant comme sélection.`
      : " Aucune de ces cotes n'est une consigne de mise.";
  return {
    text: base + guard,
    source: {
      id: `odds-${match.id}`,
      label: odds.book,
      status: "HIGH_CONFIDENCE",
      note: "Prix observé sur le desk BetGPT. Ce n'est pas un communiqué de club ni une recommandation.",
    },
  };
}

function modelSentence(match: EditorialMatch, model: EditorialModel | undefined): { text: string; source: EditorialSource } | null {
  if (!model) return null;
  const sum = model.home + model.draw + model.away;
  if (!Number.isFinite(sum) || sum < 0.9 || sum > 1.1) return null;
  const stamp = model.timestamp ? ` (horodatage modèle ${model.timestamp})` : "";
  return {
    text: `Estimation du modèle BetGPT${stamp} : ${match.home.name} ${pct(model.home)}, nul ${pct(model.draw)}, ${match.away.name} ${pct(model.away)}. Ce chiffre est une estimation interne, pas un score annoncé.`,
    source: {
      id: `model-${match.id}`,
      label: "Modèle BetGPT",
      status: "HIGH_CONFIDENCE",
      note: "Sortie du modèle déjà calculée par BetGPT. Ce n'est pas un fait de match.",
    },
  };
}

function absenceSentence(match: EditorialMatch): { text: string; source: EditorialSource } {
  const home = trustedAbsences(match.absencesHome);
  const away = trustedAbsences(match.absencesAway);
  if (!home.length && !away.length) {
    return {
      text: "BetGPT ne dispose pas, dans ce signal, d'une composition officielle ni d'un forfait confirmé par le club. L'absence d'un joueur n'est donc pas affirmée.",
      source: {
        id: `xi-${match.id}`,
        label: "Compositions",
        status: "UNKNOWN",
        note: "Aucune liste de joueurs n'est branchée sur ce match.",
      },
    };
  }
  const bits = [];
  if (home.length) bits.push(`${match.home.name} : ${home.join(", ")}`);
  if (away.length) bits.push(`${match.away.name} : ${away.join(", ")}`);
  return {
    text: `Signal d'absence présent dans le desk, au-dessus du seuil de confiance interne : ${bits.join(". ")}. Tant que le club ne figure pas comme source primaire, BetGPT ne parle pas de forfait officiel.`,
    source: {
      id: `xi-${match.id}`,
      label: "Absences desk",
      status: "CORROBORATED",
      note: match.absencesHome?.source || match.absencesAway?.source || "signal interne",
    },
  };
}

function coreSources(match: EditorialMatch | null, competition: string): EditorialSource[] {
  return [
    {
      id: match ? `cal-${match.id}` : "cal-day",
      label: "Calendrier desk BetGPT",
      status: "HIGH_CONFIDENCE",
      note: match
        ? `${match.home.name} – ${match.away.name}, ${match.competition}, coup d'envoi ${match.kickoff}.`
        : `Journée agrégée depuis les matchs du desk (${competition}).`,
    },
  ];
}

function hashOf(match: EditorialMatch | null, model?: EditorialModel): string {
  if (!match) return factHash(["slate", model ? String(Math.round(model.home * 100)) : ""]);
  const odds = listedOdds(match);
  return factHash([
    match.id,
    match.status ?? "",
    String(match.scoreHome ?? ""),
    String(match.scoreAway ?? ""),
    match.kickoff,
    match.home.name,
    match.away.name,
    odds ? `${fr(odds.home)}-${fr(odds.draw)}-${fr(odds.away)}` : "",
    model ? `${Math.round(model.home * 100)}-${Math.round(model.draw * 100)}-${Math.round(model.away * 100)}` : "",
  ]);
}

function paragraph(h2: string, body: string, sourceIds: string[] = []): { h2: string; body: string; sourceIds?: string[] } {
  return sourceIds.length ? { h2, body, sourceIds: [...new Set(sourceIds)] } : { h2, body };
}

function composeMatch(
  match: EditorialMatch,
  type: ArticleType,
  model: EditorialModel | undefined,
  slot: SlotId,
  day: string,
  when: string,
  open: boolean,
): Omit<EditorialArticle, "image" | "related" | "quality" | "duplicateScore" | "discoverChecks" | "discoverReadiness" | "topStories" | "discoverOpportunity"> {
  const score =
    match.status === "finished" || match.status === "live"
      ? match.scoreHome != null && match.scoreAway != null
        ? `${match.scoreHome}–${match.scoreAway}`
        : null
      : null;
  const kickLabel = formatParis(match.kickoff);
  const odds = oddsSentence(match);
  const modelBit = modelSentence(match, model);
  const absences = absenceSentence(match);
  const formBits = [match.formHome ? `${match.home.name} ${match.formHome}` : "", match.formAway ? `${match.away.name} ${match.formAway}` : ""]
    .filter(Boolean)
    .join(" · ");
  const previewH1 =
    slot === "morning"
      ? `${match.home.name} – ${match.away.name} : les clés du match et l'heure du coup d'envoi`
      : slot === "noon"
        ? `${match.home.name} – ${match.away.name} : forme, horaire et données disponibles`
        : `${match.home.name} – ${match.away.name} : dernières informations avant le match`;
  let h1 = previewH1;
  if (type === "postmatch" && score) h1 = `${match.home.name} – ${match.away.name} : ${score}, résultat et faits du match`;
  else if (type === "brief" && score) h1 = `${match.home.name} – ${match.away.name} en direct : ${score}, score et situation du match`;
  else if (type === "brief") h1 = `${match.home.name} – ${match.away.name} en direct : score et situation du match`;
  const previewLead =
    slot === "morning"
      ? `${match.home.name} et ${match.away.name} se retrouvent en ${match.competition}. Coup d'envoi ${kickLabel} : voici les repères utiles pour comprendre l'affiche avant le début de la journée.`
      : slot === "noon"
        ? `${match.home.name} – ${match.away.name} approche en ${match.competition}. À ${kickLabel}, l'intérêt se concentre sur la forme disponible, les cotes observées et les informations confirmées avant le match.`
        : `${match.home.name} – ${match.away.name} est l'une des affiches à suivre en ${match.competition}. À l'approche du coup d'envoi indiqué ${kickLabel}, voici les derniers éléments fiables et ce qui reste à confirmer.`;
  const lead =
    type === "postmatch" && score
      ? `${match.home.name} – ${match.away.name} s'est terminé sur le score de ${score} en ${match.competition}. Voici les informations factuelles disponibles sur cette rencontre et ce qu'elles changent pour la suite.`
      : type === "preview"
        ? previewLead
        : `${match.home.name} affronte ${match.away.name} en ${match.competition}, avec un coup d'envoi prévu ${kickLabel}. Voici les informations vérifiées disponibles, sans compléter les données manquantes.`;
  const established = paragraph(
    type === "postmatch"
      ? "Le résultat et le contexte"
      : slot === "morning"
        ? "Les repères essentiels de l'affiche"
        : slot === "noon"
          ? "Horaire, forme et contexte compétitif"
          : "Les dernières données confirmées avant le coup d'envoi",
    `${match.home.name} – ${match.away.name} figure au calendrier de ${match.competition}${match.venue ? `, au ${match.venue}` : ""}. Le coup d'envoi est indiqué ${kickLabel}.${score ? ` Le score actuellement enregistré est ${score}${match.clock ? ` (${match.clock})` : ""}.` : ""} ${formBits ? `Les séries de forme disponibles sont : ${formBits}.` : "Les données de forme ne sont pas suffisamment complètes pour être présentées comme un fait."}`,
    [`cal-${match.id}`],
  );
  const context = paragraph(
    slot === "morning"
      ? "Ce que montrent les données disponibles"
      : slot === "noon"
        ? "Ce que disent les chiffres et les absences signalées"
        : "Cotes, absences et signaux à vérifier avant le match",
    `${odds ? odds.text.replace(/Le desk observe/g, "Les cotes 1N2 disponibles indiquent").replace(/sur le desk BetGPT/g, "dans les données disponibles") : "Aucune cote 1N2 suffisamment fiable n'est disponible pour cette affiche."} ${absences.text.replace(/BetGPT ne dispose pas, dans ce signal,/g, "Les données disponibles ne contiennent").replace(/Signal d'absence présent dans le desk, au-dessus du seuil de confiance interne :/g, "Des absences sont signalées avec un niveau de confiance suffisant :").replace(/Tant que le club ne figure pas comme source primaire, BetGPT ne parle pas de forfait officiel\./g, "Elles ne sont pas présentées comme officielles sans confirmation primaire.")} ${modelBit ? modelBit.text : "Aucune probabilité chiffrée n'est ajoutée lorsqu'un modèle exploitable n'est pas disponible."}`,
    [`cal-${match.id}`, absences.source.id, ...(odds ? [odds.source.id] : []), ...(modelBit ? [modelBit.source.id] : [])],
  );
  const unknown = paragraph(
    slot === "morning"
      ? "Les informations attendues dans la journée"
      : slot === "noon"
        ? "Les confirmations qui peuvent encore changer la lecture du match"
        : "Ce qui peut encore évoluer juste avant le coup d'envoi",
    `Les compositions, forfaits, changements d'horaire et autres informations de dernière minute ne sont publiés que lorsqu'ils sont présents dans une source suffisamment fiable. La fiche du match reste la référence BetGPT pour le score, les statistiques et les éventuelles mises à jour factuelles.`,
    [`cal-${match.id}`, absences.source.id],
  );
  const sources = [...coreSources(match, match.competition), absences.source];
  if (odds) sources.push(odds.source);
  if (modelBit) sources.push(modelBit.source);
  const slug = newsSlug([match.home.name, match.away.name, type, day]);
  const publishedAt = open ? when : null;
  return {
    id: `ed-${day}-${slot}`,
    slug,
    slot,
    articleType: type,
    status: open ? "PUBLISHED" : "SCHEDULED",
    title: `${h1} | BetGPT`,
    h1,
    lead,
    paragraphs: [established, context, unknown],
    createdAt: when,
    publishedAt,
    modifiedAt: publishedAt,
    parisDate: day,
    scheduledTime: when.slice(11, 16),
    category: "Football",
    section: sectionFor(match.league),
    league: match.league,
    teams: [match.home.name, match.away.name],
    matchId: match.id,
    competition: match.competition,
    sources,
    newsworthiness: 0,
    links: deskLinks(match, match.competition),
    corrections: [],
    sourceChanges: [],
    factHash: hashOf(match, model),
    keywords: `${match.home.name}, ${match.away.name}, ${match.competition}`,
  };
}

function sectionFor(league: EditorialMatch["league"] | null): string {
  if (league === "L1") return "ligue-1";
  if (league === "PL") return "premier-league";
  if (league === "CL") return "champions-league";
  if (league === "LL") return "la-liga";
  if (league === "BL") return "bundesliga";
  if (league === "SA") return "serie-a";
  if (league === "EL") return "ligue-europa";
  return "football";
}

function composeSlate(matches: EditorialMatch[], slot: SlotId, day: string, when: string, open: boolean): Omit<EditorialArticle, "image" | "related" | "quality" | "duplicateScore" | "discoverChecks" | "discoverReadiness" | "topStories" | "discoverOpportunity"> {
  const label = dayLabel(day);
  const competitions = [...new Set(matches.map((m) => m.competition))];
  const headlineComp = competitions[0] ?? "football";
  const lines = matches
    .slice(0, 8)
    .map((m) => {
      const score = m.status === "finished" && m.scoreHome != null ? ` ${m.scoreHome}–${m.scoreAway}` : "";
      return `${m.home.name} – ${m.away.name}${score} (${formatParis(m.kickoff)}, ${m.competition})`;
    })
    .join(" · ");
  const h1 = `Programme du ${label} : ${headlineComp} suivi par BetGPT`;
  const lead = `BetGPT retient ${matches.length} match${matches.length > 1 ? "s" : ""} daté${matches.length > 1 ? "s" : ""} du ${label} dans le desk. La liste ci-dessous reprend les affiches, les heures et les compétitions déjà ingérées. Pas un pronostic inventé. 18+.`;
  const established = paragraph(
    "Les affiches du jour",
    `${lines || "Aucun match daté de ce jour n'est dans le desk."} BetGPT ne complète pas cette liste avec des affiches absentes du calendrier. Chaque ligne correspond à un match déjà ingéré, avec son heure Europe/Paris et sa compétition.`,
  );
  const how = paragraph(
    "Comment la journée est lue",
    `Les créneaux matin, midi et soir ne fabriquent pas trois textes sur la même phrase. Le matin résume le programme. Les autres créneaux ne partent que si un match distinct apporte un fait supplémentaire : cote observée, score, ou statut. Compétitions présentes : ${competitions.join(", ") || "aucune"}. Chaque nom renvoie vers la fiche match, pas vers une dépêche recopiée.`,
  );
  const limit = paragraph(
    "Limite de cette édition",
    `Si une information n'est pas dans le calendrier, les cotes ou le score du desk, elle n'est pas écrite. Les rumeurs de transfert et les compositions officielles absentes restent hors page. Score interne de choix : il sert à trier, il ne prédit pas Google Discover. 18+. BetGPT n'est pas un bookmaker.`,
  );
  const links = deskLinks(matches[0] ?? null, headlineComp);
  for (const match of matches.slice(0, 4)) {
    links.unshift({ href: matchHref(match), label: `${match.home.name} – ${match.away.name}` });
  }
  return {
    id: `ed-${day}-${slot}`,
    slug: newsSlug(["programme", headlineComp, day]),
    slot,
    articleType: "slate",
    status: open ? "PUBLISHED" : "SCHEDULED",
    title: `${h1} | BetGPT`,
    h1,
    lead,
    paragraphs: [established, how, limit],
    createdAt: when,
    publishedAt: open ? when : null,
    modifiedAt: open ? when : null,
    parisDate: day,
    scheduledTime: when.slice(11, 16),
    category: "Football",
    section: "football",
    league: matches[0]?.league ?? null,
    teams: matches.slice(0, 6).flatMap((m) => [m.home.name, m.away.name]),
    matchId: null,
    competition: headlineComp,
    sources: coreSources(null, headlineComp),
    newsworthiness: 0,
    links,
    corrections: [],
    sourceChanges: [],
    factHash: factHash(["slate", day, ...matches.map((m) => `${m.id}:${m.status}:${m.scoreHome ?? ""}-${m.scoreAway ?? ""}`)]),
    keywords: competitions.slice(0, 4).join(", "),
  };
}

function cleanNewsTitle(title: string, sourceName?: string): string {
  let value = title.replace(/\s+/g, " ").trim();
  if (sourceName) {
    const escaped = sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\s[-–—|]\\s${escaped}$`, "i"), "").trim();
  }
  value = value.replace(/\s[-–—|]\s(?:Google Actualités|Google News)$/i, "").trim();
  // Publishers sometimes append a vertical label before their own source name,
  // e.g. "| Foot - Portugal". Keep the headline, drop the navigation chrome.
  value = value.replace(/\s*\|\s*Foot\s*-\s*[^|]{2,40}$/i, "").trim();
  return value;
}

function newsSourceStatus(signal: EditorialNewsSignal, corroborated: boolean): EditorialSource["status"] {
  if (signal.sourceTier === "OFFICIAL") return "OFFICIAL";
  if (corroborated && signal.sourceTier === "TIER1") return "CORROBORATED";
  if (signal.sourceTier === "TIER1") return "HIGH_CONFIDENCE";
  return "UNCONFIRMED";
}

function matchingContextMatch(cluster: NewsCluster, matches: EditorialMatch[]): EditorialMatch | null {
  const hay = `${cluster.title} ${cluster.entities.join(" ")}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  let best: EditorialMatch | null = null;
  let bestScore = 0;
  for (const match of matches) {
    const names = [match.home.name, match.home.short, match.away.name, match.away.short].filter(Boolean) as string[];
    let score = 0;
    for (const name of names) {
      const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalized.length >= 4 && hay.includes(normalized)) score += 2;
      else {
        for (const part of normalized.split(/\s+/)) if (part.length >= 5 && hay.includes(part)) score += 1;
      }
    }
    if (score > bestScore) {
      best = match;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function newsConsequenceLine(text: string, subject: string): string {
  if (/blessure|blessé|forfait|absent|indisponible|opéré|operation/i.test(text)) {
    return `Pour ${subject}, les conséquences vérifiables se liront dans le prochain groupe convoqué, le point médical et la feuille de match. Une durée d'absence n'est ajoutée que si une source l'établit.`;
  }
  if (/transfert|mercato|accord|signature|prolong|contrat/i.test(text)) {
    return `Pour ${subject}, la prochaine preuve forte serait un communiqué de club, une signature enregistrée ou un changement contractuel attribuable. Une rumeur, même reprise, ne devient pas un transfert acquis.`;
  }
  if (/licenci|limog|entra[iî]neur|coach|nommé|nomination/i.test(text)) {
    return `Pour ${subject}, la suite concrète se vérifie dans la communication du club, la présence sur le banc et les décisions de staff. BetGPT sépare le changement annoncé des spéculations sur son remplaçant.`;
  }
  if (/composition|compo|titulaire|banc|groupe|sélection/i.test(text)) {
    return `Pour ${subject}, le contrôle suivant porte sur la liste officielle, la feuille de match et les changements de dernière minute. Aucun joueur n'est présenté comme titulaire sans confirmation exploitable.`;
  }
  if (/sanction|suspendu|décision|communiqué|officiel|autorisé|autorisation|dément|refus|verdict/i.test(text)) {
    return `Pour ${subject}, ce nouvel élément modifie l'état du dossier. BetGPT recherche ensuite la décision primaire, ses conditions exactes et son effet sportif plutôt que de recycler l'étape précédente de l'histoire.`;
  }
  return `Pour ${subject}, la suite utile dépend d'un fait supplémentaire attribuable : déclaration, décision, résultat, liste officielle ou nouvelle donnée de match. Sans élément nouveau, aucune dépêche supplémentaire n'est créée.`;
}

function composeNews(
  cluster: NewsCluster,
  matches: EditorialMatch[],
  slot: SlotId,
  day: string,
  when: string,
  open: boolean,
): Omit<EditorialArticle, "image" | "related" | "quality" | "duplicateScore" | "discoverChecks" | "discoverReadiness" | "topStories" | "discoverOpportunity"> {
  const ranked = cluster.signals
    .slice()
    .sort((a, b) => {
      const tier = (x: EditorialNewsSignal) => (x.sourceTier === "OFFICIAL" ? 3 : x.sourceTier === "TIER1" ? 2 : 1);
      return tier(b) - tier(a) || b.publishedAt.localeCompare(a.publishedAt);
    });
  const leadSignal = ranked[0]!;
  const citedSignals = ranked.slice(0, 6);
  const h1 = cleanNewsTitle(cluster.title, leadSignal.sourceName);
  const corroborated = cluster.distinctSources >= 2;
  const sources: EditorialSource[] = citedSignals.map((signal) => ({
    id: signal.id,
    label: signal.sourceName,
    status: newsSourceStatus(signal, corroborated),
    note: `${cleanNewsTitle(signal.title, signal.sourceName)} · publié ${formatParis(signal.publishedAt)}.`,
    url: signal.url,
  }));
  const contextMatch = matchingContextMatch(cluster, matches);
  if (contextMatch) sources.push(coreSources(contextMatch, contextMatch.competition)[0]!);
  const contextSourceId = contextMatch ? `cal-${contextMatch.id}` : null;
  const entities = cluster.entities.length ? cluster.entities : contextMatch ? [contextMatch.home.name, contextMatch.away.name] : [];
  const mainClaim = cleanNewsTitle(leadSignal.title, leadSignal.sourceName);
  const subject = entities.length ? entities.join(", ") : "le sujet";
  const material = cluster.signals.some((signal) =>
    isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`),
  );

  const cleanDetail = (signal: EditorialNewsSignal): string => {
    const raw = (signal.description || cleanNewsTitle(signal.title, signal.sourceName))
      .replace(/\s+/g, " ")
      .trim();
    return raw.length > 720 ? `${raw.slice(0, 717).trimEnd()}…` : raw;
  };

  const usefulSignals = citedSignals
    .filter((signal) => cleanDetail(signal).length >= 70)
    .slice(0, 5);
  const detailLines = usefulSignals.map(
    (signal) =>
      `${signal.sourceName}, ${formatParis(signal.publishedAt)} : ${cleanDetail(signal)}`,
  );
  const chronology = citedSignals
    .slice()
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(0, 6)
    .map(
      (signal) =>
        `${formatParis(signal.publishedAt)} — ${signal.sourceName} publie « ${cleanNewsTitle(signal.title, signal.sourceName)} ».`,
    )
    .join(" ");

  const officialSignals = citedSignals.filter((signal) => signal.sourceTier === "OFFICIAL");
  const tier1Signals = citedSignals.filter((signal) => signal.sourceTier === "TIER1");
  const otherSignals = citedSignals.filter((signal) => signal.sourceTier === "OTHER");

  const contextLine = contextMatch
    ? `Le calendrier BetGPT rattache ce sujet à ${contextMatch.home.name} – ${contextMatch.away.name}, en ${contextMatch.competition}, avec un coup d'envoi ${formatParis(contextMatch.kickoff)}. Ce match fournit un repère sportif concret pour mesurer les conséquences de l'information sans inventer de date de retour, de composition ou de disponibilité.`
    : `Aucune rencontre précise du calendrier BetGPT n'est suffisamment reliée à ce sujet pour servir de prétexte à une projection sportive. L'article reste donc centré sur les faits publiés par les sources, sans fabriquer de prochain match ni de calendrier de retour.`;

  const sourceReading = detailLines.length
    ? detailLines.join(" ")
    : `${leadSignal.sourceName} fournit pour l'instant l'élément factuel principal : ${mainClaim}. Les autres signaux disponibles ne contiennent pas assez de détails distincts pour ajouter un récit supplémentaire sans répétition.`;

  const leadDetail = cleanDetail(leadSignal);
  const lead = `${mainClaim}. ${leadSignal.sourceName} a publié cette information ${formatParis(leadSignal.publishedAt)}. ${corroborated ? `Le dossier est repris par ${cluster.distinctSources} sources distinctes.` : "La formulation reste attribuée à cette source tant qu'une corroboration indépendante n'est pas disponible."} ${leadDetail && leadDetail !== mainClaim ? leadDetail : ""}`.replace(/\s+/g, " ").trim();

  const paragraphs = [
    paragraph(
      "Le fait nouveau qui fait basculer le dossier",
      `${leadSignal.sourceName} rapporte ${mainClaim}. ${material ? "Ce nouvel élément modifie l'état du dossier par rapport aux informations qui circulaient auparavant." : "L'information devient pertinente parce qu'elle précise un dossier déjà suivi, sans transformer une hypothèse en certitude."} ${corroborated ? `Au total, ${cluster.distinctSources} rédactions ou sources distinctes alimentent ce cluster d'actualité.` : "À ce stade, une seule source forte porte encore l'essentiel du fait nouveau."} Les détails complémentaires sont attribués séparément dans la section suivante afin d'éviter de transformer une reprise en confirmation indépendante.`.replace(/\s+/g, " ").trim(),
      [leadSignal.id],
    ),
    paragraph(
      "Ce que disent précisément les différentes sources",
      `${sourceReading} Cette présentation reste volontairement attribuée source par source : lorsque deux médias racontent le même épisode avec des détails différents, BetGPT ne fusionne pas automatiquement ces détails en un fait unique. Une information n'est élevée au rang de fait établi que si son niveau de source le justifie ou si plusieurs références indépendantes convergent réellement.`,
      usefulSignals.length ? usefulSignals.map((signal) => signal.id) : [leadSignal.id],
    ),
    paragraph(
      "La chronologie des publications",
      `${chronology || `${leadSignal.sourceName} publie le premier signal exploitable ${formatParis(leadSignal.publishedAt)}.`} Cette chronologie permet de distinguer le fait initial, les reprises et les éventuelles confirmations plus tardives. Elle évite surtout de présenter comme simultanées des informations qui ont pu évoluer au fil de la journée.`,
      citedSignals.map((signal) => signal.id),
    ),
    paragraph(
      contextMatch ? "Le repère sportif concret autour de cette information" : "Pourquoi BetGPT ne force pas un contexte de match",
      `${contextLine} ${entities.length ? `Les entités explicitement détectées dans les sources sont : ${entities.join(", ")}.` : "Aucune entité sportive supplémentaire n'est ajoutée à partir de mémoire ou de suppositions."}`,
      contextSourceId ? [contextSourceId, leadSignal.id] : [leadSignal.id],
    ),
    paragraph(
      "Ce qui est établi, corroboré ou encore fragile",
      `Le cluster contient ${officialSignals.length} source${officialSignals.length > 1 ? "s" : ""} officielle${officialSignals.length > 1 ? "s" : ""}, ${tier1Signals.length} source${tier1Signals.length > 1 ? "s" : ""} de premier niveau journalistique et ${otherSignals.length} autre${otherSignals.length > 1 ? "s" : ""} source${otherSignals.length > 1 ? "s" : ""}. ${officialSignals.length ? "Les éléments issus d'une source officielle sont distingués des reprises de presse." : "Aucune déclaration officielle n'est ajoutée artificiellement si elle n'existe pas dans le flux."} ${corroborated ? "Les points communs entre plusieurs sources sont présentés comme corroborés ; les détails isolés restent attribués." : "Les détails non corroborés restent explicitement attachés à leur source d'origine."}`,
      citedSignals.map((signal) => signal.id),
    ),
    paragraph(
      "Le prochain élément qui permettra de mettre l'article à jour",
      `${newsConsequenceLine(`${leadSignal.title} ${leadSignal.description ?? ""}`, subject)} BetGPT ne republie pas une nouvelle dépêche pour répéter le même état de fait : une mise à jour exige un changement matériel, une confirmation nouvelle ou une donnée sportive directement vérifiable.`,
      citedSignals.slice(0, 2).map((signal) => signal.id),
    ),
  ];

  const links = contextMatch ? deskLinks(contextMatch, contextMatch.competition) : deskLinks(null, "Football");
  const publishedAt = open ? when : null;
  return {
    id: `ed-${day}-${slot}`,
    slug: newsSlug([h1, day]),
    slot,
    articleType: "news",
    status: open ? "PUBLISHED" : "SCHEDULED",
    title: `${h1} | BetGPT`,
    h1,
    lead,
    paragraphs,
    createdAt: when,
    publishedAt,
    modifiedAt: publishedAt,
    parisDate: day,
    scheduledTime: when.slice(11, 16),
    category: "Actualité football",
    section: contextMatch ? sectionFor(contextMatch.league) : "football",
    league: contextMatch?.league ?? null,
    teams: entities,
    matchId: contextMatch?.id ?? null,
    competition: contextMatch?.competition ?? "Football",
    sources,
    newsworthiness: 0,
    links,
    corrections: [],
    sourceChanges: [],
    factHash: factHash(cluster.signals.map((signal) => `${signal.id}:${signal.publishedAt}:${signal.title}`)),
    keywords: [...entities, contextMatch?.competition ?? "football", "actualité football"].filter(Boolean).join(", "),
  };
}

function discoverOpportunity(
  draft: Pick<EditorialArticle, "articleType" | "teams" | "competition" | "sources" | "paragraphs" | "h1">,
  score: number,
  imageWidth: number,
  duplicateScore: number,
) {
  const freshness = Math.max(0, Math.min(20, Math.round(score * 0.2)));
  const frenchInterest = Math.max(0, Math.min(20, Math.round(score * 0.2)));
  const named = draft.teams
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const strongEntity = [...NOTABLE].some((token) => named.includes(token));
  const entityStrength = strongEntity ? 15 : Math.max(5, Math.min(12, Math.round(score * 0.12)));
  const novelty = duplicateScore < 0.35 ? 15 : duplicateScore < 0.55 ? 10 : 4;
  const visual = imageWidth >= 1200 ? 10 : 0;
  const sourceQuality = sourceQualityScore(draft.sources);
  const editorialAngle = draft.articleType === "postmatch" || draft.articleType === "brief" ? 10 : strongEntity ? 8 : 5;
  const total = Math.max(0, Math.min(100, freshness + frenchInterest + entityStrength + novelty + visual + sourceQuality + editorialAngle));
  const reasons: string[] = [];
  if (draft.articleType === "slate") reasons.push("programme générique");
  if (sourceQuality < 4) reasons.push("sources insuffisantes");
  if (entityStrength < 8) reasons.push("intérêt entité faible");
  if (duplicateScore >= 0.66) reasons.push("risque de duplication");
  if (total < 70) reasons.push(`score Discover Opportunity ${total}/100 sous le seuil 70`);
  const decision = total >= 80 ? "PUBLISH" : total >= 70 ? "REVIEW" : "REJECT";
  return { freshness, frenchInterest, entityStrength, novelty, visual, sourceQuality, editorialAngle, total, decision, reasons } as const;
}

function finalize(
  draft: Omit<EditorialArticle, "image" | "related" | "quality" | "duplicateScore" | "discoverChecks" | "discoverReadiness" | "topStories" | "discoverOpportunity">,
  score: number,
  prior: string[],
  usedImages: Set<string>,
): EditorialArticle {
  const image = imageFor(draft.articleType, draft.league, draft.slug, usedImages);
  const gate = qualityGate({ ...draft, image }, prior);
  const opportunity = discoverOpportunity(draft, score, image.width, gate.duplicateScore);
  const opportunityPass = opportunity.total >= 70 && opportunity.decision !== "REJECT";
  const combinedReasons = [...gate.reasons, ...opportunity.reasons];
  const article: EditorialArticle = {
    ...draft,
    image,
    related: [],
    newsworthiness: score,
    discoverOpportunity: opportunity,
    quality: { pass: gate.pass && opportunityPass, reasons: combinedReasons },
    duplicateScore: gate.duplicateScore,
    discoverChecks: {
      INDEXABLE: false,
      LARGE_IMAGE: image.width >= 1200,
      IMAGE_GE_1200: image.width >= 1200,
      MAX_IMAGE_PREVIEW_LARGE: true,
      HELPFUL_CONTENT: false,
      NON_CLICKBAIT_TITLE: true,
      ORIGINAL_VALUE: false,
      MOBILE_TEMPLATE: true,
    },
    discoverReadiness: 0,
    topStories: "NOT_READY",
  };
  article.discoverChecks = discoverChecks(article);
  article.discoverReadiness = readinessScore(article.discoverChecks);
  const ready = article.discoverChecks.INDEXABLE && article.discoverChecks.LARGE_IMAGE && article.discoverChecks.NON_CLICKBAIT_TITLE && article.discoverChecks.HELPFUL_CONTENT;
  article.topStories = ready ? "TOP_STORIES_ELIGIBILITY_READY" : "NOT_READY";
  return article;
}

function probe(article: EditorialArticle): string {
  return `${article.h1} ${article.lead}`;
}

function buildCandidates(
  matches: EditorialMatch[],
  signals: EditorialNewsSignal[],
  now: number,
  day: string,
  models: Map<string, EditorialModel>,
): Candidate[] {
  const dayMatches = matches
    .filter((m) => instantParisDate(m.kickoff) === day)
    .slice()
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const out: Candidate[] = [];
  // Les programmes génériques restent des pages utilitaires éventuelles, jamais des candidats éditoriaux Discover automatiques.
  void dayMatches;
  for (const match of matches) {
    const type: ArticleType =
      match.status === "finished" ? "postmatch" : match.status === "live" ? "brief" : "preview";
    const score = scoreMatch(match, now, type);
    out.push({
      id: `${type}-${match.id}`,
      match,
      news: null,
      articleType: type,
      score,
      slotFit: type === "preview" ? "noon" : slotFit(type),
      title: `${match.home.name} – ${match.away.name}`,
    });
    if (type === "preview" && models.has(match.id)) {
      out.push({
        id: `brief-${match.id}`,
        match,
        news: null,
        articleType: "brief",
        score: Math.min(100, score + 2),
        slotFit: "noon",
        title: `${match.home.name} – ${match.away.name}`,
      });
    }
  }

  for (const cluster of clusterSignals(signals)) {
    if (!autoPublishableCluster(cluster)) continue;
    const publishedMs = Date.parse(cluster.publishedAt);
    if (!Number.isFinite(publishedMs)) continue;
    const ageHours = Math.max(0, (now - publishedMs) / 36e5);
    const strongSources = cluster.signals.filter((signal) => signal.sourceTier === "OFFICIAL" || signal.sourceTier === "TIER1");
    const sourceScore = cluster.official ? 28 : strongSources.length >= 2 ? 22 : 8;
    const freshness = ageHours <= 2 ? 24 : ageHours <= 6 ? 20 : ageHours <= 12 ? 14 : ageHours <= 24 ? 8 : 3;
    const entityText = cluster.entities
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const strongEntity = [...NOTABLE].some((token) => entityText.includes(token));
    const entityScore = strongEntity ? 20 : cluster.entities.length ? 12 : 4;
    const corroboration = cluster.distinctSources >= 3 ? 14 : cluster.distinctSources >= 2 ? 10 : cluster.official ? 8 : 0;
    const angle = cluster.newsworthy ? 16 : 0;
    const materialBonus = cluster.signals.some((signal) =>
      isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`),
    )
      ? 8
      : 0;
    const score = Math.max(0, Math.min(100, sourceScore + freshness + entityScore + corroboration + angle + materialBonus));
    out.push({
      id: `news-${cluster.id}`,
      match: null,
      news: cluster,
      articleType: "news",
      score,
      slotFit: "noon",
      title: cluster.title,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export function applyEventOverride<T extends { slot: SlotId; score: number; articleType: ArticleType; matchId: string | null }>(
  selected: T[],
  breaking: T[],
): T[] {
  const next = [...selected];
  for (const event of breaking) {
    if (event.score < 82) continue;
    if (event.articleType !== "postmatch" && event.articleType !== "brief" && event.articleType !== "news") continue;
    if (next.some((row) => row.matchId && row.matchId === event.matchId)) continue;
    let weakest = 0;
    for (let i = 1; i < next.length; i += 1) if (next[i]!.score < next[weakest]!.score) weakest = i;
    const slot = next[weakest];
    if (!slot || event.score < slot.score + 12) continue;
    next[weakest] = { ...event, slot: slot.slot };
  }
  return next;
}

function refreshFrozen(
  frozen: EditorialArticle,
  matches: EditorialMatch[],
  models: Map<string, EditorialModel>,
  usedImages: Set<string>,
  now: Date,
): EditorialArticle {
  // A news story may be contextually linked to a match, but a desk odds/score
  // change must never rewrite that story as a generic match preview while
  // preserving its original news slug. News articles stay frozen unless a
  // genuine editorial news development creates a new article.
  if (frozen.articleType === "news") return frozen;
  if (!frozen.matchId) return frozen;
  const match = matches.find((row) => row.id === frozen.matchId);
  if (!match) return frozen;
  const model = models.get(match.id);
  if (hashOf(match, model) === frozen.factHash) return frozen;
  const when = frozen.publishedAt ?? frozen.createdAt;
  const draft = composeMatch(
    match,
    frozen.articleType === "slate" ? "preview" : frozen.articleType,
    model,
    frozen.slot,
    frozen.parisDate,
    when,
    Boolean(frozen.publishedAt),
  );
  const article = finalize(
    { ...draft, id: frozen.id, slug: frozen.slug, createdAt: frozen.createdAt, publishedAt: frozen.publishedAt, status: "UPDATED" },
    frozen.newsworthiness,
    [],
    usedImages,
  );
  const at = now.toISOString();
  article.modifiedAt = at;
  article.corrections = [
    ...frozen.corrections,
    {
      at,
      note: "Mise à jour factuelle après un changement de score, de statut ou de cote observée. L'URL et l'heure de première publication ne bougent pas.",
    },
  ];
  article.sourceChanges = [...frozen.sourceChanges, { at, note: "Sources réévaluées sur le nouveau signal desk." }];
  article.status = "UPDATED";
  article.publishedAt = frozen.publishedAt;
  return article;
}

function wireRelated(articles: EditorialArticle[]): EditorialArticle[] {
  const published = articles.filter(isPublicArticle);
  return articles.map((article) => {
    if (!isPublicArticle(article)) return { ...article, related: [] };
    const ranked = published
      .filter((other) => other.slug !== article.slug)
      .map((other) => {
        const sameTeam = other.teams.some((team) => article.teams.includes(team));
        const sameComp = other.competition === article.competition;
        const sameLeague = other.league && other.league === article.league;
        const score = (sameTeam ? 5 : 0) + (sameComp ? 3 : 0) + (sameLeague ? 2 : 0);
        return { other, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || b.other.publishedAt!.localeCompare(a.other.publishedAt!))
      .slice(0, 5)
      .map((row) => ({ href: `/actualites/${row.other.slug}`, title: row.other.h1 }));
    return { ...article, related: ranked };
  });
}

function materialize(
  candidate: Candidate,
  slot: SlotId,
  day: string,
  time: string,
  now: Date,
  models: Map<string, EditorialModel>,
  pool: EditorialMatch[],
  prior: string[],
  usedImages: Set<string>,
): EditorialArticle {
  const scheduled = slotInstant(day, time);
  const immediateBreakingNews =
    candidate.articleType === "news" &&
    candidate.score >= 88 &&
    Boolean(candidate.news) &&
    (candidate.news!.official ||
      candidate.news!.signals.some((signal) =>
        isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`),
      ));
  const open = immediateBreakingNews || scheduled.getTime() <= now.getTime();
  // Never backdate a first publication. A high-confidence material development may also open
  // the next unused slot immediately instead of waiting for the nominal morning/noon/evening time.
  const when = open ? now.toISOString() : scheduled.toISOString();
  const draft = candidate.news
    ? composeNews(candidate.news, pool, slot, day, when, open)
    : candidate.match
      ? composeMatch(candidate.match, candidate.articleType, models.get(candidate.match.id), slot, day, when, open)
      : composeSlate(
          pool.filter((match) => instantParisDate(match.kickoff) === day),
          slot,
          day,
          when,
          open,
        );
  draft.id = `ed-${day}-${slot}`;
  draft.slot = slot;
  draft.scheduledTime = time;
  draft.createdAt = when;
  draft.newsworthiness = candidate.score;
  return finalize(draft, candidate.score, prior, usedImages);
}

function isCorruptedFrozenNews(article: EditorialArticle): boolean {
  if (article.articleType !== "news") return false;
  const text = `${article.h1} ${article.lead}`.toLowerCase();
  // Signature of the historical bug where a news article was rebuilt through
  // composeMatch() while keeping the original news slug.
  return (
    /forme, horaire et données disponibles/.test(text) ||
    /les clés du match et l'heure du coup d'envoi/.test(text) ||
    /dernières informations avant le match/.test(text) ||
    (/affronte/.test(text) && /coup d'envoi/.test(text) && /voici les informations vérifiées disponibles/.test(text))
  );
}

export function buildEdition(input: EditionInput): EditorialEdition {
  const now = input.now ?? new Date();
  const day = parisDate(now);
  const baseTimes = { ...DEFAULT_TIMES, ...input.times };
  const optimized = optimizeTimes(baseTimes, input.metrics, input.timeChanges ?? []);
  const times = optimized.times;
  const models = new Map((input.models ?? []).map((model) => [model.matchId, model]));
  const pool = input.matches.filter((match) => inWindow(match, now.getTime(), day));
  const candidates = buildCandidates(pool, input.signals ?? [], now.getTime(), day, models);
  const frozenPublic = (input.frozen ?? [])
    .filter(isPublicArticle)
    .filter((article) => !isCorruptedFrozenNews(article));
  const frozenToday = frozenPublic.filter((article) => article.parisDate === day);
  const locked = new Set(frozenToday.map((article) => article.slot));
  const usedMatches = new Set(frozenToday.map((article) => article.matchId).filter((id): id is string => Boolean(id)));
  const usedCandidateIds = new Set<string>();
  const usedImages = new Set(frozenToday.map((article) => article.image.src));
  const prior = frozenToday.map(probe);
  const skipped: SkippedSlot[] = [];
  const chosen: { slot: SlotId; candidate: Candidate | null; article: EditorialArticle | null }[] = [];
  let slateUsed = false;

  (["morning", "noon", "evening"] as SlotId[]).forEach((slot) => {
    if (locked.has(slot)) return;
    const order = preferred(slot);
    const ranked = candidates
      .filter((candidate) => !usedCandidateIds.has(candidate.id))
      .filter((candidate) => !candidate.match || !usedMatches.has(candidate.match.id))
      .filter((candidate) => candidate.articleType !== "slate" || !slateUsed)
      .slice()
      .sort((a, b) => {
        const ap = order.indexOf(a.articleType);
        const bp = order.indexOf(b.articleType);
        const aw = ap === -1 ? 9 : ap;
        const bw = bp === -1 ? 9 : bp;
        return aw - bw || b.score - a.score;
      });
    let picked: Candidate | null = null;
    let article: EditorialArticle | null = null;
    const rejects: string[] = [];
    for (const candidate of ranked) {
      if (candidate.score < 65) {
        rejects.push(`${candidate.title}: score ${candidate.score}`);
        continue;
      }
      const built = materialize(candidate, slot, day, times[slot], now, models, pool, prior, usedImages);
      if (!built.quality.pass) {
        rejects.push(`${candidate.id}: ${built.quality.reasons.join(", ")}`);
        continue;
      }
      picked = candidate;
      article = built;
      prior.push(probe(built));
      if (built.image.src) usedImages.add(built.image.src);
      break;
    }
    if (!picked) {
      skipped.push({
        jobId: `ed-${day}-${slot}`,
        slot,
        reason: rejects.length ? `FAIL_CLOSED ${rejects.slice(0, 4).join(" || ")}` : "FAIL_CLOSED aucun sujet fiable",
      });
    }
    if (picked?.articleType === "slate") slateUsed = true;
    chosen.push({ slot, candidate: picked, article });
    if (picked) usedCandidateIds.add(picked.id);
    if (picked?.match) usedMatches.add(picked.match.id);
  });

  const selectedCandidateIds = new Set(chosen.map((row) => row.candidate?.id).filter((id): id is string => Boolean(id)));
  const breaking = candidates
    .filter((candidate) => !selectedCandidateIds.has(candidate.id))
    .filter((candidate) =>
      candidate.articleType === "news"
        ? candidate.score >= 88
        : (candidate.articleType === "postmatch" || candidate.articleType === "brief") && candidate.score >= 82,
    )
    .map((candidate) => ({
      slot: "evening" as SlotId,
      score: candidate.score,
      articleType: candidate.articleType,
      matchId: candidate.match?.id ?? null,
      candidate,
    }));
  const overridden = applyEventOverride(
    chosen
      .filter((row) => row.candidate)
      .map((row) => ({
        slot: row.slot,
        score: row.candidate!.score,
        articleType: row.candidate!.articleType,
        matchId: row.candidate!.match?.id ?? null,
        candidate: row.candidate!,
      })),
    breaking,
  );
  for (const row of overridden) {
    const target = chosen.find((item) => item.slot === row.slot);
    if (!target || target.candidate?.id === row.candidate.id) continue;
    const others = chosen
      .filter((item) => item.slot !== row.slot && item.article)
      .map((item) => probe(item.article!));
    const built = materialize(row.candidate, row.slot, day, times[row.slot], now, models, pool, others, usedImages);
    if (!built.quality.pass) continue;
    target.candidate = row.candidate;
    target.article = built;
  }

  const fresh = chosen.flatMap((row) => (row.article ? [row.article] : []));

  const refreshed = frozenToday.map((article) => refreshFrozen(article, pool, models, usedImages, now));
  const archivedFrozen = frozenPublic.filter((article) => article.parisDate !== day);
  // Published URLs are immutable inventory. The three-slot policy caps new daily
  // generation; it must never evict an already-published article from the corpus.
  const articles = wireRelated([...refreshed, ...fresh, ...archivedFrozen]);
  const filled = new Set(
    articles.filter((article) => article.parisDate === day).map((article) => article.slot),
  );
  const skippedClean = skipped.filter((row) => !filled.has(row.slot));

  const slots = (["morning", "noon", "evening"] as SlotId[]).map((slot) => {
    const opens = slotInstant(day, times[slot]);
    return {
      id: slot,
      time: times[slot],
      jobId: `ed-${day}-${slot}`,
      opensAt: opens.toISOString(),
      article:
        articles.find((article) => article.parisDate === day && article.slot === slot) ?? null,
      skipped: skippedClean.find((row) => row.slot === slot) ?? null,
    };
  });
  const upcoming = slots.find((slot) => Date.parse(slot.opensAt) > now.getTime());
  const tomorrowMorning = slotInstant(shiftDay(day, 1), times.morning);
  const planning = slotInstant(shiftDay(day, Date.parse(slotInstant(day, "00:05").toISOString()) > now.getTime() ? 0 : 1), "00:05");

  const candidateViews: CandidateView[] = candidates.slice(0, 12).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    score: candidate.score,
    slotFit: candidate.slotFit,
    articleType: candidate.articleType,
    competition: candidate.match?.competition ?? (candidate.news ? "Actualité football" : pool[0]?.competition ?? ""),
    sources: candidate.news
      ? candidate.news.signals.slice(0, 3).map((signal) => `${signal.sourceName} (${signal.sourceTier})`)
      : candidate.match
        ? ["Calendrier BetGPT", listedOdds(candidate.match)?.book ?? "cotes absentes"]
        : ["Calendrier BetGPT"],
    matchId: candidate.match?.id ?? null,
  }));

  return {
    parisDate: day,
    generatedAt: now.toISOString(),
    timezone: "Europe/Paris",
    slots,
    articles,
    skipped: skippedClean,
    candidates: candidateViews,
    nextRun: (upcoming ? new Date(upcoming.opensAt) : tomorrowMorning).toISOString(),
    nextPlanningAt: planning.toISOString(),
    times,
    timeChanges: optimized.changes,
    maxPerDay: 3,
    targetPerDay: 3,
    publicationPolicy: "OPPORTUNITY_DRIVEN_MAX_3",
    plannedCount: slots.filter((slot) => slot.article).length,
    targetStatus: slots.filter((slot) => slot.article).length >= 3 ? "MET" : "DEGRADED",
  };
}

function shiftDay(day: string, add: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d! + add, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

export function newsCards(edition: EditorialEdition): {
  published: { href: string; title: string; lead: string; time: string; category: string; image: string; alt: string }[];
  planned: { slot: SlotId; time: string; title: string; score: number | null; status: string; sources: string[] }[];
} {
  return {
    published: edition.articles.filter(isPublicArticle).slice(0, 3).map((article) => ({
      href: `/actualites/${article.slug}`,
      title: article.h1,
      lead: article.lead,
      time: formatParis(article.publishedAt),
      category: article.category,
      image: article.image.src,
      alt: article.image.alt,
    })),
    planned: edition.slots.map((slot) => ({
      slot: slot.id,
      time: slot.time,
      title: slot.article?.h1 ?? slot.skipped?.topic ?? "Sujet non retenu",
      score: slot.article?.newsworthiness ?? null,
      status: slot.article ? slot.article.status : slot.skipped ? `SKIPPED` : "VIDE",
      sources: slot.article?.sources.slice(0, 2).map((source) => `${source.label} (${source.status})`) ?? [],
    })),
  };
}

export function articleUrl(slug: string): string {
  return `${SITE_URL}/actualites/${slug}`;
}

export const HUB_SECTIONS: { slug: string; title: string; league: EditorialMatch["league"] | "ALL" }[] = [
  { slug: "football", title: "Football", league: "ALL" },
  { slug: "ligue-1", title: "Ligue 1", league: "L1" },
  { slug: "premier-league", title: "Premier League", league: "PL" },
  { slug: "champions-league", title: "Ligue des champions", league: "CL" },
  { slug: "la-liga", title: "La Liga", league: "LL" },
  { slug: "bundesliga", title: "Bundesliga", league: "BL" },
  { slug: "serie-a", title: "Serie A", league: "SA" },
  { slug: "ligue-europa", title: "Ligue Europa", league: "EL" },
];

export function sectionArticles(edition: EditorialEdition, slug: string): EditorialArticle[] | null {
  const section = HUB_SECTIONS.find((item) => item.slug === slug);
  if (!section) return null;
  return edition.articles.filter(isPublicArticle).filter((article) => (section.league === "ALL" ? true : article.league === section.league));
}

export const SECTION_MIN = 3;
