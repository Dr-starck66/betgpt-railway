import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadFollows, type Follows } from "@/lib/follows";
import { LEAGUE_LABEL } from "@/lib/labels";
import { TeamLine } from "@/components/crest";
import type { LeagueId, MatchInput } from "@/engine/types";

export function FollowedHome({ matches }: { matches: MatchInput[] }) {
  const [bag, setBag] = useState<Follows | null>(null);
  useEffect(() => {
    const sync = () => setBag(loadFollows());
    sync();
    window.addEventListener("betgpt-follows", sync);
    return () => window.removeEventListener("betgpt-follows", sync);
  }, []);
  const mine = useMemo(() => {
    if (!bag) return [];
    const teams = new Set(bag.teams.map((t) => t.toLowerCase()));
    const leagues = new Set(bag.leagues);
    return matches.filter((m) => {
      if (leagues.has(m.league)) return true;
      return teams.has(m.home.name.toLowerCase()) || teams.has(m.away.name.toLowerCase());
    });
  }, [bag, matches]);
  if (!bag || (!bag.teams.length && !bag.leagues.length && !bag.hunters.length)) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold tracking-tight">Vos suivis</h2>
      <p className="mt-1 text-sm text-mist">Enregistrés sur cet appareil. Pas de compte.</p>
      {bag.hunters.length ? (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {bag.hunters.map((h) => (
            <Link key={h} to="/score-hunter/$scenario" params={{ scenario: h }} className="rounded-md border border-line px-3 py-2 hover:border-sage">
              Hunter {h}
            </Link>
          ))}
        </p>
      ) : null}
      {bag.leagues.length ? (
        <p className="mt-2 text-sm text-mist">
          Ligues : {bag.leagues.map((id) => LEAGUE_LABEL[id as LeagueId] ?? id).join(", ")}
        </p>
      ) : null}
      {mine.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {mine.slice(0, 8).map((m) => (
            <li key={m.id}>
              <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="flex items-center gap-2 hover:text-sage">
                <TeamLine home={m.home} away={m.away} size={24} names="full" competition={m.competition} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-mist">Pas de match suivi dans le desk actuel.</p>
      )}
    </section>
  );
}
