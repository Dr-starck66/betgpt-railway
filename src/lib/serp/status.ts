export type StrictStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HALFTIME"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "FINISHED";

export function strictStatus(match: {
  status?: string;
  voidReason?: string;
  clock?: string;
  phase?: string;
  phaseLabel?: string;
}): StrictStatus {
  if (match.status === "finished") return "FINISHED";
  if (match.voidReason === "postponed") return "POSTPONED";
  if (match.status === "cancelled" || match.voidReason === "cancelled") return "CANCELLED";
  if (match.voidReason === "abandoned") return "SUSPENDED";
  const blob = `${match.phase ?? ""} ${match.phaseLabel ?? ""} ${match.clock ?? ""}`.toLowerCase();
  if (match.status === "live") {
    if (/suspend|interrompu|abandon/.test(blob)) return "SUSPENDED";
    if (/mi-temps|mi temps|halftime|\bht\b|half-time|half time/.test(blob)) return "HALFTIME";
    return "LIVE";
  }
  return "SCHEDULED";
}

export function statusLabel(status: StrictStatus, stale = false): string {
  if ((status === "LIVE" || status === "HALFTIME") && stale) return "Dernier score connu";
  switch (status) {
    case "LIVE":
      return "En direct";
    case "HALFTIME":
      return "Mi-temps";
    case "FINISHED":
      return "Terminé";
    case "POSTPONED":
      return "Reporté";
    case "CANCELLED":
      return "Annulé";
    case "SUSPENDED":
      return "Suspendu";
    default:
      return "À venir";
  }
}

export function hasScore(match: { scoreHome?: number | null; scoreAway?: number | null }): boolean {
  return (
    typeof match.scoreHome === "number" &&
    typeof match.scoreAway === "number" &&
    Number.isFinite(match.scoreHome) &&
    Number.isFinite(match.scoreAway)
  );
}

/** Age of the last real desk collection. Not a page-view timestamp. */
export function scoreFreshness(asOf?: string | null, now = Date.now()): { known: boolean; ageSec: number | null; stale: boolean } {
  const t = Date.parse(asOf ?? "");
  if (!Number.isFinite(t)) return { known: false, ageSec: null, stale: false };
  const ageSec = Math.max(0, Math.round((now - t) / 1000));
  return { known: true, ageSec, stale: ageSec > 180 };
}
