import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { isFollowed, toggleFollow, type FollowKind } from "@/lib/follows";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function FollowStar({
  kind,
  id,
  label,
}: {
  kind: FollowKind;
  id: string;
  label: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(isFollowed(kind, id));
    const sync = () => setOn(isFollowed(kind, id));
    window.addEventListener("betgpt-follows", sync);
    return () => window.removeEventListener("betgpt-follows", sync);
  }, [kind, id]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Ne plus suivre ${label}` : `Suivre ${label}`}
      onClick={() => {
        const next = toggleFollow(kind, id);
        const nowOn =
          kind === "team" ? next.teams.includes(id) : kind === "league" ? next.leagues.includes(id) : next.hunters.includes(id);
        setOn(nowOn);
        if (nowOn) track("favorite_add", `${kind}:${id}`);
      }}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium",
        on ? "border-sage bg-sage/15 text-paper" : "border-line text-mist hover:text-paper",
      )}
    >
      <Star className={cn("h-4 w-4", on ? "fill-sage text-sage" : "text-muted")} />
      <span className="hidden sm:inline">{on ? "Suivi" : "Suivre"}</span>
    </button>
  );
}
