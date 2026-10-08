export type EditorialLiveResult<T> = {
  value: T | null;
  status: "AVAILABLE" | "UNAVAILABLE" | "TIMEOUT";
};

// Match enrichment is optional for sourced news. Never let a shared live-data
// refresh hold every editorial reader and the publication cron indefinitely.
export async function editorialLiveWithinBudget<T>(
  load: () => Promise<T | null>,
  budgetMs = 45_000,
): Promise<EditorialLiveResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(load).then(
        (value): EditorialLiveResult<T> => ({ value, status: value == null ? "UNAVAILABLE" : "AVAILABLE" }),
        (): EditorialLiveResult<T> => ({ value: null, status: "UNAVAILABLE" }),
      ),
      new Promise<EditorialLiveResult<T>>((resolve) => {
        timer = setTimeout(() => resolve({ value: null, status: "TIMEOUT" }), budgetMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
