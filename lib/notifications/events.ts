import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser, isPushConfigured } from "@/lib/notifications/push";
import { emitLifeEvent } from "@/lib/events/bus";

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

  let event: any = null;
  let created = false;
  const columns = "id,title,body,href,tone,source_type,source_id,scheduled_at,delivered_at,read_at,created_at,delivery_attempts,last_delivery_error";
  const inserted = await supabase.from("notification_events").insert(row).select(columns).maybeSingle();
  if (!inserted.error && inserted.data) {
    event = inserted.data;
    created = true;
  } else if (inserted.error?.code === "23505") {
    const existing = await supabase.from("notification_events").select(columns).eq("dedupe_key", input.dedupeKey).eq("user_id", input.userId).maybeSingle();
    if (existing.error || !existing.data) throw new Error(existing.error?.message || "Notification event tidak dapat dimuat.");
    event = existing.data;
  } else if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  let delivered = Boolean(event?.delivered_at);
  let pushed = false;
  let errorMessage: string | null = event?.last_delivery_error || null;
  const shouldPush = Boolean(input.push && isPushConfigured() && event && !event.delivered_at);
  if (shouldPush) {
    try {
      const nextAttempts = Number(event.delivery_attempts || 0) + 1;
      const attemptUpdate = await supabase.from("notification_events").update({ delivery_attempts: nextAttempts }).eq("id", event.id).eq("user_id", input.userId);
      if (attemptUpdate.error) throw new Error(attemptUpdate.error.message);
      const results = await sendPushToUser(input.userId, { title: row.title, body: row.body, href: row.href, tag: input.dedupeKey });
      pushed = true;
      if (results.some((result) => result.ok)) {
        const deliveredAt = new Date().toISOString();
        const update = await supabase.from("notification_events").update({ delivered_at: deliveredAt, last_delivery_error: null }).eq("id", event.id).eq("user_id", input.userId);
        if (update.error) throw new Error(update.error.message);
        delivered = true;
        event = { ...event, delivered_at: deliveredAt, last_delivery_error: null, delivery_attempts: nextAttempts };
        await emitLifeEvent(supabase, { userId: input.userId, eventType: "notification.delivered", entityType: "notification", entityId: event.id, payload: { dedupeKey: input.dedupeKey, created } });
      } else {
        errorMessage = "Tidak ada perangkat push yang berhasil menerima notifikasi.";
        await supabase.from("notification_events").update({ last_delivery_error: errorMessage }).eq("id", event.id).eq("user_id", input.userId);
        event = { ...event, last_delivery_error: errorMessage, delivery_attempts: nextAttempts };
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Push gagal.";
      console.error("Notification push failed", input.dedupeKey, error);
      await supabase.from("notification_events").update({ last_delivery_error: errorMessage }).eq("id", event.id).eq("user_id", input.userId);
      event = { ...event, last_delivery_error: errorMessage };
    }
  }

  if (created) {
    await emitLifeEvent(supabase, { userId: input.userId, eventType: "notification.created", entityType: "notification", entityId: event.id, payload: { sourceType: row.source_type, sourceId: row.source_id, dedupeKey: input.dedupeKey } });
  }
  return { event, created, pushed, delivered, error: errorMessage };
}
