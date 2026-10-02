import type { LeagueId, MatchInput } from "./types.ts";

export type OfficialLineupPlayer = {
  id?: string;
  name: string;
  number?: string;
  position?: string;
  starter: boolean;
};

export type OfficialTeamLineup = {
  teamId?: string;
  teamName: string;
  formation?: string;
  starters: OfficialLineupPlayer[];
  bench: OfficialLineupPlayer[];
};

export type OfficialLineupsStatus = "CONFIRMED" | "PARTIAL" | "UNVERIFIED";

export type OfficialLineups = {
  status: OfficialLineupsStatus;
  source: "ESPN";
  sourceLabel: string;
  sourceUrl: string;
  providerEventId?: string;
  observedAt: string;
  home?: OfficialTeamLineup;
  away?: OfficialTeamLineup;
  reason?: string;
};

const REQUEST_TIMEOUT_MS = 1600;
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: OfficialLineups }>();

const LEAGUE_SLUGS: Record<LeagueId, string[]> = {
  PL: ["eng.1", "eng.fa", "eng.league_cup"],
  LL: ["esp.1", "esp.copa_del_rey"],
  BL: ["ger.1", "ger.dfb_pokal"],
  SA: ["ita.1", "ita.coppa_italia"],
  L1: ["fra.1", "fra.coupe_de_france"],
  ER: ["ned.1"],
  PT: ["por.1", "por.taca.portugal"],
  SC: ["sco.1"],
  TR: ["tur.1"],
  CL: ["uefa.champions", "uefa.champions_qual"],
  EL: ["uefa.europa", "uefa.europa_qual", "uefa.europa.conf", "uefa.europa.conf_qual"],
  NL: [
    "uefa.nations",
    "uefa.euro",
    "uefa.euroq",
    "fifa.world",
    "fifa.worldq",
    "fifa.worldq.uefa",
    "fifa.worldq.caf",
    "fifa.worldq.afc",
    "fifa.worldq.concacaf",
    "fifa.worldq.conmebol",
    "caf.nations",
    "caf.nations_qual",
    "conmebol.america",
    "concacaf.gold",
    "afc.asian.cup",
  ],
};

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|afc|sc|ac|rc|ud|cd|ss|calcio|united|utd)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function compactName(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function leagueCandidates(match: Pick<MatchInput, "league" | "competition">): string[] {
  const base = LEAGUE_SLUGS[match.league] ?? [];
  const competition = String(match.competition ?? "").toLowerCase();
  const preferred =
    competition.includes("conference") ? ["uefa.europa.conf", "uefa.europa.conf_qual"] :
    competition.includes("champions") ? ["uefa.champions", "uefa.champions_qual"] :
    competition.includes("europa") ? ["uefa.europa", "uefa.europa_qual"] :
    competition.includes("fa cup") ? ["eng.fa"] :
    competition.includes("league cup") ? ["eng.league_cup"] :
    competition.includes("copa del rey") ? ["esp.copa_del_rey"] :
    competition.includes("dfb") ? ["ger.dfb_pokal"] :
    competition.includes("coppa") ? ["ita.coppa_italia"] :
    competition.includes("coupe de france") ? ["fra.coupe_de_france"] :
    [];
  return [...new Set([...preferred, ...base])];
}

function providerEventId(match: Pick<MatchInput, "id">): string | null {
  const m = String(match.id ?? "").match(/^espn-(\d{5,12})$/i);
  return m?.[1] ?? null;
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BetGPT-Lineups/1.0)",
        Referer: "https://www.espn.com/",
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function eventMatches(event: any, match: Pick<MatchInput, "home" | "away">): boolean {
  const comp = event?.competitions?.[0];
  const home = comp?.competitors?.find((c: any) => c?.homeAway === "home")?.team;
  const away = comp?.competitors?.find((c: any) => c?.homeAway === "away")?.team;
  if (!home || !away) return false;
  const hId = String(match.home.id ?? "");
  const aId = String(match.away.id ?? "");
  if (hId && aId && String(home.id ?? "") === hId && String(away.id ?? "") === aId) return true;
  return norm(home.displayName ?? home.shortDisplayName) === norm(match.home.name)
    && norm(away.displayName ?? away.shortDisplayName) === norm(match.away.name);
}

async function resolveEventId(match: MatchInput): Promise<{ eventId: string; leagueSlug: string } | null> {
  const direct = providerEventId(match);
  const candidates = leagueCandidates(match);
  if (direct) {
    return { eventId: direct, leagueSlug: candidates[0] ?? "eng.1" };
  }
  const day = String(match.kickoff ?? "").slice(0, 10).replaceAll("-", "");
  if (!/^\d{8}$/.test(day)) return null;
  const attempts = await Promise.all(
    candidates.map(async (leagueSlug) => {
      const board = await getJson(
        `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/scoreboard?dates=${day}&limit=100&lang=en&region=gb`,
      );
      const hit = (board?.events ?? []).find((event: any) => eventMatches(event, match));
      return hit?.id ? { eventId: String(hit.id), leagueSlug } : null;
    }),
  );
  return attempts.find(Boolean) ?? null;
}

async function fetchSummary(eventId: string, match: MatchInput, preferredSlug?: string): Promise<{ json: any; leagueSlug: string } | null> {
  const candidates = [...new Set([preferredSlug, ...leagueCandidates(match)].filter(Boolean) as string[])];
  const attempts = await Promise.all(
    candidates.map(async (leagueSlug) => {
      const json = await getJson(
        `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${eventId}`,
      );
      if (!json) return null;
      const headerId = String(json?.header?.id ?? json?.header?.competitions?.[0]?.id ?? "");
      const hasRosters = Array.isArray(json?.rosters) && json.rosters.length > 0;
      return headerId === eventId || hasRosters ? { json, leagueSlug } : null;
    }),
  );
  return attempts.find(Boolean) ?? null;
}

function formationOf(block: any): string | undefined {
  const raw = block?.formation?.displayName ?? block?.formation?.name ?? block?.formation;
  const value = compactName(raw);
  return value && value !== "[object Object]" ? value : undefined;
}

function playerFrom(entry: any): OfficialLineupPlayer | null {
  const athlete = entry?.athlete ?? entry?.player ?? entry;
  const name = compactName(
    athlete?.displayName ?? athlete?.fullName ?? athlete?.shortName ?? entry?.displayName ?? entry?.name,
  );
  if (!name) return null;
  const id = compactName(athlete?.id ?? entry?.id) || undefined;
  const number = compactName(entry?.jersey ?? athlete?.jersey ?? athlete?.jerseyNumber) || undefined;
  const position = compactName(
    entry?.position?.abbreviation ??
      entry?.position?.displayName ??
      athlete?.position?.abbreviation ??
      athlete?.position?.displayName,
  ) || undefined;
  const role = compactName(entry?.role ?? entry?.status?.type?.name ?? entry?.status?.name).toLowerCase();
  const starter =
    typeof entry?.starter === "boolean"
      ? entry.starter
      : /starter|starting|first.?xi/.test(role);
  return { id, name, number, position, starter };
}

function dedupe(players: OfficialLineupPlayer[]): OfficialLineupPlayer[] {
  const seen = new Set<string>();
  return players.filter((player) => {
    const key = player.id ? `id:${player.id}` : `name:${norm(player.name)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rosterEntries(block: any): any[] {
  if (Array.isArray(block?.roster)) return block.roster;
  if (Array.isArray(block?.athletes)) return block.athletes;
  if (Array.isArray(block?.entries)) return block.entries;
  return [];
}

function blockTeamId(block: any): string {
  return String(block?.team?.id ?? block?.teamId ?? "");
}

function blockTeamName(block: any): string {
  return compactName(block?.team?.displayName ?? block?.team?.name ?? block?.displayName);
}

function pickBlock(rosters: any[], team: MatchInput["home"]): any | null {
  const byId = rosters.find((block) => blockTeamId(block) && blockTeamId(block) === String(team.id ?? ""));
  if (byId) return byId;
  const target = norm(team.name);
  return rosters.find((block) => target && norm(blockTeamName(block)) === target) ?? null;
}

function parseTeam(block: any, fallbackName: string): OfficialTeamLineup | undefined {
  if (!block) return undefined;
  const players = dedupe(rosterEntries(block).map(playerFrom).filter(Boolean) as OfficialLineupPlayer[]);
  const starters = players.filter((player) => player.starter);
  const bench = players.filter((player) => !player.starter);
  if (!players.length) return undefined;
  return {
    teamId: blockTeamId(block) || undefined,
    teamName: blockTeamName(block) || fallbackName,
    formation: formationOf(block),
    starters,
    bench,
  };
}

export function unavailableLineups(reason = "Composition confirmée indisponible.", providerEventId?: string): OfficialLineups {
  return {
    status: "UNVERIFIED",
    source: "ESPN",
    sourceLabel: "ESPN Match Summary",
    sourceUrl: providerEventId ? `https://www.espn.com/soccer/match/_/gameId/${providerEventId}` : "https://www.espn.com/soccer/",
    providerEventId,
    observedAt: new Date().toISOString(),
    reason,
  };
}

export function parseEspnLineups(json: any, match: MatchInput, eventId: string): OfficialLineups {
  const rosters = Array.isArray(json?.rosters) ? json.rosters : [];
  const home = parseTeam(pickBlock(rosters, match.home), match.home.name);
  const away = parseTeam(pickBlock(rosters, match.away), match.away.name);
  const homeOk = home?.starters.length === 11;
  const awayOk = away?.starters.length === 11;
  const any = Boolean(
    home?.starters.length || home?.bench.length || away?.starters.length || away?.bench.length,
  );
  const status: OfficialLineupsStatus = homeOk && awayOk ? "CONFIRMED" : any ? "PARTIAL" : "UNVERIFIED";
  return {
    status,
    source: "ESPN",
    sourceLabel: "ESPN Match Summary",
    sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${eventId}`,
    providerEventId: eventId,
    observedAt: new Date().toISOString(),
    home,
    away,
    reason:
      status === "CONFIRMED"
        ? undefined
        : status === "PARTIAL"
          ? "Feuille reçue mais incomplète : BetGPT refuse de la présenter comme composition confirmée."
          : "Le fournisseur ne publie pas encore de feuille exploitable.",
  };
}

export async function fetchOfficialLineupsForMatch(match: MatchInput): Promise<OfficialLineups> {
  const resolved = await resolveEventId(match);
  if (!resolved) return unavailableLineups("Identifiant fournisseur introuvable pour ce match.");
  const cached = cache.get(resolved.eventId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const summary = await fetchSummary(resolved.eventId, match, resolved.leagueSlug);
  if (!summary) return unavailableLineups("Résumé fournisseur indisponible.", resolved.eventId);
  const value = parseEspnLineups(summary.json, match, resolved.eventId);
  cache.set(resolved.eventId, { at: Date.now(), value });
  return value;
}
