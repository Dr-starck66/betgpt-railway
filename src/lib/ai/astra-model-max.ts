export type AstraModelProfile = "critical" | "coding" | "research" | "fast" | "economy";

export type AstraModelDescriptor = {
  id: string;
  provider: string;
  authorized: boolean;
  availability: "available" | "degraded" | "unavailable";
  quality: number;
  reasoning: number;
  tools: number;
  reliability: number;
  latency: number;
  cost: number;
  tags?: string[];
};

export type AstraModelPlan = {
  status: "PASS" | "PARTIAL" | "FAIL";
  profile: AstraModelProfile;
  primary: AstraModelDescriptor | null;
  critic: AstraModelDescriptor | null;
  fallback: AstraModelDescriptor | null;
  evidence: string[];
};

type Weights = {
  quality: number;
  reasoning: number;
  tools: number;
  reliability: number;
  latencyPenalty: number;
  costPenalty: number;
};

const WEIGHTS: Record<AstraModelProfile, Weights> = {
  critical: {
    quality: 0.46,
    reasoning: 0.26,
    tools: 0.1,
    reliability: 0.15,
    latencyPenalty: 0.02,
    costPenalty: 0.01,
  },
  coding: {
    quality: 0.36,
    reasoning: 0.3,
    tools: 0.17,
    reliability: 0.13,
    latencyPenalty: 0.02,
    costPenalty: 0.02,
  },
  research: {
    quality: 0.36,
    reasoning: 0.27,
    tools: 0.2,
    reliability: 0.14,
    latencyPenalty: 0.02,
    costPenalty: 0.01,
  },
  fast: {
    quality: 0.2,
    reasoning: 0.12,
    tools: 0.08,
    reliability: 0.15,
    latencyPenalty: 0.4,
    costPenalty: 0.05,
  },
  economy: {
    quality: 0.18,
    reasoning: 0.12,
    tools: 0.08,
    reliability: 0.12,
    latencyPenalty: 0.1,
    costPenalty: 0.4,
  },
};

function clampMetric(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function modelScore(model: AstraModelDescriptor, profile: AstraModelProfile): number {
  const w = WEIGHTS[profile];
  return (
    clampMetric(model.quality) * w.quality +
    clampMetric(model.reasoning) * w.reasoning +
    clampMetric(model.tools) * w.tools +
    clampMetric(model.reliability) * w.reliability -
    clampMetric(model.latency) * w.latencyPenalty -
    clampMetric(model.cost) * w.costPenalty
  );
}

export function authorizedAvailableModels(catalog: AstraModelDescriptor[]): AstraModelDescriptor[] {
  return catalog.filter((model) => model.authorized && model.availability !== "unavailable");
}

export function assertRequestedModelAuthorized(
  requestedId: string,
  catalog: AstraModelDescriptor[],
): AstraModelDescriptor {
  const model = catalog.find((candidate) => candidate.id === requestedId);
  if (!model) {
    throw new Error(
      `ASTRA_MODEL_MAX_FAIL: requested model "${requestedId}" is not present in the discovered catalog`,
    );
  }
  if (!model.authorized) {
    throw new Error(
      `ASTRA_MODEL_MAX_FAIL: requested model "${requestedId}" is not authorized for this runtime`,
    );
  }
  if (model.availability === "unavailable") {
    throw new Error(
      `ASTRA_MODEL_MAX_FAIL: requested model "${requestedId}" is authorized but unavailable`,
    );
  }
  return model;
}

function ranked(
  catalog: AstraModelDescriptor[],
  profile: AstraModelProfile,
): AstraModelDescriptor[] {
  return authorizedAvailableModels(catalog)
    .slice()
    .sort((a, b) => {
      const delta = modelScore(b, profile) - modelScore(a, profile);
      if (Math.abs(delta) > 1e-9) return delta;
      return a.id.localeCompare(b.id);
    });
}

export function buildAstraModelMaxPlan(
  catalog: AstraModelDescriptor[],
  profile: AstraModelProfile = "critical",
  options: {
    requireIndependentCritic?: boolean;
    preferredProviders?: string[];
  } = {},
): AstraModelPlan {
  const evidence: string[] = [];
  const available = ranked(catalog, profile);

  if (!available.length) {
    return {
      status: "FAIL",
      profile,
      primary: null,
      critic: null,
      fallback: null,
      evidence: ["No authorized and available model was discovered."],
    };
  }

  const preferred = options.preferredProviders?.length
    ? available.filter((m) => options.preferredProviders!.includes(m.provider))
    : [];
  const pool = preferred.length ? preferred : available;

  const primary = pool[0] ?? available[0];
  evidence.push(
    `primary=${primary.provider}/${primary.id} score=${modelScore(primary, profile).toFixed(2)} authorization=verified`,
  );

  const independent = available.find(
    (model) => model.id !== primary.id && model.provider !== primary.provider,
  );
  const alternate = available.find((model) => model.id !== primary.id);
  const critic = independent ?? alternate ?? null;

  if (critic) {
    evidence.push(
      `critic=${critic.provider}/${critic.id} score=${modelScore(critic, profile).toFixed(2)} independent=${critic.provider !== primary.provider}`,
    );
  } else {
    evidence.push("critic=none");
  }

  const fallback =
    available.find(
      (model) =>
        model.id !== primary.id &&
        model.id !== critic?.id &&
        model.availability === "available",
    ) ??
    alternate ??
    null;

  if (fallback) {
    evidence.push(
      `fallback=${fallback.provider}/${fallback.id} score=${modelScore(fallback, profile).toFixed(2)}`,
    );
  }

  const needsIndependentCritic = options.requireIndependentCritic ?? profile === "critical";
  const independentCriticOk = Boolean(critic && critic.provider !== primary.provider);

  return {
    status: needsIndependentCritic && !independentCriticOk ? "PARTIAL" : "PASS",
    profile,
    primary,
    critic,
    fallback,
    evidence,
  };
}
