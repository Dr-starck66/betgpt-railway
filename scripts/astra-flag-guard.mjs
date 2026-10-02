import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/components/country-flag.tsx",
  "src/lib/country-flag-resolver.ts",
  "src/routes/comparer-cotes.tsx",
  "src/components/scores-hub.tsx",
  "src/components/crest.tsx",
  "src/lib/team-flags.ts",
  "data/live-snapshot.json",
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`ASTRA FLAG GUARD FAIL: missing ${rel}`);
  }
}

const comparer = fs.readFileSync(path.join(root, "src/routes/comparer-cotes.tsx"), "utf8");
const scoresHub = fs.readFileSync(path.join(root, "src/components/scores-hub.tsx"), "utf8");
const crest = fs.readFileSync(path.join(root, "src/components/crest.tsx"), "utf8");
const component = fs.readFileSync(path.join(root, "src/components/country-flag.tsx"), "utf8");
const resolver = fs.readFileSync(path.join(root, "src/lib/country-flag-resolver.ts"), "utf8");
const teamFlags = fs.readFileSync(path.join(root, "src/lib/team-flags.ts"), "utf8");
const liveSnapshot = JSON.parse(fs.readFileSync(path.join(root, "data/live-snapshot.json"), "utf8"));

const mustContain = [
  [comparer, "<TeamLine", "comparer-cotes must delegate team/country visuals to TeamLine"],
  [comparer, "league={m.league}", "comparer-cotes must pass league context to TeamLine"],
  [scoresHub, "<TeamLine", "scores-en-direct must render TeamLine instead of text-only teams"],
  [scoresHub, "league={m.league}", "scores-en-direct must pass league context for country flags"],
  [crest, "CountryFlag", "TeamLine/Crest visual owner must use CountryFlag"],
  [crest, "countryForLeague", "TeamLine must resolve league countries centrally"],
  [crest, "nationalTeamCountryCode", "TeamLine must resolve national-team countries centrally"],
  [component, "flagcdn.com", "CountryFlag needs primary image source"],
  [component, "cdn.jsdelivr.net/gh/twitter/twemoji", "CountryFlag needs independent image fallback"],
  [resolver, "LEAGUE_COUNTRY", "central league-country map is missing"],
  [resolver, "FIFA_TO_ISO2", "central FIFA-to-country map is missing"],
];

for (const [text, needle, message] of mustContain) {
  if (!text.includes(needle)) throw new Error(`ASTRA FLAG GUARD FAIL: ${message}`);
}

const flagBranchIndex = crest.indexOf("if (flagCode)");
const logoBranchIndex = crest.indexOf("const srcs = logoCandidates");
if (flagBranchIndex < 0 || logoBranchIndex < 0 || flagBranchIndex > logoBranchIndex) {
  throw new Error("ASTRA FLAG GUARD FAIL: national teams must prefer CountryFlag before external crest/logo candidates");
}

function normalizeCountryName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const nationalFlagMatch = teamFlags.match(/const NATIONAL_FLAG:[\\s\\S]*?= \\{([\\s\\S]*?)\\n\\};/);
if (!nationalFlagMatch) {
  throw new Error("ASTRA FLAG GUARD FAIL: NATIONAL_FLAG registry not found");
}
const registeredNames = new Set();
for (const line of nationalFlagMatch[1].split("\\n")) {
  const quoted = line.match(/^\\s*"([^"]+)"\\s*:/);
  const bare = line.match(/^\\s*([a-z][a-z0-9 ]*)\\s*:/);
  const key = quoted?.[1] ?? bare?.[1];
  if (key) registeredNames.add(normalizeCountryName(key));
}

const nationalNames = new Set(
  (liveSnapshot.matches ?? [])
    .filter((match) => match?.league === "NL")
    .flatMap((match) => [match?.home?.name, match?.away?.name])
    .filter(Boolean)
    .map(normalizeCountryName),
);
const unresolvedNationalTeams = [...nationalNames].filter((name) => !registeredNames.has(name)).sort();
if (unresolvedNationalTeams.length) {
  throw new Error(
    `ASTRA FLAG GUARD FAIL: national-team flag resolution must cover every NL team; missing: ${unresolvedNationalTeams.join(", ")}`,
  );
}

const regionalPair = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

for (const file of walk(path.join(root, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  if (regionalPair.test(text)) {
    throw new Error(
      `ASTRA FLAG GUARD FAIL: direct regional-flag emoji found in ${path.relative(root, file)}; use CountryFlag instead`,
    );
  }
  regionalPair.lastIndex = 0;
}

console.log("ASTRA FLAG GUARD PASS: country flags use resilient image rendering with fallbacks.");
