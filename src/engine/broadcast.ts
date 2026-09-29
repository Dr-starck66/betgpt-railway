import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSharePosts, type ShareTicket } from "@/lib/share-copy";

const FILE = join(process.cwd(), "data", "broadcast.json");
const GAP_MS = 10 * 60 * 1000;

export type BroadcastJob = {
  id: string;
  text: string;
  title: string;
  dueAt: number;
  sentAt?: number;
  ok?: boolean;
  error?: string;
};

type Store = {
  webhook: string;
  on: boolean;
  fingerprint: string;
  jobs: BroadcastJob[];
};

function empty(): Store {
  return { webhook: "", on: false, fingerprint: "", jobs: [] };
}

function load(): Store {
  try {
    return { ...empty(), ...(JSON.parse(readFileSync(FILE, "utf8")) as Store) };
  } catch {
    return empty();
  }
}

function save(s: Store): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(s, null, 2));
  } catch {
    /* read-only prod */
  }
}

function safeWebhook(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return "";
    return u.toString().slice(0, 500);
  } catch {
    return "";
  }
}

export function broadcastStatus(): {
  on: boolean;
  webhookSet: boolean;
  pending: number;
  sent: number;
  nextDue: number | null;
  lastError: string | null;
} {
  const s = load();
  const pending = s.jobs.filter((j) => !j.sentAt);
  const sent = s.jobs.filter((j) => j.sentAt);
  const next = pending.map((j) => j.dueAt).sort((a, b) => a - b)[0] ?? null;
  const err = [...sent].reverse().find((j) => j.ok === false)?.error ?? null;
  return {
    on: s.on,
    webhookSet: Boolean(s.webhook),
    pending: pending.length,
    sent: sent.length,
    nextDue: next,
    lastError: err,
  };
}

export function saveBroadcast(input: { webhook?: string; on?: boolean }): ReturnType<typeof broadcastStatus> {
  const s = load();
  if (typeof input.webhook === "string") s.webhook = safeWebhook(input.webhook);
  if (typeof input.on === "boolean") s.on = input.on && Boolean(s.webhook);
  save(s);
  return broadcastStatus();
}

function fingerprint(tickets: ShareTicket[]): string {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  return `${day}:${tickets.map((t) => `${t.home}>${t.label}>${t.odds.toFixed(2)}`).join("|")}`;
}

export function enqueueBroadcast(tickets: ShareTicket[]): void {
  const s = load();
  if (!s.on || !s.webhook) return;
  const fp = fingerprint(tickets);
  if (fp === s.fingerprint) return;
  const posts = buildSharePosts(tickets, Date.now() % 997).filter((p) => p.id !== "empty");
  const now = Date.now();
  s.fingerprint = fp;
  s.jobs = posts.map((p, i) => ({
    id: `${fp.slice(0, 24)}-${p.id}-${i}`,
    text: p.text,
    title: p.title,
    dueAt: now + i * GAP_MS,
  }));
  save(s);
}

async function postWebhook(url: string, text: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text, text, username: "BetGPT" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}`);
}

export async function flushBroadcast(): Promise<void> {
  if (process.env.BETGPT_OFFLINE === "1") return;
  const s = load();
  if (!s.on || !s.webhook) return;
  const now = Date.now();
  let dirty = false;
  for (const job of s.jobs) {
    if (job.sentAt || job.dueAt > now) continue;
    try {
      await postWebhook(s.webhook, job.text);
      job.sentAt = Date.now();
      job.ok = true;
      job.error = undefined;
    } catch (err) {
      job.sentAt = Date.now();
      job.ok = false;
      job.error = err instanceof Error ? err.message.slice(0, 80) : "envoi raté";
    }
    dirty = true;
    break;
  }
  if (dirty) save(s);
}
