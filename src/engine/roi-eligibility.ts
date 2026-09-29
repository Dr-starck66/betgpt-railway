import type { Decision } from "./types.ts";

/**
 * Hard accounting invariant: NO_BET means no wager was placed.
 * Such rows must never contribute stake, profit/loss, hit-rate denominators or ROI.
 */
export function isRoiEligibleDecision(decision: Decision | undefined | null): boolean {
  return decision !== "NO_BET";
}
