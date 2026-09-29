import { loadAdmin } from "../engine/admin.ts";

export const JIS_TEL = "09 74 75 13 13";
export const JIS_URL = "https://www.joueurs-info-service.fr";
export const ANJ_URL = "https://anj.fr";

const PLACEHOLDER = /à déclarer|à renseigner|renseigner/i;

export type LegalIdentity = {
  name: string;
  siret: string;
  address: string;
  director: string;
  email: string;
  tva: string;
  adsensePub: string;
  host: string;
  ready: boolean;
};

export function legalIdentity(): LegalIdentity {
  const a = loadAdmin();
  const siret = a.siret?.trim() ?? "";
  const address = a.address?.trim() ?? "";
  const director = a.director?.trim() ?? "";
  const ready = Boolean(siret && address && director) && !PLACEHOLDER.test(`${siret} ${address} ${director}`);
  return {
    name: a.legalName?.trim() || "BetGPT",
    siret: ready ? siret : "",
    address: ready ? address : "",
    director: ready ? director : "",
    email: a.contactEmail?.trim() || "contact@betgpt.live",
    tva: a.tva?.trim() || "",
    adsensePub: (a.adsensePub ?? "").replace(/^ca-/, "").trim(),
    host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    ready,
  };
}

export function legalReady(id: LegalIdentity = legalIdentity()): boolean {
  return id.ready;
}
