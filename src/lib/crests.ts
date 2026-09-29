/** Club crests — ESPN CDN soccer/500/{numericId}.png. Never use slug ids. */
function fold(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonName(name: string): string {
  let s = fold(name);
  s = s
    .replace(
      /\b(fc|cf|afc|sc|ac|as|rc|ud|cd|vfb|tsg|rb|aj|ss|sk|nk|fk|sv|stade|calcio|the|1|bayer|borussia)\b/g,
      " ",
    )
    .trim();
  s = fold(s).replace(/\s+/g, "");
  for (const [re, to] of ALIAS) {
    if (re.test(s)) return to;
  }
  return s;
}

const ALIAS: Array<[RegExp, string]> = [
  [/manchestercity|mancity/, "mancity"],
  [/manchesterunited|manutd|manunited/, "manutd"],
  [/parissaintgermain|parissg|^psg$/, "psg"],
  [/^paris$|parisfc/, "parisfc"],
  [/nottinghamforest|^nottingham$/, "nottingham"],
  [/brighton/, "brighton"],
  [/tottenham/, "tottenham"],
  [/westham/, "westham"],
  [/newcastle/, "newcastle"],
  [/leeds/, "leeds"],
  [/crystalpalace/, "crystalpalace"],
  [/astonvilla/, "astonvilla"],
  [/atletico/, "atletico"],
  [/athletic/, "athletic"],
  [/realmadrid/, "realmadrid"],
  [/rayo/, "rayo"],
  [/bayern/, "bayern"],
  [/dortmund/, "dortmund"],
  [/augsburg|augsbourg/, "augsburg"],
  [/leverkusen/, "leverkusen"],
  [/unionberlin/, "unionberlin"],
  [/^inter$|intermilan|interista/, "inter"],
  [/^milan$|acmilan/, "milan"],
  [/^como$/, "como"],
  [/koln|cologne|koln/, "cologne"],
  [/stuttgart/, "stuttgart"],
  [/lyon/, "lyon"],
  [/marseille/, "marseille"],
  [/wolverhampton|wolves/, "wolves"],
  [/bournemouth/, "bournemouth"],
  [/sunderland/, "sunderland"],
  [/monaco/, "monaco"],
  [/realsociedad/, "realsociedad"],
  [/realbetis|^betis$/, "betis"],
  [/eintrachtfrankfurt|frankfurt/, "frankfurt"],
  [/gladbach|mgladbach|monchengladbach/, "gladbach"],
  [/rbleipzig|^leipzig$/, "leipzig"],
  [/werder/, "werder"],
  [/mayence|mainz/, "mainz"],
  [/fribourg|freiburg/, "freiburg"],
  [/barcelone|barcelona|^barca$/, "barcelona"],
  [/rennes|rennais/, "rennes"],
  [/psveindhoven|^psv$/, "psv"],
  [/fenerbahce|^fener$/, "fenerbahce"],
  [/shakhtar/, "shakhtar"],
  [/slavia/, "slavia"],
  [/^sabah/, "sabah"],
  [/wolfsburg|wolfsbourg/, "wolfsburg"],
  [/schalke/, "schalke"],
  [/olympiacos|olympiakos/, "olympiacos"],
  [/unionsaintgilloise|unionstgilloise|unionsg|usg/, "unionsg"],
  [/salzburg/, "salzburg"],
  [/jagiellonia/, "jagiellonia"],
  [/lillestrom|lillestrm/, "lillestrom"],
  [/hapoel/, "hapoel"],
  [/viktoriaplzen|plzen/, "plzen"],
  [/sturmgraz|^sturm$/, "sturmgraz"],
  [/bodglimt|bodoglimt|^bodo$|glimt/, "bodoglimt"],
  [/azalkmaar|^az$/, "az"],
  [/necnijmegen|^nec$/, "nec"],
  [/celtavigo|^celta$/, "celta"],
  [/spartaprague|^sparta$/, "sparta"],
  [/dinamozagreb|^dinamo$/, "dinamo"],
  [/lechpoznan|^lech$/, "lech"],
  [/havre/, "lehavre"],
  [/^mans$|lemans/, "lemans"],
  [/hamburger|^hamburg$/, "hamburg"],
  [/hoffenheim/, "hoffenheim"],
  [/paderborn/, "paderborn"],
  [/coventry/, "coventry"],
  [/hull/, "hull"],
  [/ipswich/, "ipswich"],
  [/deportivo/, "deportivo"],
  [/racingsantander|^racing$/, "racing"],
  [/^celje$/, "celje"],
  [/ararat/, "ararat"],
  [/besiktas/, "besiktas"],
  [/ferenc/, "ferencvaros"],
  [/anderlecht/, "anderlecht"],
  [/omonia/, "omonia"],
  [/levski/, "levski"],
  [/oficrete|^ofi$/, "ofi"],
  [/benfica/, "benfica"],
  [/celtic/, "celtic"],
];

/** Verified ESPN numeric ids. Wrong ids (Como 10464, Augsburg 3840, Monza 40071,
 *  Elversberg 19217, Paris FC 30484, Wolfsburg 133) are intentionally omitted. */
const ESPN_ID: Record<string, string> = {
  // Premier League / EFL
  arsenal: "359",
  chelsea: "363",
  liverpool: "364",
  mancity: "382",
  manutd: "360",
  tottenham: "367",
  newcastle: "361",
  astonvilla: "362",
  brighton: "331",
  westham: "371",
  crystalpalace: "384",
  fulham: "370",
  wolves: "380",
  everton: "368",
  bournemouth: "349",
  brentford: "337",
  nottingham: "393",
  leicester: "375",
  southampton: "376",
  ipswich: "373",
  leeds: "357",
  sunderland: "366",
  burnley: "379",
  hull: "306",
  coventry: "388",
  // LaLiga
  realmadrid: "86",
  barcelona: "83",
  atletico: "1068",
  sevilla: "243",
  realsociedad: "89",
  athletic: "93",
  villarreal: "102",
  betis: "244",
  realbetis: "244",
  valencia: "94",
  celta: "85",
  osasuna: "97",
  mallorca: "84",
  getafe: "2922",
  girona: "9812",
  rayo: "101",
  alaves: "96",
  espanyol: "88",
  laspalmas: "98",
  valladolid: "95",
  elche: "3751",
  levante: "1538",
  deportivo: "90",
  oviedo: "92",
  malaga: "99",
  racing: "87",
  // Bundesliga / 2.BL
  bayern: "132",
  dortmund: "124",
  leverkusen: "131",
  leipzig: "11420",
  frankfurt: "125",
  freiburg: "126",
  wolfsburg: "138",
  gladbach: "268",
  stuttgart: "134",
  hoffenheim: "7911",
  mainz: "2950",
  augsburg: "3841",
  unionberlin: "598",
  cologne: "122",
  werder: "137",
  hamburg: "127",
  heidenheim: "6418",
  stpauli: "270",
  elversberg: "10388",
  paderborn: "3307",
  schalke: "133",
  // Serie A / B
  inter: "110",
  milan: "103",
  juventus: "111",
  napoli: "114",
  roma: "104",
  lazio: "112",
  atalanta: "105",
  fiorentina: "109",
  bologna: "107",
  torino: "239",
  udinese: "118",
  genoa: "108",
  cagliari: "2925",
  verona: "119",
  empoli: "2574",
  lecce: "113",
  parma: "115",
  como: "2572",
  pisa: "3956",
  cremonese: "4050",
  monza: "4007",
  sassuolo: "3997",
  frosinone: "4057",
  venezia: "17530",
  // Ligue 1 / 2
  psg: "160",
  marseille: "176",
  lyon: "167",
  monaco: "174",
  lille: "166",
  nice: "175",
  rennes: "169",
  lens: "323",
  strasbourg: "2734",
  toulouse: "179",
  nantes: "165",
  reims: "182",
  brest: "171",
  auxerre: "173",
  lehavre: "3236",
  angers: "146",
  metz: "177",
  parisfc: "6851",
  lorient: "273",
  troyes: "170",
  lemans: "2697",
  // CL / EL / Europe
  fenerbahce: "436",
  psv: "148",
  shakhtar: "493",
  bodoglimt: "2980",
  sabah: "21922",
  slavia: "494",
  sparta: "433",
  celtic: "256",
  benfica: "1929",
  andrelecht: "441",
  anderlecht: "441",
  unionsg: "5807",
  salzburg: "2790",
  sturmgraz: "3746",
  dinamo: "597",
  ferencvaros: "622",
  besiktas: "1895",
  olympiacos: "435",
  omonia: "617",
  levski: "490",
  ararat: "20024",
  jagiellonia: "11505",
  lech: "2990",
  plzen: "11706",
  az: "140",
  nec: "147",
  celje: "3362",
  ofi: "1010",
  hapoel: "13083",
  lillestrom: "987",
};

const BAD_IDS = new Set([
  "10464", // Como wrong
  "3840", // Augsburg wrong
  "40071", // Monza wrong
  "19217", // Elversberg wrong
  "30484", // Paris FC wrong
  "21615", // Torreense — no ESPN png
]);

function espnPng(id: string): string {
  return `/crests/${id}.png`;
}

const LOCAL_CRESTS = new Set(
  "101,1010,102,103,10388,104,105,1068,107,108,109,110,111,112,113,114,11420,115,11505,11706,118,119,122,124,125,126,127,13083,131,132,133,134,137,138,140,146,147,148,1538,160,165,166,167,169,170,171,173,174,175,17530,176,177,179,182,1895,1929,20024,21922,239,243,244,256,2572,2574,268,2697,270,273,2734,2790,2922,2925,2950,2980,2990,306,323,3236,3307,331,3362,337,349,357,359,360,361,362,363,364,366,367,368,370,371,373,3746,375,3751,376,379,380,382,384,3841,388,393,3956,3997,4007,4050,4057,433,435,436,441,490,493,494,5807,597,598,617,622,6418,6851,7911,83,84,85,86,87,88,89,90,92,93,94,95,96,97,98,9812,987,99".split(
    ",",
  ),
);

function espnCdn(id: string): string {
  return `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
}

function usableExplicit(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const m = url.match(/soccer\/500\/([^/.]+)\.png/i);
  if (m) {
    if (!/^\d+$/.test(m[1])) return false;
    if (BAD_IDS.has(m[1])) return false;
  }
  return true;
}

export function logoCandidates(name: string, id?: string, explicit?: string): string[] {
  const out: string[] = [];
  const add = (u?: string) => {
    if (u && !out.includes(u)) out.push(u);
  };
  const addId = (num?: string) => {
    if (!num || !/^\d+$/.test(num) || BAD_IDS.has(num)) return;
    if (LOCAL_CRESTS.has(num)) add(espnPng(num));
    add(espnCdn(num));
  };
  const mapped = ESPN_ID[canonName(name)];
  addId(mapped);
  if (id && id !== mapped) addId(id);
  if (explicit && usableExplicit(explicit)) {
    const m = explicit.match(/soccer\/500\/(\d+)\.png/i);
    if (m) addId(m[1]);
    else add(explicit);
  }
  if (explicit && /^\/crests\/(\d+)\.png$/.test(explicit)) {
    const id = explicit.match(/^\/crests\/(\d+)\.png$/)?.[1];
    if (id && LOCAL_CRESTS.has(id)) add(explicit);
  }
  return out;
}

export function logoFor(name: string, id?: string, explicit?: string): string | undefined {
  return logoCandidates(name, id, explicit)[0];
}
