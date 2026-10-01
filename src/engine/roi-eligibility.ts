import type { Decision } from "./types.ts";

/**
 * Hard accounting invariant: NO_BET means no wager was placed.
 * Only explicit BET rows contribute stake, profit/loss, hit-rate denominators or ROI. WATCH and NO_BET are observational only.
 */
export function isRoiEligibleDecision(decision: Decision | undefined | null): boolean {
  return decision === "BET";
}
