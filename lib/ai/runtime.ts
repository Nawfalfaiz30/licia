function retryable(error: unknown): boolean {
  const e = error as any;
  const status = Number(e?.status || e?.response?.status || 0);
  const message = String(e?.message || "");
  const name = String(e?.name || "");
  if (name === "AbortError" || /aborted|aborterror|request.*aborted|operation.*aborted/i.test(message)) return false;
  if (/OPENAI_API_KEY/i.test(message)) return false;
  return !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function withOpenAIRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  signal?: AbortSignal,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= attempts; i += 1) {
    if (signal?.aborted) throw new DOMException("Permintaan dibatalkan.", "AbortError");
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (signal?.aborted || !retryable(error) || i >= attempts) break;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 450 * (i + 1));
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("Permintaan dibatalkan.", "AbortError"));
        }, { once: true });
      });
    }
  }
  throw last instanceof Error ? last : new Error("Permintaan AI gagal.");
}
