export type FollowKind = "team" | "league" | "hunter";

export type Follows = {
  v: 1;
  teams: string[];
  leagues: string[];
  hunters: string[];
};

const KEY = "betgpt-follows";

export const EMPTY_FOLLOWS: Follows = { v: 1, teams: [], leagues: [], hunters: [] };

export function loadFollows(): Follows {
  if (typeof window === "undefined") return EMPTY_FOLLOWS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_FOLLOWS;
    const p = JSON.parse(raw) as Partial<Follows>;
    return {
      v: 1,
      teams: Array.isArray(p.teams) ? p.teams.slice(0, 40) : [],
      leagues: Array.isArray(p.leagues) ? p.leagues.slice(0, 12) : [],
      hunters: Array.isArray(p.hunters) ? p.hunters.slice(0, 20) : [],
    };
  } catch {
    return EMPTY_FOLLOWS;
  }
}

export function saveFollows(next: Follows): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("betgpt-follows"));
  } catch {
    /* quota */
  }
}

export function isFollowed(kind: FollowKind, id: string, bag = loadFollows()): boolean {
  if (kind === "team") return bag.teams.includes(id);
  if (kind === "league") return bag.leagues.includes(id);
  return bag.hunters.includes(id);
}

export function toggleFollow(kind: FollowKind, id: string): Follows {
  const bag = loadFollows();
  const key = kind === "team" ? "teams" : kind === "league" ? "leagues" : "hunters";
  const has = bag[key].includes(id);
  const next = {
    ...bag,
    [key]: has ? bag[key].filter((x) => x !== id) : [...bag[key], id].slice(0, 40),
  };
  saveFollows(next);
  return next;
}
