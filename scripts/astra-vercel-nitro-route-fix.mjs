#!/usr/bin/env node
/**
 * ASTRA BetGPT — Vercel Nitro Node SSR runtime route fix.
 *
 * Vercel Build Output API v3: Nitro's shared "__server.func" handler and its
 * auto-generated .func symlink aliases were HTTP 500 on the target project.
 * The very same full function, copied to a real named directory and reached
 * through a direct rewrite, answered real HTTP 200.
 *
 * This script runs AFTER the original npm build; it never changes source routes,
 * canonical URLs, data snapshots, sitemaps, or DNS.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, ".vercel", "output");
const configPath = join(output, "config.json");
if (!existsSync(configPath)) {
  console.log("ASTRA_VERCEL_NITRO_ROUTE_FIX_SKIPPED_NON_VERCEL");
  process.exit(0);
}
const functionRoot = join(output, "functions");
const nitroDir = join(functionRoot, "__server.func");
const targetDir = join(functionRoot, "betgpt_full.func");
if (!existsSync(join(nitroDir, "index.mjs")) || !existsSync(join(nitroDir, ".vc-config.json"))) {
  throw new Error("ASTRA_VERCEL_NITRO_ROUTE_FIX_MISSING_ORIGINAL_FUNCTION");
}
const sourceConfig = JSON.parse(readFileSync(join(nitroDir, ".vc-config.json"), "utf8"));
if (sourceConfig.launcherType !== "Nodejs" || !String(sourceConfig.runtime).startsWith("nodejs")) {
  throw new Error("ASTRA_VERCEL_NITRO_ROUTE_FIX_REQUIRES_NODE_ENTRY");
}
if (existsSync(targetDir)) rmSync(targetDir, {recursive:true,force:true});
cpSync(nitroDir, targetDir, {recursive:true,force:true});
if (!existsSync(join(targetDir, "index.mjs"))) throw new Error("ASTRA_VERCEL_NITRO_ROUTE_FIX_COPY_FAILED");

let aliasesRemoved = 0;
const cleanAliases = dir => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const filepath = join(dir, e.name);
    if (e.isSymbolicLink() && e.name.endsWith(".func")) {
      let target = "";
      try { target = readlinkSync(filepath); } catch { /* broken symlink */ }
      if (target.endsWith("__server.func")) { rmSync(filepath, { force: true }); aliasesRemoved++; }
    } else if (e.isDirectory() && !e.name.endsWith(".func")) cleanAliases(filepath);
  }
};
cleanAliases(functionRoot);

const conf = JSON.parse(readFileSync(configPath, "utf8"));
if (conf.version !== 3 || !Array.isArray(conf.routes)) {
  throw new Error("ASTRA_VERCEL_NITRO_ROUTE_FIX_BAD_BUILD_OUTPUT_CONFIG");
}
const headers = conf.routes.filter(r => r && typeof r === "object" && r.src && r.headers);
conf.routes = [
  ...headers,
  { handle: "filesystem" },
  { src: "/(.*)", dest: "/betgpt_full" }
];
writeFileSync(configPath, JSON.stringify(conf));
const checked = JSON.parse(readFileSync(configPath, "utf8"));
if (checked.routes.at(-1)?.dest !== "/betgpt_full") {
  throw new Error("ASTRA_VERCEL_NITRO_ROUTE_FIX_REWRITE_NOT_PERSISTED");
}
console.log("ASTRA_VERCEL_NITRO_ROUTE_FIX_PASS", JSON.stringify({
  original: "__server.func",
  destination: "betgpt_full.func",
  aliasesRemoved,
  preservedHeaderRules: headers.length,
  effectiveFallback: checked.routes.at(-1).dest,
  framework: conf.framework?.name ?? null
}));
