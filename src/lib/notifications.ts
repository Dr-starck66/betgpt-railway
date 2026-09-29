export type LocalNotice = {
  id: string;
  title: string;
  body: string;
  href: string;
  at: number;
  read: boolean;
};

const KEY = "betgpt-notices";
const DISMISS = "betgpt-notice-dismiss";

export function loadNotices(): LocalNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as LocalNotice[];
    return Array.isArray(p) ? p.slice(-40) : [];
  } catch {
    return [];
  }
}

export function saveNotices(rows: LocalNotice[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-40)));
  } catch {
    /* */
  }
}

export function dismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS);
    const p = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(p) ? p : []);
  } catch {
    return new Set();
  }
}

export function dismissNotice(id: string): void {
  const set = dismissedIds();
  set.add(id);
  try {
    localStorage.setItem(DISMISS, JSON.stringify([...set].slice(-80)));
  } catch {
    /* */
  }
}

/** In-app only. No web-push / email infra in this build. */
export function kickoffNotices(
  matches: { id: string; slug?: string; kickoff: string; home: { name: string }; away: { name: string } }[],
  followedTeams: string[],
  now = Date.now(),
): LocalNotice[] {
  if (!followedTeams.length) return [];
  const want = new Set(followedTeams.map((n) => n.toLowerCase()));
  const horizon = 2 * 3600_000;
  const skip = dismissedIds();
  const out: LocalNotice[] = [];
  for (const m of matches) {
    const t = Date.parse(m.kickoff);
    if (!Number.isFinite(t)) continue;
    const wait = t - now;
    if (wait <= 0 || wait > horizon) continue;
    const hit = want.has(m.home.name.toLowerCase()) || want.has(m.away.name.toLowerCase());
    if (!hit) continue;
    const id = `ko-${m.id}`;
    if (skip.has(id)) continue;
    const mins = Math.max(1, Math.round(wait / 60000));
    out.push({
      id,
      title: `${m.home.name} – ${m.away.name}`,
      body: `Coup d’envoi dans ${mins} min. Analyse BetGPT disponible.`,
      href: `/match/${m.slug ?? m.id}`,
      at: now,
      read: false,
    });
  }
  return out;
}
