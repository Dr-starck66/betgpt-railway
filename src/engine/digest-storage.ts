import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A digest must never be sent before storage is confirmed durable.
 * Serverless function filesystems are ephemeral even if /tmp is writable.
 * Fail closed: no persistence claim, no duplicate-prone email send.
 */
export function probeDigestStorage(
  directory: string,
  runtime: { VERCEL?: string; AWS_LAMBDA_FUNCTION_NAME?: string } = process.env,
): { ok: true } | { ok: false; reason: string } {
  if (runtime.VERCEL || runtime.AWS_LAMBDA_FUNCTION_NAME) {
    return { ok: false, reason: "SERVERLESS_STORAGE_NOT_DURABLE" };
  }
  let probe: string | undefined;
  try {
    mkdirSync(directory, { recursive: true });
    probe = join(directory, `.astra-digest-probe-${process.pid}-${randomUUID()}`);
    writeFileSync(probe, "", { flag: "wx" });
    unlinkSync(probe);
    return { ok: true };
  } catch (error) {
    if (probe) {
      try { unlinkSync(probe); } catch { /* already removed or read-only */ }
    }
    const reason = error instanceof Error
      ? ((error as NodeJS.ErrnoException).code ?? error.message)
      : "UNKNOWN_STORAGE_ERROR";
    return { ok: false, reason };
  }
}
