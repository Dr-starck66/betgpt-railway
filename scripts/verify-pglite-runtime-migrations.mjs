import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isMigrationFile } from "./migration-plan.mjs";

const root = process.cwd();
const sourceDir = join(root, "migrations");
const runtimeDir = join(root, ".output", "migrations");

const sourceNames = readdirSync(sourceDir)
  .filter(isMigrationFile)
  .sort((a, b) => a.localeCompare(b));

assert.ok(sourceNames.length > 0, "source migrations must not be empty");
assert.ok(existsSync(runtimeDir), ".output/migrations must exist in the production artifact");

const runtimeNames = readdirSync(runtimeDir)
  .filter(isMigrationFile)
  .sort((a, b) => a.localeCompare(b));

assert.deepEqual(
  runtimeNames,
  sourceNames,
  "runtime artifact must contain every top-level source migration exactly once",
);

for (const name of sourceNames) {
  const source = readFileSync(join(sourceDir, name), "utf8");
  const runtime = readFileSync(join(runtimeDir, name), "utf8");
  assert.equal(runtime, source, `runtime migration differs from source: ${name}`);
}

console.log(
  "ASTRA_PGLITE_RUNTIME_MIGRATIONS_PASS",
  JSON.stringify({ count: runtimeNames.length, names: runtimeNames }),
);
