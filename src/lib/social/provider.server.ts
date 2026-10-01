import type { SocialProviderHealth, SocialPublication } from "@/lib/social/types";

function enabled(): boolean {
  return typeof process !== "undefined" && process.env.BETGPT_X_AUTOPUBLISH_ENABLED === "true";
}

function token(): string {
  return typeof process !== "undefined" ? process.env.BETGPT_X_USER_ACCESS_TOKEN?.trim() ?? "" : "";
}

export function xProviderHealth(): SocialProviderHealth {
  if (!enabled()) {
    return {
      network: "x",
      state: "READY_NOT_AUTHORIZED",
      autoPublish: false,
      reason: "ASTRA SOCIAL est prêt, mais l'écriture automatique X reste désactivée par la politique zéro coût.",
    };
  }
  if (!token()) {
    return {
      network: "x",
      state: "ERROR",
      autoPublish: false,
      reason: "BETGPT_X_AUTOPUBLISH_ENABLED=true mais aucun jeton utilisateur X n'est configuré.",
    };
  }
  return {
    network: "x",
    state: "CONFIGURED",
    autoPublish: true,
    reason: "Provider X officiel configuré.",
  };
}

export async function publishToX(publication: SocialPublication): Promise<SocialPublication> {
  const health = xProviderHealth();
  if (!health.autoPublish) return publication;
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: publication.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { id?: string };
      detail?: string;
      title?: string;
    };
    if (!response.ok || !payload.data?.id) {
      return {
        ...publication,
        attemptedAt,
        status: publication.retryCount >= 2 ? "FAILED" : "RETRY",
        retryCount: publication.retryCount + 1,
        error: payload.detail || payload.title || `X API HTTP ${response.status}`,
      };
    }
    const remotePostId = payload.data.id;
    return {
      ...publication,
      attemptedAt,
      publishedAt: attemptedAt,
      status: "PUBLISHED",
      remotePostId,
      remotePostUrl: `https://x.com/i/web/status/${remotePostId}`,
      error: null,
    };
  } catch (error) {
    return {
      ...publication,
      attemptedAt,
      status: publication.retryCount >= 2 ? "FAILED" : "RETRY",
      retryCount: publication.retryCount + 1,
      error: error instanceof Error ? error.message : "X publish failed",
    };
  }
}
