import type { TicketRow } from "@/engine/ticket-log";

/** Public, non-invented view of a stored ticket. Missing fields stay null. */
export function publicEvidence(rows: TicketRow[], limit = 80) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    matchId: row.matchId,
    league: row.league ?? null,
    kickoff: row.kickoff,
    home: row.home,
    away: row.away,
    market: row.market,
    label: row.label,
    modelProb: Number.isFinite(row.modelProb) ? row.modelProb : null,
    odds: Number.isFinite(row.odds) ? row.odds : null,
    recordedAt: row.recordedAt,
    lockedAt: row.lockedAt ?? null,
    predictionHash: row.predictionHash ?? null,
    engineVersion: row.engineVersion ?? null,
    result: row.result ?? null,
    goalsHome: row.goalsHome ?? null,
    goalsAway: row.goalsAway ?? null,
  }));
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Same fields as the JSON extract, all stored rows, nothing filled in. */
export function evidenceCsv(rows: TicketRow[]): string {
  const items = publicEvidence(rows, 5000);
  const columns = items[0] ? Object.keys(items[0]) : ["id"];
  const lines = [columns.join(",")];
  for (const item of items) {
    const row = item as Record<string, unknown>;
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
