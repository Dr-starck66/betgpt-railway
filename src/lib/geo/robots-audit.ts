import { robotsTxt } from "@/lib/robots";

export type RobotsRule = { allow: boolean; path: string };

export const CRAWLERS = ["Googlebot", "Bingbot", "OAI-SearchBot", "*"] as const;

const IMPORTANT = [
  "/",
  "/about",
  "/methodology",
  "/editorial-policy",
  "/data-sources",
  "/prediction-history",
  "/press",
  "/changelog",
  "/ledger",
  "/scores-en-direct",
  "/resultats-football",
  "/score-data-methodology",
  "/pronos-football",
  "/blog",
  "/ligue-1",
  "/match/exemple",
  "/equipe/exemple",
  "/statistics",
];

const PRIVATE = ["/admin", "/admin/secret", "/api/go", "/api/", "/go", "/lab"];

export function parseRobots(txt: string): Map<string, RobotsRule[]> {
  const groups = new Map<string, RobotsRule[]>();
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  const flush = () => {
    if (!agents.length) return;
    for (const agent of agents) groups.set(agent, rules);
    agents = [];
    rules = [];
  };
  for (const raw of txt.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (rules.length) flush();
      agents.push(value);
    } else if (key === "allow" || key === "disallow") {
      rules.push({ allow: key === "allow", path: value || "/" });
    }
  }
  flush();
  return groups;
}

export function rulesFor(groups: Map<string, RobotsRule[]>, agent: string): RobotsRule[] {
  const exact = [...groups.keys()].find((name) => name.toLowerCase() === agent.toLowerCase());
  if (exact) return groups.get(exact) ?? [];
  return groups.get("*") ?? [];
}

export function pathAllowed(path: string, rules: RobotsRule[]): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const rule of rules) {
    const prefix = rule.path;
    const hit =
      prefix === "/"
        ? true
        : path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
    if (!hit) continue;
    if (!best || prefix.length >= best.len) best = { len: prefix.length, allow: rule.allow };
  }
  return best ? best.allow : true;
}

export type CrawlerProof = {
  agent: string;
  allowed: string[];
  blocked: string[];
  importantOpen: boolean;
  privateClosed: boolean;
};

export function crawlerProof(txt = robotsTxt()): CrawlerProof[] {
  const groups = parseRobots(txt);
  return CRAWLERS.map((agent) => {
    const rules = rulesFor(groups, agent);
    const allowed = IMPORTANT.filter((path) => pathAllowed(path, rules));
    const blocked = PRIVATE.filter((path) => !pathAllowed(path, rules));
    return {
      agent,
      allowed,
      blocked,
      importantOpen: allowed.length === IMPORTANT.length,
      privateClosed: blocked.length === PRIVATE.length,
    };
  });
}
