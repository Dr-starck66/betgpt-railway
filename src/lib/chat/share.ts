export type ShareMoment = {
  title: string;
  text: string;
  url: string;
};

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildChallengeUrl(origin: string, prompt: string): string {
  const base = origin.replace(/\/+$/, "");
  const q = clean(prompt, 500);
  const params = new URLSearchParams({ q, roast: "1" });
  return `${base}/chat?${params.toString()}`;
}

export function buildShareMoment(
  origin: string,
  prompt: string,
  punchline: string,
): ShareMoment {
  const q = clean(prompt, 500);
  const punch = clean(punchline, 220);
  const url = buildChallengeUrl(origin, q);
  return {
    title: "BetGPT a détruit mon pari 😂",
    text: `BetGPT vient de me sortir : « ${punch} »\n\nEssaie avec ton propre ticket 👇`,
    url,
  };
}
