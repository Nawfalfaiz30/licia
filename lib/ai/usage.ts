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

/** Batas token AI per 24 jam per pengguna (LICIA_AI_DAILY_TOKEN_LIMIT; 0/kosong = tanpa batas). */
export function dailyTokenLimit(): number {
  const n = Number(process.env.LICIA_AI_DAILY_TOKEN_LIMIT || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function getDailyTokenUsage(supabase: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pageSize = 1000;
  let offset = 0;
  let total = 0;
  try {
    while (true) {
      const { data, error } = await supabase
        .from("ai_usage_events")
        .select("id,total_tokens")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      total += rows.reduce((sum: number, row: { total_tokens?: number | null }) => sum + Number(row.total_tokens || 0), 0);
      if (rows.length < pageSize) return total;
      offset += pageSize;
      if (offset >= 100_000) return Number.MAX_SAFE_INTEGER;
    }
  } catch (error) {
    console.warn("Licia AI usage quota read failed", error);
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Mengembalikan pesan error bila kuota habis, selain itu null. */
export async function checkDailyQuota(supabase: SupabaseClient, userId: string): Promise<{ message: string; used: number; limit: number } | null> {
  const limit = dailyTokenLimit();
  if (!limit) return null;
  const used = await getDailyTokenUsage(supabase, userId);
  if (used < limit) return null;
  return { message: "Kuota AI harian sudah habis. Coba lagi besok atau naikkan LICIA_AI_DAILY_TOKEN_LIMIT.", used, limit };
}
