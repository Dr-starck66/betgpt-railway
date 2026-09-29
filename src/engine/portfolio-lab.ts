export type PortfolioMarket = "1X2_H" | "1X2_A";

export type PortfolioTicket = {
  kickoff: string;
  league: string;
  market: PortfolioMarket;
  odds: number;
  modelProb: number;
  result: "win" | "lose";
};

export type PortfolioRule = {
  id: string;
  market: PortfolioMarket | "ALL";
  minOdds: number;
  maxOdds: number;
  minModelProb: number;
  league: string | "ALL";
};

export type PortfolioMetrics = {
  n: number;
  wins: number;
  losses: number;
  hitRate: number;
  profit: number;
  capital: number;
  roi: number;
  maxDrawdown: number;
  avgOdds: number;
};

export type PortfolioDiscovery = {
  baseline: { train: PortfolioMetrics; validation: PortfolioMetrics; holdout: PortfolioMetrics };
  accuracyRule: PortfolioRule | null;
  valueRule: PortfolioRule | null;
  accuracy: { train: PortfolioMetrics; validation: PortfolioMetrics; holdout: PortfolioMetrics } | null;
  value: { train: PortfolioMetrics; validation: PortfolioMetrics; holdout: PortfolioMetrics } | null;
  hybrid: { train: PortfolioMetrics; validation: PortfolioMetrics; holdout: PortfolioMetrics } | null;
  gates: {
    accuracyPass: boolean;
    valuePass: boolean;
    hybridPass: boolean;
  };
};

export function ruleMatches(t: PortfolioTicket, r: PortfolioRule): boolean {
  return (
    (r.market === "ALL" || t.market === r.market) &&
    (r.league === "ALL" || t.league === r.league) &&
    t.odds >= r.minOdds &&
    t.odds <= r.maxOdds &&
    t.modelProb >= r.minModelProb
  );
}

export function portfolioMetrics(tickets: PortfolioTicket[], exposure: (t: PortfolioTicket) => number = () => 1): PortfolioMetrics {
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let capital = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let oddsWeighted = 0;
  let nExposure = 0;

  for (const t of tickets) {
    const x = Math.max(0, Number(exposure(t)) || 0);
    if (x <= 0) continue;
    const won = t.result === "win";
    if (won) wins += 1;
    else losses += 1;
    const pnl = (won ? t.odds - 1 : -1) * x;
    profit += pnl;
    capital += x;
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    oddsWeighted += t.odds * x;
    nExposure += 1;
  }

  return {
    n: nExposure,
    wins,
    losses,
    hitRate: nExposure ? wins / nExposure : 0,
    profit,
    capital,
    roi: capital ? profit / capital : 0,
    maxDrawdown,
    avgOdds: capital ? oddsWeighted / capital : 0,
  };
}

export function chronologicalSplit(tickets: PortfolioTicket[], trainFraction = 0.6, validationFraction = 0.2) {
  const sorted = [...tickets].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const trainEnd = Math.floor(sorted.length * trainFraction);
  const validationEnd = Math.floor(sorted.length * (trainFraction + validationFraction));
  return {
    train: sorted.slice(0, trainEnd),
    validation: sorted.slice(trainEnd, validationEnd),
    holdout: sorted.slice(validationEnd),
  };
}

function evaluate(split: ReturnType<typeof chronologicalSplit>, rule: PortfolioRule) {
  return {
    train: portfolioMetrics(split.train.filter((t) => ruleMatches(t, rule))),
    validation: portfolioMetrics(split.validation.filter((t) => ruleMatches(t, rule))),
    holdout: portfolioMetrics(split.holdout.filter((t) => ruleMatches(t, rule))),
  };
}

function ruleGrid(leagues: string[]): PortfolioRule[] {
  const out: PortfolioRule[] = [];
  let i = 0;
  for (const market of ["ALL", "1X2_H", "1X2_A"] as const) {
    for (const maxOdds of [1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.2, 2.3, 2.5, 2.7, 3.0]) {
      for (const minModelProb of [0, 0.38, 0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.55]) {
        for (const league of ["ALL", ...leagues]) {
          out.push({ id: `r${++i}`, market, minOdds: 1.8, maxOdds, minModelProb, league });
        }
      }
    }
  }
  return out;
}

/**
 * Portfolio Lab intentionally learns rules only from train + validation.
 * The final chronological holdout is evaluated only after rule selection.
 */
export function discoverPortfolioPolicies(raw: PortfolioTicket[]): PortfolioDiscovery {
  const eligible = raw.filter(
    (t) => (t.market === "1X2_H" || t.market === "1X2_A") && Number.isFinite(t.odds) && t.odds >= 1.8 && t.odds <= 3.0,
  );
  const split = chronologicalSplit(eligible);
  const leagues = [...new Set(eligible.map((t) => t.league))].sort();
  const candidates = ruleGrid(leagues).map((rule) => ({ rule, metrics: evaluate(split, rule) }));

  // Accuracy mandate: >=60% wins on BOTH train and validation, positive ROI,
  // and enough observations to reduce tiny-sample false positives.
  const accuracyCandidates = candidates
    .filter(({ metrics: m }) => m.train.n >= 300 && m.validation.n >= 100)
    .filter(({ metrics: m }) => m.train.hitRate >= 0.6 && m.validation.hitRate >= 0.6)
    .filter(({ metrics: m }) => m.train.roi > 0 && m.validation.roi > 0)
    .sort((a, b) => {
      const aScore = Math.min(a.metrics.train.roi, a.metrics.validation.roi) - 0.25 * Math.abs(a.metrics.train.roi - a.metrics.validation.roi);
      const bScore = Math.min(b.metrics.train.roi, b.metrics.validation.roi) - 0.25 * Math.abs(b.metrics.train.roi - b.metrics.validation.roi);
      return bScore - aScore;
    });

  // Value mandate: maximize the weaker of train/validation ROI while requiring
  // meaningful sample size and positive performance on both periods.
  const valueCandidates = candidates
    .filter(({ metrics: m }) => m.train.n >= 300 && m.validation.n >= 100)
    .filter(({ metrics: m }) => m.train.roi > 0 && m.validation.roi > 0)
    .sort((a, b) => {
      const aScore = Math.min(a.metrics.train.roi, a.metrics.validation.roi) - 0.25 * Math.abs(a.metrics.train.roi - a.metrics.validation.roi);
      const bScore = Math.min(b.metrics.train.roi, b.metrics.validation.roi) - 0.25 * Math.abs(b.metrics.train.roi - b.metrics.validation.roi);
      return bScore - aScore;
    });

  const accuracyPicked = accuracyCandidates[0] ?? null;
  const valuePicked = valueCandidates[0] ?? null;
  const accuracy = accuracyPicked?.metrics ?? null;
  const value = valuePicked?.metrics ?? null;

  let hybrid: PortfolioDiscovery["hybrid"] = null;
  if (accuracyPicked && valuePicked) {
    const hybridMetrics = (part: PortfolioTicket[]) => {
      const selected = part.filter((t) => ruleMatches(t, accuracyPicked.rule) || ruleMatches(t, valuePicked.rule));
      // Research exposure only, not a real-money stake recommendation.
      // Accuracy-qualified observations = 1.0 normalized exposure;
      // value-only observations = 0.75 normalized exposure.
      return portfolioMetrics(selected, (t) => (ruleMatches(t, accuracyPicked.rule) ? 1 : 0.75));
    };
    hybrid = {
      train: hybridMetrics(split.train),
      validation: hybridMetrics(split.validation),
      holdout: hybridMetrics(split.holdout),
    };
  }

  const baseline = {
    train: portfolioMetrics(split.train.filter((t) => t.odds <= 2.5)),
    validation: portfolioMetrics(split.validation.filter((t) => t.odds <= 2.5)),
    holdout: portfolioMetrics(split.holdout.filter((t) => t.odds <= 2.5)),
  };

  // Holdout gates verify rather than select. Failure keeps policies SHADOW.
  const accuracyPass = Boolean(
    accuracy && accuracy.holdout.n >= 200 && accuracy.holdout.hitRate >= 0.6 && accuracy.holdout.roi > baseline.holdout.roi,
  );
  const valuePass = Boolean(value && value.holdout.n >= 250 && value.holdout.roi > baseline.holdout.roi);
  const hybridPass = Boolean(
    hybrid && hybrid.holdout.n >= 300 && hybrid.holdout.roi > baseline.holdout.roi && hybrid.holdout.maxDrawdown < baseline.holdout.maxDrawdown,
  );

  return {
    baseline,
    accuracyRule: accuracyPicked?.rule ?? null,
    valueRule: valuePicked?.rule ?? null,
    accuracy,
    value,
    hybrid,
    gates: { accuracyPass, valuePass, hybridPass },
  };
}
