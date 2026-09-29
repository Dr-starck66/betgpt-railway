import { getLiveSnapshot, hydrateLiveFromDisk } from "@/engine/live";
import { stripMarkup } from "@/lib/plain";
import { betgptPrompt } from "./prompt";
import { normalizeMemory, parseMode, type ChatRequestBody, type PersonalityMode } from "./types";
import { localMatchFacts } from "./local";
import { allowKeyed } from "@/lib/store";
import { historyFacts } from "./history-facts";

async function deskNow(question: string): Promise<string> {
  try {
    const snapshot = getLiveSnapshot() ?? hydrateLiveFromDisk();
    return [historyFacts(question), localMatchFacts(question, snapshot?.matches ?? [], snapshot?.meta?.asOf)].filter(Boolean).join("\n\n");
  } catch {
    return "Calendrier indisponible pour l'instant.";
  }
}

function localReply(_last: string, desk: string, _mode: PersonalityMode): string {
  return desk;
}

async function callXai(
  apiKey: string,
  system: string,
  history: { role: string; content: string }[],
  mode: PersonalityMode,
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_MODEL?.trim() || "grok-4.5",
        stream: false,
        temperature: mode === "ROAST" ? 0.6 : 0.2,
        max_tokens: 420,
        messages: [{ role: "system", content: system.slice(0, 12000) }, ...history],
      }),
    });
    if (!upstream.ok) return { ok: false, status: upstream.status };
    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = stripMarkup(json.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false, status: 204 };
    return { ok: true, text };
  } finally {
    clearTimeout(timer);
  }
}

export async function completeChat(
  body: ChatRequestBody,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "Écris un message." };
  }
  if (!(await allowKeyed("chat:service-budget", 60, 60_000)))
    return { ok: false, error: "Trop de messages. Patiente une minute." };

  const desk = await deskNow(body.messages.at(-1)?.content ?? "");
  const mode: PersonalityMode = parseMode(body.requestedMode);
  const memory = normalizeMemory(body.userMemory);
  const system = betgptPrompt(memory, mode, desk);
  const history = body.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, 4000),
    }));
  const last = history.at(-1)?.content ?? "";

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const out = await callXai(apiKey, system, history, mode);
      if (out.ok) return { ok: true, text: out.text };
    } catch {
      /* fall through to local desk */
    }
  }

  return {
    ok: true,
    text: `Mode local — ${apiKey ? "le service IA n’a pas répondu" : "service IA non configuré"}.\n\n${localReply(last, desk, mode)}`,
  };
}
