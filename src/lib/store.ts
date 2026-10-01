/**
 * Persistence layers
 * -----------------
 * RELATIONAL (Postgres Neon / PGLite): kv, analytics_events, affiliate_clicks, rate_hits
 *   — unowned rows (auth OFF). Never personal data.
 * KV / CACHE: live football snapshot + hunter pack stay in-process; rate_hits is durable.
 * OBJECT / FILE: historical archive JSON (12k ESPN matches) — too large for kv rows.
 * LOCAL (browser): favorites, age-gate, consent, chat memory.
 * JSON files under data/ are a local-dev fallback only. Production writes go to Postgres.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

const mem = new Map<string, unknown>();
const memHits = new Map<string, number[]>();
let testMemory = false;

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

async function trySql(): Promise<Sql | null> {
  if (testMemory) return null;
  if (typeof window !== "undefined") return null;
  try {
    const mod = await import("./db.ts");
    return await mod.getSql();
  } catch {
    return null;
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (mem.has(key)) return mem.get(key) as T;
  const sql = await trySql();
  if (!sql) return null;
  try {
    const rows = await sql.query<{ v: T }>("select v from kv where k = $1", [key]);
    const v = rows[0]?.v;
    if (v === undefined) return null;
    mem.set(key, v);
    return v;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  mem.set(key, value);
  const sql = await trySql();
  if (!sql) return;
  try {
    await sql.query(
      "insert into kv (k, v, updated_at) values ($1, $2::jsonb, now()) on conflict (k) do update set v = excluded.v, updated_at = now()",
      [key, JSON.stringify(value)],
    );
  } catch {
    /* preview / missing table */
  }
}

export async function recordAnalytics(e: string, p?: string, route?: string): Promise<void> {
  const sql = await trySql();
  if (!sql) return;
  try {
    await sql.query("insert into analytics_events (e, p, route) values ($1, $2, $3)", [
      e.slice(0, 40),
      (p ?? "").slice(0, 80) || null,
      (route ?? "").slice(0, 120) || null,
    ]);
  } catch {
    /* */
  }
}

export async function analyticsSummary(limit = 40): Promise<{ e: string; n: number }[]> {
  const sql = await trySql();
  if (!sql) return [];
  try {
    return await sql.query<{ e: string; n: number }>(
      "select e, count(*)::int as n from analytics_events group by e order by n desc limit $1",
      [limit],
    );
  } catch {
    return [];
  }
}

export async function growthWindowSnapshot(windowHours = 24): Promise<{
  currentEvents: Record<string, number>;
  previousEvents: Record<string, number>;
  affiliateClicks: number;
  previousAffiliateClicks: number;
  topRoutes: { route: string; n: number }[];
}> {
  const sql = await trySql();
  const empty = {
    currentEvents: {} as Record<string, number>,
    previousEvents: {} as Record<string, number>,
    affiliateClicks: 0,
    previousAffiliateClicks: 0,
    topRoutes: [] as { route: string; n: number }[],
  };
  if (!sql) return empty;
  try {
    const current = await sql.query<{ e: string; n: number }>(
      "select e, count(*)::int as n from analytics_events where t >= now() - ($1 * interval '1 hour') group by e",
      [windowHours],
    );
    const previous = await sql.query<{ e: string; n: number }>(
      "select e, count(*)::int as n from analytics_events where t < now() - ($1 * interval '1 hour') and t >= now() - ($2 * interval '1 hour') group by e",
      [windowHours, windowHours * 2],
    );
    const clicks = await sql.query<{ n: number }>(
      "select count(*)::int as n from affiliate_clicks where t >= now() - ($1 * interval '1 hour')",
      [windowHours],
    );
    const previousClicks = await sql.query<{ n: number }>(
      "select count(*)::int as n from affiliate_clicks where t < now() - ($1 * interval '1 hour') and t >= now() - ($2 * interval '1 hour')",
      [windowHours, windowHours * 2],
    );
    const routes = await sql.query<{ route: string; n: number }>(
      "select coalesce(route, '/') as route, count(*)::int as n from analytics_events where t >= now() - ($1 * interval '1 hour') group by route order by n desc limit 10",
      [windowHours],
    );
    return {
      currentEvents: Object.fromEntries(current.map((row) => [row.e, Number(row.n) || 0])),
      previousEvents: Object.fromEntries(previous.map((row) => [row.e, Number(row.n) || 0])),
      affiliateClicks: Number(clicks[0]?.n) || 0,
      previousAffiliateClicks: Number(previousClicks[0]?.n) || 0,
      topRoutes: routes.map((row) => ({ route: row.route || "/", n: Number(row.n) || 0 })),
    };
  } catch {
    return empty;
  }
}

export async function recordClick(book: string, matchId: string, href: string): Promise<void> {
  const sql = await trySql();
  if (!sql) return;
  try {
    await sql.query("insert into affiliate_clicks (book, match_id, href) values ($1, $2, $3)", [
      book.slice(0, 40),
      matchId.slice(0, 80) || null,
      href.slice(0, 500),
    ]);
  } catch {
    /* */
  }
}

export async function recordSearchTruthLanding(source: string, route: string): Promise<void> {
  const sql = await trySql();
  if (!sql) return;
  try {
    await sql.query("insert into search_truth_landings (source, route) values ($1, $2)", [
      source.slice(0, 40),
      route.slice(0, 180) || "/",
    ]);
  } catch {
    /* migration may not be deployed yet */
  }
}

export async function searchTruthSnapshot(windowHours = 24): Promise<{
  current: number;
  previous: number;
  growth: number | null;
  bySource: { source: string; n: number }[];
  topRoutes: { route: string; n: number }[];
}> {
  const sql = await trySql();
  const empty = { current: 0, previous: 0, growth: null, bySource: [], topRoutes: [] };
  if (!sql) return empty;
  try {
    const current = await sql.query<{ n: number }>(
      "select count(*)::int as n from search_truth_landings where t >= now() - ($1 * interval '1 hour')",
      [windowHours],
    );
    const previous = await sql.query<{ n: number }>(
      "select count(*)::int as n from search_truth_landings where t < now() - ($1 * interval '1 hour') and t >= now() - ($2 * interval '1 hour')",
      [windowHours, windowHours * 2],
    );
    const bySource = await sql.query<{ source: string; n: number }>(
      "select source, count(*)::int as n from search_truth_landings where t >= now() - ($1 * interval '1 hour') group by source order by n desc, source asc",
      [windowHours],
    );
    const topRoutes = await sql.query<{ route: string; n: number }>(
      "select route, count(*)::int as n from search_truth_landings where t >= now() - ($1 * interval '1 hour') group by route order by n desc, route asc limit 20",
      [windowHours],
    );
    const a = Number(current[0]?.n) || 0;
    const b = Number(previous[0]?.n) || 0;
    return {
      current: a,
      previous: b,
      growth: b > 0 ? (a - b) / b : a > 0 ? 1 : null,
      bySource: bySource.map((row) => ({ source: row.source, n: Number(row.n) || 0 })),
      topRoutes: topRoutes.map((row) => ({ route: row.route || "/", n: Number(row.n) || 0 })),
    };
  } catch {
    return empty;
  }
}

export async function allowKeyed(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const sql = await trySql();
  if (sql) {
    try {
      await sql.query("delete from rate_hits where t < $1", [now - windowMs * 4]);
      const rows = await sql.query<{ n: number }>(
        "select count(*)::int as n from rate_hits where k = $1 and t > $2",
        [key, now - windowMs],
      );
      if ((rows[0]?.n ?? 0) >= max) return false;
      await sql.query("insert into rate_hits (k, t) values ($1, $2)", [key, now]);
      return true;
    } catch {
      /* fall through */
    }
  }
  const bucket = memHits.get(key) ?? [];
  const next = bucket.filter((t) => t > now - windowMs);
  if (next.length >= max) {
    memHits.set(key, next);
    return false;
  }
  next.push(now);
  memHits.set(key, next);
  return true;
}

export function resetStoreForTests(): void {
  mem.clear();
  memHits.clear();
  testMemory = true;
}
