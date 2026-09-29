const TOKENS = [
  "paris saint-germain",
  "paris-saint-germain",
  "paris sg",
  "paris-sg",
  "psg",
  "marseille",
  "olympique de marseille",
  "olympique marseille",
  "monaco",
  "as monaco",
  "lille",
  "losc",
  "lyon",
  "olympique lyonnais",
  "olympique lyon",
  "lens",
  "rc lens",
  "nice",
  "ogc nice",
  "brest",
  "stade brestois",
  "strasbourg",
  "racing strasbourg",
  "rennes",
  "stade rennais",
  "nantes",
  "toulouse",
  "reims",
  "montpellier",
  "auxerre",
  "le havre",
  "angers",
  "saint-etienne",
  "st etienne",
  "asse",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isFrenchClub(team: { id?: string; name?: string; short?: string; league?: string }): boolean {
  if (team.league === "L1") return true;
  const blob = norm(`${team.id ?? ""} ${team.name ?? ""} ${team.short ?? ""}`);
  return TOKENS.some((t) => blob.includes(t));
}

export function skipEuropeFrenchProno(match: {
  league: string;
  home: { id?: string; name?: string; short?: string; league?: string };
  away: { id?: string; name?: string; short?: string; league?: string };
}): boolean {
  if (match.league !== "CL" && match.league !== "EL") return false;
  return isFrenchClub(match.home) || isFrenchClub(match.away);
}

export const FRENCH_EUROPE_NO_PRONO =
  "C1 / Europa : pas de prono BetGPT dès qu’un club français est sur la feuille.";
