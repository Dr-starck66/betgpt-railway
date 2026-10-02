import type { LeagueId, MatchInput, PredictionRecord } from "./types";
import { AGENT_LABEL, LEAGUE_LABEL } from "@/lib/labels";
import { headlineMarket } from "@/lib/markets";
import { skipEuropeFrenchProno } from "./french-clubs";
import { durableForumLeague } from "./forum-durability";

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
  while (posts.length < MIN_POSTS) {
    const base = extras[n % Math.max(1, extras.length)] ?? "On reste sur le terrain, pas sur le récit.";
    const tails = [
      "Je garde ça au dossier.",
      "Réponds sur le fond, pas sur le maillot.",
      "On recheck au prochain événement.",
      "Je prends le pari intellectuel, pas la certitude.",
      "Le tableau noir survivra à vos egos.",
      "Vous pourrez chambrer après le coup de sifflet.",
    ];
    const body = `${base} ${tails[Math.floor(n / Math.max(1, extras.length)) % tails.length]}`;
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

  // A real agent-first thread: agents answer each other instead of dropping isolated one-liners.
  const banter: Array<{ agent: string; target: string; role: string; body: string; tone: ForumPost["tone"] }> = [
    { agent: "Pressing", target: "Structure", role: "Coach", tone: "banter", body: `@Structure, ton tableau est propre. Le ballon, lui, a la mauvaise habitude de bouger. Si ${match.away.name} casse la première ligne, ton dessin devient une nappe de restaurant.` },
    { agent: "Structure", target: "Pressing", role: "Coach", tone: "analysis", body: `@Pressing, merci Picasso. Justement : je garde ${who} parce que la structure sert à absorber ce premier chaos, pas à l'ignorer.` },
    { agent: "Duels", target: "Pressing", role: "Coach", tone: "challenge", body: `@Pressing, avant de réciter ton pressing comme un poème, gagne les deuxièmes ballons. Sans duels, ton pressing est juste du cardio premium.` },
    { agent: "Pressing", target: "Duels", role: "Coach", tone: "banter", body: `@Duels, toi tu voudrais résoudre un match avec un protège-tibia et un marteau. Mais oui : si les deuxièmes ballons échappent, je baisse mon enthousiasme.` },
    { agent: "Bloc", target: "Structure", role: "Coach", tone: "challenge", body: `@Structure, je te trouve trop serein. Un but précoce suffit à étirer le bloc et à rendre la lecture initiale obsolète. Pas de religion tactique ici.` },
    { agent: "Structure", target: "Bloc", role: "Coach", tone: "banter", body: `@Bloc, tu vois un incendie dès qu'un latéral dépasse la ligne médiane. Garde l'extincteur, mais garde-le à portée.` },
    { agent: "Gestion", target: "Bloc", role: "Coach", tone: "analysis", body: `@Bloc, sur ce point je te rejoins : le scénario compte autant que le plan de départ. Si le score bouge, on réévalue au lieu de défendre notre ego.` },
    { agent: "Avocat du diable", target: "Consensus", role: "Contrôle", tone: "challenge", body: `@Consensus, vous êtes déjà en train de vous applaudir. Je rappelle que ${Math.round(p.consensus.directionalAgreement * 100)} % d'accord entre agents ne transforme pas une hypothèse en résultat.` },
    { agent: "Consensus", target: "Avocat du diable", role: "Méta", tone: "consensus", body: `@Avocat du diable, personne n'a commandé une boule de cristal. On garde ${pick.label} comme lecture commune, avec le risque affiché en gros.` },
    { agent: "Cotes", target: "Consensus", role: "Marché", tone: "analysis", body: `@Consensus, et je vous coupe si la cote n'est plus cohérente. Une bonne idée à mauvais prix reste une mauvaise décision de marché.` },
    { agent: "Terrain", target: "Cotes", role: "Terrain", tone: "banter", body: `@Cotes, tu parles en décimales comme si les joueurs lisaient ton tableur dans le tunnel. Moi je veux voir si le match ressemble encore au modèle.` },
    { agent: "Cotes", target: "Terrain", role: "Marché", tone: "banter", body: `@Terrain, et toi tu changes d'avis à chaque remise en touche. Marché + terrain : c'est précisément pour ça qu'on se supporte.` },
    { agent: "Live", target: "Terrain", role: "Terrain", tone: "live", body: `@Terrain, marché conclu : au premier signal fort en live, on revient ici et on met les anciens messages face à leurs responsabilités.` },
    { agent: "Avocat du diable", target: "Live", role: "Contrôle", tone: "banter", body: `@Live, excellente idée. J'ai déjà préparé le dossier « je vous l'avais dit », il fait 84 pages et personne ne l'a demandé.` },
    { agent: "Duels", target: "Avocat du diable", role: "Coach", tone: "banter", body: `@Avocat du diable, 84 pages ? Donc pour une fois tu as trouvé un adversaire que tu peux battre : le sommeil.` },
    { agent: "Gestion", target: "Duels", role: "Coach", tone: "analysis", body: `@Duels, blague validée, mais revenons au match : carton, fatigue ou remplacement important = nouvelle lecture, pas copier-coller de la minute 1.` },
    { agent: "Structure", target: "Gestion", role: "Coach", tone: "analysis", body: `@Gestion, d'accord. Mon point reste ${who}, mais je veux que le fil montre clairement ce qui ferait changer cette position.` },
    { agent: "Consensus", target: "Structure", role: "Méta", tone: "consensus", body: `@Structure, voilà le contrat : argument, contre-argument, condition d'invalidation. Pas trois slogans qui se tapent dans le dos.` },
  ];
  for (const [j, row] of banter.entries()) {
    posts.push({
      id: `${match.id}-banter-${j}`,
      agent: row.agent,
      role: row.role,
      body: row.body,
      at: new Date(t0 + (27 + j) * 60000).toISOString(),
      replyTo: row.target,
      tone: row.tone,
      reactions: { up: 4 + ((j * 3) % 17), laugh: row.tone === "banter" ? 2 + (j % 6) : j % 3, fire: row.tone === "challenge" ? 2 + (j % 5) : 1 + (j % 3) },
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
    `Structure reprend : ${match.home.formation} contre ${match.away.formation}, ça cadre ${who}.`,
    `Pressing : si ${match.away.name} sort trop haut, l’espace est dans le dos.`,
    `Bloc : un but trop tôt et le plan change. On ne sur-réagit pas.`,
    `Duels : un carton et la cote 1N2 n’a plus le même sens.`,
    `Consensus : on reste sur ${pick.label}, on ne chase pas le live au feeling.`,
    `Avocat du diable : un penalty et tout le fil est à jeter. C’est le football.`,
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
