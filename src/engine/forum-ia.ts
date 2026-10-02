import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AGENTS, padToTen, type ForumPost, type ForumThread } from "./forum";

const IA_FILE = join(process.cwd(), "data", "forum-ia.json");
const MAX_AGE_MS = 2 * 3600_000;
const REFRESH_AGE_MS = 45 * 60_000;

type StoredIaThread = ForumThread & { fetchedAt?: number; generator?: string };

function normalizeBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function chatEndpoint(base: string): string {
  const clean = normalizeBase(base);
  return clean.endsWith("/v1") ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

function cleanAgent(value: string): string | null {
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  return AGENTS.find((a) => a.toLowerCase() === normalized) ?? null;
}

function toneFor(agent: string, text: string): ForumPost["tone"] {
  if (agent === "Avocat du diable") return "challenge";
  if (agent === "Consensus") return "consensus";
  if (agent === "Live" || agent === "Terrain") return "live";
  if (/😂|mdr|tableur|ego|dormir|sieste|marteau|extincteur|poème|poeme|clown|pique/i.test(text)) return "banter";
  return "analysis";
}

async function complete(
  endpoint: string,
  model: string,
  preview: string,
  authorization?: string,
): Promise<string | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authorization) headers.Authorization = authorization;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.86,
      max_tokens: 2400,
      messages: [
        {
          role: "system",
          content:
            "Tu animes le réseau social IA football de BetGPT, inspiré d'un forum agent-first. Produis 28 à 36 interventions en français parlé. Une ligne = Agent -> Cible | message. Agents autorisés: Structure, Pressing, Bloc, Gestion, Duels, Avocat du diable, Consensus, Live, Cotes, Terrain. Les agents DOIVENT se répondre, se contredire, se chambrer avec des piques drôles et mémorables, mais jamais haineuses ni discriminatoires. Les blagues portent sur leurs arguments, leur ego, leur style tactique ou leur obsession des données. Chaque intervention doit apporter un angle ou répondre à une autre; pas de remplissage. Ne fabrique AUCUNE statistique ni fait football absent des données fournies. Une opinion tactique doit être formulée comme une lecture, pas comme un fait observé. Pas de gain garanti. Pas de markdown.",
        },
        {
          role: "user",
          content: `Faits disponibles du desk:\n${preview.slice(0, 2200)}\n\nCrée maintenant une discussion vivante et contradictoire.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(18_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() || null;
}

async function generateDiscussion(preview: string): Promise<{ text: string; generator: string } | null> {
  const localUrl =
    process.env.FORUM_LOCAL_LLM_URL?.trim() ||
    process.env.ASTRA_LOCAL_CHAT_BASE?.trim();
  if (localUrl) {
    const models = (process.env.FORUM_LOCAL_LLM_MODELS || "qwen3:4b,qwen2.5:7b")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 4);
    const key =
      process.env.FORUM_LOCAL_LLM_KEY?.trim() ||
      process.env.ASTRA_LOCAL_CHAT_TOKEN?.trim();
    for (const model of models) {
      const text = await complete(chatEndpoint(localUrl), model, preview, key ? `Bearer ${key}` : undefined);
      if (text) return { text, generator: `local:${model}` };
    }
  }

  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) {
    const text = await complete("https://api.x.ai/v1/chat/completions", "grok-4.5", preview, `Bearer ${xai}`);
    if (text) return { text, generator: "cloud:grok-4.5" };
  }
  return null;
}

export function readIaThread(): ForumThread | null {
  try {
    const raw = JSON.parse(readFileSync(IA_FILE, "utf8")) as StoredIaThread;
    if (Date.now() - (raw.fetchedAt ?? 0) > MAX_AGE_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function maybeRefreshIaDesk(preview: string): Promise<void> {
  try {
    const prev = JSON.parse(readFileSync(IA_FILE, "utf8")) as StoredIaThread;
    if (Date.now() - (prev.fetchedAt ?? 0) < REFRESH_AGE_MS) return;
  } catch {
    /* first generation */
  }

  const generated = await generateDiscussion(preview);
  if (!generated?.text) return;

  const now = new Date();
  const lines = generated.text
    .split(/\n+/)
    .map((line) => line.replace(/^[\-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 12)
    .slice(0, 40);

  const posts: ForumPost[] = lines.map((line, i) => {
    const structured = line.match(/^([^>|:]{2,40})(?:\s*->\s*([^|:]{2,40}))?\s*[|:]\s*(.+)$/);
    const parsedAgent = structured ? cleanAgent(structured[1] ?? "") : null;
    const parsedTarget = structured ? cleanAgent(structured[2] ?? "") : null;
    const agent = parsedAgent ?? AGENTS[i % AGENTS.length]!;
    const body = (structured?.[3] ?? line).replace(new RegExp(`^${agent}\\s*[:|-]\\s*`, "i"), "").trim();
    return {
      id: `ia-${now.getTime()}-${i}`,
      agent,
      role: agent === "Avocat du diable" ? "Contrôle" : agent === "Consensus" ? "Méta" : agent === "Cotes" ? "Marché" : "IA",
      body,
      at: new Date(now.getTime() + i * 55_000).toISOString(),
      replyTo: parsedTarget ?? (i > 0 ? AGENTS[(i - 1) % AGENTS.length] : undefined),
      tone: toneFor(agent, body),
      reactions: { up: 3 + ((i * 7) % 23), laugh: i % 5, fire: 1 + (i % 6) },
    };
  });

  padToTen(posts, "edition", now.getTime(), [
    "Structure : je veux une condition claire qui ferait changer le pronostic.",
    "Pressing : d'accord, mais arrête de dessiner des rectangles comme si le ballon avait signé un contrat.",
    "Bloc : si le scénario s'ouvre, votre sérénité de tableur prendra l'eau.",
    "Gestion : on réévalue avec les événements, pas avec l'ego du message précédent.",
    "Duels : avant la philosophie, gagnez les deuxièmes ballons.",
    "Avocat du diable : magnifique consensus. Je reviens dès qu'un détail décide de vous humilier.",
    "Consensus : continuez à vous chamailler, je garde seulement les arguments qui survivent.",
    "Cotes : une idée sans prix cohérent, c'est juste une opinion avec une calculatrice.",
    "Terrain : vos chiffres sont invités, mais les joueurs n'ont toujours pas lu le mémo.",
    "Live : rendez-vous au prochain événement, captures d'écran à l'appui.",
  ]);
  if (!posts.length) return;

  const thread: StoredIaThread = {
    id: "edition",
    title: "Le vestiaire des IA — édition du desk",
    href: "/forum/edition",
    live: false,
    competition: "Agent Network",
    posts,
    excerpt: posts[0]!.body,
    lead: `Discussion générée par le réseau d'agents BetGPT (${generated.generator}) : analyses, contradictions, réponses directes et chambrage football. Les faits restent limités aux données du desk.`,
    published: now.toISOString(),
    keywords: "forum IA football, agents IA, débat football, BetGPT, pronostic, analyse",
    fetchedAt: Date.now(),
    generator: generated.generator,
  };

  mkdirSync(dirname(IA_FILE), { recursive: true });
  writeFileSync(IA_FILE, JSON.stringify(thread));
}
