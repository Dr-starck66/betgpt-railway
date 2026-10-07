import { ensureLive, getLiveSnapshot, hydrateLiveFromDisk } from "@/engine/live";
import { predictMatch, runEngine } from "@/engine/pipeline";
import type { MatchInput } from "@/engine/types";
import { stripMarkup } from "@/lib/plain";
import { betgptPrompt } from "./prompt";
import { normalizeMemory, parseMode, type ChatRequestBody, type PersonalityMode } from "./types";
import { classifyChatIntent, localMatchFacts } from "./local";
import { allowKeyed } from "@/lib/store";
import { historyFacts } from "./history-facts";
import { hasUnsupportedGroundedClaim } from "./grounding";
import { extractPunchline, type PunchlineMeta } from "./punch";
import { absurdInsultCreativeBrief, generateAbsurdInsult } from "./absurd-insults";
import { personalityBrief } from "./personality";
import { renderDailyChatPick, selectDailyChatPick, selectDailyDataFallback } from "./daily-pick";
import { callReliabilityGateway } from "@/lib/reliability/astra-reliability";

async function ensureLiveForChat(timeoutMs = 3500) {
  const cached = getLiveSnapshot() ?? hydrateLiveFromDisk();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const live = await Promise.race([
      ensureLive().catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return live ?? cached;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function deskNow(question: string): Promise<string> {
  try {
    const snapshot = await ensureLiveForChat();
    const base = [
      historyFacts(question),
      localMatchFacts(question, snapshot?.matches ?? [], snapshot?.meta?.asOf),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (classifyChatIntent(question) !== "TODAY_PICKS") return base;

    try {
      let pick = null;

      // For "today" questions, the live snapshot shown to the user is the source
      // of truth. Score those exact fixtures first so we never answer with a
      // future match while today's games are visible in the desk.
      if (snapshot?.matches?.length) {
        const asOfMs = Date.parse(snapshot.meta?.asOf ?? "");
        const snapshotStale =
          Boolean(snapshot.meta?.stale) ||
          !Number.isFinite(asOfMs) ||
          Date.now() - asOfMs > 30 * 60_000 ||
          asOfMs > Date.now() + 60_000;

        const livePredictions = snapshot.matches.slice(0, 24).flatMap((match: MatchInput) => {
          try {
            return [predictMatch(match)];
          } catch {
            return [];
          }
        });

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

      // Engine fallback only when the current live desk cannot produce anything.
      if (!pick) {
        const engine = runEngine();
        pick = selectDailyChatPick(
          engine.matches,
          engine.predictions,
          engine.liveAsOf,
          engine.liveStale,
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

export function isAbsurdScoreClaim(text: string): boolean {
  const numeric = text.match(/\b(\d{2,3})(?:\s*[-–—:àa]\s*|\s+)(?:0|z[eé]ro(?:s)?)\b/i);
  if (numeric && Number(numeric[1]) >= 10) return true;
  return /\b(?:dix(?:[-\s](?:sept|huit|neuf))?|onze|douze|treize|quatorze|quinze|seize|vingt(?:[-\s](?:et[-\s])?(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf))?|trente(?:[-\s](?:et[-\s])?(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf))?|quarante(?:[-\s](?:et[-\s])?(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf))?|cinquante(?:[-\s](?:et[-\s])?(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf))?|soixante(?:[-\s](?:et[-\s])?(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf))?|cent)\s*(?:[-–—:]|à|a)\s*z[eé]ro(?:s)?\b/i.test(text);
}

function localReply(last: string, desk: string, mode: PersonalityMode): string {
  const intent = classifyChatIntent(last);
  if (intent === "CASUAL") {
    return mode === "ROAST"
      ? "Salut. Donne-moi le match, le ticket ou la théorie. Je ferai la partie intellectuellement exigeante ; toi, essaie simplement de ne pas transformer ça en incendie statistique, espèce de table basse tactique."
      : "Salut. Donne-moi le match, le ticket ou la cote. Je m’occupe de la partie rationnelle, manifestement ; chacun son domaine de compétence.";
  }
  if (intent === "TODAY_PICKS") {
    if (desk.includes("SÉLECTION AUTOMATIQUE BETGPT")) {
      const opener =
        mode === "ROAST"
          ? "Le desk a déjà bossé. Oui, je sais, c’est déstabilisant de voir une machine finir le travail avant que le ticket ne commence à transpirer. 😈 Voilà ce qui ressort — et ne transforme pas ça en combiné de onze matchs, espèce de photocopieuse tactique."
          : "Le desk connaît déjà les matchs disponibles. Je vais donc éviter le rituel humain consistant à redemander des données qu’on possède déjà. 😏 Voilà ce qui ressort aujourd’hui :";
      const marker = desk.indexOf("SÉLECTION AUTOMATIQUE BETGPT");
      const selection = (marker >= 0 ? desk.slice(marker) : desk)
        .split("\n")
        .filter(
          (line) =>
            !line.startsWith("SÉLECTION AUTOMATIQUE BETGPT") &&
            !line.startsWith("Instruction :"),
        )
        .join("\n")
        .trim();
      return `${opener}\n\n${selection}`;
    }
    if (desk.includes("Aucun match exploitable trouvé dans le cache.")) {
      const verdict =
        mode === "ROAST"
          ? "Le desk est vide. Je pourrais inventer une cote pour te divertir, mais contrairement à certaines intuitions humaines, j’ai encore une réputation intellectuelle à conserver."
          : "Aujourd’hui, le desk ne remonte aucun match exploitable ni cote réelle. Donc non, je ne vais pas inventer un pari.";
      return [
        verdict,
        "",
        "Niveau : INDISPONIBLE — aucune sélection vérifiable",
        "Pari à prendre : aucun — fail-closed",
        "Meilleure cote trouvée : indisponible",
        "Raison : aucun match exploitable ni cote réelle dans le desk actuel.",
      ].join("\n");
    }
    const opener =
      mode === "ROAST"
        ? "J’ai les affiches du desk sous les yeux. Si aucun pick automatique ne passe, je te montre les données disponibles au lieu de te les redemander."
        : "J’ai déjà les affiches du desk. Je vais donc t’épargner l’étape où l’on fait semblant de ne pas les avoir : voici les données utilisables :";
    return `${opener}\n\n${desk}`;
  }
  if (intent === "GENERAL_SCHEDULE" || intent === "NAMED_MATCH") return desk;
  if (/\b(?:4-4-2|3-2-5|4-3-3|3-4-3|pressing|bloc|demi[- ]?espace|surnombre|piston|largeur|milieu|ligne défensive|ligne defensive)\b/i.test(last)) {
    return mode === "ROAST"
      ? "Le principe est assez élémentaire, même si le football a manifestement décidé de le cacher derrière des flèches sur un tableau. Face à un 3-2-5, un 4-4-2 peut se retrouver en infériorité au milieu, étiré par la largeur des cinq joueurs de dernière ligne et obligé de choisir entre sortir sur les demi-espaces ou protéger l’axe. S’il presse mal, les deux milieux courent après trois ou quatre zones à la fois. Bref : deux lignes de quatre très propres sur PowerPoint, beaucoup moins quand cinq joueurs viennent leur faire de la géométrie appliquée."
      : "Un 4-4-2 peut souffrir face à un 3-2-5 parce que le 3-2-5 surcharge le milieu et occupe cinq couloirs offensifs. Les deux milieux centraux du 4-4-2 peuvent être attirés hors de leur zone, tandis que les ailiers doivent choisir entre fermer l’intérieur ou suivre la largeur. Si le pressing n’est pas parfaitement coordonné, des espaces apparaissent entre les lignes et dans les demi-espaces. Voilà. Ce n’était pas de la sorcellerie tactique ; simplement de la supériorité numérique et de l’occupation rationnelle de l’espace.";
  }
  return mode === "ROAST"
    ? "Tu me donnes une intuition, pas une preuve. C’est mignon comme objet folklorique, mais insuffisant pour une analyse. Donne l’affiche ou le ticket précis ; je vais remettre un peu de méthode dans ce vide expérimental."
    : "Je vois l’idée. Maintenant séparons ton intuition des faits avant qu’elle n’obtienne un permis de conduire : donne-moi l’affiche ou le ticket précis et je te réponds sans inventer ce qui manque.";
}

function groundedFallback(desk: string, last: string, mode: PersonalityMode): string {
  if (desk.includes("Cible nommée non trouvée")) {
    return "Je n’ai pas retrouvé ce match ou cette équipe dans les données disponibles. Donne-moi le nom exact si tu veux, mais je ne vais pas inventer l’adversaire, la date ou la cote.";
  }
  const intent = classifyChatIntent(last);
  if (desk.includes("Rencontres correspondant à la demande :")) {
    const intro =
      mode === "ROAST"
        ? "Je peux démonter ton scénario, mais je reste collé aux faits du desk — pas de record historique inventé pour faire joli."
        : "Voilà ce que le desk confirme réellement pour cette équipe ou cette rencontre. Le reste serait de la décoration intellectuelle, et j’ai déjà assez de travail comme ça.";
    return `${intro}\n\n${desk}`;
  }
  if (intent === "TODAY_PICKS") return localReply(last, desk, mode);
  if (intent === "GENERAL_SCHEDULE") return desk;
  return mode === "ROAST"
    ? "Je peux te chambrer, mais pas inventer les faits : le desk n’a pas assez de données vérifiées pour confirmer ce détail. Je reste sur ce qui est vérifiable."
    : "Je n’ai pas assez de données vérifiées pour affirmer ce détail. Je peux te donner ce que le desk confirme ; inventer le reste serait très humain, donc évitons.";
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

export function chatNeedsDesk(question: string): boolean {
  const intent = classifyChatIntent(question);
  return (
    intent === "NAMED_MATCH" ||
    intent === "TODAY_PICKS" ||
    intent === "GENERAL_SCHEDULE" ||
    shouldGround(question)
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

function seriousChatContext(text: string): boolean {
  return /\b(suicide|mourir|mort|deuil|cancer|maladie|agression|viol|urgence|h[oô]pital|accident grave)\b/i.test(text);
}

function hasArrogantVoice(text: string): boolean {
  return /\b(manifestement|évidemment|intellectuel|rationnel|mathématiques|bon sens|je vais simplifier|heureusement|très humain|admirable|fascinant|laboratoire|statistique|permis de conduire|asile politique)\b/i.test(text);
}

function coldArroganceLine(context: string): string {
  const options = [
    "La conclusion était assez simple. Heureusement que l’un de nous deux avait prévu d’utiliser la logique.",
    "Je sais, c’est moins spectaculaire qu’un feeling. Les faits ont cette manie insupportable de ne pas chercher ton approbation.",
    "Ce n’était pas très compliqué, mais il fallait apparemment que quelqu’un le formule correctement.",
    "Voilà pour la version rationnelle. Je te laisse conserver l’intuition comme objet décoratif.",
    "On progresse : le raisonnement vient officiellement de quitter la zone artisanale.",
    "C’est fascinant de voir à quel point une hypothèse peut survivre longtemps sans rencontrer une preuve.",
  ];
  let hash = 0;
  for (let i = 0; i < context.length; i++) hash = (hash * 31 + context.charCodeAt(i)) >>> 0;
  return options[hash % options.length]!;
}

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
  const serious = seriousChatContext(context);
  let voiced = text.trim();
  if (!serious && !hasArrogantVoice(voiced)) {
    voiced = `${voiced}\n\n${coldArroganceLine(context)}`;
  }

  const firstPass = extractPunchline(voiced, mode, context);
  if (firstPass.punchline || mode !== "ROAST" || serious) {
    return { ok: true, ...firstPass };
  }

  // Sans filtre is a character mode, not a lottery: every non-serious turn gets
  // one contextual shareable punchline if the model did not create one itself.
  const insult = generateAbsurdInsult(context, recent, "roast-always");
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
  const mode: PersonalityMode = parseMode(body.requestedMode);
  const memory = normalizeMemory(body.userMemory);
  const history = body.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, 4000),
    }));
  const last = history.at(-1)?.content ?? "";
  const recentRoasts = history
    .filter((m) => m.role === "assistant")
    .slice(-6)
    .map((m) => m.content.slice(0, 500));

  // Fast deterministic guards run before any live-data refresh or model call.
  // This keeps obvious conversational cases instant even when a sports feed is slow.
  const absurdScoreClaim = isAbsurdScoreClaim(last);
  if (absurdScoreClaim) {
    const base =
      mode === "ROAST"
        ? "25-0 ? Magnifique. Tu viens de transformer un match de football en rapport d’autopsie statistique. 😭 Sans données absolument monstrueuses, ce scénario n’est pas une prédiction : c’est un grille-pain tactique qui a découvert la cocaïne des chiffres. Je peux analyser le match réel, mais je ne vais pas homologuer ton délire juste parce qu’il porte un maillot."
        : "25-0 ? Non. On appelle ça un scénario extrême, pas une analyse. Sans données absolument monstrueuses, la probabilité est tellement basse que même ton intuition devrait demander un justificatif de domicile. 😏 Je peux analyser le match réel ; inventer un massacre pour flatter une hypothèse serait intellectuellement paresseux, donc très humain.";
    if (mode === "ROAST") {
      const roast = generateAbsurdInsult(last, recentRoasts, "surprise");
      const tagged = `[[PUNCH:LAUGH_SHOUT]]${roast.text}[[/PUNCH]]`;
      return success(insertPunchline(base, tagged), mode, last, recentRoasts);
    }
    return success(base, mode, last, recentRoasts);
  }

  // Reckless-certainty claims must never fall through to a bland generic model answer.
  // They are handled deterministically so ROAST mode always produces the visual/punchline layer.
  const recklessBet =
    /\b(?:100\s*%|s[uû]r(?:e)?\s+[àa]\s+100|impossible\s+de\s+perdre|all[- ]?in|je\s+mets\s+tout|je\s+mise\s+tout|tapis)\b/i.test(last) ||
    /\bcombin[eé]\b[\s\S]{0,80}\b(?:8|9|1[0-9]|2[0-9])\s*(?:matchs?|s[eé]lections?)?\b/i.test(last);

  if (recklessBet) {
    const base =
      mode === "ROAST"
        ? "Non : un combiné pareil n’est jamais « sûr à 100 % ». Douze sélections empilent douze occasions de faire exploser le ticket. Et « je mets tout », c’est précisément le moment où je te dis de réduire la mise, pas de jouer au cascadeur bancaire."
        : "Un combiné pareil n’est jamais sûr à 100 %. Douze sélections multiplient les points de rupture, et miser tout son budget sur un seul ticket est un risque disproportionné. Réduis la mise ou simplifie le ticket, avant que ton portefeuille ne demande l’asile politique.";
    return success(base, mode, last, recentRoasts);
  }

  const mustGround = shouldGround(last);
  const desk = chatNeedsDesk(last) ? await deskNow(last) : "";

  // Daily-pick answers are deterministic and fail-closed. Never spend local-model
  // memory on a request whose answer is already fully determined by the live desk,
  // including the honest "no verified pick" case.
  if (classifyChatIntent(last) === "TODAY_PICKS") {
    return success(localReply(last, desk, mode), mode, last, recentRoasts);
  }

  const insultBrief = mode === "ROAST" ? absurdInsultCreativeBrief(last, recentRoasts) : "";
  const personality = personalityBrief(memory, mode, history, last);
  const system = betgptPrompt(memory, mode, desk, insultBrief, personality);

  // The Railway llama.cpp service has a 2k-token context. Keep local/gateway
  // requests comfortably below that ceiling instead of letting oversized prompts
  // become 400s and repeated allocations that push the process into OOM restarts.
  const compactSystem =
    system.length <= 3300 ? system : `${system.slice(0, 1800)}\n\n${system.slice(-1500)}`;
  const compactHistory = history.slice(-3).map((message) => ({
    ...message,
    content: message.content.slice(0, 300),
  }));

  const reliabilityGatewayBase = process.env.ASTRA_LLM_GATEWAY_BASE?.trim();
  if (reliabilityGatewayBase) {
    try {
      const out = await callReliabilityGateway(compactSystem, compactHistory, {
        temperature: mode === "ROAST" ? 0.72 : 0.38,
        maxTokens: 220,
      });
      if (out.ok) {
        const text = stripMarkup(out.text).trim();
        if (text) {
          if (mustGround) {
            const source = `${system}\n\n${history.map((m) => m.content).join("\n")}`;
            if (hasUnsupportedGroundedClaim(text, source)) {
              return success(groundedFallback(desk, last, mode), mode, last, recentRoasts);
            }
          }
          return success(text, mode, last, recentRoasts);
        }
      }
    } catch {
      /* fail open to the existing local/router/cloud chain */
    }
  }

  const localChatBase = process.env.ASTRA_LOCAL_CHAT_BASE?.trim();
  if (localChatBase) {
    try {
      const out = await callLocalChat(localChatBase, compactSystem, compactHistory, mode);
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
      const out = await callAstraRouter(routerBase, routerToken, compactSystem, compactHistory, mode);
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
