import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CITE_LEAGUES, type CiteLeague, type CiteRow, type CiteSnap } from "./cite-public";

export { CITE_LEAGUES, citeBySlug, classementAnswer } from "./cite-public";
export type { CiteRow, CiteLeague, CiteSnap } from "./cite-public";

const FILE = join(process.cwd(), "data", "cite-snapshot.json");
const TTL = 30 * 60 * 1000;
let MEM: CiteSnap | null = null;

export async function getCiteData(): Promise<CiteSnap> {
  if (MEM && Date.now() - MEM.fetchedAt < TTL) return MEM;
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as CiteSnap;
    if (raw?.leagues?.length && Date.now() - raw.fetchedAt < TTL) {
      MEM = raw;
      return raw;
    }
  } catch {
    /* */
  }
  const leagues = await Promise.all(CITE_LEAGUES.map(loadLeague));
  const snap: CiteSnap = { fetchedAt: Date.now(), leagues };
  MEM = snap;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(snap));
  } catch {
    /* */
  }
  return snap;
}

async function loadLeague(meta: (typeof CITE_LEAGUES)[number]): Promise<CiteLeague> {
  const payload = await espn(`v2/sports/soccer/${meta.espn}/standings?lang=fr&region=fr`);
  const rows = parseStandings(payload);
  return { league: meta.league, slug: meta.slug, title: meta.title, rows };
}

function parseStandings(payload: unknown): CiteRow[] {
  const root = payload as {
    children?: {
      standings?: {
        entries?: {
          team?: { displayName?: string; abbreviation?: string; logos?: { href?: string }[] };
          stats?: { name?: string; value?: number }[];
        }[];
      };
    }[];
  };
  const entries = root.children?.[0]?.standings?.entries ?? [];
  const rows: CiteRow[] = [];
  for (const e of entries) {
    const get = (n: string) => e.stats?.find((s) => s.name === n)?.value ?? 0;
    const name = e.team?.displayName ?? "";
    if (!name) continue;
    rows.push({
      rank: get("rank") || rows.length + 1,
      name,
      short: e.team?.abbreviation ?? name.slice(0, 3),
      gp: get("gamesPlayed"),
      w: get("wins"),
      d: get("ties"),
      l: get("losses"),
      gf: get("pointsFor"),
      ga: get("pointsAgainst"),
      pts: get("points"),
      logo: e.team?.logos?.[0]?.href,
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

async function espn(path: string): Promise<unknown> {
  try {
    const res = await fetch(`https://site.web.api.espn.com/apis/${path}`, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://www.espn.co.uk/",
      },
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}
