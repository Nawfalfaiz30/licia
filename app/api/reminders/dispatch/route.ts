import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, isPushConfigured } from "@/lib/notifications/push";
import { ensureTimezoneOffset } from "@/lib/date";
import { enforceSameOrigin } from "@/lib/security";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: Request) {
  const secret = process.env.LICIA_CRON_SECRET?.trim();
  const header = req.headers.get("x-licia-cron-secret")?.trim();
  return Boolean(secret && header && secret === header);
}

async function runDispatch(userId?: string, sessionSupabase?: SupabaseClient, light=false) {
  const supabase = sessionSupabase || createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  // Recover reminders left in processing after a crashed request/server restart.
  let stuck = supabase.from("reminders").update({ status: "pending", updated_at: nowIso }).eq("status", "processing").eq("enabled", true).lt("last_attempt_at", new Date(now.getTime() - 10 * 60_000).toISOString());
  if (userId) stuck = stuck.eq("user_id", userId);
  await stuck;
  // Full/server dispatch also keeps legacy schedule reminders synchronized. Client polling stays light.
  if (!light) {
  // Migrate/sync legacy schedule_soon automations into real reminder rows.
    let legacy = supabase.from("automations").select("id,user_id,name,trigger_config,enabled").eq("enabled", true).eq("trigger_type", "schedule_soon").limit(100);
  if (userId) legacy = legacy.eq("user_id", userId);
  const { data: legacyRules } = await legacy;
  for (const rule of legacyRules ?? []) {
    const targetId = rule.trigger_config?.schedule_block_id ? String(rule.trigger_config.schedule_block_id) : "";
    if (!targetId) continue;
    const minutes = Math.min(1440, Math.max(1, Number(rule.trigger_config?.minutes) || 30));
    const { data: block } = await supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("id", targetId).eq("user_id", rule.user_id).maybeSingle();
    if (!block) continue;
    const { data: profile } = await supabase.from("users").select("timezone").eq("id", rule.user_id).maybeSingle();
    const timezone = profile?.timezone || "Asia/Jakarta";
    const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0,8)}`, timezone);
    if (!startIso) continue;
    const remindAt = new Date(new Date(startIso).getTime() - minutes * 60_000).toISOString();
    const { data: existing } = await supabase.from("reminders").select("id").eq("user_id", rule.user_id).eq("target_type", "schedule").eq("target_id", block.id).limit(1);
    const payload = { title: rule.name || `Pengingat: ${block.title}`, body: `${block.title} · ${String(block.start_time).slice(0,5)}–${String(block.end_time).slice(0,5)}`, remind_at: remindAt, timezone, target_type: "schedule", target_id: block.id, offset_minutes: minutes, href: "/calendar", enabled: true, status: "pending", updated_at: nowIso };
    if (existing?.[0]) await supabase.from("reminders").update(payload).eq("id", existing[0].id).eq("user_id", rule.user_id).neq("status", "sent");
    else await supabase.from("reminders").insert({ user_id: rule.user_id, ...payload });
  }

  }
  let query = supabase.from("reminders").select("id,user_id,title,body,href,target_type,target_id,remind_at,status,enabled,last_attempt_at").eq("enabled", true).in("status", ["pending", "waiting_for_device"]).lte("remind_at", nowIso).order("remind_at", { ascending: true }).limit(100);
  if (userId) query = query.eq("user_id", userId);
  const { data: due, error } = await query;
  if (error) throw new Error(error.message);

  if (!light) {
  // Keep every pending agenda-bound reminder aligned with a moved/rescheduled event.
    const { data: scheduledReminders } = await supabase.from("reminders").select("id,user_id,title,target_id,offset_minutes,timezone,status,enabled").eq("enabled", true).eq("target_type", "schedule").in("status", ["pending", "waiting_for_device"]).limit(250);
  const scheduleIds = Array.from(new Set((scheduledReminders ?? []).map((r: any) => String(r.target_id || "")).filter(Boolean)));
  if (scheduleIds.length) {
    const { data: blocks } = await supabase.from("schedule_blocks").select("id,user_id,title,block_date,start_time,end_time").in("id", scheduleIds);
    const blockMap = new Map((blocks ?? []).map((b: any) => [String(b.id), b]));
    const userIds = Array.from(new Set((scheduledReminders ?? []).map((r: any) => String(r.user_id))));
    const { data: profiles } = await supabase.from("users").select("id,timezone").in("id", userIds);
    const tzMap = new Map((profiles ?? []).map((p: any) => [String(p.id), p.timezone || "Asia/Jakarta"]));
    for (const reminder of scheduledReminders ?? []) {
      const block = blockMap.get(String(reminder.target_id || ""));
      if (!block) {
        await supabase.from("reminders").update({ enabled: false, status: "cancelled", updated_at: nowIso }).eq("id", reminder.id);
        continue;
      }
      const tz = tzMap.get(String(reminder.user_id)) || reminder.timezone || "Asia/Jakarta";
      const startIso = ensureTimezoneOffset(`${block.block_date}T${String(block.start_time).slice(0, 8)}`, tz);
      const remindMs = startIso ? new Date(startIso).getTime() - Number(reminder.offset_minutes || 0) * 60_000 : NaN;
      if (!Number.isFinite(remindMs)) continue;
      const nextStatus = remindMs > now.getTime() ? "pending" : "waiting_for_device";
      await supabase.from("reminders").update({ title: `Pengingat: ${block.title}`, body: `${String(block.start_time).slice(0,5)}–${String(block.end_time).slice(0,5)}`, remind_at: new Date(remindMs).toISOString(), timezone: tz, status: nextStatus, updated_at: nowIso }).eq("id", reminder.id).eq("user_id", reminder.user_id);
    }
  }
  }
  const { data: refreshedDue } = await supabase.from("reminders").select("id,user_id,title,body,href,target_type,target_id,remind_at,status,enabled,last_attempt_at").eq("enabled", true).in("status", ["pending", "waiting_for_device"]).lte("remind_at", nowIso).order("remind_at", { ascending: true }).limit(100);
  const filteredDue = userId ? (refreshedDue ?? []).filter((x: any) => x.user_id === userId) : (refreshedDue ?? []);

  let claimed = 0, delivered = 0, waiting = 0, failed = 0;
  for (const reminder of filteredDue ?? []) {
    if (reminder.status === "waiting_for_device" && reminder.last_attempt_at && Date.now() - new Date(reminder.last_attempt_at).getTime() < 5 * 60_000) continue;
    const claim = await supabase.from("reminders").update({ status: "processing", last_attempt_at: nowIso, updated_at: nowIso }).eq("id", reminder.id).in("status", ["pending", "waiting_for_device"]).select("id,user_id,title,body,href").maybeSingle();
    if (claim.error || !claim.data) continue;
    claimed += 1;
    const dedupeKey = `reminder:${reminder.id}`;
    await supabase.from("notification_events").upsert({
      user_id: reminder.user_id, dedupe_key: dedupeKey, title: reminder.title, body: reminder.body, href: reminder.href || "/", tone: "accent", source_type: "reminder", source_id: reminder.id, scheduled_at: reminder.remind_at,
    }, { onConflict: "dedupe_key" });
    if (!isPushConfigured()) {
      await supabase.from("reminders").update({ status: "waiting_for_device", updated_at: nowIso }).eq("id", reminder.id).eq("user_id", reminder.user_id);
      waiting += 1;
      continue;
    }
    try {
      const results = await sendPushToUser(reminder.user_id, { title: reminder.title, body: reminder.body, href: reminder.href || "/", tag: dedupeKey });
      if (!results.some((x) => x.ok)) {
        await supabase.from("reminders").update({ status: "waiting_for_device", updated_at: nowIso }).eq("id", reminder.id).eq("user_id", reminder.user_id);
        waiting += 1;
      } else {
        await supabase.from("reminders").update({ status: "sent", sent_at: nowIso, updated_at: nowIso }).eq("id", reminder.id).eq("user_id", reminder.user_id);
        await supabase.from("notification_events").update({ delivered_at: nowIso }).eq("dedupe_key", dedupeKey).eq("user_id", reminder.user_id);
        delivered += 1;
      }
    } catch (error) {
      console.error("Reminder push failed", reminder.id, error);
      await supabase.from("reminders").update({ status: "failed", updated_at: nowIso }).eq("id", reminder.id).eq("user_id", reminder.user_id);
      failed += 1;
    }
  }
  return { now: nowIso, due: filteredDue?.length ?? 0, claimed, delivered, waiting, failed, pushConfigured: isPushConfigured() };
}

export async function GET(req: Request) {
  const authorizedCron = cronAuthorized(req);
  let userId: string | undefined;
  let sessionSupabase: SupabaseClient | undefined;
  if (!authorizedCron) {
    const originError = enforceSameOrigin(req);
    if (originError) return originError;
    const mod = await import("@/lib/supabase/server");
    sessionSupabase = mod.createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Belum masuk atau cron secret tidak valid." }, { status: 401 });
    userId = user.id;
  }
  const light = new URL(req.url).searchParams.get("mode") === "client";
  try { return NextResponse.json(await runDispatch(userId, sessionSupabase, light), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dispatch reminder gagal." }, { status: 500 }); }
}
