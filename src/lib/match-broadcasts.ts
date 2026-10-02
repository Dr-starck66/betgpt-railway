import type { MatchInput } from "@/engine/types";

export type MatchBroadcast = {
  territory: "FR";
  label: string;
  sourceLabel: string;
  sourceUrl: string;
  verifiedAt: string;
};

const MATCH_BROADCASTS: Record<string, MatchBroadcast> = {
  "borussia-dortmund-werder-bremen-2026-10-09": {
    territory: "FR",
    label: "beIN SPORTS MAX 10",
    sourceLabel: "Mon Match",
    sourceUrl: "https://www.mon-match.com/index.php/matchs/borussia-dortmund-vs-f-erder-bremen-2",
    verifiedAt: "2026-10-02T14:00:00Z",
  },
};

export function matchBroadcast(match: Pick<MatchInput, "id" | "slug">): MatchBroadcast | null {
  const key = match.slug ?? match.id;
  return MATCH_BROADCASTS[key] ?? null;
}
