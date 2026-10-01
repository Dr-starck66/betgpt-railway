import { defineEventHandler, readBody } from "h3";
import { allowKeyed } from "../../src/lib/store";

type VoiceStyle = "SHOUT" | "LAUGH_SHOUT" | "ANGRY_SHOUT";

const STYLE_TAGS: Record<VoiceStyle, string> = {
  SHOUT: "[shouts, booming, explosive, comedic]",
  LAUGH_SHOUT: "[laughs] [shouts, delighted, explosive, comedic]",
  ANGRY_SHOUT: "[angry] [shouts, booming, exasperated, comedic]",
};

function parseStyle(raw: unknown): VoiceStyle {
  return raw === "LAUGH_SHOUT" || raw === "ANGRY_SHOUT" ? raw : "SHOUT";
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as
    | { text?: unknown; style?: unknown; score?: unknown }
    | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (text.length < 8 || text.length > 220) {
    return Response.json({ error: "Punchline invalide." }, { status: 400 });
  }

  // Hard cost gate: one short clip only, globally rate-limited.
  if (!(await allowKeyed("chat:punch-tts", 24, 60_000))) {
    return Response.json({ error: "Budget voix temporairement atteint." }, { status: 429 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId || process.env.BETGPT_TTS_ENABLED === "0") {
    return Response.json({ error: "Voix premium non configurée." }, { status: 503 });
  }

  const style = parseStyle(body?.style);
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_v4";
  const scripted = `${STYLE_TAGS[style]} ${text}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: scripted,
          model_id: modelId,
        }),
      },
    );

    if (!upstream.ok) {
      return Response.json(
        { error: "Voix premium indisponible." },
        { status: upstream.status >= 500 ? 502 : 503 },
      );
    }

    const audio = await upstream.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "audio/mpeg",
        "cache-control": "private, max-age=31536000, immutable",
        "x-betgpt-voice-provider": "elevenlabs",
      },
    });
  } catch {
    return Response.json({ error: "Voix premium indisponible." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
});
