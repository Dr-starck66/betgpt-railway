/**
 * Select bounded, rotating, genuinely unsettled historic fixtures.
 * The old <=8 day search window permanently starved old BET tickets.
 * Never score a fixture, guess a result, or rewrite a ticket here.
 */
import type { TicketRow } from "../../src/engine/ticket-log.ts";
import type { ResultRecoveryTarget } from "../../src/engine/live.ts";

export const RECOVERY_LOOKBACK_DAYS = 90;
export const RECOVERY_RECENT_DAYS = 8;
export const RECOVERY_BATCH_LIMIT = 4;

type PendingTicket = Pick<TicketRow,
  "result" | "kind" | "matchId" | "kickoff" | "league" | "home" | "away" | "competition" | "competitionKey">;

export type RecoveryCursor = { recent: number; historical: number };
export type RecoveryPlan = {
  targets: ResultRecoveryTarget[];
  nextCursor: RecoveryCursor;
  recentPending: number;
  historicalPending: number;
};

function rotate<T>(rows: T[], cursor: number, count: number): { selected: T[]; next: number } {
  if (!rows.length || count <= 0) return { selected: [], next: 0 };
  const offset = Math.max(0, Math.floor(cursor)) % rows.length;
  const selected = Array.from({ length: Math.min(count, rows.length) }, (_, i) => rows[(offset + i) % rows.length]!);
  return { selected, next: (offset + selected.length) % rows.length };
}

export function planResultRecovery(
  tickets: readonly PendingTicket[],
  at: number,
  cursor: RecoveryCursor = { recent: 0, historical: 0 },
): RecoveryPlan {
  const latestMs = at - 90 * 60_000;
  const oldestMs = at - RECOVERY_LOOKBACK_DAYS * 864e5;
  const recentCutoff = at - RECOVERY_RECENT_DAYS * 864e5;
  const seen = new Set<string>();
  const pending = tickets
    .filter((row) => {
      const kickoff = Date.parse(row.kickoff);
      return !row.result && typeof row.matchId === "string" && row.matchId.length > 0 &&
        Number.isFinite(kickoff) && kickoff <= latestMs && kickoff >= oldestMs;
    })
    .sort((a, b) =>
      Number(b.kind === "mise") - Number(a.kind === "mise") ||
      String(b.kickoff).localeCompare(String(a.kickoff)))
    .filter((row) => {
      if (seen.has(row.matchId)) return false;
      seen.add(row.matchId);
      return true;
    });
  const recent = pending.filter((row) => Date.parse(row.kickoff) >= recentCutoff);
  const historical = pending.filter((row) => Date.parse(row.kickoff) < recentCutoff);
  // Reserve at least half the 4-item batch for historic backfill when both
  // queues exist, rather than repeatedly retrying only the newest fixtures.
  const recentQuota = historical.length ? 2 : RECOVERY_BATCH_LIMIT;
  const recentPick = rotate(recent, cursor.recent, recentQuota);
  const oldPick = rotate(historical, cursor.historical, RECOVERY_BATCH_LIMIT - recentPick.selected.length);
  const targets = [...recentPick.selected, ...oldPick.selected].map(row => ({
    matchId: row.matchId, kickoff: row.kickoff, league: row.league,
    home: row.home, away: row.away,
    competition: row.competition, competitionKey: row.competitionKey,
  }));
  return {
    targets,
    nextCursor: { recent: recentPick.next, historical: oldPick.next },
    recentPending: recent.length,
    historicalPending: historical.length,
  };
}
