export type GrowthCounts = Record<string, number>;

export type GrowthInput = {
  windowHours: number;
  currentEvents: GrowthCounts;
  previousEvents: GrowthCounts;
  affiliateClicks: number;
  previousAffiliateClicks: number;
  discoverReady: number;
  discoverCandidates: number;
  topRoutes: { route: string; n: number }[];
};

export type GrowthAction = {
  id: string;
  priority: number;
  loop: "acquisition" | "activation" | "retention" | "virality" | "revenue";
  title: string;
  reason: string;
};

function n(map: GrowthCounts, ...keys: string[]): number {
  return keys.reduce((sum, key) => sum + (Number(map[key]) || 0), 0);
}

function ratio(a: number, b: number): number | null {
  if (b <= 0) return null;
  return Math.max(0, Math.min(1, a / b));
}

function delta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 1 : null;
  return (current - previous) / previous;
}

export function nationalBreakoutScorecard(input: GrowthInput) {
  const sessions = n(input.currentEvents, "landing", "return_visit");
  const previousSessions = n(input.previousEvents, "landing", "return_visit");
  const activations = n(
    input.currentEvents,
    "chat_ask",
    "match_analyzed",
    "hunter_open",
    "hunter_scenario",
    "why_this_score",
  );
  const shares = n(input.currentEvents, "share", "chat_share", "chat_share_copy");
  const returns = n(input.currentEvents, "return_visit");

  const activationRate = ratio(activations, sessions);
  const retentionRate = ratio(returns, sessions);
  const viralityRate = ratio(shares, Math.max(activations, sessions));
  const monetizationRate = ratio(input.affiliateClicks, Math.max(activations, sessions));
  const trafficGrowth = delta(sessions, previousSessions);
  const affiliateGrowth = delta(input.affiliateClicks, input.previousAffiliateClicks);

  const noBehavioralSignal =
    sessions === 0 &&
    previousSessions === 0 &&
    activations === 0 &&
    shares === 0 &&
    returns === 0 &&
    input.affiliateClicks === 0 &&
    input.previousAffiliateClicks === 0;

  if (noBehavioralSignal) {
    return {
      schema: "astra-national-breakout/v1",
      score: null,
      status: "UNVERIFIED" as const,
      windowHours: input.windowHours,
      metrics: {
        sessions,
        previousSessions,
        activations,
        shares,
        returns,
        affiliateClicks: input.affiliateClicks,
        previousAffiliateClicks: input.previousAffiliateClicks,
        activationRate,
        retentionRate,
        viralityRate,
        monetizationRate,
        trafficGrowth,
        affiliateGrowth,
        discoverReady: input.discoverReady,
        discoverCandidates: input.discoverCandidates,
      },
      topRoutes: input.topRoutes.slice(0, 10),
      actions: [
        {
          id: "measurement-warmup",
          priority: 100,
          loop: "acquisition" as const,
          title: "Accumuler un signal comportemental mesuré",
          reason:
            "Aucune visite, activation, rétention, partage ou conversion n’est encore observée dans les fenêtres comparées. Aucun diagnostic de performance n’est émis avant données réelles.",
        },
      ],
    };
  }

  const actions: GrowthAction[] = [];

  if (trafficGrowth == null || trafficGrowth < 0.15) {
    actions.push({
      id: "acquisition-freshness",
      priority: trafficGrowth != null && trafficGrowth < 0 ? 96 : 82,
      loop: "acquisition",
      title: "Accélérer l’acquisition fraîche",
      reason: "Le trafic 24 h ne progresse pas assez par rapport à la fenêtre précédente.",
    });
  }
  if (input.discoverReady < 2) {
    actions.push({
      id: "discover-ready",
      priority: 94,
      loop: "acquisition",
      title: "Remonter au moins deux candidats Discover prêts",
      reason: `Seulement ${input.discoverReady}/${input.discoverCandidates} candidat(s) récent(s) passent les gates Discover statiques.`,
    });
  }
  if (activationRate == null || activationRate < 0.3) {
    actions.push({
      id: "activation-chat",
      priority: 90,
      loop: "activation",
      title: "Pousser le visiteur vers une action utile",
      reason: "Moins de 30 % des visites mesurées déclenchent chat, analyse ou Hunter.",
    });
  }
  if (retentionRate == null || retentionRate < 0.2) {
    actions.push({
      id: "retention-loop",
      priority: 88,
      loop: "retention",
      title: "Renforcer la boucle de retour",
      reason: "Le taux de retour mesuré est inférieur à 20 %.",
    });
  }
  if (viralityRate == null || viralityRate < 0.08) {
    actions.push({
      id: "share-loop",
      priority: 84,
      loop: "virality",
      title: "Augmenter les moments naturellement partageables",
      reason: "Moins de 8 % des visites/activations produisent un partage mesuré.",
    });
  }
  if (monetizationRate == null || monetizationRate < 0.05) {
    actions.push({
      id: "revenue-clickthrough",
      priority: 80,
      loop: "revenue",
      title: "Mieux relier valeur utilisateur et clic bookmaker",
      reason: "Le taux de clic affilié mesuré reste inférieur à 5 % des visites/activations.",
    });
  }

  const normalizedRates = [
    activationRate == null ? null : Math.min(1, activationRate / 0.5),
    retentionRate == null ? null : Math.min(1, retentionRate / 0.3),
    viralityRate == null ? null : Math.min(1, viralityRate / 0.15),
    monetizationRate == null ? null : Math.min(1, monetizationRate / 0.1),
  ].filter((value): value is number => value != null);
  const rateScore = normalizedRates.length
    ? normalizedRates.reduce((sum, value) => sum + value, 0) / normalizedRates.length
    : 0;
  const momentumScore = trafficGrowth == null ? 0 : Math.max(0, Math.min(1, (trafficGrowth + 0.25) / 0.75));
  const discoverScore = Math.min(1, input.discoverReady / 3);
  const score = Math.round((rateScore * 0.55 + momentumScore * 0.25 + discoverScore * 0.2) * 100);

  return {
    schema: "astra-national-breakout/v1",
    score,
    status: score >= 70 ? "ACCELERATE" : score >= 45 ? "BUILD" : "FIX",
    windowHours: input.windowHours,
    metrics: {
      sessions,
      previousSessions,
      activations,
      shares,
      returns,
      affiliateClicks: input.affiliateClicks,
      previousAffiliateClicks: input.previousAffiliateClicks,
      activationRate,
      retentionRate,
      viralityRate,
      monetizationRate,
      trafficGrowth,
      affiliateGrowth,
      discoverReady: input.discoverReady,
      discoverCandidates: input.discoverCandidates,
    },
    topRoutes: input.topRoutes.slice(0, 10),
    actions: actions.sort((a, b) => b.priority - a.priority).slice(0, 3),
  };
}
