import { useState } from "react";
import { logoCandidates } from "@/lib/crests";
import { crestSeo } from "@/lib/image-seo";
import { cn } from "@/lib/utils";
import { nationalTeamFlag } from "@/lib/team-flags";

export type TeamRef = {
  name: string;
  short: string;
  logo?: string;
  color?: string;
  id?: string;
};

export function Crest({
  name,
  short,
  logo,
  color,
  id,
  size = 32,
  competition,
}: {
  name: string;
  short: string;
  logo?: string;
  color?: string;
  id?: string;
  size?: number;
  competition?: string;
}) {
  const [fail, setFail] = useState(0);
  const srcs = logoCandidates(name, id, logo);
  const src = srcs[fail];
  const seo = crestSeo(name, { competition, size, id, logo });
  const flag = nationalTeamFlag(name);
  const letter = flag ? (
    <span
      className="grid shrink-0 place-items-center rounded-sm bg-white ring-1 ring-line"
      style={{ width: size, height: size, fontSize: Math.max(16, size * 0.72) }}
      title={name}
      aria-label={`Drapeau ${name}`}
    >
      {flag}
    </span>
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-sm font-bold text-ink ring-1 ring-line"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.32),
        background: color || "#00e38c",
      }}
      title={seo.title}
      aria-label={seo.alt}
    >
      {short.slice(0, 3)}
    </span>
  );
  if (!src) return letter;
  return (
    <img
      src={src}
      alt={seo.alt}
      title={seo.title}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-sm bg-white object-contain p-0.5")}
      style={{ width: size, height: size }}
      data-filename={seo.filename}
      onError={() => setFail((n) => n + 1)}
    />
  );
}

export function TeamLine({
  home,
  away,
  size = 28,
  names = "auto",
  competition,
  className,
}: {
  home: TeamRef;
  away: TeamRef;
  size?: number;
  names?: "short" | "full" | "auto";
  competition?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <TeamChip team={home} size={size} names={names} competition={competition} />
      <span className="shrink-0 text-muted">–</span>
      <TeamChip team={away} size={size} names={names} competition={competition} />
    </span>
  );
}

function TeamChip({
  team,
  size,
  names,
  competition,
}: {
  team: TeamRef;
  size: number;
  names: "short" | "full" | "auto";
  competition?: string;
}) {
  const flag = nationalTeamFlag(team.name);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 overflow-hidden">
      {flag ? (
        <span
          className="grid shrink-0 place-items-center rounded-sm bg-white ring-1 ring-line"
          style={{ width: size, height: size, fontSize: Math.max(16, size * 0.72) }}
          aria-label={`Drapeau ${team.name}`}
          title={team.name}
        >
          {flag}
        </span>
      ) : (
        <Crest
          name={team.name}
          short={team.short}
          logo={team.logo}
          color={team.color}
          id={team.id}
          size={size}
          competition={competition}
        />
      )}
      {names === "short" ? (
        <span className="truncate font-medium text-paper">{team.short}</span>
      ) : names === "full" ? (
        <span className="truncate font-medium text-paper">{team.name}</span>
      ) : (
        <span className="truncate font-medium text-paper">
          <span className="sm:hidden">{team.short}</span>
          <span className="hidden sm:inline">{team.name}</span>
        </span>
      )}
    </span>
  );
}

export function BookMark({ book, size = 16 }: { book: string; size?: number }) {
  const n = book.toLowerCase();
  const style =
    /betclic/.test(n) ? { bg: "#1a4bff", fg: "#fff", ch: "B" }
    : /netbet/.test(n) ? { bg: "#e10600", fg: "#fff", ch: "N" }
    : /winamax/.test(n) ? { bg: "#e20e17", fg: "#fff", ch: "W" }
    : /vbet/.test(n) ? { bg: "#111", fg: "#ffcd00", ch: "V" }
    : /pmu/.test(n) ? { bg: "#009639", fg: "#fff", ch: "P" }
    : /unibet/.test(n) ? { bg: "#ffcd00", fg: "#111", ch: "U" }
    : { bg: "#2a3344", fg: "#fff", ch: book.slice(0, 1).toUpperCase() || "?" };
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: style.bg,
        color: style.fg,
      }}
      title={book}
    >
      {style.ch}
    </span>
  );
}
