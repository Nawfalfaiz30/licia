import type { SupabaseClient } from "@supabase/supabase-js";

export type AiTraceStart = {
  userId: string;
  requestId: string;
  conversationId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  toolModel?: string | null;
  metadata?: Record<string, unknown>;
};

export function makeRequestId(prefix = "licia") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + "-" + random;
}

export async function startAiTrace(supabase: SupabaseClient, input: AiTraceStart) {
  const { data, error } = await supabase.from("ai_request_traces").insert({
    user_id: input.userId,
    request_id: input.requestId,
    conversation_id: input.conversationId ?? null,
    prompt_version: input.promptVersion ?? null,
    model: input.model ?? null,
    tool_model: input.toolModel ?? null,
    metadata: input.metadata ?? {},
    status: "started",
  }).select("id").single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.replace(/(?:sk-|xox[baprs]-|Bearer\\s+)[A-Za-z0-9._:-]+/gi, "[REDACTED]").slice(0, 500);
}

export async function finishAiTrace(
  supabase: SupabaseClient,
  traceId: string | null,
  input: {
    status: "completed" | "error" | "cancelled";
    tools?: string[];
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    latencyMs?: number | null;
    errorCode?: string | null;
    error?: unknown;
    metadata?: Record<string, unknown>;
  },
) {
  if (!traceId) return;
  await supabase.from("ai_request_traces").update({
    status: input.status,
    tools: input.tools ?? [],
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    total_tokens: input.totalTokens ?? null,
    latency_ms: input.latencyMs ?? null,
    error_code: input.errorCode ?? null,
    error_message: input.error ? safeError(input.error) : null,
    metadata: input.metadata ?? {},
    completed_at: new Date().toISOString(),
  }).eq("id", traceId);
}

export async function redactAiLogText(value: unknown): Promise<string> {
  return safeError(value);
}
