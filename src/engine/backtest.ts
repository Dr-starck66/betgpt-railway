import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { clamp, goalMatrix } from "./math";
import { pickCoverScore, fairCoverOdds, marketHits, type TicketRow } from "./ticket-log";
import { pickCurrentMethod, prettyPickLabel } from "./pick";
import { skipEuropeFrenchProno } from "./french-clubs";
import type { HistoricalMatch, LeagueId } from "./types";

const FILE = join(process.cwd(), "data", "archive-backtest.json");

export type LeagueBacktest = {
  league: LeagueId;
  n: number;
  acc: number;
  coverHit: number;
  cover11Hit: number;
  coverWhenLose: number;
  cover11WhenLose: number;
  staked: number;
  returned: number;
  profit: number;
  roi: number;
};

export type ArchiveBacktest = {
  hash: string;
  years: string;
  n: number;
  acc: number;
  coverHit: number;
  cover11Hit: number;
  coverWhenLose: number;
  cover11WhenLose: number;
  staked: number;
  returned: number;
  profit: number;
  roi: number;
  byLeague: LeagueBacktest[];
  notes: string[];
  tickets: TicketRow[];
};

function hashOf(h: HistoricalMatch[]): string {
  return `pickv4-stake100:${h.length}:${h[0]?.id ?? ""}:${h.at(-1)?.id ?? ""}`;
}

function lambdas(eloH: number, eloA: number): { lh: number; la: number } {
  const d = (eloH - eloA + 55) / 900;
  const lh = clamp(1.18 * Math.pow(10, d * 0.55), 0.55, 2.7);
  const la = clamp(1.08 * Math.pow(10, -d * 0.55), 0.5, 2.5);
  return { lh, la };
}

function price(p: number): number {
  return clamp(1 / Math.max(p * 1.05, 0.06), 1.12, 18);
}

export function runArchiveBacktest(history: HistoricalMatch[]): ArchiveBacktest {
  const elo = new Map<string, number>();
  const get = (id: string) => elo.get(id) ?? 1700;
  const tickets: TicketRow[] = [];
  const STAKE = 100;
  const leagueN: Record<string, { n: number; hit: number; cov: number; cov11: number; lose: number; covL: number; cov11L: number; staked: number; returned: number }> = {};
  const bucket = (lg: string) => {
    leagueN[lg] ??= { n: 0, hit: 0, cov: 0, cov11: 0, lose: 0, covL: 0, cov11L: 0, staked: 0, returned: 0 };
    return leagueN[lg]!;
  };

  const sorted = [...history].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  for (const h of sorted) {
    const eH = get(h.homeId);
    const eA = get(h.awayId);
    const { lh, la } = lambdas(eH, eA);
    const g = goalMatrix(lh, la, -0.1);
    const pick = pickCurrentMethod(
      { home: g.home, draw: g.draw, away: g.away },
      { home: price(g.home), draw: price(g.draw), away: price(g.away) },
      { skipDraw: h.league === "CL" || h.league === "EL" },
    );
    if (!pick) {
      const score = h.goalsHome > h.goalsAway ? 1 : h.goalsHome === h.goalsAway ? 0.5 : 0;
      const exp = 1 / (1 + Math.pow(10, (eA - (eH + 55)) / 400));
      const k = 16;
      elo.set(h.homeId, clamp(eH + k * (score - exp), 1350, 2300));
      elo.set(h.awayId, clamp(eA + k * (1 - score - (1 - exp)), 1350, 2300));
      continue;
    }
    const homeName = h.homeName ?? h.homeId;
    const awayName = h.awayName ?? h.awayId;
    if (
      skipEuropeFrenchProno({
        league: h.league,
        home: { id: h.homeId, name: homeName },
        away: { id: h.awayId, name: awayName },
      })
    ) {
      const score = h.goalsHome > h.goalsAway ? 1 : h.goalsHome === h.goalsAway ? 0.5 : 0;
      const exp = 1 / (1 + Math.pow(10, (eA - (eH + 55)) / 400));
      const k = 16;
      elo.set(h.homeId, clamp(eH + k * (score - exp), 1350, 2300));
      elo.set(h.awayId, clamp(eA + k * (1 - score - (1 - exp)), 1350, 2300));
      continue;
    }
    const result = marketHits(pick.market, h.goalsHome, h.goalsAway);
    const cover = pickCoverScore(g.matrix, pick.market);
    const coverOdds = fairCoverOdds(cover.p).odds;
    const coverHit = cover.hg === h.goalsHome && cover.ag === h.goalsAway;
    const hit11 = h.goalsHome === 1 && h.goalsAway === 1;
    const lost = result === "lose";
    const row: TicketRow = {
      id: `arch:${h.id}:1X2`,
      matchId: h.id,
      kickoff: h.kickoff,
      home: homeName,
      away: awayName,
      market: pick.market,
      label: prettyPickLabel(homeName, awayName, pick.market),
      odds: pick.odds,
      book: "clôture",
      stakePct: 0,
      modelProb: pick.modelProb,
      ev: pick.modelProb * pick.odds - 1,
      dailyBest: false,
      kind: "prono",
      decision: "NO_BET",
      league: h.league,
      pHome: g.home,
      pDraw: g.draw,
      pAway: g.away,
      recordedAt: h.kickoff,
      goalsHome: h.goalsHome,
      goalsAway: h.goalsAway,
      result,
      coverOdds,
      coverScore: cover.label,
      coverResult: coverHit ? "win" : "lose",
    };
    {
      const b = bucket(h.league);
      b.n += 1;
      b.staked += STAKE;
      if (result === "win") {
        b.hit += 1;
        b.returned += STAKE * pick.odds;
      }
      if (coverHit) b.cov += 1;
      if (hit11) b.cov11 += 1;
      if (lost) {
        b.lose += 1;
        if (coverHit) b.covL += 1;
        if (hit11) b.cov11L += 1;
      }
      tickets.push(row);
    }
    const score = h.goalsHome > h.goalsAway ? 1 : h.goalsHome === h.goalsAway ? 0.5 : 0;
    const exp = 1 / (1 + Math.pow(10, (eA - (eH + 55)) / 400));
    const k = 16;
    elo.set(h.homeId, clamp(eH + k * (score - exp), 1350, 2300));
    elo.set(h.awayId, clamp(eA + k * (1 - score - (1 - exp)), 1350, 2300));
  }

  const n = tickets.length || 1;
  const acc = tickets.filter((t) => t.result === "win").length / n;
  const coverHit = tickets.filter((t) => t.coverResult === "win").length / n;
  const cover11Hit = tickets.filter((t) => t.goalsHome === 1 && t.goalsAway === 1).length / n;
  let lose = 0;
  let covL = 0;
  let cov11L = 0;
  for (const t of tickets) {
    if (t.result !== "lose") continue;
    lose += 1;
    if (t.coverResult === "win") covL += 1;
    if (t.goalsHome === 1 && t.goalsAway === 1) cov11L += 1;
  }
  const names: Record<LeagueId, string> = {
    PL: "Premier League",
    LL: "La Liga",
    BL: "Bundesliga",
    SA: "Serie A",
    L1: "Ligue 1",
    ER: "Eredivisie",
    PT: "Primeira Liga",
    SC: "Premiership écossaise",
    TR: "Süper Lig",
    CL: "Ligue des champions",
    EL: "Ligue Europa",
    NL: "Internationaux",
  };
  const byLeague: LeagueBacktest[] = (Object.keys(leagueN) as LeagueId[]).map((league) => {
    const b = leagueN[league]!;
    return {
      league,
      n: b.n,
      acc: b.n ? b.hit / b.n : 0,
      coverHit: b.n ? b.cov / b.n : 0,
      cover11Hit: b.n ? b.cov11 / b.n : 0,
      coverWhenLose: b.lose ? b.covL / b.lose : 0,
      cover11WhenLose: b.lose ? b.cov11L / b.lose : 0,
      staked: b.staked,
      returned: b.returned,
      profit: b.returned - b.staked,
      roi: b.staked ? (b.returned - b.staked) / b.staked : 0,
    };
  });
  const notes: string[] = [];
  notes.push(
    `Même méthode qu’aujourd’hui : issue 1-N-2 la plus probable, pas les cotes loterie, pas de club français en C1/Europa, pas de nul C1/Europa. ${tickets.length} matchs.`,
  );
  const lift = (covL / Math.max(lose, 1) - cov11L / Math.max(lose, 1)) * 100;
  if (lift > 0.3) {
    notes.push(
      `Quand le 1-N-2 perd, le filet adaptatif tape le score ${Math.round((covL / Math.max(lose, 1)) * 1000) / 10} % du temps, le 1-1 fixe ${Math.round((cov11L / Math.max(lose, 1)) * 1000) / 10} %. On garde l'adaptatif.`,
    );
  } else if (lift < -0.3) {
    notes.push("Le 1-1 fixe n'est pas battu net. On garde l'adaptatif seulement s'il évite de doubler un nul.");
  } else {
    notes.push("Filet adaptatif et 1-1 proche. L'adaptatif reste obligatoire sur un pari nul (le 1-1 ne couvre pas).");
  }
  notes.push(
    `Prono 1-N-2 juste ${Math.round(acc * 100)} % (le hasard sur 3 issues ≈ 33 %).`,
  );
  const cl = byLeague.find((x) => x.league === "CL");
  if (cl && cl.n >= 40) {
    notes.push(
      `C1 : ${cl.n} matchs, ${Math.round(cl.acc * 100)} % de pronos justes.`,
    );
  }
  for (const row of byLeague) {
    if (row.n >= 80 && row.acc < 0.36) {
      notes.push(`${names[row.league]} : trop juste (${Math.round(row.acc * 100)} %). On se méfie.`);
    }
  }

  const staked = byLeague.reduce((s, r) => s + r.staked, 0);
  const returned = byLeague.reduce((s, r) => s + r.returned, 0);
  const profit = returned - staked;
  notes.push(
    `100 € le match, sans filet : ${profit >= 0 ? "+" : "−"}${Math.abs(Math.round(profit)).toLocaleString("fr-FR")} € (${staked ? ((profit / staked) * 100).toFixed(1).replace(".", ",") : "0"} %).`,
  );

  return {
    hash: hashOf(history),
    years: history.length
      ? `${history[0]!.kickoff.slice(0, 4)}–${history.at(-1)!.kickoff.slice(0, 4)}`
      : "5 saisons",
    n: tickets.length,
    acc,
    coverHit,
    cover11Hit,
    coverWhenLose: lose ? covL / lose : 0,
    cover11WhenLose: lose ? cov11L / lose : 0,
    staked,
    returned,
    profit,
    roi: staked ? profit / staked : 0,
    byLeague,
    notes: notes.slice(0, 7),
    tickets,
  };
}

export function loadArchiveBacktest(hash: string): ArchiveBacktest | null {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as ArchiveBacktest;
    if (raw.hash === hash && raw.n > 80 && typeof raw.profit === "number") return raw;
  } catch {
    /* missing */
  }
  return null;
}

export function saveArchiveBacktest(b: ArchiveBacktest): void {
  mkdirSync(dirname(FILE), { recursive: true });
  const slim = { ...b, tickets: b.tickets };
  writeFileSync(FILE, JSON.stringify(slim));
}

export function archiveTicketsOf(b: ArchiveBacktest | null): TicketRow[] {
  return b?.tickets ?? [];
}

export function ensureArchiveBacktest(history: HistoricalMatch[]): ArchiveBacktest | null {
  if (history.length < 200) return null;
  const hash = hashOf(history);
  const cached = loadArchiveBacktest(hash);
  if (cached) return cached;
  const fresh = runArchiveBacktest(history);
  try {
    saveArchiveBacktest(fresh);
  } catch {
    /* ignore */
  }
  return fresh;
}
