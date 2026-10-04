import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("PGlite fallback loads top-level migrations under plain Node", async () => {
  const probe = `
    delete process.env.DATABASE_URL;
    const { getSql } = await import("./src/lib/db.ts");
    const sql = await getSql();
    const rows = await sql.query("select name from _migrations order by name");
    const names = rows.map((row) => String(row.name));
    if (names.length < 4) {
      throw new Error("expected top-level migrations, got: " + names.join(","));
    }
    console.log("ASTRA_PGLITE_NODE_FALLBACK_PASS", names.join(","));
  `;

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", probe],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: "" },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    },
  );

  assert.match(stdout, /ASTRA_PGLITE_NODE_FALLBACK_PASS/);
  assert.match(stdout, /0002_betgpt\.sql/);
  assert.match(stdout, /0005_search_truth\.sql/);
});
