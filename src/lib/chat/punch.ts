import type { PersonalityMode } from "./types";
import { reactionForPunchline, type PunchReaction } from "./reaction";

export type PunchVoiceStyle = "SHOUT" | "LAUGH_SHOUT" | "ANGRY_SHOUT";

export type PunchlineMeta = {
  text: string;
  score: number;
  style: PunchVoiceStyle;
  reaction: PunchReaction;
};

const TAGGED =
  /\[\[PUNCH(?::(SHOUT|LAUGH_SHOUT|ANGRY_SHOUT))?\]\]([\s\S]{1,280}?)\[\[\/PUNCH\]\]/i;

const ABSURD = [
  "grille-pain",
  "grille pain",
  "cosmique",
  "intersid",
  "quantique",
  "pigeon",
  "patate",
  "patates",
  "moonwalk",
  "tongs",
  "patinoire",
  "caf[eé]ine",
  "orbite",
  "nucl[eé]aire",
  "satellite",
  "fus[eé]e",
  "hamster",
  "cornichon",
  "clown",
  "marmotte",
  "licorne",
];

function cleanPunch(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function scoreSentence(sentence: string): number {
  const s = sentence.trim();
  if (s.length < 12 || s.length > 220) return 0;
  let score = 0;
  if (/[!?]{2,}/.test(s)) score += 24;
  else if (/[!?]/.test(s)) score += 10;
  const letters = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  const uppers = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, "");
  if (letters.length >= 8 && uppers.length / letters.length > 0.55) score += 20;
  if (/\b(mais|non|stop|attends|s[eé]rieux|quoi|fr[eè]re)\b/i.test(s)) score += 8;
  if (/\b(t['’]es|tu|ton|ta|tes)\b/i.test(s)) score += 6;
  for (const token of ABSURD) {
    if (new RegExp(token, "i").test(s)) score += 8;
  }
  if (/\b(esp[eè]ce de|sac [àa]|compl[eè]tement|bordel|dingue|lunaire)\b/i.test(s)) score += 14;
  if (s.length <= 130) score += 8;
  return Math.min(100, score);
}

function inferStyle(text: string): PunchVoiceStyle {
  if (/\b(non|stop|mais|bordel|dingue|compl[eè]tement)\b/i.test(text)) return "ANGRY_SHOUT";
  if (/\b(lol|mdr|haha|😂|🤣)\b/i.test(text)) return "LAUGH_SHOUT";
  return "SHOUT";
}

export function extractPunchline(
  rawText: string,
  mode: PersonalityMode,
  context = "",
): { text: string; punchline?: PunchlineMeta } {
  const tagged = rawText.match(TAGGED);
  if (tagged) {
    const text = cleanPunch(tagged[2] ?? "");
    const style = (tagged[1] as PunchVoiceStyle | undefined) ?? inferStyle(text);
    const clean = rawText.replace(TAGGED, text).replace(/\[\[\/?PUNCH[^\]]*\]\]/gi, "").trim();
    if (text.length >= 8) return { text: clean, punchline: { text, score: 100, style, reaction: reactionForPunchline(text, context) } };
    return { text: clean };
  }

  const clean = rawText.replace(/\[\[\/?PUNCH[^\]]*\]\]/gi, "").trim();
  if (mode !== "ROAST") return { text: clean };

  const candidates = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((text) => ({ text: cleanPunch(text), score: scoreSentence(text) }))
    .filter((item) => item.text.length >= 8)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 86) return { text: clean };
  return {
    text: clean,
    punchline: { text: best.text, score: best.score, style: inferStyle(best.text), reaction: reactionForPunchline(best.text, context) },
  };
}
