import type { SupabaseClient } from "@supabase/supabase-js";
import { emitLifeEvent } from "@/lib/events/bus";

const ACTIVE_STATUSES = ["pending", "waiting_for_device", "failed", "processing"] as const;

export async function cancelBoundReminders(
  supabase: SupabaseClient,
  userId: string,
  targetType: "task" | "schedule" | "goal" | "project" | "subscription" | "habit",
  targetIds: string | string[],
  reason = "target_deleted",
) {
  const ids = (Array.isArray(targetIds) ? targetIds : [targetIds]).map(String).filter(Boolean);
  if (!ids.length) return { cancelled: 0 };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reminders")
    .update({ enabled: false, status: "cancelled", updated_at: now })
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .in("target_id", ids)
    .in("status", [...ACTIVE_STATUSES])
    .select("id,target_id,title");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    await emitLifeEvent(supabase, { userId, eventType: "reminder.cancelled", entityType: "reminder", entityId: row.id, payload: { targetType, targetId: row.target_id, reason } });
  }
  return { cancelled: data?.length ?? 0 };
}

export async function cancelTaskReminders(supabase: SupabaseClient, userId: string, taskIds: string | string[], reason = "task_changed") {
  return cancelBoundReminders(supabase, userId, "task", taskIds, reason);
}

export async function cancelScheduleReminders(supabase: SupabaseClient, userId: string, blockIds: string | string[], reason = "schedule_changed") {
  return cancelBoundReminders(supabase, userId, "schedule", blockIds, reason);
}
