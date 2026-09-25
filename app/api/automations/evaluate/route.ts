import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateStrInTimezone, ensureTimezoneOffset } from "@/lib/date";
import { enforceSameOrigin, rateLimit } from "@/lib/security";
import { upsertNotificationEvent } from "@/lib/notifications/events";

export const dynamic = "force-dynamic";

function ensureScheduleIso(date: string, time: string, timezone: string) {
  return ensureTimezoneOffset(`${date}T${String(time).slice(0,8)}`, timezone) || `${date}T${String(time).slice(0,8)}+07:00`;
}

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const now = new Date();
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  const timezone = profile?.timezone || "Asia/Jakarta";
  const today = dateStrInTimezone(now, timezone);
  const [{ data: rules }, { data: tasks }, { data: decisions }, { data: projects }, { data: scheduleBlocks }] = await Promise.all([
    supabase.from("automations").select("id,name,trigger_type,trigger_config,action_type,enabled,last_run_at").eq("user_id", user.id).eq("enabled", true).order("created_at", { ascending: false }),
    supabase.from("tasks").select("id,title,due_at,status").eq("user_id", user.id).neq("status", "done").limit(300),
    supabase.from("decisions").select("id,title,review_date,outcome").eq("user_id", user.id).order("review_date", { ascending: true, nullsFirst: false }).limit(300),
    supabase.from("projects").select("id,name,status,updated_at").eq("user_id", user.id).in("status", ["active", "paused"]).limit(200),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id", user.id).gte("block_date", today).lte("block_date", dateStrInTimezone(new Date(now.getTime()+2*86400000), timezone)).order("block_date", { ascending: true }).order("start_time", { ascending: true }).limit(100),
  ]);
  const out: any[] = [];
  for (const r of (rules ?? []) as any[]) {
    const days = Math.max(1, Number(r.trigger_config?.days) || 3);
    let matched = 0;
    let details = "";
    if (r.trigger_type === "overdue_task") {
      matched = (tasks ?? []).filter((t: any) => t.due_at && new Date(t.due_at).getTime() < now.getTime()).length;
      details = matched ? `${matched} tugas melewati tenggat.` : "Tidak ada tugas terlambat.";
    } else if (r.trigger_type === "review_due") {
      matched = (decisions ?? []).filter((d: any) => d.review_date && !d.outcome && d.review_date <= today).length;
      details = matched ? `${matched} keputusan menunggu review.` : "Tidak ada review keputusan yang jatuh tempo.";
    } else if (r.trigger_type === "daily_open") {
      matched = 1;
      details = "Aturan tersedia saat halaman harian dibuka.";
    } else if (r.trigger_type === "schedule_soon") {
      const minutes = Math.min(240, Math.max(5, Number(r.trigger_config?.minutes) || 30));
      const targetId = r.trigger_config?.schedule_block_id ? String(r.trigger_config.schedule_block_id) : null;
      const horizon = now.getTime() + minutes * 60 * 1000;
      const matches = (scheduleBlocks ?? []).filter((b: any) => {
        if (targetId && String(b.id) !== targetId) return false;
        const startIso = ensureScheduleIso(b.block_date, b.start_time, timezone);
        const startMs = new Date(startIso).getTime();
        return Number.isFinite(startMs) && startMs >= now.getTime() && startMs <= horizon;
      });
      matched = matches.length;
      details = matched ? matches.slice(0, 2).map((b: any) => `${b.title} ${String(b.start_time).slice(0,5)}`).join(" · ") : `Tidak ada agenda dalam ${minutes} menit ke depan.`;
    } else {
      matched = (projects ?? []).filter((p: any) => Date.now() - new Date(p.updated_at).getTime() > days * 86400000).length;
      details = matched ? `${matched} project tidak disentuh lebih dari ${days} hari.` : "Tidak ada project stagnan.";
    }
    const result = matched > 0 ? `Terpenuhi · ${details}` : `Belum terpenuhi · ${details}`;
    if (matched > 0) {
      const shouldNotify = r.trigger_type !== "schedule_soon" && (r.action_type === "notify" || r.action_type === "suggest_focus" || r.action_type === "open_brief");
      if (shouldNotify) {
        const href = r.action_type === "suggest_focus" ? "/focus" : r.action_type === "open_brief" ? "/brief" : r.trigger_type === "schedule_soon" ? "/calendar" : "/today";
        await upsertNotificationEvent(supabase, {
          userId: user.id,
          dedupeKey: `automation:${r.id}:${today}`,
          title: r.name || "Automation Licia",
          body: details,
          href,
          tone: r.action_type === "notify" ? "accent" : "accentSoft",
          sourceType: "automation",
          sourceId: r.id,
          scheduledAt: now.toISOString(),
          push: r.action_type === "notify",
        }).catch(() => null);
      }
    }
    await supabase.from("automations").update({ last_run_at: now.toISOString(), last_result: result, updated_at: now.toISOString() }).eq("id", r.id).eq("user_id", user.id);
    if (matched > 0) out.push({ id: r.id, name: r.name, actionType: r.action_type, detail: details, href: r.action_type === "suggest_focus" ? "/focus" : r.action_type === "open_brief" ? "/brief" : "/today" });
  }
  return NextResponse.json({ checkedAt: now.toISOString(), matched: out },{headers:{"Cache-Control":"private, no-store"}});
}
