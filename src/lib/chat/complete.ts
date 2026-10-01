import { getLiveSnapshot, hydrateLiveFromDisk } from "@/engine/live";
import { stripMarkup } from "@/lib/plain";
import { betgptPrompt } from "./prompt";
import { normalizeMemory, parseMode, type ChatRequestBody, type PersonalityMode } from "./types";
import { classifyChatIntent, localMatchFacts } from "./local";
import { allowKeyed } from "@/lib/store";
import { historyFacts } from "./history-facts";
import { hasUnsupportedGroundedClaim } from "./grounding";
import { extractPunchline, type PunchlineMeta } from "./punch";
import { absurdInsultCreativeBrief, generateAbsurdInsult, shouldDropAbsurdInsult } from "./absurd-insults";

async function deskNow(question: string): Promise<string> {
  try {
    const snapshot = getLiveSnapshot() ?? hydrateLiveFromDisk();
    return [historyFacts(question), localMatchFacts(question, snapshot?.matches ?? [], snapshot?.meta?.asOf)]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "Calendrier indisponible pour l'instant.";
  }
}

function localReply(last: string, desk: string, mode: PersonalityMode): string {
  const intent = classifyChatIntent(last);
  if (intent === "CASUAL") {
    return mode === "ROAST"
      ? "Salut 😈 BetGPT est réveillé. Balance ton match, ton ticket ou ta théorie football — je sortirai le grille-pain quantique si le raisonnement le mérite."
      : "Salut 👋 Je suis là. Donne-moi un match, un ticket ou demande-moi ce qui vaut vraiment le coup aujourd’hui.";
  }
  if (intent === "TODAY_PICKS") {
    if (desk.includes("Aucun match exploitable trouvé dans le cache.")) {
      return mode === "ROAST"
        ? "Aujourd’hui, le desk est vide. Donc pas question de fabriquer un combiné en carton mouillé juste pour faire semblant d’avoir une idée géniale. Pas de match exploitable = pas de pari forcé."
        : "Aujourd’hui, je ne force rien : le desk ne me remonte aucun match exploitable. Donc pas de pari inventé juste pour avoir quelque chose à jouer. Dès que les affiches remontent, je te sors 1 à 3 idées maximum, avec la raison et le risque principal.";
    }
    const opener =
      mode === "ROAST"
        ? "Je ne vais pas fabriquer un combiné en carton mouillé juste pour remplir la case. Voilà ce que le desk a réellement sous la main :"
        : "Je ne vais pas inventer un pari. Voilà les matchs réellement disponibles dans le desk :";
    return `${opener}\n\n${desk}`;
  }
  if (intent === "GENERAL_SCHEDULE" || intent === "NAMED_MATCH") return desk;
  return mode === "ROAST"
    ? "Le moteur conversationnel est momentanément en secours local. Je peux toujours vérifier un match ou démonter un ticket, mais je préfère éviter de broder comme un poulpe consultant."
    : "Le moteur conversationnel est momentanément en secours local. Je peux toujours vérifier un match ou un ticket à partir des données disponibles, sans inventer.";
}

function groundedFallback(desk: string, last: string, mode: PersonalityMode): string {
  if (desk.includes("Cible nommée non trouvée")) {
    return "Je n’ai pas retrouvé ce match ou cette équipe dans les données disponibles. Donne-moi le nom exact si tu veux, mais je ne vais pas inventer l’adversaire, la date ou la cote.";
  }
  const intent = classifyChatIntent(last);
  if (desk.includes("Rencontres correspondant à la demande :")) {
    const intro =
      mode === "ROAST"
        ? "Je peux démonter ton scénario, mais je reste collé aux faits du desk — pas de record historique sorti d’un grille-pain quantique."
        : "Voilà ce que le desk confirme réellement pour cette équipe ou cette rencontre.";
    return `${intro}\n\n${desk}`;
  }
  if (intent === "TODAY_PICKS") return localReply(last, desk, mode);
  if (intent === "GENERAL_SCHEDULE") return desk;
  return mode === "ROAST"
    ? "Je peux te chambrer, mais pas inventer les faits : le desk n’a pas assez de données vérifiées pour confirmer ce détail. Donc je garde le grille-pain quantique au placard et je reste sur ce qui est vérifiable."
    : "Je n’ai pas assez de données vérifiées pour affirmer ce détail. Je peux te donner ce que le desk confirme, ou raisonner sans inventer le reste.";
}

function shouldGround(question: string): boolean {
  const intent = classifyChatIntent(question);
  return (
    intent === "NAMED_MATCH" ||
    intent === "TODAY_PICKS" ||
    intent === "GENERAL_SCHEDULE" ||
    /\b(prochain(?:e)?|aujourd['’]?hui|demain|ce soir|score|perdre|gagner|victoire|défaite)\b/i.test(question)
  );
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
        maxTokens: critic ? 320 : 320,
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

async function callLocalChat(
  base: string,
  system: string,
  history: { role: string; content: string }[],
  mode: PersonalityMode,
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const upstream = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ASTRA_LOCAL_CHAT_TOKEN?.trim() || "astra-private"}`,
      },
      body: JSON.stringify({
        model: "qwen-chat-local",
        stream: false,
        temperature: mode === "ROAST" ? 0.72 : 0.38,
        max_tokens: 220,
        messages: [{ role: "system", content: system.slice(0, 12000) }, ...history],
      }),
    });
    if (!upstream.ok) return { ok: false, status: upstream.status };
    const json = (await upstream.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = stripMarkup(json.choices?.[0]?.message?.content ?? "").trim();
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
        temperature: mode === "ROAST" ? 0.72 : 0.35,
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

type CompleteChatSuccess = { ok: true; text: string; punchline?: PunchlineMeta };

function insertPunchline(text: string, taggedPunchline: string): string {
  const firstBreak = text.indexOf("\n");
  if (firstBreak > 0) return `${text.slice(0, firstBreak)}\n\n${taggedPunchline}\n${text.slice(firstBreak + 1).trimStart()}`;
  const firstSentence = text.match(/^(.{12,220}?[.!?])\s+/);
  if (firstSentence) {
    const cut = firstSentence[0].length;
    return `${text.slice(0, cut).trim()}\n\n${taggedPunchline}\n\n${text.slice(cut).trimStart()}`;
  }
  return `${text}\n\n${taggedPunchline}`;
}

function success(
  text: string,
  mode: PersonalityMode,
  context: string,
  recent: string[],
): CompleteChatSuccess {
  const firstPass = extractPunchline(text, mode, context);
  if (firstPass.punchline || mode !== "ROAST" || !shouldDropAbsurdInsult(context, recent)) {
    return { ok: true, ...firstPass };
  }

  const insult = generateAbsurdInsult(context, recent, "surprise");
  const style = /NON|STOP|IMPOSSIBLE|ALL-IN|TAPIS/i.test(context) ? "ANGRY_SHOUT" : "LAUGH_SHOUT";
  const tagged = `[[PUNCH:${style}]]${insult.text}[[/PUNCH]]`;
  return { ok: true, ...extractPunchline(insertPunchline(firstPass.text, tagged), mode, context) };
}

export async function completeChat(
  body: ChatRequestBody,
): Promise<CompleteChatSuccess | { ok: false; error: string }> {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "Écris un message." };
  }
  if (!(await allowKeyed("chat:service-budget", 60, 60_000)))
    return { ok: false, error: "Trop de messages. Patiente une minute." };

  const rawLast = body.messages.at(-1)?.content ?? "";
  const desk = await deskNow(rawLast);
  const mode: PersonalityMode = parseMode(body.requestedMode);
  const memory = normalizeMemory(body.userMemory);
  const recentRoasts = body.messages
    .filter((m) => m.role === "assistant")
    .slice(-6)
    .map((m) => m.content.slice(0, 500));
  const insultBrief = mode === "ROAST" ? absurdInsultCreativeBrief(rawLast, recentRoasts) : "";
  const system = betgptPrompt(memory, mode, desk, insultBrief);
  const history = body.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, 4000),
    }));
  const last = history.at(-1)?.content ?? "";
  const mustGround = shouldGround(last);

  const localChatBase = process.env.ASTRA_LOCAL_CHAT_BASE?.trim();
  if (localChatBase) {
    try {
      const out = await callLocalChat(localChatBase, system, history, mode);
      if (out.ok) {
        if (mustGround) {
          const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
          if (hasUnsupportedGroundedClaim(out.text, source)) {
            return success(groundedFallback(desk, last, mode), mode, last, recentRoasts);
          }
        }
        return success(out.text, mode, last, recentRoasts);
      }
    } catch {
      /* fall through to ASTRA router, optional cloud provider, then local fallback */
    }
  }

  const routerBase = process.env.ASTRA_ROUTER_BASE?.trim();
  const routerToken = process.env.ASTRA_ROUTER_TOKEN?.trim();
  if (routerBase && routerToken) {
    try {
      const out = await callAstraRouter(routerBase, routerToken, system, history, mode);
      if (out.ok) {
        if (mustGround) {
          const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
          if (hasUnsupportedGroundedClaim(out.text, source)) {
            return success(groundedFallback(desk, last, mode), mode, last, recentRoasts);
          }
        }
        return success(out.text, mode, last, recentRoasts);
      }
    } catch {
      /* fall through to optional cloud provider, then conversational local fallback */
    }
  }

  const apiKey = process.env.XAI_API_KEY;
  if (apiKey) {
    try {
      const out = await callXai(apiKey, system, history, mode);
      if (out.ok) {
        if (mustGround) {
          const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
          if (hasUnsupportedGroundedClaim(out.text, source)) {
            return success(groundedFallback(desk, last, mode), mode, last, recentRoasts);
          }
        }
        return success(out.text, mode, last, recentRoasts);
      }
    } catch {
      /* fall through to conversational local fallback */
    }
  }

  return success(localReply(last, desk, mode), mode, last, recentRoasts);
}
