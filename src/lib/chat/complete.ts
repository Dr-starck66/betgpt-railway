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

async function callAstraRouter(
  base: string,
  token: string,
  system: string,
  history: { role: string; content: string }[],
  mode: PersonalityMode,
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 26000);
  try {
    const last = history.at(-1)?.content ?? "";
    const critic =
      mode === "ROAST" ||
      /\b(démonte|demontre|critique|audit|contre-argument|contre argument|risque|faiblesse|erreur)\b/i.test(last);
    const transcript = history
      .slice(-10)
      .map((m) => `${m.role === "assistant" ? "BETGPT" : "UTILISATEUR"}: ${m.content}`)
      .join("\n\n");
    const upstream = await fetch(`${base.replace(/\/+$/, "")}/api/router_chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        system: system.slice(0, 18000),
        user: `CONVERSATION RÉCENTE\n\n${transcript}\n\nRéponds au dernier message de l'utilisateur.`,
        requestedModel: critic ? "gemma-critic-local" : "qwen-coder-local",
        maxTokens: mode === "ROAST" ? 700 : 850,
      }),
    });
    const json = (await upstream.json().catch(() => ({}))) as {
      text?: string;
      status?: string;
      reason?: string;
    };
    if (!upstream.ok) return { ok: false, status: upstream.status };
    const text = stripMarkup(json.text ?? "").trim();
    if (!text) return { ok: false, status: 204 };
    return { ok: true, text };
  } finally {
    clearTimeout(timer);
  }
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

  const routerBase = process.env.ASTRA_ROUTER_BASE?.trim();
  const routerToken = process.env.ASTRA_ROUTER_TOKEN?.trim();
  if (routerBase && routerToken) {
    try {
      const out = await callAstraRouter(routerBase, routerToken, system, history, mode);
      if (out.ok) return { ok: true, text: out.text };
    } catch {
      /* fall through to optional cloud provider, then factual local desk */
    }
  }

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const out = await callXai(apiKey, system, history, mode);
      if (out.ok) return { ok: true, text: out.text };
    } catch {
      /* fall through to factual local desk */
    }
  }

  const reason = routerBase && routerToken
    ? "le routeur ASTRA n’a pas répondu"
    : apiKey
      ? "le service IA n’a pas répondu"
      : "service IA non configuré";
  return {
    ok: true,
    text: `Mode de secours local — ${reason}.\n\n${localReply(last, desk, mode)}`,
  };
}
