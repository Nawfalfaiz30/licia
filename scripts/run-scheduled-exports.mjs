import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKey = process.env.LICIA_BACKUP_ENCRYPTION_KEY;
if (!url || !serviceKey || !encryptionKey)
  throw new Error("Supabase service-role dan LICIA_BACKUP_ENCRYPTION_KEY diperlukan.");
const key = Buffer.from(encryptionKey, "base64");
if (key.length !== 32) throw new Error("LICIA_BACKUP_ENCRYPTION_KEY harus base64 32-byte.");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  "areas",
  "accounts",
  "account_transfers",
  "goals",
  "projects",
  "tasks",
  "subtasks",
  "schedule_blocks",
  "pomodoro_sessions",
  "smart_inbox_items",
  "brain_dump_notes",
  "decisions",
  "skills",
  "reading_logs",
  "habits",
  "habit_checkins",
  "expenses",
  "incomes",
  "budgets",
  "subscriptions",
  "hydration_logs",
  "caffeine_logs",
  "meal_logs",
  "medication_logs",
  "fatigue_logs",
  "sleep_logs",
  "daily_plans",
  "goal_milestones",
  "movement_logs",
  "reading_sessions",
  "health_metrics",
  "user_memories",
  "automations",
  "vault_items",
  "reminders",
  "notification_events",
  "ai_action_history",
];

function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("licia-backup-v1"), iv, cipher.getAuthTag(), ciphertext]);
}

const now = new Date();
const { data: jobs, error } = await supabase.from("scheduled_exports").select("*").eq("enabled", true);
if (error) throw error;
for (const job of jobs || []) {
  if (job.last_run_at) {
    const since = now.getTime() - new Date(job.last_run_at).getTime();
    if (since < (job.frequency === "monthly" ? 25 : 6) * 86400000) continue;
  }
  const { data: profile } = await supabase.from("users").select("*").eq("id", job.user_id).maybeSingle();
  const tablesOut = {};
  for (const table of tables) {
    const { data, error: tableError } = await supabase.from(table).select("*").eq("user_id", job.user_id);
    tablesOut[table] = tableError ? [] : data || [];
  }
  const payload = {
    format: "licia-encrypted-backup",
    version: 1,
    created_at: now.toISOString(),
    profile: profile || {},
    tables: tablesOut,
  };
  const bytes = encryptJson(payload);
  const bucket = job.bucket || "licia-backups";
  const object =
    (job.object_prefix || "backups") + "/" + job.user_id + "/" + now.toISOString().replace(/[:.]/g, "-") + ".licia";
  const upload = await supabase.storage
    .from(bucket)
    .upload(object, bytes, { contentType: "application/octet-stream", upsert: false });
  if (upload.error) {
    await supabase
      .from("scheduled_exports")
      .update({
        last_run_at: now.toISOString(),
        last_status: "failed",
        last_error: upload.error.message,
        updated_at: now.toISOString(),
      })
      .eq("id", job.id);
    continue;
  }
  await supabase
    .from("scheduled_exports")
    .update({
      last_run_at: now.toISOString(),
      last_status: "completed",
      last_error: null,
      updated_at: now.toISOString(),
    })
    .eq("id", job.id);
}
console.log(JSON.stringify({ ok: true, ranAt: now.toISOString(), jobs: jobs?.length || 0 }));
