export type ReliabilityStatus = "CONFIGURED" | "UNCONFIGURED" | "PLATFORM_MANAGED_OR_UNVERIFIED";

export function reliabilityConfig(env: NodeJS.ProcessEnv = process.env) {
  const configured = (...names: string[]) =>
    names.every((name) => Boolean(String(env[name] ?? "").trim()));

  const components = {
    railwayTracing: {
      status: configured("OTEL_EXPORTER_OTLP_ENDPOINT")
        ? "CONFIGURED"
        : "PLATFORM_MANAGED_OR_UNVERIFIED",
    },
    gatus: { status: configured("ASTRA_GATUS_URL") ? "CONFIGURED" : "UNCONFIGURED" },
    litellm: {
      status: configured("ASTRA_LLM_GATEWAY_BASE") ? "CONFIGURED" : "UNCONFIGURED",
    },
    trigger: {
      status: configured("TRIGGER_SECRET_KEY") ? "CONFIGURED" : "UNCONFIGURED",
    },
    langfuse: {
      status: configured("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_BASE_URL")
        ? "CONFIGURED"
        : "UNCONFIGURED",
    },
  } as const;

  const configuredCount = Object.values(components).filter(
    (item) => item.status === "CONFIGURED",
  ).length;

  return {
    schema: "astra-reliability/v1",
    service: "betgpt",
    status: configuredCount === 5 ? "PASS" : configuredCount > 0 ? "PARTIAL" : "UNVERIFIED",
    components,
    timestamp: new Date().toISOString(),
  };
}

export async function callReliabilityGateway(
  system: string,
  history: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const base = String(process.env.ASTRA_LLM_GATEWAY_BASE ?? "").trim().replace(/\/+$/, "");
  if (!base) return { ok: false, status: 503 };

  const token = String(process.env.ASTRA_LLM_GATEWAY_TOKEN ?? "").trim();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: process.env.ASTRA_LLM_GATEWAY_MODEL?.trim() || "astra-chat",
        stream: false,
        temperature: options.temperature ?? 0.35,
        max_tokens: options.maxTokens ?? 320,
        messages: [{ role: "system", content: system.slice(0, 12_000) }, ...history],
      }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = String(json.choices?.[0]?.message?.content ?? "").trim();
    if (!response.ok || !text) return { ok: false, status: response.status || 502 };
    return { ok: true, text };
  } finally {
    clearTimeout(timer);
  }
}
