import type { SupabaseClient } from "@supabase/supabase-js";

export type LifeEventType =
  | "task.created" | "task.updated" | "task.completed" | "task.deleted"
  | "schedule.created" | "schedule.updated" | "schedule.deleted"
  | "reminder.created" | "reminder.updated" | "reminder.cancelled" | "reminder.sent"
  | "notification.created" | "notification.delivered" | "notification.read"
  | "goal.updated" | "project.updated" | "memory.updated" | "automation.executed";

export async function emitLifeEvent(
  supabase: SupabaseClient,
  input: { userId: string; eventType: LifeEventType; entityType: string; entityId?: string | null; payload?: Record<string, unknown> },
) {
  try {
    const { error } = await supabase.from("life_os_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      payload: input.payload ?? {},
    });
    if (error) console.warn("Licia event emit failed", input.eventType, error.message);
  } catch (error) {
    console.warn("Licia event emit failed", input.eventType, error);
  }
}
