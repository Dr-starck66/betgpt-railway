import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/components/country-flag.tsx",
  "src/lib/country-flag-resolver.ts",
  "src/routes/comparer-cotes.tsx",
  "src/components/crest.tsx",
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`ASTRA FLAG GUARD FAIL: missing ${rel}`);
  }
}

const comparer = fs.readFileSync(path.join(root, "src/routes/comparer-cotes.tsx"), "utf8");
const crest = fs.readFileSync(path.join(root, "src/components/crest.tsx"), "utf8");
const component = fs.readFileSync(path.join(root, "src/components/country-flag.tsx"), "utf8");
const resolver = fs.readFileSync(path.join(root, "src/lib/country-flag-resolver.ts"), "utf8");

const mustContain = [
  [comparer, "<TeamLine", "comparer-cotes must delegate team/country visuals to TeamLine"],
  [comparer, "league={m.league}", "comparer-cotes must pass league context to TeamLine"],
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
