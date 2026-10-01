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

const GROUNDING_WORD_EXCEPTIONS = new Set([
  "BetGPT", "ROI", "BTTS", "EV", "CLV", "BET", "WATCH", "NO_BET",
  "Je", "Tu", "Il", "Elle", "Nous", "Vous", "Ils", "Elles",
  "Le", "La", "Les", "Un", "Une", "Des", "Du", "De", "Pour", "Si",
  "Aucun", "Aucune", "Cette", "Ce", "Ces", "Mon", "Ton", "Votre",
]);

function normalizeGroundingText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasUnsupportedGroundedClaim(answer: string, source: string): boolean {
  const normalizedSource = normalizeGroundingText(source);
  const sensitivePatterns = [
    /\b\d{1,2}\s*[hH:]\s*\d{2}\b/g,
    /\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g,
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/g,
    /\b\d+(?:[.,]\d+)?\s*%\b/g,
    /\b\d+[.,]\d{1,3}\b/g,
  ];
  for (const pattern of sensitivePatterns) {
    for (const match of answer.matchAll(pattern)) {
      const fact = normalizeGroundingText(match[0]).replace(/\s+/g, "");
      const haystack = normalizedSource.replace(/\s+/g, "");
      if (fact && !haystack.includes(fact)) return true;
    }
  }

  const properWords = answer.match(/\b[\p{Lu}][\p{L}'’.\-]{2,}\b/gu) ?? [];
  for (const word of properWords) {
    if (GROUNDING_WORD_EXCEPTIONS.has(word)) continue;
    const key = normalizeGroundingText(word);
    if (key && !normalizedSource.includes(key)) return true;
  }
  return false;
}

function groundedFallback(desk: string): string {
  if (desk.includes("Aucune équipe précisément reconnue dans ta question.")) {
    return "Je n’ai pas de donnée vérifiée correspondant précisément à l’équipe ou au match demandé dans les données disponibles. Je préfère ne pas inventer un adversaire, une date, une cote ou un score.";
  }
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
  const timer = setTimeout(() => controller.abort(), 30000);
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
        requestedModel: "qwen-chat-local",
        maxTokens: critic ? 240 : 280,
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
      if (out.ok) {
        const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
        if (hasUnsupportedGroundedClaim(out.text, source)) {
          return { ok: true, text: groundedFallback(desk) };
        }
        return { ok: true, text: out.text };
      }
    } catch {
      /* fall through to optional cloud provider, then factual local desk */
    }
  }

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const out = await callXai(apiKey, system, history, mode);
      if (out.ok) {
        const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
        if (hasUnsupportedGroundedClaim(out.text, source)) {
          return { ok: true, text: groundedFallback(desk) };
        }
        return { ok: true, text: out.text };
      }
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
