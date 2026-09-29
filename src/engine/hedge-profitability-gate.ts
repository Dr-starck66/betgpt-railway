export type PortfolioBenchmark = {
  profit: number;
  roi: number;
  maxDrawdown: number;
  sampleSize: number;
};

export type HedgeProfitabilityGateResult = {
  promote: boolean;
  status: "PASS" | "FAIL";
  profitUplift: number;
  roiUplift: number;
  drawdownChange: number;
  reasons: string[];
};

/**
 * A hedge policy is only allowed to graduate from SHADOW if it beats the
 * identical unhedged portfolio on untouched chronological data.
 * Profit and ROI must both improve. Drawdown may not worsen materially.
 */
export function hedgeProfitabilityGate(
  baseline: PortfolioBenchmark,
  hedged: PortfolioBenchmark,
  opts: { minSampleSize?: number; maxDrawdownWorsening?: number } = {},
): HedgeProfitabilityGateResult {
  const minSampleSize = opts.minSampleSize ?? 250;
  const maxDrawdownWorsening = opts.maxDrawdownWorsening ?? 0;
  const profitUplift = hedged.profit - baseline.profit;
  const roiUplift = hedged.roi - baseline.roi;
  const drawdownChange = hedged.maxDrawdown - baseline.maxDrawdown;
  const reasons: string[] = [];

  if (baseline.sampleSize < minSampleSize || hedged.sampleSize < minSampleSize) {
    reasons.push("INSUFFICIENT_HOLDOUT_SAMPLE");
  }
  if (!(profitUplift > 0)) reasons.push("NO_PROFIT_UPLIFT");
  if (!(roiUplift > 0)) reasons.push("NO_ROI_UPLIFT");
  if (drawdownChange > maxDrawdownWorsening) reasons.push("DRAWDOWN_WORSENED");

  return {
    promote: reasons.length === 0,
    status: reasons.length === 0 ? "PASS" : "FAIL",
    profitUplift,
    roiUplift,
    drawdownChange,
    reasons,
  };
}
