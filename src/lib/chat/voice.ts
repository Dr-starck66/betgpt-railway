import type { PunchlineMeta } from "./punch";

async function cacheKey(punchline: PunchlineMeta): Promise<string> {
  const input = `${punchline.style}:\n${punchline.text}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function browserVoice(punchline: PunchlineMeta): "BROWSER" | "UNAVAILABLE" {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return "UNAVAILABLE";
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(punchline.text);
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((voice) => /^fr[-_]/i.test(voice.lang) && /google|microsoft|natural|premium|neural/i.test(voice.name)) ??
      voices.find((voice) => /^fr[-_]/i.test(voice.lang)) ??
      voices.find((voice) => /fr/i.test(voice.lang));

    if (preferred) utterance.voice = preferred;
    utterance.lang = preferred?.lang || "fr-FR";
    utterance.volume = 1;
    utterance.rate = punchline.style === "LAUGH_SHOUT" ? 1.18 : 1.12;
    utterance.pitch = punchline.style === "ANGRY_SHOUT" ? 0.92 : 1.04;
    window.speechSynthesis.speak(utterance);
    return "BROWSER";
  } catch {
    return "UNAVAILABLE";
  }
}

/**
 * Voice policy:
 * - Prefer ElevenLabs when configured.
 * - Fall back to the browser's built-in French speech synthesis at zero cost.
 * - Never surface a 5xx to the chat solely because premium TTS is unavailable.
 * - Cached ElevenLabs clips still replay without a new paid request.
 */
export async function playPunchline(
  punchline: PunchlineMeta,
): Promise<"ELEVENLABS" | "BROWSER" | "UNAVAILABLE" | "BLOCKED"> {
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

        if (fresh.status === 204 || fresh.headers.get("x-betgpt-voice-provider") === "browser-fallback") {
          return browserVoice(punchline);
        }
        if (!fresh.ok) return browserVoice(punchline);

        response = fresh.clone();
        await cache.put(cacheRequest, fresh.clone());
      }
    } else {
      const fresh = await fetch("/api/punch-voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(punchline),
      });

      if (fresh.status === 204 || fresh.headers.get("x-betgpt-voice-provider") === "browser-fallback") {
        return browserVoice(punchline);
      }
      if (!fresh.ok) return browserVoice(punchline);
      response = fresh;
    }

    const blob = await response.blob();
    if (!blob.size) return browserVoice(punchline);

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
      const fallback = browserVoice(punchline);
      return fallback === "BROWSER" ? "BROWSER" : "BLOCKED";
    }
  } catch {
    return browserVoice(punchline);
  }
}
