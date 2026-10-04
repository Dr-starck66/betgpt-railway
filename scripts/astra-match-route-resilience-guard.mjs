import fs from "node:fs";

const checks = [
  [
    "src/lib/desk.functions.ts",
    [
      "MATCH_ROUTE_FORM_BUDGET_MS",
      "MATCH_ROUTE_LIVE_BUDGET_MS",
      "resolveStoredMatch(data.id) ?? getPrediction(data.id)",
      "export const getOfficialLineups",
      "MATCH_LINEUPS_BUDGET_MS",
    ],
  ],
  [
    "src/routes/match.$matchId.tsx",
    [
      "MatchLineups",
      "matchId={data.match.slug ?? data.match.id}",
      "homeName={data.match.home.name}",
      "awayName={data.match.away.name}",
    ],
  ],
  [
    "src/lib/seo.ts",
    [
      "export function matchRouteId",
      "INVALID_MATCH_ROUTE_IDS",
      'return routeId ? \`/match/${routeId}\` : "/scores-en-direct";',
    ],
  ],
  [
    "src/components/match-card.tsx",
    ["href={matchPath(match)}"],
  ],
  [
    "src/components/scores-hub.tsx",
    ["href={matchPath(m)}"],
  ],
  [
    "src/components/results-board.tsx",
    ["href={matchPath(row)}"],
  ],
  [
    "src/engine/official-lineups.ts",
    [
      "home?.starters.length === 11",
      "away?.starters.length === 11",
      '"CONFIRMED"',
      '"PARTIAL"',
      '"UNVERIFIED"',
      "ESPN Match Summary",
    ],
  ],
  [
    "src/components/match-lineups.tsx",
    [
      "data-lineups-status",
      "jamais remplacées par une composition probable",
      "les 11 titulaires des deux équipes",
    ],
  ],
];

const failures = [];
for (const [file, fragments] of checks) {
  const text = fs.readFileSync(file, "utf8");
  for (const fragment of fragments) {
    if (!text.includes(fragment)) failures.push({ file, fragment });
  }
}
if (failures.length) {
  console.error("ASTRA_MATCH_ROUTE_RESILIENCE_FAIL", JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("ASTRA_MATCH_ROUTE_RESILIENCE_PASS", JSON.stringify({ checks: checks.length }));
