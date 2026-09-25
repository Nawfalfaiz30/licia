import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser, isPushConfigured } from "@/lib/notifications/push";

export type NotificationEventInput = {
  userId: string;
  dedupeKey: string;
  title: string;
  body?: string | null;
  href?: string | null;
  tone?: string;
  sourceType?: string;
  sourceId?: string | null;
  scheduledAt?: string;
  push?: boolean;
};

export async function upsertNotificationEvent(supabase: SupabaseClient, input: NotificationEventInput) {
  const row = {
    user_id: input.userId,
    dedupe_key: input.dedupeKey,
    title: input.title.slice(0, 180),
    body: input.body ? input.body.slice(0, 1000) : null,
    href: input.href || "/",
    tone: input.tone || "accent",
    source_type: input.sourceType || "system",
    source_id: input.sourceId || null,
    scheduled_at: input.scheduledAt || new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("notification_events")
    .upsert(row, { onConflict: "dedupe_key" })
    .select("id,title,body,href,tone,source_type,source_id,scheduled_at,delivered_at,read_at,created_at")
    .single();
  if (error) throw new Error(error.message);

  if (input.push && isPushConfigured()) {
    try {
      const results = await sendPushToUser(input.userId, {
        title: row.title,
        body: row.body,
        href: row.href,
        tag: input.dedupeKey,
      });
      if (results.some((result) => result.ok)) {
        await supabase.from("notification_events").update({ delivered_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", input.userId);
      }
    } catch (error) {
      console.error("Notification push failed", input.dedupeKey, error);
    }
  }

  return data;
}
