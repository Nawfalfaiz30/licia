import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceSameOrigin } from "@/lib/security";
import { isPushConfigured } from "@/lib/notifications/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function count(query: any) {
  const result = await query;
  return { count: result.count ?? 0, error: result.error?.message || null };
}

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const admin = createAdminClient();
  const now = Date.now();

  const [healthRes, heartbeatRes, reminderRes, notificationRes, subscriptionRes, taskReminderRes, scheduleReminderRes, overdueRes, stuckRes, aiUsageRes] = await Promise.all([
    fetch(new URL("/api/health", req.url), { headers: { cookie: req.headers.get("cookie") || "" }, cache: "no-store" }).then((r) => r.json()).catch(() => null),
    admin.from("system_health_heartbeats").select("component,status,details,updated_at").eq("component", "reminder-worker").maybeSingle(),
    count(supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
    count(supabase.from("notification_events").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
    count(supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true)),
    count(supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("target_type", "task").eq("enabled", true).in("status", ["pending", "waiting_for_device", "failed", "processing"])),
    count(supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("target_type", "schedule").eq("enabled", true).in("status", ["pending", "waiting_for_device", "failed", "processing"])),
    count(supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true).in("status", ["pending", "waiting_for_device", "failed", "processing"]).lt("remind_at", new Date().toISOString())),
    count(supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true).eq("status", "processing").lt("last_attempt_at", new Date(now - 10 * 60_000).toISOString())),
    count(supabase.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(now - 24 * 3600000).toISOString())),
  ]);

  const schemaProbe = await Promise.all([
    supabase.from("reminders").select("id,delivery_attempts,last_error").limit(1),
    supabase.from("notification_events").select("id,delivery_attempts,last_delivery_error").limit(1),
    admin.from("system_health_heartbeats").select("component").limit(1),
    supabase.from("ai_usage_events").select("id").limit(1),
  ]);
  const schema = {
    remindersV30: !schemaProbe[0].error,
    notificationDeliveryFields: !schemaProbe[1].error,
    heartbeatTable: !schemaProbe[2].error,
    aiUsageEvents: !schemaProbe[3].error,
  };

  const activeTargetReminders = await supabase.from("reminders").select("id,target_type,target_id").eq("user_id", user.id).eq("enabled", true).in("status", ["pending", "waiting_for_device", "failed", "processing"]).not("target_id", "is", null).limit(500);
  const taskIds = Array.from(new Set((activeTargetReminders.data ?? []).filter((r: any) => r.target_type === "task").map((r: any) => String(r.target_id))));
  const scheduleIds = Array.from(new Set((activeTargetReminders.data ?? []).filter((r: any) => r.target_type === "schedule").map((r: any) => String(r.target_id))));
  const [{ data: taskRows }, { data: scheduleRows }] = await Promise.all([
    taskIds.length ? supabase.from("tasks").select("id").eq("user_id", user.id).in("id", taskIds) : Promise.resolve({ data: [] as any[] }),
    scheduleIds.length ? supabase.from("schedule_blocks").select("id").eq("user_id", user.id).in("id", scheduleIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const validTaskIds = new Set((taskRows ?? []).map((r: any) => String(r.id)));
  const validScheduleIds = new Set((scheduleRows ?? []).map((r: any) => String(r.id)));
  const orphanedReminders = (activeTargetReminders.data ?? []).filter((r: any) => (r.target_type === "task" && !validTaskIds.has(String(r.target_id))) || (r.target_type === "schedule" && !validScheduleIds.has(String(r.target_id)))).length;

  const heartbeat = heartbeatRes.data;
  const heartbeatAgeMs = heartbeat?.updated_at ? now - new Date(heartbeat.updated_at).getTime() : Infinity;
  const cronConfigured = Boolean(process.env.LICIA_CRON_SECRET?.trim());
  const workerStatus = heartbeat ? (heartbeatAgeMs <= 3 * 60_000 ? heartbeat.status : cronConfigured ? "degraded" : "degraded") : cronConfigured ? "error" : "degraded";
  const issues: string[] = [];
  if (!schema.remindersV30 || !schema.notificationDeliveryFields || !schema.heartbeatTable || !schema.aiUsageEvents) issues.push("Migration V30 belum lengkap.");
  if (orphanedReminders > 0) issues.push(`${orphanedReminders} reminder aktif tidak memiliki target sumber.`);
  if ((stuckRes.count ?? 0) > 0) issues.push(`${stuckRes.count} reminder terdeteksi macet di processing.`);
  if ((overdueRes.count ?? 0) > 0) issues.push(`${overdueRes.count} reminder sudah jatuh tempo dan masih belum terkirim.`);
  if (workerStatus === "error") issues.push("Reminder worker belum mengirim heartbeat.");
  if ((notificationRes.count ?? 0) > 0 && !isPushConfigured()) issues.push("Ada notification event tetapi Web Push server belum dikonfigurasi.");

  const ok = Boolean(healthRes?.database && schema.remindersV30 && schema.notificationDeliveryFields && schema.heartbeatTable && schema.aiUsageEvents && orphanedReminders === 0 && (stuckRes.count ?? 0) === 0 && issues.length === 0);
  return NextResponse.json({
    ok,
    checkedAt: new Date().toISOString(),
    userId: user.id,
    health: healthRes,
    schema,
    worker: { status: workerStatus, heartbeat: heartbeat?.updated_at || null, ageMs: Number.isFinite(heartbeatAgeMs) ? heartbeatAgeMs : null, details: heartbeat?.details ?? null, cronConfigured },
    reminders: { total: reminderRes.count, activeTask: taskReminderRes.count, activeSchedule: scheduleReminderRes.count, overdue: overdueRes.count, stuckProcessing: stuckRes.count, orphaned: orphanedReminders },
    notifications: { total: notificationRes.count, pushSubscriptions: subscriptionRes.count },
    ai: { usageEvents24h: aiUsageRes.count },
    issues,
  }, { headers: { "Cache-Control": "no-store" } });
}
