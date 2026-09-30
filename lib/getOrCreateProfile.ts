import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  userId: string,
  fallbackName?: string | null
) {
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, timezone")
    .eq("id", userId)
    .single();

  if (profile) return profile;

  // Profile row missing (e.g. account created before the auto-create trigger
  // existed). Create it now — auth.uid() = userId here, so RLS allows it.
  const { data: created } = await supabase
    .from("users")
    .upsert({ id: userId, display_name: fallbackName ?? null, timezone: "Asia/Jakarta" })
    .select("display_name, timezone")
    .single();

  return created ?? { display_name: fallbackName ?? null, timezone: "Asia/Jakarta" };
}
