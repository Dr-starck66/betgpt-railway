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

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function dateKey(now = new Date()): { day: string; month: string } {
  const iso = now.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as
    | { text?: unknown; style?: unknown; score?: unknown }
    | null;

  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  const words = text.split(/\s+/).filter(Boolean).length;
  const score = typeof body?.score === "number" && Number.isFinite(body.score) ? body.score : 0;
  const minScore = envInt("BETGPT_TTS_MIN_SCORE", 86, 70, 100);
  const maxChars = envInt("BETGPT_TTS_MAX_CHARS", 180, 60, 220);
  const maxWords = envInt("BETGPT_TTS_MAX_WORDS", 26, 8, 40);

  // Premium voice is only for one exceptional, very short punchline.
  if (text.length < 8 || text.length > maxChars || words > maxWords || score < minScore) {
    return Response.json({ error: "Punchline non éligible à la voix premium." }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId || process.env.BETGPT_TTS_ENABLED === "0") {
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        "x-betgpt-voice-provider": "browser-fallback",
      },
    });
  }

  const { day, month } = dateKey();
  const perMinute = envInt("BETGPT_TTS_PER_MINUTE", 12, 1, 120);
  const dailyClips = envInt("BETGPT_TTS_DAILY_CLIPS", 120, 1, 10000);
  const monthlyClips = envInt("BETGPT_TTS_MONTHLY_CLIPS", 1500, 1, 100000);

  // Conservative hard budget gate. Failed upstream calls still consume a slot,
  // which guarantees spend cannot exceed the configured ceiling.
  if (!(await allowKeyed(`chat:punch-tts:month:${month}`, monthlyClips, 35 * 24 * 60 * 60_000))) {
    return Response.json({ error: "Budget voix mensuel atteint." }, { status: 429 });
  }
  if (!(await allowKeyed(`chat:punch-tts:day:${day}`, dailyClips, 26 * 60 * 60_000))) {
    return Response.json({ error: "Budget voix quotidien atteint." }, { status: 429 });
  }
  if (!(await allowKeyed("chat:punch-tts:minute", perMinute, 60_000))) {
    return Response.json({ error: "Budget voix temporairement atteint." }, { status: 429 });
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
      return new Response(null, {
        status: 204,
        headers: {
          "cache-control": "no-store",
          "x-betgpt-voice-provider": "browser-fallback",
        },
      });
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
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        "x-betgpt-voice-provider": "browser-fallback",
      },
    });
  } finally {
    clearTimeout(timer);
  }
});
