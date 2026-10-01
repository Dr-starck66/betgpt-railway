export type ResultsWatchdogStatus = "PASS" | "PARTIAL" | "FAIL";

export type ResultsWatchdogInput = {
  httpOk: boolean;
  asOf?: string | null;
  rowCount: number;
  visualCount: number;
  historySections: number;
  now?: number;
};

export type ResultsWatchdogReport = {
  schema: "astra-results-watchdog/v1";
  status: ResultsWatchdogStatus;
  checkedAt: string;
  freshnessMinutes: number | null;
  rowCount: number;
  visualCount: number;
  visualCoverage: number;
  historySections: number;
  reasons: string[];
};

export function auditResultsSnapshot(input: ResultsWatchdogInput): ResultsWatchdogReport {
  const now = input.now ?? Date.now();
  const parsed = input.asOf ? Date.parse(input.asOf) : Number.NaN;
  const freshnessMinutes = Number.isFinite(parsed) ? Math.max(0, Math.round((now - parsed) / 60000)) : null;
  const expectedVisuals = Math.max(1, input.rowCount * 2);
  const visualCoverage = Math.min(1, input.visualCount / expectedVisuals);
  const reasons: string[] = [];
  let status: ResultsWatchdogStatus = "PASS";

  const fail = (reason: string) => {
    status = "FAIL";
    reasons.push(reason);
  };
  const partial = (reason: string) => {
    if (status === "PASS") status = "PARTIAL";
    reasons.push(reason);
  };

  if (!input.httpOk) fail("results-page-http");
  if (input.rowCount < 1) fail("no-recent-results");
  if (freshnessMinutes == null) partial("missing-freshness-marker");
  else if (freshnessMinutes > 24 * 60) fail("results-older-than-24h");
  else if (freshnessMinutes > 120) partial("results-older-than-2h");

  if (input.historySections < 7) partial("history-window-incomplete");
  if (visualCoverage < 0.15) fail("team-visuals-mostly-missing");
  else if (visualCoverage < 0.75) partial("team-visuals-incomplete");

  if (!reasons.length) reasons.push("fresh-results-and-team-visuals-present");

  return {
    schema: "astra-results-watchdog/v1",
    status,
    checkedAt: new Date(now).toISOString(),
    freshnessMinutes,
    rowCount: input.rowCount,
    visualCount: input.visualCount,
    visualCoverage: Math.round(visualCoverage * 1000) / 1000,
    historySections: input.historySections,
    reasons,
  };
}
