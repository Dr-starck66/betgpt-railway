import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fmtOdds, fmtPct } from "@/lib/utils";
import { loadAdmin } from "./admin";
import type { MarketQuote, PredictionRecord } from "./types";

export type Digest = {
  date: string;
  subject: string;
  text: string;
  html: string;
  sent: boolean;
  to: string[];
};

const DIR = join(process.cwd(), "data", "digests");

function dayStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function latestDigest(): Digest | null {
  try {
    return JSON.parse(readFileSync(join(DIR, `${dayStamp()}.json`), "utf8")) as Digest;
  } catch {
    return null;
  }
}

export function buildDigest(
  daily: { prediction: PredictionRecord; market: MarketQuote } | null,
  bets: { p: PredictionRecord; m: MarketQuote }[],
): Digest {
  const date = dayStamp();
  const lines: string[] = [];
  lines.push(`BetGPT — ${date}`);
  lines.push("");
  if (daily) {
    lines.push("Opportunité du jour");
    lines.push(`${daily.prediction.home.name} – ${daily.prediction.away.name}`);
    lines.push(`${daily.market.label} @ ${fmtOdds(daily.market.bestOdds)} chez ${daily.market.bestBook}`);
    lines.push(`On estime ${Math.round(daily.market.modelProb * 100)} chances sur 100. Mise ${fmtPct(daily.market.stakePct)}.`);
    lines.push("");
  } else {
    lines.push("Aucune mise du jour. On passe.");
    lines.push("");
  }
  if (bets.length) {
    lines.push("Ticket");
    for (const x of bets.slice(0, 8)) {
      lines.push(
        `- ${x.p.home.name} – ${x.p.away.name} · ${x.m.label} @ ${fmtOdds(x.m.bestOdds)} · ${x.m.bestBook}`,
      );
    }
  }
  lines.push("");
  const text = lines.join("\n");
  const html = `<pre style="font-family:IBM Plex Sans,sans-serif;color:#121612;background:#fff;padding:24px">${text.replace(/</g, "<")}</pre>`;
  return {
    date,
    subject: daily
      ? `BetGPT · ${daily.prediction.home.short}–${daily.prediction.away.short} ${daily.market.label}`
      : `BetGPT · pas de mise ${date}`,
    text,
    html,
    sent: false,
    to: loadAdmin().emailTo,
  };
}

export async function publishDigest(digest: Digest): Promise<Digest> {
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, `${digest.date}.json`);
  let existing: Digest | null = null;
  try {
    existing = JSON.parse(readFileSync(file, "utf8")) as Digest;
  } catch {
    existing = null;
  }
  if (existing?.sent) return existing;

  const admin = loadAdmin();
  let sent = false;
  const key = process.env.RESEND_API_KEY;
  if (admin.emailEnabled && key && admin.emailTo.length) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BetGPT <betgpt@updates.local>",
          to: admin.emailTo,
          subject: digest.subject,
          text: digest.text,
        }),
      });
      sent = res.ok;
    } catch {
      sent = false;
    }
  }
  const out = { ...digest, sent, to: admin.emailTo };
  writeFileSync(file, JSON.stringify(out, null, 2));
  return out;
}
