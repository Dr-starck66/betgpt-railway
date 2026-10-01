import { defineEventHandler, getRequestURL, setHeader, setResponseStatus } from "h3";
import { auditResultsSnapshot } from "../../src/lib/serp/results-watchdog";

function count(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  const origin = getRequestURL(event).origin;
  const target = new URL("/resultats-football", origin);

  try {
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "ASTRA-RESULTS-WATCHDOG/1.0" },
    });
    const html = await response.text();
    const asOf = html.match(/data-results-as-of="([^"]+)"/i)?.[1] ?? null;
    const historySections = Number(html.match(/data-results-history-days="(\d+)"/i)?.[1] ?? 0);
    const rowCount = count(html, ">Terminé<");
    const crestCount = count(html, 'data-filename="ecusson-');
    const flagCount = Math.max(
      count(html, 'alt="Drapeau '),
      count(html, 'aria-label="Drapeau '),
    );
    const report = auditResultsSnapshot({
      httpOk: response.ok,
      asOf,
      rowCount,
      visualCount: crestCount + flagCount,
      historySections,
    });

    if (report.status === "FAIL") setResponseStatus(event, 503);
    return {
      ...report,
      source: {
        page: target.pathname,
        httpStatus: response.status,
        crests: crestCount,
        flags: flagCount,
      },
      fallbackPolicy: ["FotMob", "ESPN", "BetGPT archive", "BetGPT desk"],
    };
  } catch (error) {
    setResponseStatus(event, 503);
    return {
      ...auditResultsSnapshot({ httpOk: false, rowCount: 0, visualCount: 0, historySections: 0 }),
      error: error instanceof Error ? error.message : String(error),
      fallbackPolicy: ["FotMob", "ESPN", "BetGPT archive", "BetGPT desk"],
    };
  }
});
