import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { dateStrInTimezone } from "@/lib/date";
import { memoizeUserContext } from "@/lib/ai/contextCache";
import { shouldProactivelyNotify } from "@/lib/ai/proactivePolicy";

export const dynamic = "force-dynamic";

type Suggestion = { id: string; title: string; message: string; href: string; tone: "warning" | "info" | "success"; action?: string };

export async function GET(req: Request) {
  const originError = enforceSameOrigin(req);
  if (originError) return originError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ suggestions: [] }, { status: 401 });

  const suggestions = await memoizeUserContext(`${user.id}:proactive`, async () => {
    const { data: profile } = await supabase.from("users").select("timezone,preferences").eq("id", user.id).maybeSingle();
    const preferences = (profile?.preferences || {}) as Record<string, unknown>;
    if (preferences.proactiveAssistant === false) return [];
    const timezone = String(profile?.timezone || "Asia/Jakarta");
    const now = new Date();
    const { data: proactivePrefs } = await supabase
      .from("ai_proactive_preferences")
      .select("enabled,max_suggestions_per_day,quiet_start,quiet_end")
      .eq("user_id", user.id)
      .maybeSingle();
    const policy = shouldProactivelyNotify({
      now,
      prefs: proactivePrefs || { enabled: true, max_suggestions_per_day: 3 },
      suggestionsToday: Number((preferences as any).proactiveSuggestionsToday || 0),
      candidateScore: 100,
    });
    if (!policy.allowed) return [];
    const today = dateStrInTimezone(now, timezone);
    const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const [overdue, agenda, goals, inbox, watchersRes] = await Promise.all([
      supabase.from("tasks").select("id,title,due_at,priority").eq("user_id", user.id).neq("status", "done").lt("due_at", now.toISOString()).order("due_at", { ascending: true }).limit(4),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id", user.id).gte("block_date", today).lte("block_date", dateStrInTimezone(horizon, timezone)).order("block_date").order("start_time").limit(10),
      supabase.from("goals").select("id,title,progress,target_date").eq("user_id", user.id).eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(8),
      supabase.from("smart_inbox_items").select("id,content,created_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: true }).limit(3),
      supabase.from("ai_watchers").select("id,name,description,condition,action,cooldown_minutes,last_triggered_at,entity_type").eq("user_id", user.id).eq("enabled", true).limit(50),
    ]);

    const suggestions: Suggestion[] = [];
    const oldTasks = overdue.data || [];
    const watchers = watchersRes.data || [];

    const watcherMetrics: Record<string, number> = {
      overdue_tasks: oldTasks.length,
      today_agenda: (agenda.data || []).filter((item) => item.block_date === today).length,
      inbox_open: (inbox.data || []).length,
      goals_at_risk: (goals.data || []).filter((goal) => Number(goal.progress || 0) < 80 && goal.target_date && new Date(`${goal.target_date}T23:59:59`).getTime() - now.getTime() <= 7 * 86400000).length,
    };
    for (const watcher of watchers) {
      const last = watcher.last_triggered_at ? new Date(watcher.last_triggered_at).getTime() : 0;
      const cooldown = Math.max(5, Number(watcher.cooldown_minutes || 1440)) * 60000;
      if (last && Date.now() - last < cooldown) continue;
      const condition = (watcher.condition || {}) as Record<string, unknown>;
      const metric = String(condition.metric || watcher.entity_type || "");
      const actual = watcherMetrics[metric];
      const op = String(condition.operator || ">=");
      const expected = Number(condition.value ?? 1);
      const matched = Number.isFinite(actual) && compareMetric(actual, op, expected);
      if (!matched) continue;
      const action = (watcher.action || {}) as Record<string, unknown>;
      suggestions.push({
        id: `watcher-${watcher.id}`,
        title: watcher.name,
        message: String(action.message || watcher.description || `Kondisi ${metric} terpenuhi (${actual}).`),
        href: String(action.href || "/chat"),
        tone: action.tone === "success" ? "success" : action.tone === "warning" ? "warning" : "info",
        action: String(action.label || "Tinjau"),
      });
      void supabase.from("ai_watchers").update({ last_triggered_at: new Date().toISOString(), last_result: { metric, actual, expected, operator: op } }).eq("id", watcher.id).eq("user_id", user.id);
      if (suggestions.length >= 6) break;
    }
    if (oldTasks[0]) {
      suggestions.push({ id: "overdue-task", title: "Ada tugas yang tertinggal", message: `“${oldTasks[0].title}” sudah melewati waktunya. Kamu bisa menyelesaikannya sekarang atau menjadwalkan ulang.`, href: "/tasks", tone: "warning", action: "Buka tugas" });
    }
    const todayAgenda = (agenda.data || []).filter((item) => item.block_date === today);
    if (todayAgenda.length >= 5) {
      suggestions.push({ id: "busy-day", title: "Hari ini cukup padat", message: `Ada ${todayAgenda.length} agenda hari ini. Pertimbangkan memindahkan satu pekerjaan yang tidak mendesak.`, href: "/calendar", tone: "info", action: "Buka kalender" });
    } else if (todayAgenda.length === 0 && oldTasks.length > 0) {
      suggestions.push({ id: "open-slot", title: "Ada ruang untuk mengejar tugas", message: "Belum ada agenda terjadwal hari ini. Ini bisa menjadi waktu yang baik untuk membereskan tugas yang tertunda.", href: "/tasks", tone: "success", action: "Lihat tugas" });
    }
    const nearGoal = (goals.data || []).find((goal) => {
      if (!goal.target_date) return false;
      const days = Math.ceil((new Date(`${goal.target_date}T23:59:59`).getTime() - now.getTime()) / 86400000);
      return days >= 0 && days <= 7 && Number(goal.progress || 0) < 80;
    });
    if (nearGoal) {
      suggestions.push({ id: "goal-deadline", title: "Target mendekati tenggat", message: `“${nearGoal.title}” masih ${Number(nearGoal.progress || 0)}% dan targetnya dalam 7 hari.`, href: "/goals", tone: "warning", action: "Tinjau target" });
    }
    if ((inbox.data || []).length >= 3) {
      suggestions.push({ id: "inbox-backlog", title: "Inbox mulai menumpuk", message: `Ada ${inbox.data?.length} item yang belum dipilah. Rapikan beberapa sekarang agar tidak menjadi beban mental.`, href: "/inbox", tone: "info", action: "Buka Inbox" });
    }
    return suggestions.slice(0, 3);
  }, 30_000);

  return NextResponse.json({ suggestions, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, max-age=30" } });
}


function compareMetric(actual: number, operator: string, expected: number) {
  if (operator === ">") return actual > expected;
  if (operator === ">=") return actual >= expected;
  if (operator === "<") return actual < expected;
  if (operator === "<=") return actual <= expected;
  if (operator === "=") return actual === expected;
  return false;
}
