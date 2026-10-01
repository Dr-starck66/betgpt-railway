import type { PunchlineMeta } from "./punch";

async function cacheKey(punchline: PunchlineMeta): Promise<string> {
  const input = `${punchline.style}:\n${punchline.text}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Premium-only voice policy:
 * - ElevenLabs or silence.
 * - Never fall back to browser speech synthesis: robotic TTS would break the product tone.
 * - Cached clips may still replay without a new paid request.
 */
export async function playPunchline(
  punchline: PunchlineMeta,
): Promise<"ELEVENLABS" | "UNAVAILABLE" | "BLOCKED"> {
  try {
    const key = await cacheKey(punchline);
    const cacheRequest = new Request(`/__betgpt_voice_cache__/${key}.mp3`);
    let response: Response | undefined;

    if ("caches" in window) {
      const cache = await caches.open("betgpt-punch-voice-v1");
      response = (await cache.match(cacheRequest)) ?? undefined;
      if (!response) {
        const fresh = await fetch("/api/punch-voice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(punchline),
        });
        if (!fresh.ok) return "UNAVAILABLE";
        response = fresh.clone();
        await cache.put(cacheRequest, fresh.clone());
      }
    } else {
      const fresh = await fetch("/api/punch-voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(punchline),
      });
      if (!fresh.ok) return "UNAVAILABLE";
      response = fresh;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1;
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });

    try {
      await audio.play();
      return "ELEVENLABS";
    } catch {
      URL.revokeObjectURL(url);
      return "BLOCKED";
    }
  } catch {
    return "UNAVAILABLE";
  }
}
