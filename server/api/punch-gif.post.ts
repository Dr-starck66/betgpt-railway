import { defineEventHandler, readBody } from "h3";
import { allowKeyed } from "../../src/lib/store";

type TenorResult = {
  content_description?: string;
  media_formats?: Record<string, { url?: string }>;
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length > 2);
}

function scoreResult(result: TenorResult, query: string): number {
  const desc = new Set(tokens(result.content_description ?? ""));
  let score = 0;
  for (const token of tokens(query)) {
    if (desc.has(token)) score += 3;
  }
  if (/funny|reaction|shocked|chaos|laugh/i.test(result.content_description ?? "")) score += 2;
  return score;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.replace(/\s+/g, " ").trim() : "";
  if (query.length < 4 || query.length > 120) {
    return Response.json({ error: "Requête GIF invalide." }, { status: 400 });
  }

  const apiKey = process.env.TENOR_API_KEY?.trim();
  if (!apiKey || process.env.BETGPT_GIF_ENABLED === "0") {
    return Response.json({ error: "GIF premium non configuré." }, { status: 503 });
  }

  if (!(await allowKeyed("chat:punch-gif", 30, 60_000))) {
    return Response.json({ error: "Quota GIF temporairement atteint." }, { status: 429 });
  }

  const clientKey = process.env.TENOR_CLIENT_KEY?.trim() || "betgpt";
  const url = new URL("https://tenor.googleapis.com/v2/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("contentfilter", "medium");
  url.searchParams.set("media_filter", "gif,tinygif");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const upstream = await fetch(url, { signal: controller.signal });
    if (!upstream.ok) {
      return Response.json({ error: "GIF indisponible." }, { status: 503 });
    }

    const json = (await upstream.json().catch(() => ({}))) as { results?: TenorResult[] };
    const ranked = (json.results ?? [])
      .map((result) => ({ result, score: scoreResult(result, query) }))
      .filter(({ result }) => Boolean(result.media_formats?.gif?.url || result.media_formats?.tinygif?.url))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) return Response.json({ error: "Aucun GIF pertinent." }, { status: 404 });

    const mediaUrl =
      best.result.media_formats?.gif?.url ??
      best.result.media_formats?.tinygif?.url ??
      "";

    return Response.json(
      {
        url: mediaUrl,
        alt: (best.result.content_description || "Réaction BetGPT").slice(0, 140),
        provider: "tenor",
      },
      { headers: { "cache-control": "private, max-age=3600" } },
    );
  } catch {
    return Response.json({ error: "GIF indisponible." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
});
