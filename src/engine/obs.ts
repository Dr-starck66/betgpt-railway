type Ring = { t: number; name: string; extra?: string };

const MAX = 250;
const ring: Ring[] = [];
const counts = new Map<string, number>();
let hunterComputeMs = 0;
let hunterCacheHits = 0;
let hunterCacheMiss = 0;
let lastError = "";

export function obsInc(name: string, extra?: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1);
  ring.push({ t: Date.now(), name, extra: extra?.slice(0, 80) });
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

export function obsHunterTiming(ms: number, hit: boolean): void {
  hunterComputeMs = ms;
  if (hit) hunterCacheHits += 1;
  else hunterCacheMiss += 1;
}

export function obsError(msg: string): void {
  lastError = msg.slice(0, 200);
  obsInc("error", msg);
}

export function obsSnapshot() {
  return {
    counts: Object.fromEntries(counts),
    recent: ring.slice(-40),
    hunterComputeMs,
    hunterCacheHits,
    hunterCacheMiss,
    lastError,
  };
}
