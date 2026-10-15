/**
 * ASTRA BETGPT LEARNING REFRESH GATE Ω
 * Fast, fail-closed check of fresh real sports data, independent from the optional
 * recovery of older fixture results. Only the latter is allowed to degrade.
 * No added infrastructure, no falsified "PASS" on stale data.
 */
export type LiveSnapshotStatus = {
  fetchedAt?: number;
  matches?: unknown[];
  meta?: { stale?: boolean; asOf?: string | null };
} | null | undefined;

export type LearningRefreshSummary = {
  status: "PASS";
  source: "FRESH_CACHE" | "LIVE_REFRESH" | "FRESH_AFTER_TIMEOUT";
  liveFetchedAt: number;
  liveAsOf: string | null;
  warning?: string;
};

export type RecoverySummary = {
  status: "PASS" | "DEGRADED" | "SKIPPED_COOLDOWN";
  targets: number;
  recovered: number;
  error?: string;
};

export const LEARNING_REFRESH_POLICY = Object.freeze({
  maxLiveAgeMs: 10 * 60_000,
  liveTimeoutMs: 12_000,
  recoveryTimeoutMs: 3_000,
  failedLiveCooldownMs: 45_000,
  recoveryCooldownMs: 90_000,
});

export function usableLearningSnapshot(
  snap: LiveSnapshotStatus,
  at = Date.now(),
  maxAgeMs = LEARNING_REFRESH_POLICY.maxLiveAgeMs,
): snap is NonNullable<LiveSnapshotStatus> & { fetchedAt: number } {
  return Boolean(
    snap && typeof snap.fetchedAt === "number" &&
    Number.isFinite(snap.fetchedAt) &&
    snap.fetchedAt <= at &&
    at - snap.fetchedAt <= maxAgeMs &&
    snap.meta?.stale !== true &&
    Array.isArray(snap.matches) &&
    snap.matches.length > 0
  );
}

export async function withinDeadline<T>(
  work: Promise<T>,
  ms: number,
  code: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type CoordinatorDependencies = {
  ensureLive: () => Promise<unknown>;
  getSnapshot: () => LiveSnapshotStatus;
  recoverPending: () => Promise<{ targets: number; recovered: number }>;
  runEngine: () => unknown;
  now?: () => number;
};

export function createLearningCheckpointCoordinator(
  deps: CoordinatorDependencies,
  policy = LEARNING_REFRESH_POLICY,
) {
  const now = deps.now ?? Date.now;
  let cycle: Promise<{ refresh: LearningRefreshSummary; recovery: RecoverySummary }> | null = null;
  let inFlightLive: Promise<unknown> | null = null;
  let inFlightRecovery: Promise<{ targets: number; recovered: number }> | null = null;
  let lastLiveFailureAt = -Infinity;
  let lastRecoveryAttemptAt = -Infinity;

  async function liveRefresh(): Promise<LearningRefreshSummary> {
    const cached = deps.getSnapshot();
    if (usableLearningSnapshot(cached, now(), policy.maxLiveAgeMs)) {
      return { status: "PASS", source: "FRESH_CACHE",
        liveFetchedAt: cached.fetchedAt, liveAsOf: cached.meta?.asOf ?? null };
    }
    if (now() - lastLiveFailureAt < policy.failedLiveCooldownMs) {
      throw new Error("ASTRA_LEARNING_LIVE_COOLDOWN_NO_FRESH_CACHE");
    }
    if (!inFlightLive) {
      let operation: Promise<unknown>;
      operation = Promise.resolve().then(() => deps.ensureLive()).finally(() => {
        if (inFlightLive === operation) inFlightLive = null;
      });
      inFlightLive = operation;
    }

    let warning: string | undefined;
    try {
      await withinDeadline(inFlightLive!, policy.liveTimeoutMs, "ASTRA_LEARNING_LIVE_TIMEOUT");
    } catch (error) {
      lastLiveFailureAt = now();
      warning = error instanceof Error ? error.message : "ASTRA_LEARNING_UPSTREAM_ERROR";
    }
    const refreshed = deps.getSnapshot();
    if (!usableLearningSnapshot(refreshed, now(), policy.maxLiveAgeMs)) {
      throw new Error(warning || "ASTRA_LEARNING_LIVE_STALE_OR_EMPTY");
    }
    return {
      status: "PASS",
      source: warning ? "FRESH_AFTER_TIMEOUT" : "LIVE_REFRESH",
      liveFetchedAt: refreshed.fetchedAt,
      liveAsOf: refreshed.meta?.asOf ?? null,
      ...(warning ? { warning } : {}),
    };
  }

  async function recover(): Promise<RecoverySummary> {
    if (!inFlightRecovery && now() - lastRecoveryAttemptAt < policy.recoveryCooldownMs) {
      return { status: "SKIPPED_COOLDOWN", targets: 0, recovered: 0 };
    }
    if (!inFlightRecovery) {
      lastRecoveryAttemptAt = now();
      let operation: Promise<{ targets: number; recovered: number }>;
      operation = Promise.resolve().then(() => deps.recoverPending()).finally(() => {
        if (inFlightRecovery === operation) inFlightRecovery = null;
      });
      inFlightRecovery = operation;
    }
    try {
      const outcome = await withinDeadline(inFlightRecovery!, policy.recoveryTimeoutMs, "ASTRA_LEARNING_RECOVERY_TIMEOUT");
      return { status: "PASS", ...outcome };
    } catch (error) {
      return {
        status: "DEGRADED",
        targets: 0,
        recovered: 0,
        error: error instanceof Error ? error.message : "ASTRA_RECOVERY_ERROR",
      };
    }
  }

  function refresh() {
    if (!cycle) {
      let operation: Promise<{ refresh: LearningRefreshSummary; recovery: RecoverySummary }>;
      operation = (async () => {
        // Live sports truth is mandatory. Older-result recovery is separately
        // accounted for but must not invalidate an already fresh match snapshot.
        const live = await liveRefresh();
        const recovery = await recover();
        // Compute and settle from the vetted snapshot even if legacy recovery
        // is slow. No learning on stale feeds or invented score lines.
        deps.runEngine();
        return { refresh: live, recovery };
      })().finally(() => { if (cycle === operation) cycle = null; });
      cycle = operation;
    }
    return cycle;
  }

  return { refresh };
}
