import type { LeagueId } from "@/engine/types";

export type CountryFlagSpec = {
  code: string | null;
  label: string;
};

export const LEAGUE_COUNTRY: Record<LeagueId, CountryFlagSpec> = {
  L1: { code: "FR", label: "France" },
  PL: { code: "GB", label: "Angleterre" },
  LL: { code: "ES", label: "Espagne" },
  BL: { code: "DE", label: "Allemagne" },
  SA: { code: "IT", label: "Italie" },
  ER: { code: "NL", label: "Pays-Bas" },
  PT: { code: "PT", label: "Portugal" },
  SC: { code: "GB", label: "Écosse" },
  TR: { code: "TR", label: "Turquie" },
  CL: { code: "EU", label: "Europe" },
  EL: { code: "EU", label: "Europe" },
  NL: { code: null, label: "International" },
};

export const FIFA_TO_ISO2: Record<string, string> = {
  ALB:"AL", ALG:"DZ", AND:"AD", ARM:"AM", AUT:"AT", AZE:"AZ", BEL:"BE", BEN:"BJ", BIH:"BA", BFA:"BF", BDI:"BI",
  BLR:"BY", BUL:"BG", CAN:"CA", CHI:"CL", CHN:"CN", COL:"CO", CPV:"CV", CRO:"HR", CYP:"CY", CZE:"CZ", DEN:"DK", ECU:"EC",
  EGY:"EG", ENG:"GB", ESP:"ES", EST:"EE", FIN:"FI", FRA:"FR", FRO:"FO", GAB:"GA", GAM:"GM", GEO:"GE", GER:"DE", GHA:"GH",
  GIB:"GI", GRE:"GR", GNB:"GW", GUI:"GN", HUN:"HU", IRL:"IE", ISL:"IS", ISR:"IL", ITA:"IT", JPN:"JP", KAZ:"KZ",
  KEN:"KE", KOR:"KR", KOS:"XK", LAT:"LV", LBR:"LR", LIE:"LI", LTU:"LT", LUX:"LU", MAD:"MG", MAR:"MA", MEX:"MX",
  MKD:"MK", MLI:"ML", MLT:"MT", MNE:"ME", MDA:"MD", MOZ:"MZ", MWI:"MW", NED:"NL", NER:"NE", NGA:"NG", NIR:"GB",
  NOR:"NO", NZL:"NZ", PAR:"PY", PER:"PE", POL:"PL", POR:"PT", ROU:"RO", RUS:"RU", RSA:"ZA", RWA:"RW", SCO:"GB", SEN:"SN", SMR:"SM",
  SRB:"RS", SLO:"SI", SVK:"SK", SOM:"SO", SSD:"SS", SUI:"CH", SWE:"SE", TAN:"TZ", TOG:"TG", TUN:"TN", TUR:"TR",
  UKR:"UA", URU:"UY", USA:"US", VEN:"VE", WAL:"GB", ZAM:"ZM",
};

export function teamCountryCodeFromShort(short?: string): string | null {
  const value = (short ?? "").trim().toUpperCase();
  if (!value) return null;
  if (/^[A-Z]{2}$/.test(value)) return value;
  return FIFA_TO_ISO2[value] ?? null;
}

export function countryForLeague(league: LeagueId): CountryFlagSpec {
  return LEAGUE_COUNTRY[league];
}
