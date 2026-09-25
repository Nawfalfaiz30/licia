function retryable(error: unknown): boolean {
  const e = error as any;
  const status = Number(e?.status || e?.response?.status || 0);
  const message = String(e?.message || "");
  if (/OPENAI_API_KEY/i.test(message)) return false;
  return !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function withOpenAIRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (i >= attempts || !retryable(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Permintaan AI gagal.");
}
