/**
 * Budget a non-critical read without abandoning its in-flight refresh.
 * A timed-out or rejected read returns an explicit fallback, never invented data.
 */
export async function withTimeoutFallback<T>(
  work: Promise<T>,
  timeoutMs: number,
  fallback: () => T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ms = Math.max(1, Math.min(15_000, Math.floor(timeoutMs)));
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms);
  });
  try {
    return await Promise.race([work.catch(() => fallback()), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
