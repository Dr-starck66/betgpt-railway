import type { OfficialLineupPlayer, OfficialTeamLineup } from "./official-lineups.ts";

export type VerifiedPitchLayout = {
  formation: string;
  /** From goalkeeper to attack; horizontal positions are illustrative, not tracking data. */
  lines: OfficialLineupPlayer[][];
};

export type SchematicPitchLayout = {
  formation: string;
  /** An anonymous, illustrative formation, never a verified starting XI. */
  lines: number[];
};

/** Works on every match route, even before the lineups provider answers. */
export function buildSchematicPitchLayout(value?: string | null): SchematicPitchLayout | null {
  const formation = (value ?? "").trim();
  if (!/^\d(?:-\d){1,4}$/.test(formation)) return null;
  const counts = formation.split("-").map(Number);
  if (counts.some((count) => count < 1 || count > 6)) return null;
  if (counts.reduce((total, count) => total + count, 0) !== 10) return null;
  return { formation, lines: [1, ...counts] };
}

function roleRank(position?: string): number {
  const p = (position ?? "").trim().toUpperCase();
  if (/^(GK|G|GOALKEEPER)$/.test(p)) return 0;
  if (/^(D|DF|DEF|CB|LB|RB|LWB|RWB|SW)/.test(p)) return 1;
  if (/^(M|MF|MID|DM|CM|AM|LM|RM)/.test(p)) return 2;
  if (/^(F|FW|ST|CF|LW|RW|SS|ATT)/.test(p)) return 3;
  return 4;
}

/** Confirmed rosters require 11 unique source starters, without made-up players. */
export function buildVerifiedPitchLayout(lineup: OfficialTeamLineup): VerifiedPitchLayout | null {
  if (lineup.starters.length !== 11) return null;
  const schematic = buildSchematicPitchLayout(lineup.formation);
  if (!schematic) return null;

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
  for (const size of schematic.lines.slice(1)) {
    lines.push(outfield.slice(offset, offset + size));
    offset += size;
  }
  if (lines.reduce((n, line) => n + line.length, 0) !== 11) return null;
  return { formation: schematic.formation, lines };
}
