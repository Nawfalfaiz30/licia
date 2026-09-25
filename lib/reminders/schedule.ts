import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureTimezoneOffset } from "@/lib/date";

type ScheduleRow = {
  id: string;
  title: string;
  block_date: string;
  start_time: string;
  end_time: string;
};

export async function getDefaultReminderMinutes(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("users").select("preferences").eq("id", userId).maybeSingle();
  const value = Number((data?.preferences as Record<string, unknown> | null)?.defaultReminderMinutes ?? 0);
  return Math.min(1440, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Creates the default reminder for a new timed agenda. Existing reminders are never
 * resurrected here so a user can intentionally cancel one without it reappearing.
 */
export async function createDefaultScheduleReminder(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  block: ScheduleRow,
  minutesBefore: number,
) {
  const minutes = Math.min(1440, Math.max(1, Number(minutesBefore) || 0));
  if (!minutes) return null;
  const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, timezone);
  const remindMs = startIso ? new Date(startIso).getTime() - minutes * 60_000 : NaN;
  if (!Number.isFinite(remindMs) || remindMs <= Date.now()) return null;

  const { data: existing } = await supabase
    .from("reminders")
    .select("id,status,enabled")
    .eq("user_id", userId)
    .eq("target_type", "schedule")
    .eq("target_id", block.id)
    .limit(1);
  if (existing?.[0]) return existing[0];

  const inserted = await supabase.from("reminders").insert({
    user_id: userId,
    title: `Pengingat: ${block.title}`,
    body: `${String(block.start_time).slice(0, 5)}–${String(block.end_time).slice(0, 5)}`,
    remind_at: new Date(remindMs).toISOString(),
    timezone,
    target_type: "schedule",
    target_id: block.id,
    offset_minutes: minutes,
    href: "/calendar",
    enabled: true,
    status: "pending",
    updated_at: new Date().toISOString(),
  }).select("id,title,remind_at,target_type,target_id,offset_minutes,status").maybeSingle();
  if (!inserted.error) return inserted.data ?? null;
  if (inserted.error.code === "23505") {
    const { data: existingAfterRace } = await supabase.from("reminders").select("id,status,enabled").eq("user_id", userId).eq("target_type", "schedule").eq("target_id", block.id).eq("offset_minutes", minutes).limit(1);
    return existingAfterRace?.[0] ?? null;
  }
  return null;
}

/** Keep an existing pending agenda reminder synced after a schedule edit. */
export async function syncExistingScheduleReminder(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  block: ScheduleRow,
) {
  const { data: reminder } = await supabase
    .from("reminders")
    .select("id,offset_minutes,status,enabled")
    .eq("user_id", userId)
    .eq("target_type", "schedule")
    .eq("target_id", block.id)
    .in("status", ["pending", "waiting_for_device"])
    .maybeSingle();
  if (!reminder || reminder.enabled === false || !reminder.offset_minutes) return null;
  const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, timezone);
  const remindMs = startIso ? new Date(startIso).getTime() - Number(reminder.offset_minutes) * 60_000 : NaN;
  if (!Number.isFinite(remindMs)) return null;
  const patch = {
    remind_at: new Date(remindMs).toISOString(),
    timezone,
    status: remindMs > Date.now() ? "pending" : "waiting_for_device",
    sent_at: null,
    updated_at: new Date().toISOString(),
  };
  const { data } = await supabase.from("reminders").update(patch).eq("id", reminder.id).eq("user_id", userId).select().maybeSingle();
  return data ?? null;
}


type TaskRow = {
  id: string;
  title: string;
  due_at: string | null;
};

export async function createDefaultTaskReminder(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  task: TaskRow,
  minutesBefore: number,
) {
  const minutes = Math.min(1440, Math.max(1, Number(minutesBefore) || 0));
  if (!minutes || !task.due_at) return null;
  const dueMs = new Date(task.due_at).getTime();
  if (!Number.isFinite(dueMs)) return null;
  const remindMs = dueMs - minutes * 60_000;
  if (!Number.isFinite(remindMs) || remindMs <= Date.now()) return null;
  const { data: existing } = await supabase
    .from("reminders")
    .select("id,status,enabled")
    .eq("user_id", userId)
    .eq("target_type", "task")
    .eq("target_id", task.id)
    .limit(1);
  if (existing?.[0]) return existing[0];
  const inserted = await supabase.from("reminders").insert({
    user_id: userId,
    title: `Pengingat: ${task.title}`,
    body: `Deadline ${new Date(task.due_at).toLocaleString("id-ID", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    remind_at: new Date(remindMs).toISOString(),
    timezone,
    target_type: "task",
    target_id: task.id,
    offset_minutes: minutes,
    href: "/tasks",
    enabled: true,
    status: "pending",
    updated_at: new Date().toISOString(),
  }).select("id,title,remind_at,target_type,target_id,offset_minutes,status").maybeSingle();
  if (!inserted.error) return inserted.data ?? null;
  if (inserted.error.code === "23505") {
    const { data: existingAfterRace } = await supabase.from("reminders").select("id,status,enabled").eq("user_id", userId).eq("target_type", "task").eq("target_id", task.id).eq("offset_minutes", minutes).limit(1);
    return existingAfterRace?.[0] ?? null;
  }
  return null;
}

export async function syncExistingTaskReminder(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  task: TaskRow,
) {
  const { data: reminder } = await supabase
    .from("reminders")
    .select("id,offset_minutes,status,enabled")
    .eq("user_id", userId)
    .eq("target_type", "task")
    .eq("target_id", task.id)
    .in("status", ["pending", "waiting_for_device", "failed"])
    .maybeSingle();
  if (!reminder || reminder.enabled === false || !reminder.offset_minutes) return null;
  if (!task.due_at) {
    const { data } = await supabase.from("reminders").update({ enabled: false, status: "cancelled", last_error: "Task deadline removed", updated_at: new Date().toISOString() }).eq("id", reminder.id).eq("user_id", userId).select().maybeSingle();
    return data ?? null;
  }
  const dueMs = new Date(task.due_at).getTime();
  const remindMs = dueMs - Number(reminder.offset_minutes) * 60_000;
  if (!Number.isFinite(remindMs)) return null;
  const status = remindMs > Date.now() ? "pending" : "waiting_for_device";
  const body = `Deadline ${new Date(task.due_at).toLocaleString("id-ID", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  const { data } = await supabase.from("reminders").update({
    title: `Pengingat: ${task.title}`, body, remind_at: new Date(remindMs).toISOString(), timezone, status, sent_at: null, last_attempt_at: null, updated_at: new Date().toISOString(),
  }).eq("id", reminder.id).eq("user_id", userId).select().maybeSingle();
  return data ?? null;
}
