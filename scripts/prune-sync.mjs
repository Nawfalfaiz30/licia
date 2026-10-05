import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.");
  process.exit(1);
}
const daysArg = Number(process.argv[2] || process.env.LICIA_SYNC_CONFLICT_RETENTION_DAYS || 90);
const days = Number.isFinite(daysArg) ? Math.max(30, Math.min(365, Math.floor(daysArg))) : 90;
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("licia_prune_sync_history", { _days: days });
if (error) {
  console.error(`Prune sync gagal: ${error.message}`);
  process.exit(1);
}
console.log(`Sync history dibersihkan: ${JSON.stringify(data)}`);
