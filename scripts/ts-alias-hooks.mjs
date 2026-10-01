import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function isFile(file) {
  try {
    return existsSync(file) && statSync(file).isFile();
  } catch {
    return false;
  }
}

function withExt(base) {
  // Prefer concrete files before directories. This prevents Node ESM from
  // resolving "@/lib/seo" to the sibling directory "seo/" when "seo.ts"
  // is the intended module.
  if (isFile(base)) return base;
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    if (isFile(base + ext)) return base + ext;
  }
  for (const indexFile of ["index.ts", "index.tsx", "index.js", "index.mjs"]) {
    const candidate = join(base, indexFile);
    if (isFile(candidate)) return candidate;
  }
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