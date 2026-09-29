/** Recent results observed on an ESPN team schedule. No invented scores. */

export type RecentLine = {
  kickoff: string;
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  venue: "home" | "away";
  competition: string;
};

export function clubKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(as|fc|cf|ac|rb|fk|sc|cd|rcd|afc|cfc)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function scoreOf(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  if (raw && typeof raw === "object") {
    const o = raw as { displayValue?: unknown; value?: unknown };
    return scoreOf(o.displayValue ?? o.value);
  }
  return null;
}

type Comp = {
  team?: { displayName?: string; shortDisplayName?: string; name?: string };
  homeAway?: string;
  score?: unknown;
};

function teamLabel(c: Comp | undefined): string {
  return c?.team?.displayName || c?.team?.shortDisplayName || c?.team?.name || "";
}

export function parseSchedule(teamName: string, payload: unknown): RecentLine[] {
  const body = payload as {
    season?: { displayName?: string; name?: string };
    events?: {
      date?: string;
      competitions?: {
        date?: string;
        status?: { type?: { completed?: boolean; name?: string } };
        competitors?: Comp[];
      }[];
    }[];
  };
  const want = clubKey(teamName);
  if (!want) return [];
  const competition = body.season?.displayName || body.season?.name || "Calendrier ESPN";
  const out: RecentLine[] = [];
  for (const event of body.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const status = comp.status?.type;
    const done = status?.completed === true || /FULL_TIME|FINAL|POST/i.test(status?.name ?? "");
    if (!done) continue;
    const kickoff = comp.date || event.date || "";
    if (!Number.isFinite(Date.parse(kickoff))) continue;
    const sides = comp.competitors ?? [];
    const us = sides.find((c) => clubKey(teamLabel(c)) === want);
    const them = sides.find((c) => c !== us);
    if (!us || !them) continue;
    const scoreFor = scoreOf(us.score);
    const scoreAgainst = scoreOf(them.score);
    const opponent = teamLabel(them);
    if (scoreFor == null || scoreAgainst == null || !opponent) continue;
    const venue: "home" | "away" = us.homeAway === "away" ? "away" : "home";
    out.push({ kickoff, opponent, scoreFor, scoreAgainst, venue, competition });
  }
  out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return out;
}

/** Newest first, strictly before kickoff. */
export function linesBefore(lines: RecentLine[], kickoff: string, limit = 5): RecentLine[] {
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) return [];
  return lines
    .filter((l) => Date.parse(l.kickoff) < t - 60_000)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, limit);
}

/** Newest → oldest, same order as the on-page list. */
export function lettersFromLines(newestFirst: RecentLine[]): string {
  return newestFirst
    .map((l) => (l.scoreFor > l.scoreAgainst ? "W" : l.scoreFor === l.scoreAgainst ? "D" : "L"))
    .join("");
}

export function recentLineLabel(line: RecentLine): string {
  const day = new Date(line.kickoff).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
  const place = line.venue === "home" ? "à domicile" : "à l’extérieur";
  return `${line.scoreFor}–${line.scoreAgainst} contre ${line.opponent} (${day}, ${place})`;
}
