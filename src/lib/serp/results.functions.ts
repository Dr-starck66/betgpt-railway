import { createServerFn } from "@tanstack/react-start";
import { ensureArchiveHistory, loadArchiveHistory } from "@/engine/archive";
import { getDesk } from "@/lib/desk.functions";
import { mergeResults, recentResults, rowFromHistory, rowFromMatch, type ResultRow } from "@/lib/serp/results";

const RESULTS_REFRESH_TTL_MS = 5 * 60_000;
const resultsMem = globalThis as typeof globalThis & {
  __betgptResultsArchiveAt?: number;
  __betgptResultsArchive?: Awaited<ReturnType<typeof ensureArchiveHistory>>;
  __betgptResultsRefresh?: Promise<Awaited<ReturnType<typeof ensureArchiveHistory>>> | null;
};

async function freshResultArchive() {
  const now = Date.now();
  if (
    resultsMem.__betgptResultsArchive &&
    now - (resultsMem.__betgptResultsArchiveAt ?? 0) < RESULTS_REFRESH_TTL_MS
  ) {
    return resultsMem.__betgptResultsArchive;
  }
  if (!resultsMem.__betgptResultsRefresh) {
    resultsMem.__betgptResultsRefresh = ensureArchiveHistory({ force: true })
      .then((rows) => {
        resultsMem.__betgptResultsArchive = rows;
        resultsMem.__betgptResultsArchiveAt = Date.now();
        return rows;
      })
      .finally(() => {
        resultsMem.__betgptResultsRefresh = null;
      });
  }
  try {
    return await resultsMem.__betgptResultsRefresh;
  } catch {
    return loadArchiveHistory();
  }
}

export const getResultsBoard = createServerFn({ method: "GET" }).handler(async (): Promise<{ asOf: string; rows: ResultRow[] }> => {
  const [desk, archive] = await Promise.all([getDesk(), freshResultArchive()]);
  const fromDesk = (desk.matches ?? []).map(rowFromMatch).filter((r): r is ResultRow => !!r);
  const cutoff = Date.now() - 21 * 864e5;
  const fromArchive = archive
    .filter((h) => Date.parse(h.kickoff) >= cutoff)
    .map(rowFromHistory)
    .filter((r): r is ResultRow => !!r);
  return { asOf: desk.liveAsOf, rows: recentResults(mergeResults(fromDesk, fromArchive)) };
});
