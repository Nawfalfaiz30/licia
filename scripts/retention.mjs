import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan.");
  process.exit(1);
}
const keepDays = Math.max(7, Math.min(Number(process.env.LICIA_LOG_RETENTION_DAYS || 90), 3650));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("licia_prune_operational_logs", { p_keep_days: keepDays });
if (error) {
  console.error("Retention job gagal:", error.message);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, keepDays, result: data }, null, 2));
