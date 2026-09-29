import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LeagueId } from "./types";

export type AdminSettings = {
  minEv: number;
  minEdge: number;
  maxStake: number;
  maxBook: number;
  leagues: Record<LeagueId, boolean>;
  freezeBets: boolean;
  emailEnabled: boolean;
  emailTo: string[];
  affTags: Record<string, string>;
  legalName: string;
  siret: string;
  address: string;
  director: string;
  contactEmail: string;
  tva: string;
  adsensePub: string;
};

const FILE = join(process.cwd(), "data", "admin.json");

const DEFAULTS: AdminSettings = {
  minEv: 0.038,
  minEdge: 0.024,
  maxStake: 0.08,
  maxBook: 0.24,
  leagues: { PL: true, LL: true, BL: true, SA: true, L1: true, ER: true, PT: true, SC: true, TR: true, CL: true, EL: true, NL: true },
  freezeBets: false,
  emailEnabled: false,
  emailTo: [],
  affTags: {},
  legalName: "BetGPT",
  siret: "",
  address: "",
  director: "",
  contactEmail: "contact@betgpt.live",
  tva: "",
  adsensePub: "",
};

let CACHE: AdminSettings | null = null;

function mergeAdmin(base: AdminSettings, raw: Partial<AdminSettings> | null | undefined): AdminSettings {
  const r = raw ?? {};
  return {
    ...base,
    ...r,
    maxStake: typeof r.maxStake === "number" && r.maxStake > 0.03 ? r.maxStake : base.maxStake,
    maxBook: typeof r.maxBook === "number" && r.maxBook > 0.18 ? r.maxBook : base.maxBook,
    leagues: { ...base.leagues, ...(r.leagues ?? {}) },
    emailTo: Array.isArray(r.emailTo) ? r.emailTo : base.emailTo,
    affTags: r.affTags && typeof r.affTags === "object" ? { ...base.affTags, ...r.affTags } : { ...base.affTags },
  };
}

function readFileAdmin(): AdminSettings {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<AdminSettings>;
    return mergeAdmin({ ...DEFAULTS, leagues: { ...DEFAULTS.leagues }, affTags: {} }, raw);
  } catch {
    return { ...DEFAULTS, leagues: { ...DEFAULTS.leagues }, affTags: {} };
  }
}

export function loadAdmin(): AdminSettings {
  if (CACHE) return CACHE;
  CACHE = readFileAdmin();
  return CACHE;
}

export async function hydrateAdmin(): Promise<AdminSettings> {
  const local = loadAdmin();
  try {
    const { kvGet } = await import("../lib/store.ts");
    const remote = await kvGet<Partial<AdminSettings>>("admin");
    if (remote && typeof remote === "object") {
      CACHE = mergeAdmin(local, remote);
      return CACHE;
    }
  } catch {
    /* */
  }
  return local;
}

export function saveAdmin(next: Partial<AdminSettings>): AdminSettings {
  const cur = loadAdmin();
  const merged = mergeAdmin(cur, {
    ...next,
    leagues: { ...cur.leagues, ...(next.leagues ?? {}) },
    emailTo: next.emailTo ?? cur.emailTo,
    affTags: { ...cur.affTags, ...(next.affTags ?? {}) },
    legalName: next.legalName ?? cur.legalName,
    siret: next.siret ?? cur.siret,
    address: next.address ?? cur.address,
    director: next.director ?? cur.director,
    contactEmail: next.contactEmail ?? cur.contactEmail,
    tva: next.tva ?? cur.tva,
    adsensePub: next.adsensePub ?? cur.adsensePub,
  });
  CACHE = merged;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(merged, null, 2));
  } catch {
    /* serverless FS may be read-only */
  }
  void import("../lib/store.ts")
    .then((m) => m.kvSet("admin", merged))
    .catch(() => undefined);
  return merged;
}
