/** One clock for a match page. Kickoff is never a publication date. */

const PARIS = "Europe/Paris";

export type MatchClock = {
  kickoff: string;
  published?: string;
  modified?: string;
  freshnessLabel: string;
};

function stampMs(iso: string | undefined, now: number, kickoffMs: number): number | null {
  const ms = Date.parse(iso ?? "");
  if (!Number.isFinite(ms) || ms > now + 30_000) return null;
  if (Number.isFinite(kickoffMs) && kickoffMs > now && Math.abs(ms - kickoffMs) < 120_000) return null;
  return ms;
}

export function freshnessLabel(modified: string | undefined, now = Date.now()): string {
  const t = Date.parse(modified ?? "");
  if (!Number.isFinite(t)) return "indisponible";
  const minutes = Math.max(0, Math.round((now - t) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 36 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} j`;
}

export function formatParis(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS,
  });
}

/** Published = earliest real stamp. Modified = latest real stamp. Never the future kickoff. */
export function matchClock(input: {
  kickoff: string;
  predictionAt?: string;
  versions?: { timestamp?: string }[] | null;
  now?: number;
}): MatchClock {
  const now = input.now ?? Date.now();
  const kickoffMs = Date.parse(input.kickoff);
  const candidates = [
    ...(input.versions ?? []).map((v) => v.timestamp),
    input.predictionAt,
  ];
  const ms = candidates
    .map((iso) => stampMs(iso, now, kickoffMs))
    .filter((n): n is number => n != null);
  const published = ms.length ? new Date(Math.min(...ms)).toISOString() : undefined;
  const modified = ms.length ? new Date(Math.max(...ms)).toISOString() : undefined;
  return {
    kickoff: input.kickoff,
    published,
    modified,
    freshnessLabel: freshnessLabel(modified, now),
  };
}
