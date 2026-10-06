import type { LeagueId } from "./types";

export const INTERNATIONAL_UNKNOWN = "international.unknown";

export const INTERNATIONAL_COMPETITION_KEYS = [
  "uefa.nations",
  "caf.nations_qual",
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
  "conmebol.america",
  "concacaf.gold",
  "afc.asian.cup",
] as const;

export type InternationalCompetitionKey =
  | (typeof INTERNATIONAL_COMPETITION_KEYS)[number]
  | typeof INTERNATIONAL_UNKNOWN
  | string;

type CompetitionScoped = {
  league?: LeagueId;
  competition?: string;
  competitionKey?: string;
};

function clean(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function inferFromName(name: string): string | null {
  const n = clean(name);
  if (!n) return null;

  if (/nations league|ligue des nations/.test(n)) return "uefa.nations";

  if (
    /afcon.*qual|africa cup of nations.*qual|qualif.*coupe d['’]afrique|qualification.*can|qualif.*can/.test(n)
  ) return "caf.nations_qual";

  if (/euro.*qual|qualif.*euro/.test(n)) return "uefa.euroq";
  if (/uefa euro|championnat d['’]europe|euro 20\d\d/.test(n)) return "uefa.euro";

  if (/world cup.*qual.*uefa|qualif.*coupe du monde.*uefa/.test(n)) return "fifa.worldq.uefa";
  if (/world cup.*qual.*caf|qualif.*coupe du monde.*caf/.test(n)) return "fifa.worldq.caf";
  if (/world cup.*qual.*afc|qualif.*coupe du monde.*afc/.test(n)) return "fifa.worldq.afc";
  if (/world cup.*qual.*concacaf|qualif.*coupe du monde.*concacaf/.test(n)) return "fifa.worldq.concacaf";
  if (/world cup.*qual.*conmebol|qualif.*coupe du monde.*conmebol/.test(n)) return "fifa.worldq.conmebol";
  if (/world cup.*qual|qualif.*coupe du monde/.test(n)) return "fifa.worldq";
  if (/fifa world cup|coupe du monde/.test(n)) return "fifa.world";

  if (/africa cup of nations|coupe d['’]afrique des nations|\bcan\b/.test(n)) return "caf.nations";
  if (/copa am[eé]rica/.test(n)) return "conmebol.america";
  if (/gold cup/.test(n)) return "concacaf.gold";
  if (/asian cup|coupe d['’]asie/.test(n)) return "afc.asian.cup";

  return null;
}

export function internationalCompetitionKeyOf(input: CompetitionScoped): string | null {
  if (input.league !== "NL") return null;

  const explicit = clean(input.competitionKey);
  if (explicit) return explicit;

  return inferFromName(input.competition ?? "") ?? INTERNATIONAL_UNKNOWN;
}

export function rowsForInternationalCompetition<T extends CompetitionScoped>(
  rows: T[],
  key: string,
): T[] {
  return rows.filter((row) => internationalCompetitionKeyOf(row) === key);
}

export function internationalCompetitionKeysOf<T extends CompetitionScoped>(rows: T[]): string[] {
  return [...new Set(rows.map(internationalCompetitionKeyOf).filter((key): key is string => Boolean(key)))];
}
