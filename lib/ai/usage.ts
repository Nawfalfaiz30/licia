import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  input: { model: string; endpoint?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null },
) {
  const prompt = Number(input.usage?.prompt_tokens || 0);
  const completion = Number(input.usage?.completion_tokens || 0);
  const total = Number(input.usage?.total_tokens || prompt + completion);
  if (!Number.isFinite(total) || total <= 0) return;
  try {
    await supabase.from("ai_usage_events").insert({ user_id: userId, model: input.model, endpoint: input.endpoint || "chat", input_tokens: prompt, output_tokens: completion, total_tokens: total });
  } catch (error) {
    console.warn("Licia AI usage record failed", error);
  }
}
