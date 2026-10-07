import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY diperlukan.");
  process.exit(1);
}

const defaultKeepDays = Math.max(7, Math.min(Number(process.env.LICIA_LOG_RETENTION_DAYS || 90), 3650));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: preferences, error } = await supabase
  .from("ai_privacy_preferences")
  .select("user_id,log_retention_days");
if (error) {
  console.error("Preferensi retensi gagal dibaca:", error.message);
  process.exit(1);
}

let deletedRows = 0;
let processedUsers = 0;
const failures = [];

for (const row of preferences || []) {
  const keepDays = Math.max(7, Math.min(Number(row.log_retention_days || defaultKeepDays), 3650));
  const result = await supabase.rpc("licia_prune_operational_logs_for_user", {
    p_user_id: row.user_id,
    p_keep_days: keepDays,
  });
  if (result.error) failures.push({ userId: row.user_id, error: result.error.message });
  else {
    processedUsers += 1;
    deletedRows += Number(result.data?.deleted_rows || 0);
  }
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  processedUsers,
  deletedRows,
  defaultKeepDays,
  failures,
}, null, 2));
if (failures.length) process.exit(1);
