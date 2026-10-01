export type ShareMoment = {
  title: string;
  text: string;
  url: string;
};

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildChallengeUrl(
  origin: string,
  prompt: string,
  source = "share",
): string {
  const base = origin.replace(/\/+$/, "");
  const q = clean(prompt, 500);
  const params = new URLSearchParams({ q, roast: "1", share_source: clean(source, 24) || "share" });
  return `${base}/chat?${params.toString()}`;
}

export function buildShareMoment(
  origin: string,
  prompt: string,
  punchline: string,
): ShareMoment {
  const punch = clean(punchline, 220);
  const url = buildChallengeUrl(origin, prompt, "native");
  return {
    title: "BetGPT a détruit mon pari 😂",
    text: `BetGPT vient de me sortir : « ${punch} »\n\nEssaie avec ton propre ticket 👇`,
    url,
  };
}

export function buildXShareUrl(moment: ShareMoment): string {
  const url = new URL(moment.url);
  url.searchParams.set("share_source", "x");
  const params = new URLSearchParams({
    text: `${moment.text}\n\n${url.toString()}`,
  });
  return `https://x.com/intent/post?${params.toString()}`;
}

export function buildFacebookShareUrl(moment: ShareMoment): string {
  const url = new URL(moment.url);
  url.searchParams.set("share_source", "facebook");
  const params = new URLSearchParams({ u: url.toString() });
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

export function drawShareCard(
  prompt: string,
  punchline: string,
  challengeUrl: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const ctx: CanvasRenderingContext2D = context;

  const cleanPrompt = clean(prompt, 180);
  const cleanPunch = clean(punchline, 260);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createRadialGradient(180, 160, 40, 180, 160, 720);
  gradient.addColorStop(0, "rgba(124,194,58,0.33)");
  gradient.addColorStop(1, "rgba(124,194,58,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7cc23a";
  ctx.font = "900 42px system-ui, sans-serif";
  ctx.fillText("BETGPT", 76, 100);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillText("LE ROAST DU JOUR", 76, 154);

  function wrap(text: string, maxWidth: number, font: string, lineHeight: number, y: number, color: string, maxLines: number) {
    ctx.font = font;
    ctx.fillStyle = color;
    const words = text.split(" ");
    let line = "";
    let lineIndex = 0;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 76, y + lineIndex * lineHeight);
        line = word;
        lineIndex += 1;
        if (lineIndex >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lineIndex < maxLines && line) ctx.fillText(line, 76, y + lineIndex * lineHeight);
    return y + (lineIndex + 1) * lineHeight;
  }

  let y = 270;
  y = wrap("« " + cleanPrompt + " »", 928, "700 40px system-ui, sans-serif", 54, y, "#cbd5e1", 4) + 44;
  y = wrap(cleanPunch, 928, "900 64px system-ui, sans-serif", 76, y, "#ffffff", 7) + 36;

  ctx.fillStyle = "#7cc23a";
  ctx.fillRect(76, Math.min(y, 1110), 928, 4);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("Tu crois faire mieux ? Viens te faire démonter 👇", 76, 1195);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText(clean(challengeUrl.replace(/^https?:\/\//, ""), 78), 76, 1250);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText("18+ · Joue responsablement", 76, 1302);

  return canvas;
}
