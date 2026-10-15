import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  input: {
    model: string;
    endpoint?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  },
) {
  const prompt = Number(input.usage?.prompt_tokens || 0);
  const completion = Number(input.usage?.completion_tokens || 0);
  const total = Number(input.usage?.total_tokens || prompt + completion);
  if (!Number.isFinite(total) || total <= 0) return;
  try {
    const { error } = await supabase.from("ai_usage_events").insert({
      user_id: userId,
      model: input.model,
      endpoint: input.endpoint || "chat",
      input_tokens: prompt,
      output_tokens: completion,
      total_tokens: total,
    });
    if (error) console.warn("Licia AI usage record failed", { code: error.code || "unknown" });
  } catch (error) {
    console.warn("Licia AI usage record failed", { name: error instanceof Error ? error.name : "unknown" });
  }
}

const DEFAULT_DAILY_TOKEN_LIMIT = 20_000;

/** Batas token AI per 24 jam per pengguna. Nilai 0 = tanpa batas; kosong memakai batas aman bawaan. */
export function dailyTokenLimit(): number {
  const raw = process.env.LICIA_AI_DAILY_TOKEN_LIMIT;
  if (raw == null || raw.trim() === "") return DEFAULT_DAILY_TOKEN_LIMIT;
  const n = Number(raw);
  if (n === 0) return 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_TOKEN_LIMIT;
}

export async function getDailyTokenUsage(supabase: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabase.rpc("licia_get_ai_usage_total", { p_since: since });
    if (!error && data != null) {
      const total = Number(data);
      if (Number.isFinite(total) && total >= 0) return total;
    }
  } catch {}

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
      total += rows.reduce(
        (sum: number, row: { total_tokens?: number | null }) => sum + Number(row.total_tokens || 0),
        0,
      );
      if (rows.length < pageSize) return total;
      offset += pageSize;
      if (offset >= 100_000) return Number.MAX_SAFE_INTEGER;
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code || "unknown")
        : "unknown";
    console.warn("Licia AI usage quota read failed", { code });
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Mengembalikan detail bila kuota habis, selain itu null. */
export async function checkDailyQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ message: string; used: number; limit: number } | null> {
  const limit = dailyTokenLimit();
  if (!limit) return null;
  const used = await getDailyTokenUsage(supabase, userId);
  if (used < limit) return null;
  return {
    message: "Kuota AI harian sudah habis. Coba lagi besok atau naikkan LICIA_AI_DAILY_TOKEN_LIMIT.",
    used,
    limit,
  };
}
