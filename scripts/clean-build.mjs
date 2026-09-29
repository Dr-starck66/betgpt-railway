import { lstatSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = resolve(root, ".vercel");
const output = resolve(parent, "output");
for (const path of [parent, output]) {
  try { if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing to clean a linked directory: ${path}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
// Only generated output; keep Vercel project identity and the source data.
rmSync(output, { recursive: true, force: true });
console.log("Previous generated Vercel output cleared.");
