import { createServerFn } from "@tanstack/react-start";
import { loadArchiveHistory } from "@/engine/archive";
import { getDesk } from "@/lib/desk.functions";
import { mergeResults, recentResults, rowFromHistory, rowFromMatch, type ResultRow } from "@/lib/serp/results";

export const getResultsBoard = createServerFn({ method: "GET" }).handler(async (): Promise<{ asOf: string; rows: ResultRow[] }> => {
  const desk = await getDesk();
  const fromDesk = (desk.matches ?? []).map(rowFromMatch).filter((r): r is ResultRow => !!r);
  const cutoff = Date.now() - 21 * 864e5;
  const fromArchive = loadArchiveHistory()
    .filter((h) => Date.parse(h.kickoff) >= cutoff)
    .map(rowFromHistory)
    .filter((r): r is ResultRow => !!r);
  return { asOf: desk.liveAsOf, rows: recentResults(mergeResults(fromDesk, fromArchive)) };
});
