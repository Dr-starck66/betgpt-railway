import { completeChat } from "./complete";
import type { ChatRequestBody } from "./types";
import { chatBodySchema } from "@/lib/schemas";

export async function handleChatRequest(request: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536)
      return Response.json({ error: "Message trop volumineux." }, { status: 413 });
    const parsed = chatBodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user")
      return Response.json(
        { error: "Message invalide (1 à 4 000 caractères, 12 messages maximum)." },
        { status: 400 },
      );
    body = parsed.data as ChatRequestBody;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const out = await completeChat(body);
  if (!out.ok) {
    const status = out.error.includes("Trop de messages")
      ? 429
      : out.error.includes("indisponible")
        ? 503
        : 502;
    return Response.json({ error: out.error }, { status });
  }
  return Response.json({ text: out.text }, { headers: { "cache-control": "no-store" } });
}
