import type { ChatRequestBody } from "./types.ts";
import type { PunchlineMeta } from "./punch.ts";

export async function postChat(
  body: ChatRequestBody,
  fetcher: typeof fetch = fetch,
): Promise<{ text: string; punchline?: PunchlineMeta }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetcher("/api/chat", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        messages: body.messages.filter((m) => m.content.trim()).slice(-12),
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { text?: string; punchline?: PunchlineMeta; error?: string };
    if (!response.ok)
      throw new Error(json.error || "Le service est indisponible. Réessaie dans un instant.");
    if (typeof json.text !== "string" || !json.text.trim())
      throw new Error("Réponse vide. Réessaie.");
    return { text: json.text.trim(), punchline: json.punchline };
  } finally {
    clearTimeout(timer);
  }
}
