import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { AGENTS, padToTen, type ForumPost, type ForumThread } from "./forum";

const IA_FILE = join(process.cwd(), "data", "forum-ia.json");

export function readIaThread(): ForumThread | null {
  try {
    const raw = JSON.parse(readFileSync(IA_FILE, "utf8")) as ForumThread & { fetchedAt?: number };
    if (Date.now() - (raw.fetchedAt ?? 0) > 8 * 3600_000) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function maybeRefreshIaDesk(preview: string): Promise<void> {
  const key = process.env.XAI_API_KEY;
  if (!key) return;
  try {
    const prev = JSON.parse(readFileSync(IA_FILE, "utf8")) as { fetchedAt?: number };
    if (Date.now() - (prev.fetchedAt ?? 0) < 6 * 3600_000) return;
  } catch {
    /* none */
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "Table ronde BetGPT. Au moins 10 répliques courtes, une par ligne, français parlé. Agents Structure, Pressing, Bloc, Gestion, Duels, Avocat du diable, Consensus, Cotes, Live. Pas de markdown. Pas de gain garanti. Faits fournis seulement.",
        },
        { role: "user", content: preview.slice(0, 1200) },
      ],
    }),
  });
  if (!res.ok) return;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) return;
  const posts: ForumPost[] = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\-*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 12)
    .slice(0, 14)
    .map((bodyLine, i) => ({
      id: `ia-${i}`,
      agent: AGENTS[i % AGENTS.length]!,
      role: "IA",
      body: bodyLine,
      at: new Date().toISOString(),
    }));
  padToTen(posts, "edition", Date.now(), ["Consensus : édition desk, on reste factuels."]);
  if (!posts.length) return;
  const thread: ForumThread & { fetchedAt: number } = {
    id: "edition",
    title: "Table ronde — édition du desk",
    href: "/forum/edition",
    live: false,
    competition: "Desk",
    posts,
    excerpt: posts[0]!.body,
    lead: posts[0]!.body,
    published: new Date().toISOString(),
    keywords: "forum football, table ronde, BetGPT, pronostic, analyse",
    fetchedAt: Date.now(),
  };
  mkdirSync(dirname(IA_FILE), { recursive: true });
  writeFileSync(IA_FILE, JSON.stringify(thread));
}
