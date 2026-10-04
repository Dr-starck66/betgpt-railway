#!/usr/bin/env node
import { readFileSync } from "node:fs";

const live = readFileSync("src/engine/live.ts", "utf8");
const money = readFileSync("src/lib/money.ts", "utf8");
const links = readFileSync("src/lib/bookmaker-url.ts", "utf8");

const failures = [];
if (/p\.homeOdds|p\.drawOdds|p\.awayOdds/.test(live)) {
  failures.push("HTML_PARSED_ODDS_MUST_NOT_FEED_PUBLIC_1X2");
}
if (!money.includes("bestFreshMainQuote") || !money.includes("requireTimestamp: true")) {
  failures.push("PUBLIC_BEST_ODDS_MUST_REQUIRE_FRESH_PROVIDER_TIMESTAMPS");
}
if (!links.includes("isExactBookmakerMatchUrl") || /return\s+(UNIBET_LEAGUE|BETCLIC_LEAGUE|NETBET_LEAGUE)\[/.test(links)) {
  failures.push("CTA_MUST_NOT_FALL_BACK_TO_GENERIC_BOOKMAKER_PAGES");
}
if (!/const SCHEMA = 40;/.test(live)) {
  failures.push("OLD_FALSE_ODDS_SNAPSHOT_MUST_BE_INVALIDATED");
}
if (failures.length) {
  console.error("ASTRA_ODDS_TRUTH_FAIL", failures.join(","));
  process.exit(1);
}
console.log("ASTRA_ODDS_TRUTH_PASS fresh_provider_quotes_only=true html_odds_ingestion=false exact_match_cta_only=true");
