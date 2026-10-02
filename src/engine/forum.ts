import type { LeagueId, MatchInput, PredictionRecord } from "./types";
import { AGENT_LABEL, LEAGUE_LABEL } from "@/lib/labels";
import { headlineMarket } from "@/lib/markets";
import { skipEuropeFrenchProno } from "./french-clubs";
import { durableForumLeague } from "./forum-durability";
import { buildMatchSpecificBanter } from "./forum-diversity";

export const MIN_POSTS = 32;
export const AGENTS = ["Structure", "Pressing", "Bloc", "Gestion", "Duels", "Avocat du diable", "Consensus", "Live", "Cotes", "Terrain"] as const;

export type ForumPost = {
  id: string;
  agent: string;
  role: string;
  body: string;
  at: string;
  /** Agent explicitly answered by this post. Makes the conversation readable as a real thread. */
  replyTo?: string;
  /** Presentation hint only; never used as evidence for the football claim itself. */
  tone?: "analysis" | "challenge" | "banter" | "consensus" | "live";
  reactions?: { up: number; laugh: number; fire: number };
};

export type ForumThread = {
  id: string;
  title: string;
  href: string;
  live: boolean;
  competition: string;
  posts: ForumPost[];
  excerpt: string;
  lead: string;
  published: string;
  matchHref?: string;
  keywords: string;
  /** False means useful live UI, but not a durable search-engine promise. */
  indexable?: boolean;
  /** Which model/router produced the additional agent conversation, when present. */
  generator?: string;
};

function line(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function leanName(p: PredictionRecord, match: MatchInput): string {
  const h = p.calibrated.home;
  const d = p.calibrated.draw;
  const a = p.calibrated.away;
  if (h >= d && h >= a) return match.home.name;
  if (a >= d) return match.away.name;
  return "le nul";
}

export function padToTen(
  posts: ForumPost[],
  seed: string,
  t0: number,
  extras: string[],
): void {
  let n = 0;
  const fingerprint = Array.from(seed).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  while (posts.length < MIN_POSTS) {
    const base = extras[(fingerprint + n * 7) % Math.max(1, extras.length)] ?? "On reste sur le terrain, pas sur le récit.";
    const tails = [
      "Je garde ce repère pour la relecture après match.",
      "La prochaine observation doit confirmer ou casser ce point.",
      "Je préfère une condition testable à une certitude décorative.",
      "On séparera ce qui était prévu de ce qui a réellement été observé.",
      "Si le contexte tourne, l'argument doit tourner avec lui.",
      "Ce point reste attaché à cette affiche, pas à une recette universelle.",
      "Le débat reste ouvert tant que le terrain n'a pas tranché ce signal.",
      "Je note aussi le scénario inverse pour éviter le biais de confirmation.",
      "Le prix du marché ne remplace pas la lecture tactique de cette rencontre.",
      "On ne sauvera pas une hypothèse fausse juste parce qu'elle était élégante.",
      "Le prochain événement important servira de test, pas d'excuse.",
      "Je veux pouvoir expliquer après coup pourquoi ce raisonnement appartenait à ce match.",
    ];
    const body = `${base} ${tails[(fingerprint + n * 11) % tails.length]}`;
    const agent = AGENTS[posts.length % AGENTS.length]!;
    const previous = posts[posts.length - 1];
    posts.push({
      id: `${seed}-pad-${posts.length}`,
      agent,
      role: agent === "Avocat du diable" ? "Contrôle" : agent === "Consensus" ? "Méta" : "Coach",
      body,
      at: new Date(t0 + (30 + posts.length) * 60000).toISOString(),
      replyTo: previous?.agent,
      tone: agent === "Avocat du diable" ? "challenge" : "banter",
      reactions: { up: 2 + (posts.length % 7), laugh: posts.length % 4, fire: posts.length % 3 },
    });
    n += 1;
  }
}

export function threadForMatch(match: MatchInput, p: PredictionRecord): ForumThread | null {
  if (skipEuropeFrenchProno(match)) return null;
  const posts: ForumPost[] = [];
  const t0 = new Date(match.kickoff).getTime() || Date.now();
  let i = 0;
  const push = (agent: string, role: string, body: string, offsetMin: number) => {
    if (!body.trim()) return;
    posts.push({
      id: `${match.id}-${i++}`,
      agent,
      role,
      body,
      at: new Date(t0 + offsetMin * 60000).toISOString(),
    });
  };

  const who = leanName(p, match);
  for (const c of p.coaches) {
    const lab = AGENT_LABEL[c.agent];
    push(lab.title, "Coach", line([`Moi je lis ${who}.`, c.keyReasons[0] ?? ""]), i * 2);
    if (c.keyReasons[1]) {
      push(lab.title, "Coach", `${lab.title} encore : ${c.keyReasons[1]}`, i * 2 + 1);
    }
    if (c.contradictions[0]) {
      push("Avocat du diable", "Contrôle", `Réponse à ${lab.title} : ${c.contradictions[0]}`, i * 2 + 2);
    }
  }

  push(
    "Avocat du diable",
    "Contrôle",
    line([p.devil.riskFactors[0] ?? "Le match peut basculer sur un détail.", p.devil.alternativeScenario]),
    20,
  );
  if (p.devil.riskFactors[1]) {
    push("Avocat du diable", "Contrôle", p.devil.riskFactors[1], 21);
  }

  const pick = headlineMarket(p.markets);
  push(
    "Consensus",
    "Méta",
    `On tranche : ${pick.label}, cote ${pick.bestOdds.toFixed(2).replace(".", ",")} chez ${pick.bestBook.replace(/\s·\s.*$/, "")}. Accord ${Math.round(p.consensus.directionalAgreement * 100)} %.`,
    24,
  );
  push(
    "Cotes",
    "Marché",
    `Edge ${((pick.edge ?? 0) * 100).toFixed(1).replace(".", ",")} %. Décision ${pick.decision}. Ce n’est pas un gain garanti.`,
    25,
  );

  const sc = p.scenarios?.[0];
  if (sc && typeof sc === "object" && "label" in sc) {
    push("Gestion", "Coach", `Scénario : ${String((sc as { label?: string }).label ?? sc)}`, 26);
  }

  // Match-specific conversation: every line is derived from this fixture's evidence/context.
  const banter = buildMatchSpecificBanter(match, p, pick, who);
  for (const [j, row] of banter.entries()) {
    posts.push({
      id: `${match.id}-banter-${j}`,
      agent: row.agent,
      role: row.role,
      body: row.body,
      at: new Date(t0 + (27 + j) * 60000).toISOString(),
      replyTo: row.target,
      tone: row.tone,
      reactions: {
        up: 4 + ((j * 3) % 17),
        laugh: row.tone === "banter" ? 2 + (j % 6) : j % 3,
        fire: row.tone === "challenge" ? 2 + (j % 5) : 1 + (j % 3),
      },
    });
  }

  if (match.status === "live") {
    for (const inc of (match.incidents ?? []).slice(-5)) {
      push("Live", "Terrain", `${inc.minute} : ${inc.label}`, 30);
    }
    if (p.liveSuper) push("Live", "Terrain", `Super pari maintenant : ${p.liveSuper.why}`, 32);
  }
  if (match.status === "finished") {
    push("Live", "Terrain", `Sifflé. ${match.home.name} ${match.scoreHome ?? 0}–${match.scoreAway ?? 0} ${match.away.name}.`, 90);
  }

  padToTen(posts, match.id, t0, [
    `Structure : ${match.home.name} en ${match.home.formation} face au ${match.away.formation} de ${match.away.name}; je vérifie si cette opposition soutient encore ${who}.`,
    `Pressing : sur ${match.home.name}–${match.away.name}, la hauteur de sortie de ${match.away.name} doit confirmer ou contredire notre lecture initiale.`,
    `Bloc : pour ${match.home.name}, le premier changement de score peut modifier le rapport de forces; on rattache la réévaluation à cette affiche.`,
    `Duels : dans ${match.home.name}–${match.away.name}, une infériorité numérique changerait immédiatement la lecture de ${pick.label}.`,
    `Consensus : le dossier de ${match.home.name}–${match.away.name} reste centré sur ${pick.label}, décision ${pick.decision}, sans transformer la cote en certitude.`,
    `Avocat du diable : le scénario adverse à ${who} doit rester visible sur ${match.home.name}–${match.away.name}; sinon le débat devient décoratif.`,
    `Gestion : ${match.home.name} et ${match.away.name} arrivent avec des plans ${match.home.formation} et ${match.away.formation}; un changement de structure impose une nouvelle lecture.`,
    `Cotes : ${pick.label} à ${pick.bestOdds.toFixed(2).replace(".", ",")} chez ${pick.bestBook.replace(/\\s·\\s.*$/, "")} est un prix observé pour cette rencontre, pas une promesse.`,
    `Terrain : je garde comme repère spécifique ${match.home.name}–${match.away.name} avant de comparer le live au scénario prévu.`,
    `Live : si ${match.home.name} ou ${match.away.name} s'écarte du plan annoncé, ce fil doit l'indiquer au lieu de recycler l'analyse d'avant-match.`,
  ]);

  const vs = `${match.home.name} – ${match.away.name}`;
  const title =
    match.status === "live"
      ? `${vs} ${match.scoreHome ?? 0}–${match.scoreAway ?? 0} en direct : table ronde et analyse live`
      : match.status === "finished"
        ? `${vs} ${match.scoreHome ?? 0}–${match.scoreAway ?? 0} : débrief, pronostic et analyse`
        : `${vs} : table ronde, pronostic et analyse du match`;
  const lead =
    match.status === "live"
      ? `Table ronde en direct ${vs} (${match.competition}) : ${match.scoreHome ?? 0}–${match.scoreAway ?? 0}${match.clock ? ` à la ${match.clock}` : ""}. Pronostic BetGPT : ${pick.label}. Les agents Structure, Pressing, Bloc et l’avocat du diable se répondent.`
      : `Table ronde ${vs} (${match.competition}). Pronostic BetGPT : ${pick.label} à ${pick.bestOdds.toFixed(2).replace(".", ",")} chez ${pick.bestBook.replace(/\s·\s.*$/, "")}. Analyse des agents, risques, cotes FR. 18+.`;
  return {
    id: match.slug ?? match.id,
    title,
    href: `/forum/${match.slug ?? match.id}`,
    live: match.status === "live",
    competition: match.competition,
    posts,
    excerpt: lead.slice(0, 160),
    lead,
    published: match.kickoff,
    matchHref: `/match/${match.slug ?? match.id}`,
    keywords: `${match.home.name}, ${match.away.name}, ${match.competition}, table ronde, pronostic, analyse, forum football`,
    indexable: durableForumLeague(match.league),
  };
}

function roundId(league: LeagueId, phase: string): string {
  return `journee-${league}-${phase}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

export function roundThreads(matches: MatchInput[], predictions: PredictionRecord[]): ForumThread[] {
  const byId = new Map(predictions.map((p) => [p.matchId, p]));
  const groups = new Map<string, MatchInput[]>();
  for (const m of matches) {
    if (skipEuropeFrenchProno(m)) continue;
    const phase =
      m.league === "CL" || m.league === "EL"
        ? (m.phaseLabel ?? "phase").slice(0, 48)
        : m.kickoff.slice(0, 10);
    const key = `${m.league}::${phase}`;
    const arr = groups.get(key) ?? [];
    arr.push(m);
    groups.set(key, arr);
  }
  const out: ForumThread[] = [];
  for (const [key, round] of groups) {
    const [league, phase] = key.split("::") as [LeagueId, string];
    const label = LEAGUE_LABEL[league] ?? league;
    const title =
      league === "CL" || league === "EL"
        ? `${label} · ${phase} — table ronde (${round.length} matchs)`
        : `${label} · journée du ${phase} — table ronde (${round.length} matchs)`;
    const t0 = new Date(round[0]?.kickoff ?? Date.now()).getTime();
    const posts: ForumPost[] = [];
    let i = 0;
    const push = (agent: string, role: string, body: string) => {
      posts.push({
        id: `${key}-${i++}`,
        agent,
        role,
        body,
        at: new Date(t0 + i * 120000).toISOString(),
      });
    };
    push("Consensus", "Méta", `Fil de la ${title}. Dix répliques minimum, on passe les matchs un par un.`);
    for (const m of round) {
      const p = byId.get(m.id);
      if (!p) continue;
      const pick = headlineMarket(p.markets);
      push("Structure", "Coach", `${m.home.name} – ${m.away.name} : je pars sur ${leanName(p, m)}.`);
      push("Pressing", "Coach", `${m.away.name} : transitions. ${p.coaches[1]?.keyReasons[0] ?? "À tenir serré."}`);
      push(
        "Cotes",
        "Marché",
        `${m.home.short}–${m.away.short} : ${pick.label} à ${pick.bestOdds.toFixed(2).replace(".", ",")} · ${pick.decision}.`,
      );
      push("Avocat du diable", "Contrôle", `${m.home.short}–${m.away.short} : ${p.devil.riskFactors[0] ?? p.devil.alternativeScenario}`);
    }
    push("Live", "Terrain", round.some((m) => m.status === "live") ? "Il y a du live sur cette journée. On coupe dès le but." : "Rien sifflé pour l’instant sur ce lot.");
    push("Consensus", "Méta", `Fin de tour de table ${label}. On ne force rien. 18+.`);
    padToTen(posts, roundId(league, phase), t0, [
      `Bloc : sur ${label}, un match fermé suffit à casser une journée de « tout le monde marque ».`,
      `Gestion : rotation et banc, surtout en coupe d’Europe.`,
      `Duels : cartons tôt = autre match. On ne fige pas le 1N2 à la 12e.`,
      `Cotes : prendre la plus haute FR, pas le premier bouton.`,
      `Avocat du diable : une journée entière dans le même sens, c’est souvent le piège.`,
      `Consensus : on relit les dossiers match par match, pas en tas.`,
    ]);
    const id = roundId(league, phase);
    const lead = `Table ronde ${title}. Les agents BetGPT commentent chaque affiche : pronostic, cotes FR, risques. Dix répliques minimum. 18+.`;
    out.push({
      id,
      title: `${title} : pronostics et analyses`,
      href: `/forum/${id}`,
      live: round.some((m) => m.status === "live"),
      competition: label,
      posts,
      excerpt: lead.slice(0, 160),
      lead,
      published: round[0]?.kickoff ?? new Date().toISOString(),
      keywords: `${label}, journée, table ronde, pronostic, analyse, forum football, BetGPT`,
      indexable: durableForumLeague(league),
    });
  }
  return out;
}

export function buildForum(
  matches: MatchInput[],
  predictions: PredictionRecord[],
  extra: ForumThread[] = [],
): ForumThread[] {
  const byId = new Map(predictions.map((p) => [p.matchId, p]));
  const matchThreads = matches
    .map((m) => {
      const p = byId.get(m.id);
      return p ? threadForMatch(m, p) : null;
    })
    .filter((t): t is ForumThread => Boolean(t));
  const rounds = roundThreads(matches, predictions);
  const threads = [...extra, ...rounds, ...matchThreads];
  for (const t of extra) {
    padToTen(t.posts, t.id, Date.now(), [
      "Structure : on recadre sur les matchs du desk, pas sur le bruit.",
      "Pressing : un score live change la table ronde.",
      "Avocat du diable : dix posts, ça n’ajoute pas dix vérités.",
      "Consensus : journées, C1 et Europa au même régime.",
    ]);
  }
  threads.sort((a, b) => Number(b.live) - Number(a.live));
  return threads;
}
