import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const TMP = "/tmp/betgpt-data";

function canWrite(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".w"), "1");
    return true;
  } catch {
    return false;
  }
}

let ROOT: string | undefined;

export function persistRoot(): string {
  if (ROOT) return ROOT;
  const local = join(process.cwd(), "data");
  ROOT = canWrite(local) ? local : TMP;
  if (ROOT === TMP) canWrite(TMP);
  return ROOT;
}

export function persistPath(name: string): string {
  return join(persistRoot(), name);
}

export function readPersist(name: string): string | null {
  for (const p of [persistPath(name), join(process.cwd(), "data", name), join("/workspace/data", name)]) {
    try {
      if (existsSync(p)) return readFileSync(p, "utf8");
    } catch {
      /* */
    }
  }
  return null;
}

export function writePersist(name: string, body: string): boolean {
  try {
    const p = persistPath(name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
    return true;
  } catch {
    return false;
  }
}
