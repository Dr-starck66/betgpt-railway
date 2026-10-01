import { copyFileSync, existsSync, mkdirSync, readdirSync, readlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { chatApiPlugin } from "./scripts/chat-api-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { goApiPlugin } from "./scripts/go-api-plugin.mjs";
import { seoPublicPlugin } from "./scripts/seo-public-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { canonicalOgPlugin } from "./scripts/canonical-og-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        // Persistence must be available before claiming this dev server is ready.
        throw err;
      }
    },
  };
}

/**
 * Nitro bundles PGlite's WASM module into the Vercel function, where its
 * runtime resolves these files relative to `_libs`. Vite hashes the same
 * files when it emits static assets, but that does not satisfy PGlite's
 * relative URLs. Copy the un-hashed runtime assets beside the bundled module
 * after Nitro has written the Vercel output.
 */
function pgliteVercelAssetsPlugin(): Plugin {
  let root = process.cwd();
  const assetNames = ["pglite.data", "pglite.wasm", "initdb.wasm"];

  return {
    name: "app-builder:pglite-vercel-assets",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    closeBundle() {
      // Nitro regenerates these aliases in its compiled hook. Remove only
      // aliases targeting this function, including those left by a prior build.
      const functionsDir = join(root, ".vercel", "output", "functions");
      const clearAliases = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isSymbolicLink() && entry.name.endsWith(".func") && readlinkSync(path).endsWith("__server.func")) unlinkSync(path);
          else if (entry.isDirectory() && !entry.name.endsWith(".func")) clearAliases(path);
        }
      };
      clearAliases(functionsDir);
      const packageRoots = [
        join(root, "node_modules", "@electric-sql", "pglite", "dist"),
        join(root, "node_modules", "@electric-sql", "pglite", "release"),
      ];
      const sourceDir = packageRoots.find((candidate) =>
        assetNames.every((name) => existsSync(join(candidate, name))),
      );
      if (!sourceDir) {
        throw new Error(
          `[app-builder] PGlite runtime assets missing; expected ${assetNames.join(", ")} in @electric-sql/pglite`,
        );
      }

      const targetDir = join(
        root,
        ".vercel",
        "output",
        "functions",
        "__server.func",
        "_libs",
      );
      const nodeServerTargetDir = join(root, ".output", "server", "_libs");
      for (const dir of [targetDir, nodeServerTargetDir]) {
        mkdirSync(dir, { recursive: true });
        for (const name of assetNames) {
          copyFileSync(join(sourceDir, name), join(dir, name));
        }
      }
      // Runtime fs reads are not traced from dynamic process.cwd() paths.
      // Ship football inputs explicitly; never bundle admin gates or email data.
      const dataDir = join(root, ".vercel", "output", "functions", "__server.func", "data");
      mkdirSync(dataDir, { recursive: true });
      for (const name of ["archive-history.json", "live-snapshot.json", "archive-backtest.json", "tickets.json", "prediction-versions.json", "learn.json", "forum-ia.json"]) {
        const source = join(root, "data", name);
        if (existsSync(source)) copyFileSync(source, join(dataDir, name));
      }
      console.log(`[app-builder] copied PGlite runtime assets to ${targetDir} and ${nodeServerTargetDir}`);
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

function nodeBuiltinBrowserShim(): Plugin {
  const shims: Record<string, string> = {
    "node:fs": `export function mkdirSync() {}
export function readFileSync() { return ""; }
export function writeFileSync() {}
export function existsSync() { return false; }
export default { mkdirSync, readFileSync, writeFileSync, existsSync };`,
    fs: `export function mkdirSync() {}
export function readFileSync() { return ""; }
export function writeFileSync() {}
export function existsSync() { return false; }
export default { mkdirSync, readFileSync, writeFileSync, existsSync };`,
    "node:path": `export function join(...a) { return a.filter(Boolean).join("/"); }
export function dirname(p) { const i = String(p).lastIndexOf("/"); return i <= 0 ? "." : String(p).slice(0, i); }
export default { join, dirname };`,
    path: `export function join(...a) { return a.filter(Boolean).join("/"); }
export function dirname(p) { const i = String(p).lastIndexOf("/"); return i <= 0 ? "." : String(p).slice(0, i); }
export default { join, dirname };`,
    "node:crypto": `export function createHmac() { return { update() { return this; }, digest() { return ""; } }; }
export function randomBytes(n) { return { toString() { return "0".repeat(Number(n) || 0); } }; }
export function scryptSync() { return new Uint8Array(32); }
export function timingSafeEqual() { return false; }
export default { createHmac, randomBytes, scryptSync, timingSafeEqual };`,
  };
  return {
    name: "node-builtin-browser-shim",
    enforce: "pre",
    resolveId(id, _importer, options) {
      if (options?.ssr) return null;
      if (id in shims) return `\0shim:${id}`;
      return null;
    },
    load(id) {
      if (!id.startsWith("\0shim:")) return null;
      return shims[id.slice("\0shim:".length)] ?? null;
    },
    transform(code, _id, options) {
      if (options?.ssr) return null;
      if (!code.includes("process.cwd")) return null;
      // Only rewrite cwd. Do not touch process.env: TanStack replaces
      // TSS_SERVER_FN_BASE / TSS_ROUTER_BASEPATH later, and rewriting them
      // turns server-function URLs into "/undefined<id>".
      const next = code.replace(/\bprocess\.cwd\s*\(\s*\)/g, '"/"');
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    // Engine snapshots (live-snapshot.json, archive, tickets…) rewrite often.
    // Watching them made Vite SSR do a full page reload — the preview jumped.
    watch: {
      ignored: [
        "**/data/**",
        "**/screenshots/**",
        "**/.grok/**",
        "**/.vercel/**",
        "**/dist/**",
      ],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    pgliteVercelAssetsPlugin(),
    nodeBuiltinBrowserShim(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    chatApiPlugin(),
    goApiPlugin(),
    seoPublicPlugin(),
    // Outer HTML wrapper: rewrite grok.me OG tags to betgpt.live (must register before grokPwaPlugin).
    canonicalOgPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset:
              process.env.NITRO_PRESET ||
              (process.env.RAILWAY_ENVIRONMENT ||
              process.env.RAILWAY_ENVIRONMENT_ID ||
              process.env.RAILWAY_PROJECT_ID ||
              process.env.RAILWAY_SERVICE_ID
                ? "node-server"
                : "vercel"),
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
