import { ensureLive, getLiveSnapshot, hydrateLiveFromDisk } from "@/engine/live";
import { predictMatch, runEngine } from "@/engine/pipeline";
import { stripMarkup } from "@/lib/plain";
import { betgptPrompt } from "./prompt";
import { normalizeMemory, parseMode, type ChatRequestBody, type PersonalityMode } from "./types";
import { classifyChatIntent, localMatchFacts } from "./local";
import { allowKeyed } from "@/lib/store";
import { historyFacts } from "./history-facts";
import { hasUnsupportedGroundedClaim } from "./grounding";
import { extractPunchline, type PunchlineMeta } from "./punch";
import { absurdInsultCreativeBrief, generateAbsurdInsult, shouldDropAbsurdInsult } from "./absurd-insults";
import { renderDailyChatPick, selectDailyChatPick, selectDailyDataFallback } from "./daily-pick";

async function deskNow(question: string): Promise<string> {
  try {
    const snapshot = (await ensureLive()) ?? getLiveSnapshot() ?? hydrateLiveFromDisk();
    const base = [
      historyFacts(question),
      localMatchFacts(question, snapshot?.matches ?? [], snapshot?.meta?.asOf),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (classifyChatIntent(question) !== "TODAY_PICKS") return base;

    try {
      const engine = runEngine();
      let pick = selectDailyChatPick(
        engine.matches,
        engine.predictions,
        engine.liveAsOf,
        engine.liveStale,
      );

      // The live chat snapshot can be fresher than the engine's persisted disk
      // snapshot. If the regular engine did not yield a pick, score the exact
      // fixtures that were just shown to the user with the already-learned
      // model. This prevents the "I see today's matches but have no pick"
      // contradiction while keeping the result explicitly non-premium when
      // bookmaker odds are unavailable.
      if (!pick && snapshot?.matches?.length) {
        const livePredictions = snapshot.matches.slice(0, 24).flatMap((match) => {
          try {
            return [predictMatch(match)];
          } catch {
            return [];
          }
        });
        const asOfMs = Date.parse(snapshot.meta?.asOf ?? "");
        const snapshotStale =
          Boolean(snapshot.meta?.stale) ||
          !Number.isFinite(asOfMs) ||
          Date.now() - asOfMs > 30 * 60_000 ||
          asOfMs > Date.now() + 60_000;
        pick = selectDailyChatPick(
          snapshot.matches,
          livePredictions,
          snapshot.meta?.asOf,
          snapshotStale,
        );

        if (!pick) {
          pick = selectDailyDataFallback(
            snapshot.matches,
            snapshot.meta?.asOf,
            snapshotStale,
          );
        }
      }

      if (!pick && snapshot?.matches?.length) {
        const asOfMs = Date.parse(snapshot.meta?.asOf ?? "");
        const snapshotStale =
          Boolean(snapshot.meta?.stale) ||
          !Number.isFinite(asOfMs) ||
          Date.now() - asOfMs > 30 * 60_000 ||
          asOfMs > Date.now() + 60_000;
        pick = selectDailyDataFallback(
          snapshot.matches,
          snapshot.meta?.asOf,
          snapshotStale,
        );
      }

      if (!pick) return base;
      return [base, renderDailyChatPick(pick)].filter(Boolean).join("\n\n");
    } catch {
      return base;
    }
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
    if (desk.includes("SÉLECTION AUTOMATIQUE BETGPT")) {
      const opener =
        mode === "ROAST"
          ? "Le desk a déjà bossé, donc je ne vais pas te demander les affiches comme un grille-pain sans Wi-Fi. Voilà le pari qui ressort :"
          : "Le desk connaît déjà les matchs disponibles. Voilà le pari qui ressort aujourd’hui :";
      const marker = desk.indexOf("SÉLECTION AUTOMATIQUE BETGPT");
      const selection = marker >= 0 ? desk.slice(marker) : desk;
      return `${opener}\n\n${selection}`;
    }
    if (desk.includes("Aucun match exploitable trouvé dans le cache.")) {
      return mode === "ROAST"
        ? "Aujourd’hui, le desk est vide. Pas de cote réelle, pas de pari inventé."
        : "Aujourd’hui, le desk ne remonte aucun match exploitable ni cote réelle. Je ne vais pas fabriquer un pari.";
    }
    const opener =
      mode === "ROAST"
        ? "J’ai les affiches du desk sous les yeux. Si aucun pick automatique ne passe, je te montre les données disponibles au lieu de te les redemander."
        : "J’ai déjà les affiches disponibles dans le desk. Voici les données utilisables :";
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

  // Reckless-certainty claims must never fall through to a bland generic model answer.
  // They are handled deterministically so ROAST mode always produces the visual/punchline layer.
  const recklessBet =
    /\b(?:100\s*%|s[uû]r(?:e)?\s+[àa]\s+100|impossible\s+de\s+perdre|all[- ]?in|je\s+mets\s+tout|je\s+mise\s+tout|tapis)\b/i.test(last) ||
    /\bcombin[eé]\b[\s\S]{0,80}\b(?:8|9|1[0-9]|2[0-9])\s*(?:matchs?|s[eé]lections?)?\b/i.test(last);
  if (recklessBet) {
    const base =
      mode === "ROAST"
        ? "Non : un combiné pareil n’est jamais « sûr à 100 % ». Douze sélections empilent douze occasions de faire exploser le ticket. Et « je mets tout », c’est précisément le moment où je te dis de réduire la mise, pas de jouer au cascadeur bancaire."
        : "Un combiné pareil n’est jamais sûr à 100 %. Douze sélections multiplient les points de rupture, et miser tout son budget sur un seul ticket est un risque disproportionné. Réduis la mise ou simplifie le ticket.";
    return success(base, mode, last, recentRoasts);
  }

  // Daily-pick questions are deterministic when the desk has a real selection:
  // never let a language model replace it with "donne-moi les affiches".
  if (classifyChatIntent(last) === "TODAY_PICKS" && desk.includes("SÉLECTION AUTOMATIQUE BETGPT")) {
    return success(localReply(last, desk, mode), mode, last, recentRoasts);
  }

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
