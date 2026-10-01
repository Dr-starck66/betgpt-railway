import type { PunchlineMeta } from "./punch";
import type { PunchReaction } from "./reaction";

export type ChatRole = "user" | "assistant";

export type PersonalityMode = "NORMAL" | "ROAST";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  punchline?: PunchlineMeta;
  reaction?: PunchReaction;
};

export type UserMemory = {
  sarcasticIntensity: number;
  blackBook: {
    combinésDePlus5Matchs: number;
    jaiUnFeeling: number;
    parisModifiésDerniereSeconde: number;
    matchsImpossiblesAPerdre: number;
    matchsEffectivementPerdus: number;
    niveauDeConfianceInjustifie: number;
  };
  preferences: {
    favoriteTeams: string[];
    favoriteCompetitions: string[];
  };
};

export type ChatRequestBody = {
  messages: ChatMessage[];
  userMemory: UserMemory;
  requestedMode?: PersonalityMode;
};

export const EMPTY_MEMORY: UserMemory = {
  sarcasticIntensity: 50,
  blackBook: {
    combinésDePlus5Matchs: 0,
    jaiUnFeeling: 0,
    parisModifiésDerniereSeconde: 0,
    matchsImpossiblesAPerdre: 0,
    matchsEffectivementPerdus: 0,
    niveauDeConfianceInjustifie: 0,
  },
  preferences: { favoriteTeams: [], favoriteCompetitions: [] },
};

export function parseMode(raw: unknown): PersonalityMode {
  return raw === "ROAST" || raw === "SARCASTIC" ? "ROAST" : "NORMAL";
}

/** Storage and incoming requests are untrusted, including nested fields. */
export function normalizeMemory(raw: unknown): UserMemory {
  const source = raw && typeof raw === "object" ? (raw as Partial<UserMemory>) : {};
  const blackBook = { ...EMPTY_MEMORY.blackBook };
  for (const key of Object.keys(blackBook) as (keyof typeof blackBook)[]) {
    const value = source.blackBook?.[key];
    blackBook[key] =
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(10000, Math.floor(value)))
        : 0;
  }
  const list = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((v): v is string => typeof v === "string")
          .slice(0, 10)
          .map((v) => v.slice(0, 80))
      : [];
  return {
    sarcasticIntensity:
      typeof source.sarcasticIntensity === "number" && Number.isFinite(source.sarcasticIntensity)
        ? Math.max(0, Math.min(100, source.sarcasticIntensity))
        : 50,
    blackBook,
    preferences: {
      favoriteTeams: list(source.preferences?.favoriteTeams),
      favoriteCompetitions: list(source.preferences?.favoriteCompetitions),
    },
  };
}
