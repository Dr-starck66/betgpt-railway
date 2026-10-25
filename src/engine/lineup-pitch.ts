import type { OfficialLineupPlayer, OfficialTeamLineup } from "./official-lineups.ts";

export type VerifiedPitchLayout = {
  formation: string;
  /** From goalkeeper to attack; ordering inside a line is indicative, not tracking data. */
  lines: OfficialLineupPlayer[][];
};

function roleRank(position?: string): number {
  const p = (position ?? "").trim().toUpperCase();
  if (/^(GK|G|GOALKEEPER)$/.test(p)) return 0;
  if (/^(D|DF|DEF|CB|LB|RB|LWB|RWB|SW)/.test(p)) return 1;
  if (/^(M|MF|MID|DM|CM|AM|LM|RM)/.test(p)) return 2;
  if (/^(F|FW|ST|CF|LW|RW|SS|ATT)/.test(p)) return 3;
  return 4;
}

/** Never infer a formation or a confirmed XI from missing data. */
export function buildVerifiedPitchLayout(lineup: OfficialTeamLineup): VerifiedPitchLayout | null {
  if (lineup.starters.length !== 11) return null;
  const formation = (lineup.formation ?? "").trim();
  if (!/^\d(?:-\d){1,4}$/.test(formation)) return null;
  const counts = formation.split("-").map(Number);
  if (counts.some((n) => n < 1 || n > 6) || counts.reduce((n, next) => n + next, 0) !== 10) return null;

  const players = lineup.starters;
  const goalkeeper = players.find((p) => roleRank(p.position) === 0) ?? players[0];
  if (!goalkeeper) return null;
  const outfield = players
    .filter((p) => p !== goalkeeper)
    .map((player, index) => ({ player, index }))
    .sort((a, b) => roleRank(a.player.position) - roleRank(b.player.position) || a.index - b.index)
    .map(({ player }) => player);

  const lines: OfficialLineupPlayer[][] = [[goalkeeper]];
  let offset = 0;
  for (const size of counts) {
    lines.push(outfield.slice(offset, offset + size));
    offset += size;
  }
  if (lines.reduce((n, line) => n + line.length, 0) !== 11) return null;
  return { formation, lines };
}
