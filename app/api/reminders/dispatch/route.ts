import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, isPushConfigured } from "@/lib/notifications/push";
import { ensureTimezoneOffset } from "@/lib/date";
import { enforceSameOrigin } from "@/lib/security";
import { upsertNotificationEvent } from "@/lib/notifications/events";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: Request) {
  const secret = process.env.LICIA_CRON_SECRET?.trim();
  const header = req.headers.get("x-licia-cron-secret")?.trim();
  return Boolean(secret && header && secret === header);
}

async function heartbeat(supabase: SupabaseClient, status: "ok" | "degraded" | "error", details: Record<string, unknown>) {
  try {
    await supabase.from("system_health_heartbeats").upsert({ component: "reminder-worker", status, details, updated_at: new Date().toISOString() });
  } catch (error) {
    console.warn("Reminder worker heartbeat failed", error);
  }
}

async function syncLegacyScheduleReminders(supabase: SupabaseClient, userId?: string) {
  let legacy = supabase.from("automations").select("id,user_id,name,trigger_config,enabled").eq("enabled", true).eq("trigger_type", "schedule_soon").limit(200);
  if (userId) legacy = legacy.eq("user_id", userId);
  const { data: legacyRules } = await legacy;
  for (const rule of legacyRules ?? []) {
    const targetId = rule.trigger_config?.schedule_block_id ? String(rule.trigger_config.schedule_block_id) : "";
    if (!targetId) continue;
    const minutes = Math.min(1440, Math.max(1, Number(rule.trigger_config?.minutes) || 30));
    const { data: block } = await supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("id", targetId).eq("user_id", rule.user_id).maybeSingle();
    if (!block) {
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", last_error: "Legacy schedule target sudah tidak ada.", updated_at: new Date().toISOString() }).eq("user_id", rule.user_id).eq("target_type", "schedule").eq("target_id", targetId).in("status", ["pending", "waiting_for_device", "failed", "processing"]);
      continue;
    }
    const { data: profile } = await supabase.from("users").select("timezone").eq("id", rule.user_id).maybeSingle();
    const timezone = profile?.timezone || "Asia/Jakarta";
    const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0,8)}`, timezone);
    if (!startIso) continue;
    const remindAt = new Date(new Date(startIso).getTime() - minutes * 60_000).toISOString();
    const payload = { title: rule.name || `Pengingat: ${block.title}`, body: `${block.title} · ${String(block.start_time).slice(0,5)}–${String(block.end_time).slice(0,5)}`, remind_at: remindAt, timezone, target_type: "schedule", target_id: block.id, offset_minutes: minutes, href: "/calendar", enabled: true, status: "pending", updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from("reminders").select("id").eq("user_id", rule.user_id).eq("target_type", "schedule").eq("target_id", block.id).limit(1);
    if (existing?.[0]) await supabase.from("reminders").update(payload).eq("id", existing[0].id).eq("user_id", rule.user_id).neq("status", "sent");
    else await supabase.from("reminders").insert({ user_id: rule.user_id, ...payload });
  }
}

async function repairScheduleReminders(supabase: SupabaseClient, userId?: string, now = new Date()) {
  let remindersQuery = supabase.from("reminders").select("id,user_id,title,target_id,offset_minutes,timezone,status,enabled").eq("enabled", true).eq("target_type", "schedule").in("status", ["pending", "waiting_for_device", "failed", "processing"]).limit(500);
  if (userId) remindersQuery = remindersQuery.eq("user_id", userId);
  const { data: scheduledReminders } = await remindersQuery;
  const scheduleIds = Array.from(new Set((scheduledReminders ?? []).map((r: any) => String(r.target_id || "")).filter(Boolean)));
  if (!scheduleIds.length) return { repaired: 0, orphaned: 0 };
  const { data: blocks } = await supabase.from("schedule_blocks").select("id,user_id,title,block_date,start_time,end_time").in("id", scheduleIds);
  const blockMap = new Map((blocks ?? []).map((b: any) => [String(b.id), b]));
  const userIds = Array.from(new Set((scheduledReminders ?? []).map((r: any) => String(r.user_id))));
  const { data: profiles } = await supabase.from("users").select("id,timezone").in("id", userIds);
  const tzMap = new Map((profiles ?? []).map((p: any) => [String(p.id), p.timezone || "Asia/Jakarta"]));
  let repaired = 0, orphaned = 0;
  for (const reminder of scheduledReminders ?? []) {
    const block = blockMap.get(String(reminder.target_id || ""));
    if (!block) {
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", last_error: "Agenda sumber sudah dihapus.", updated_at: now.toISOString() }).eq("id", reminder.id);
      orphaned += 1;
      continue;
    }
    const tz = tzMap.get(String(reminder.user_id)) || reminder.timezone || "Asia/Jakarta";
    const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, tz);
    const remindMs = startIso ? new Date(startIso).getTime() - Number(reminder.offset_minutes || 0) * 60_000 : NaN;
    if (!Number.isFinite(remindMs)) {
      await supabase.from("reminders").update({ enabled: false, status: "cancelled", last_error: "Waktu agenda tidak valid.", updated_at: now.toISOString() }).eq("id", reminder.id).eq("user_id", reminder.user_id);
      orphaned += 1;
      continue;
    }
    const nextStatus = remindMs > now.getTime() ? "pending" : "waiting_for_device";
    await supabase.from("reminders").update({ title: `Pengingat: ${block.title}`, body: `${String(block.start_time).slice(0,5)}–${String(block.end_time).slice(0,5)}`, remind_at: new Date(remindMs).toISOString(), timezone: tz, status: nextStatus, updated_at: now.toISOString() }).eq("id", reminder.id).eq("user_id", reminder.user_id);
    repaired += 1;
  }
  return { repaired, orphaned };
}

async function runDispatch(userId?: string, sessionSupabase?: SupabaseClient, light = false) {
  const supabase = sessionSupabase || createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const started = Date.now();

  try {
    let stuck = supabase.from("reminders").update({ status: "pending", updated_at: nowIso }).eq("status", "processing").eq("enabled", true).lt("last_attempt_at", new Date(now.getTime() - 10 * 60_000).toISOString());
    if (userId) stuck = stuck.eq("user_id", userId);
    await stuck;

    if (!light) {
      await syncLegacyScheduleReminders(supabase, userId);
      await repairScheduleReminders(supabase, userId, now);
    }

    let query = supabase.from("reminders").select("id,user_id,title,body,href,target_type,target_id,remind_at,status,enabled,last_attempt_at,delivery_attempts,last_error").eq("enabled", true).in("status", ["pending", "waiting_for_device"]).lte("remind_at", nowIso).order("remind_at", { ascending: true }).limit(100);
    if (userId) query = query.eq("user_id", userId);
    const { data: due, error } = await query;
    if (error) throw new Error(error.message);

    let claimed = 0, delivered = 0, waiting = 0, failed = 0;
    const pushConfigured = isPushConfigured();
    const subscriptionCache = new Map<string, number>();
    for (const reminder of due ?? []) {
      if (reminder.status === "waiting_for_device" && reminder.last_attempt_at && Date.now() - new Date(reminder.last_attempt_at).getTime() < 5 * 60_000) continue;
      const claim = await supabase.from("reminders").update({ status: "processing", last_attempt_at: nowIso, delivery_attempts: Number(reminder.delivery_attempts || 0) + 1, updated_at: nowIso, last_error: null }).eq("id", reminder.id).in("status", ["pending", "waiting_for_device"]).select("id,user_id,title,body,href,remind_at,target_type,target_id,delivery_attempts").maybeSingle();
      if (claim.error || !claim.data) continue;
      claimed += 1;

      const eventResult = await upsertNotificationEvent(supabase, {
        userId: reminder.user_id,
        dedupeKey: `reminder:${reminder.id}`,
        title: reminder.title,
        body: reminder.body,
        href: reminder.href || "/",
        tone: "accent",
        sourceType: "reminder",
        sourceId: reminder.id,
        scheduledAt: reminder.remind_at,
        push: true,
      }).catch((eventError) => ({ event: null, created: false, delivered: false, pushed: false, error: eventError instanceof Error ? eventError.message : "Notification event gagal." }));

      if (eventResult.delivered) {
        await supabase.from("reminders").update({ status: "sent", sent_at: nowIso, updated_at: nowIso, last_error: null }).eq("id", reminder.id).eq("user_id", reminder.user_id);
        delivered += 1;
        continue;
      }
      let hasEnabledDevice = 0;
      if (pushConfigured) {
        if (subscriptionCache.has(reminder.user_id)) hasEnabledDevice = subscriptionCache.get(reminder.user_id) || 0;
        else {
          const subscriptionResult = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", reminder.user_id).eq("enabled", true);
          hasEnabledDevice = subscriptionResult.count ?? 0;
          subscriptionCache.set(reminder.user_id, hasEnabledDevice);
        }
      }
      const errorMessage = eventResult.error || eventResult.event?.last_delivery_error || null;
      const nextStatus = !pushConfigured || hasEnabledDevice === 0 ? "waiting_for_device" : "failed";
      await supabase.from("reminders").update({ status: nextStatus, updated_at: nowIso, last_error: errorMessage || (nextStatus === "waiting_for_device" ? "Belum ada perangkat Web Push aktif." : "Push tidak berhasil dikirim.") }).eq("id", reminder.id).eq("user_id", reminder.user_id);
      if (nextStatus === "waiting_for_device") waiting += 1; else failed += 1;
    }

    const result = { now: nowIso, durationMs: Date.now() - started, due: due?.length ?? 0, claimed, delivered, waiting, failed, pushConfigured };
    await heartbeat(supabase, "ok", result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch reminder gagal.";
    await heartbeat(supabase, "error", { error: message, durationMs: Date.now() - started });
    throw error;
  }
}

export async function GET(req: Request) {
  const authorizedCron = cronAuthorized(req);
  let userId: string | undefined;
  let sessionSupabase: SupabaseClient | undefined;
  if (!authorizedCron) {
    const originError = enforceSameOrigin(req);
    if (originError) return originError;
    const mod = await import("@/lib/supabase/server");
    sessionSupabase = await mod.createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Belum masuk atau cron secret tidak valid." }, { status: 401 });
    userId = user.id;
  }
  const light = new URL(req.url).searchParams.get("mode") === "client";
  try {
    return NextResponse.json(await runDispatch(userId, sessionSupabase, light), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch reminder gagal." }, { status: 500 });
  }
}
