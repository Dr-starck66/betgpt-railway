import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { allowKeyed } from "../lib/store.ts";

const GATE = join(process.cwd(), "data", "admin-gate.json");
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

type Gate = { salt: string; hash: string; secret: string };

export function isProductionRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function adminKeyConfigured(): boolean {
  return Boolean(process.env.ADMIN_KEY?.trim());
}

/** Production without ADMIN_KEY: admin is disabled. JSON gate is preview-only. */
export function adminDisabled(): boolean {
  return isProductionRuntime() && !adminKeyConfigured();
}

function readGate(): Gate | null {
  try {
    const g = JSON.parse(readFileSync(GATE, "utf8")) as Gate;
    if (g.salt && g.hash && g.secret) return g;
  } catch {
    /* */
  }
  return null;
}

function writeGate(g: Gate): void {
  mkdirSync(dirname(GATE), { recursive: true });
  writeFileSync(GATE, JSON.stringify(g));
}

function hashPin(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin.normalize("NFKC"), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function eq(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function adminNeedsSetup(): boolean {
  if (adminKeyConfigured()) return false;
  if (isProductionRuntime()) return false;
  return !readGate();
}

export function setupAdmin(pin: string): { ok: true } | { ok: false; error: string } {
  if (isProductionRuntime()) {
    return { ok: false, error: "Admin désactivé : utilise ADMIN_KEY en production." };
  }
  if (readGate() || adminKeyConfigured()) return { ok: false, error: "Déjà initialisé." };
  const clean = pin.trim();
  if (clean.length < 8) return { ok: false, error: "Au moins 8 caractères." };
  const salt = randomBytes(16);
  const hash = hashPin(clean, salt);
  writeGate({ salt: salt.toString("hex"), hash: hash.toString("hex"), secret: randomBytes(32).toString("hex") });
  return { ok: true };
}

export function issueAdminToken(pin: string): string | null {
  if (adminDisabled()) return null;
  const env = process.env.ADMIN_KEY?.trim();
  if (env) {
    const ok = eq(hashPin(pin, Buffer.alloc(16, 7)), hashPin(env, Buffer.alloc(16, 7)));
    if (!ok) return null;
    return sign(process.env.ADMIN_TOKEN_SECRET?.trim() || env);
  }
  if (isProductionRuntime()) return null;
  const g = readGate();
  if (!g) return null;
  const ok = eq(hashPin(pin, Buffer.from(g.salt, "hex")), Buffer.from(g.hash, "hex"));
  if (!ok) return null;
  return sign(g.secret);
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  if (adminDisabled()) return false;
  const env = process.env.ADMIN_KEY?.trim();
  const g = isProductionRuntime() ? null : readGate();
  const secret = process.env.ADMIN_TOKEN_SECRET?.trim() || env || g?.secret;
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expect = createHmac("sha256", secret).update(String(exp)).digest("hex");
  try {
    return eq(Buffer.from(sig ?? "", "hex"), Buffer.from(expect, "hex"));
  } catch {
    return false;
  }
}

function sign(secret: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = createHmac("sha256", secret).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

function clientBucket(endpoint: string): string {
  let ip = "local";
  try {
    const h = (globalThis as { __betgptIp?: string }).__betgptIp;
    if (h) ip = h;
  } catch {
    ip = "local";
  }
  return createHash("sha256").update(`${endpoint}|${ip}`).digest("hex").slice(0, 24);
}

export function bindRequestIp(ip: string): void {
  (globalThis as { __betgptIp?: string }).__betgptIp = ip.slice(0, 80);
}

/** Hash the edge IP when a server request is available. Never trust a client-sent IP. */
export async function captureClientIp(): Promise<void> {
  try {
    const mod = await import("@tanstack/react-start/server");
    const getRequest = (mod as { getRequest?: () => Request }).getRequest;
    if (typeof getRequest !== "function") {
      bindRequestIp("local");
      return;
    }
    const req = getRequest();
    const raw = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    bindRequestIp(raw.split(",")[0]?.trim() || "local");
  } catch {
    bindRequestIp("local");
  }
}

export async function allowChat(): Promise<boolean> {
  return allowKeyed(`chat:${clientBucket("chat")}`, 20, 60_000);
}

export async function allowExplain(): Promise<boolean> {
  return allowKeyed(`explain:${clientBucket("explain")}`, 10, 60_000);
}

export async function allowAdminLogin(): Promise<boolean> {
  return allowKeyed(`admin:${clientBucket("admin")}`, 8, 60_000);
}

export async function allowHunterHeavy(): Promise<boolean> {
  return allowKeyed(`hunter:${clientBucket("hunter")}`, 30, 60_000);
}
