import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SITE_URL } from "@/lib/seo";
import { fmtOdds } from "@/lib/utils";
import { skipEuropeFrenchProno } from "./french-clubs";

const FILE = join(process.cwd(), "data", "prediction-hook.json");
const DEFAULT_URL = "http://127.0.0.1:8787/prediction";
const inflight = new Set<string>();

type Store = {
  url: string;
  sent: string[];
  downUntil?: number;
  last?: {
    at: string;
    url: string;
    status: number | null;
    ok: boolean;
    response: string;
    jobId: string | null;
    payload: Payload;
  };
};

export type Payload = {
  event: "prediction.created";
  source: "betgpt";
  id: string;
  matchId: string;
  home: string;
  away: string;
  league: string;
  competition: string;
  kickoff: string;
  market: string;
  label: string;
  odds: number;
  book: string;
  prob: number;
  edge: number;
  ev: number;
  premium: boolean;
  cover: { label: string; odds: number } | null;
  matchUrl: string;
  pageUrl: string;
  text: string;
};

function load(): Store {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    return {
      url: typeof s.url === "string" && s.url ? s.url : DEFAULT_URL,
      sent: Array.isArray(s.sent) ? s.sent.slice(-400) : [],
      downUntil: typeof s.downUntil === "number" ? s.downUntil : 0,
      last: s.last,
    };
  } catch {
    return { url: DEFAULT_URL, sent: [] };
  }
}

function save(s: Store): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify({ url: s.url, sent: s.sent.slice(-400), downUntil: s.downUntil ?? 0, last: s.last }, null, 2));
  } catch (err) {
    console.error("[BETGPT WEBHOOK] FAILED: persist", err instanceof Error ? err.message : err);
  }
}

export function predictionHookUrl(): string {
  return load().url || DEFAULT_URL;
}

export function setPredictionHookUrl(url: string): string {
  const s = load();
  const t = url.trim();
  if (!t) {
    s.url = DEFAULT_URL;
    save(s);
    return s.url;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return s.url;
    s.url = u.toString().slice(0, 500);
    save(s);
    return s.url;
  } catch {
    return s.url;
  }
}

function jobIdOf(raw: string): string | null {
  try {
    const j = JSON.parse(raw) as { id?: string; jobId?: string; job_id?: string };
    return j.id || j.jobId || j.job_id || null;
  } catch {
    return null;
  }
}

async function postOne(url: string, body: Payload): Promise<{ ok: boolean; status: number | null; response: string }> {
  console.log("[BETGPT WEBHOOK] prediction.created", `${body.home} – ${body.away}`, body.label, body.odds);
  console.log("[BETGPT WEBHOOK] POST ->", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(700),
    });
    const response = await res.text().catch(() => "");
    const ok = res.ok || res.status === 204;
    if (ok) console.log("[BETGPT WEBHOOK] SUCCESS", res.status, response.slice(0, 300));
    else console.error("[BETGPT WEBHOOK] FAILED:", res.status, response.slice(0, 300));
    return { ok, status: res.status, response };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BETGPT WEBHOOK] FAILED:", msg);
    return { ok: false, status: null, response: msg };
  }
}

export async function pushNewPredictions(desk: {
  predictions: {
    matchId: string;
    kickoff: string;
    league: string;
    competition: string;
    home: { name: string };
    away: { name: string };
    markets: {
      market: string;
      label: string;
      decision: string;
      bestOdds: number;
      bestBook: string;
      modelProb: number;
      edge: number;
      ev: number;
      premium: boolean;
      cover?: { label: string; odds: number };
    }[];
  }[];
  matches: { id: string; slug?: string; status?: string }[];
}): Promise<void> {
  try {
    const s = load();
    if ((s.downUntil ?? 0) > Date.now()) return;
    const url = s.url || DEFAULT_URL;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const sent = new Set(s.sent);
    const fresh: Payload[] = [];

    for (const p of desk.predictions) {
      if (skipEuropeFrenchProno(p as never)) continue;
      const match = desk.matches.find((m) => m.id === p.matchId);
      if (match?.status === "finished") continue;
      const day = new Date(p.kickoff).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
      if (day !== today && match?.status !== "live") continue;
      const m = p.markets.find((x) => x.decision === "BET");
      if (!m) continue;
      const id = `${p.matchId}:${m.market}:${m.bestOdds.toFixed(2)}`;
      if (sent.has(id) || inflight.has(id)) continue;
      const matchUrl = `${SITE_URL}/match/${match?.slug ?? p.matchId}`;
      const book = m.bestBook.replace(/\s·\s.*$/, "");
      fresh.push({
        event: "prediction.created",
        source: "betgpt",
        id,
        matchId: p.matchId,
        home: p.home.name,
        away: p.away.name,
        league: p.league,
        competition: p.competition,
        kickoff: p.kickoff,
        market: m.market,
        label: m.label,
        odds: m.bestOdds,
        book,
        prob: m.modelProb,
        edge: m.edge,
        ev: m.ev,
        premium: m.premium,
        cover: m.cover ? { label: m.cover.label, odds: m.cover.odds } : null,
        matchUrl,
        pageUrl: `${SITE_URL}/opportunities`,
        text: `${p.home.name} – ${p.away.name}\n${m.label} · ${fmtOdds(m.bestOdds)} chez ${book}\n${matchUrl}\n18+ · Jouer comporte des risques.`,
      });
    }

    if (!fresh.length) return;

    for (const body of fresh) inflight.add(body.id);
    try {
      for (const body of fresh) {
        const result = await postOne(url, body);
        s.last = {
          at: new Date().toISOString(),
          url,
          status: result.status,
          ok: result.ok,
          response: result.response.slice(0, 500),
          jobId: jobIdOf(result.response),
          payload: body,
        };
        if (result.ok) s.sent.push(body.id);
        else {
          s.downUntil = Date.now() + 15 * 60 * 1000;
          save(s);
          break;
        }
        save(s);
      }
    } finally {
      for (const body of fresh) inflight.delete(body.id);
    }
  } catch (err) {
    console.error("[BETGPT WEBHOOK] FAILED:", err instanceof Error ? err.message : err);
  }
}
