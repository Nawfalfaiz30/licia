import type OpenAI from "openai";

type ChatCompletionParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type ReasoningEffort = ChatCompletionParams["reasoning_effort"];
type GenerationOptions = Pick<ChatCompletionParams, "temperature" | "reasoning_effort">;

function retryable(error: unknown): boolean {
  const e = error as any;
  const status = Number(e?.status || e?.response?.status || 0);
  const message = String(e?.message || "");
  const name = String(e?.name || "");
  if (name === "AbortError" || /aborted|aborterror|request.*aborted|operation.*aborted/i.test(message)) return false;
  if (/OPENAI_API_KEY/i.test(message)) return false;
  return !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function normalizeReasoningEffort(value: string | undefined): ReasoningEffort | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "auto" || normalized === "default") return undefined;
  const allowed = new Set(["none", "minimal", "low", "medium", "high"]);
  if (!allowed.has(normalized)) return undefined;
  return normalized as ReasoningEffort;
}

function unsupportedGenerationParameter(error: unknown, parameter: "temperature" | "reasoning_effort"): boolean {
  const e = error as any;
  const status = Number(e?.status || e?.response?.status || 0);
  const message = String(e?.message || "");
  if (status !== 400) return false;
  const escaped = parameter === "reasoning_effort" ? "reasoning[_ ]?effort" : "temperature";
  return new RegExp(`(?:unsupported|does not support|only the default)[\\s\\S]{0,180}${escaped}|${escaped}[\\s\\S]{0,180}(?:unsupported|does not support|only the default)`, "i").test(message);
}

/**
 * Generation parameters are server-configurable. By default Licia omits
 * temperature because newer reasoning models may reject explicit sampling
 * values. Set LICIA_AI_OMIT_TEMPERATURE=false to restore tuned temperatures.
 * LICIA_AI_REASONING_EFFORT can be none|minimal|low|medium|high, depending on
 * the selected model. The completion wrapper retries once without a parameter
 * when the API explicitly rejects that parameter.
 */
export function generationOptions(model: string, temperature: number, overrides?: { reasoningEffort?: string | null; omitTemperature?: boolean }): GenerationOptions {
  void model;
  const omitTemperature = overrides?.omitTemperature ?? envBool(process.env.LICIA_AI_OMIT_TEMPERATURE, true);
  const reasoningEffort = normalizeReasoningEffort(overrides?.reasoningEffort ?? process.env.LICIA_AI_REASONING_EFFORT ?? "none");
  const options: GenerationOptions = {};
  if (!omitTemperature && Number.isFinite(temperature)) options.temperature = temperature;
  if (reasoningEffort) options.reasoning_effort = reasoningEffort;
  return options;
}

export async function chatCompletion(
  client: OpenAI,
  params: ChatCompletionParams,
  requestOptions?: OpenAI.RequestOptions,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await client.chat.completions.create(params as any, requestOptions as any) as OpenAI.Chat.Completions.ChatCompletion;
  } catch (error) {
    const dropTemperature = unsupportedGenerationParameter(error, "temperature");
    const dropReasoning = unsupportedGenerationParameter(error, "reasoning_effort");
    if (!dropTemperature && !dropReasoning) throw error;

    const retryParams = { ...params } as unknown as Record<string, unknown>;
    if (dropTemperature) delete retryParams.temperature;
    if (dropReasoning) delete retryParams.reasoning_effort;

    console.warn("[licia-ai] Retrying completion without unsupported generation parameters", {
      model: params.model,
      removed: [dropTemperature ? "temperature" : null, dropReasoning ? "reasoning_effort" : null].filter(Boolean),
    });
    return await client.chat.completions.create(retryParams as unknown as ChatCompletionParams, requestOptions as OpenAI.RequestOptions) as OpenAI.Chat.Completions.ChatCompletion;
  }
}

export function logCompletionFinish(completion: Pick<OpenAI.Chat.Completions.ChatCompletion, "choices">, endpoint: string) {
  const reason = completion.choices?.[0]?.finish_reason;
  if (reason === "length") console.warn("[licia-ai] Completion truncated by token limit", { endpoint, finish_reason: reason });
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

/* ------------------------------------------------------------------ */
/* v0.56 — Fallback model + circuit breaker                            */
/* ------------------------------------------------------------------ */

/**
 * Apakah error ini layak dicoba ulang pada MODEL CADANGAN?
 * Ya: timeout/overload/rate-limit (408, 409, 425, 429, 5xx), jaringan putus (tanpa status),
 *     dan model utama tidak tersedia (404 / model_not_found).
 * Tidak: pembatalan pengguna, API key salah (401/403), dan 400 biasa (permintaan memang salah,
 *        model lain pun akan menolaknya).
 */
export function isFallbackEligible(error: unknown): boolean {
  const e = error as any;
  const name = String(e?.name || "");
  const message = String(e?.message || "");
  if (name === "AbortError" || /aborted|aborterror/i.test(message)) return false;
  if (/OPENAI_API_KEY/i.test(message)) return false;
  const status = Number(e?.status || e?.response?.status || 0);
  const code = String(e?.code || e?.error?.code || "");
  if (code === "model_not_found" || /model[^.]{0,60}(does not exist|not found|not available|deprecated)/i.test(message)) return true;
  if (status === 401 || status === 403) return false;
  if (!status) return true;
  return status === 404 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

/**
 * Sama dengan selectAiFallbackModel() di modelRouter.ts. Sengaja diduplikasi: modul ini dimuat
 * langsung oleh Node dalam skrip test (--experimental-strip-types) yang tidak mengenal alias "@/",
 * sehingga tidak boleh meng-import modul lain milik proyek.
 */
function envFallbackModel(primary: string): string | null {
  const fb = process.env.LICIA_AI_FALLBACK_MODEL?.trim();
  return fb && fb !== primary ? fb : null;
}

type BreakerState = { failures: number; openUntil: number };
const breakers = new Map<string, BreakerState>();
const BREAKER_THRESHOLD = 3; // gagal berturut-turut sebelum model utama "dilewati"
const BREAKER_COOLDOWN_MS = 60_000; // lama model utama dilewati; setelah itu dicoba lagi (half-open)

function breakerOpen(model: string, nowMs: number): boolean {
  const b = breakers.get(model);
  return Boolean(b && b.openUntil > nowMs);
}
function breakerFailure(model: string, nowMs: number) {
  const b = breakers.get(model) ?? { failures: 0, openUntil: 0 };
  b.failures += 1;
  if (b.failures >= BREAKER_THRESHOLD) b.openUntil = nowMs + BREAKER_COOLDOWN_MS;
  breakers.set(model, b);
}
function breakerSuccess(model: string) {
  breakers.delete(model);
}
/** Untuk test & System Center. */
export function resetAiBreakers() {
  breakers.clear();
}
export function aiBreakerSnapshot(nowMs: number = Date.now()): Array<{ model: string; failures: number; open: boolean }> {
  return [...breakers.entries()].map(([model, b]) => ({ model, failures: b.failures, open: b.openUntil > nowMs }));
}

/**
 * Seperti chatCompletion(), tetapi bila model utama gagal dengan error yang layak (lihat
 * isFallbackEligible) dan LICIA_AI_FALLBACK_MODEL dikonfigurasi, permintaan yang SAMA diulang
 * pada model cadangan. Setelah 3 kegagalan beruntun, model utama dilewati selama 60 detik agar
 * pengguna tidak menunggu timeout berulang. Tanpa model cadangan, perilakunya identik dengan
 * chatCompletion().
 */
export async function chatCompletionWithFallback(
  client: OpenAI,
  params: ChatCompletionParams,
  requestOptions?: OpenAI.RequestOptions,
  opts?: { fallbackModel?: string | null; now?: () => number },
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const primary = String(params.model);
  const fallback = opts?.fallbackModel !== undefined ? opts.fallbackModel : envFallbackModel(primary);
  const clock = opts?.now ?? Date.now;

  if (!fallback) return chatCompletion(client, params, requestOptions);

  if (breakerOpen(primary, clock())) {
    console.warn("[licia-ai] Circuit breaker terbuka, memakai model cadangan", { primary, fallback });
    return chatCompletion(client, { ...params, model: fallback }, requestOptions);
  }

  try {
    const result = await chatCompletion(client, params, requestOptions);
    breakerSuccess(primary);
    return result;
  } catch (error) {
    if (!isFallbackEligible(error)) throw error;
    breakerFailure(primary, clock());
    console.warn("[licia-ai] Model utama gagal, mencoba model cadangan", {
      primary,
      fallback,
      status: (error as any)?.status ?? null,
    });
    return chatCompletion(client, { ...params, model: fallback }, requestOptions);
  }
}
