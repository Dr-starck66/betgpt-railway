import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function withExt(base) {
  if (existsSync(base) && !base.endsWith("/")) return base;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(join(base, "index.ts"))) return join(base, "index.ts");
  return base;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = withExt(join(SRC, specifier.slice(2)));
    return nextResolve(pathToFileURL(abs).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z0-9]+$/i.test(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const abs = withExt(join(dirname(parent), specifier));
    if (abs !== join(dirname(parent), specifier)) return nextResolve(pathToFileURL(abs).href, context);
  }
  return nextResolve(specifier, context);
}