import type { SupabaseClient } from "@supabase/supabase-js";
import { dateStrInTimezone, startOfWeekIsoForTimezone } from "@/lib/date";

export type Evidence = { sourceType: string; sourceId?: string | null; label: string; detail: string; href?: string | null };
export type CopilotSignal = Evidence & { severity: "info" | "attention" | "critical"; score: number };

const dayMs = 86400000;
function daysUntil(date: string | null | undefined, now: Date) { if (!date) return null; return Math.ceil((new Date(`${date}T23:59:59`).getTime() - now.getTime()) / dayMs); }

export async function buildCopilotContext(supabase: SupabaseClient, userId: string, timezone: string) {
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const weekStart = startOfWeekIsoForTimezone(now, timezone);
  const [tasksR, agendaR, projectsR, goalsR, inboxR, focusR, subsR, decisionsR, habitsR, memoriesR] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id,updated_at").eq("user_id", userId).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(120),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,task_id,project_id").eq("user_id", userId).gte("block_date", today).order("block_date").order("start_time").limit(120),
    supabase.from("projects").select("id,name,status,target_date,goal_id,updated_at").eq("user_id", userId).in("status", ["active", "paused"]).limit(80),
    supabase.from("goals").select("id,title,status,progress,target_date,next_step,updated_at").eq("user_id", userId).eq("status", "active").limit(80),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: true }).limit(60),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id", userId).gte("started_at", weekStart).limit(120),
    supabase.from("subscriptions").select("id,name,amount,next_billing_date,active").eq("user_id", userId).eq("active", true).limit(40),
    supabase.from("decisions").select("id,title,review_date,outcome").eq("user_id", userId).is("outcome", null).not("review_date", "is", null).limit(40),
    supabase.from("habits").select("id,name,target_per_week,goal_id").eq("user_id", userId).eq("active", true).limit(40),
    supabase.from("user_memories").select("id,memory_key,memory_value,confidence,importance,last_confirmed_at,expires_at").eq("user_id", userId).eq("enabled", true).limit(40),
  ]);
  const tasks = tasksR.data ?? [], agenda = agendaR.data ?? [], projects = projectsR.data ?? [], goals = goalsR.data ?? [], inbox = inboxR.data ?? [], focus = focusR.data ?? [], subscriptions = subsR.data ?? [], decisions = decisionsR.data ?? [], habits = habitsR.data ?? [], memories = memoriesR.data ?? [];
  const overdue = tasks.filter((x: any) => x.due_at && new Date(x.due_at).getTime() < now.getTime());
  const projectRisk = projects.filter((p: any) => {
    const d = daysUntil(p.target_date, now);
    const stale = p.updated_at && now.getTime() - new Date(p.updated_at).getTime() > 3 * dayMs;
    return stale || (d !== null && d <= 7 && d >= -2);
  });
  const goalRisk = goals.filter((g: any) => {
    const d = daysUntil(g.target_date, now);
    return d !== null && d <= 14 && d >= -2 && Number(g.progress || 0) < 80;
  });
  const upcomingSubs = subscriptions.filter((s: any) => {
    const d = daysUntil(s.next_billing_date, now); return d !== null && d >= 0 && d <= 7;
  });
  const focusMinutes = focus.reduce((n: number, x: any) => n + Number(x.focus_minutes || 0), 0);
  const totalEstimated = tasks.reduce((n: number, x: any) => n + Number(x.estimated_minutes || 25), 0);
  const agendaMinutes = agenda.filter((x: any) => String(x.block_date) <= dateStrInTimezone(new Date(now.getTime() + 7 * dayMs), timezone)).reduce((n: number, x: any) => n + minutesBetween(x.start_time, x.end_time), 0);
  const capacity = 7 * 60 * 5;
  const signals: CopilotSignal[] = [];
  if (overdue.length) signals.push({ severity: overdue.length >= 4 ? "critical" : "attention", score: Math.min(100, 45 + overdue.length * 8), sourceType: "tasks", sourceId: overdue[0]?.id, label: `${overdue.length} tugas terlambat`, detail: "Ada pekerjaan yang sudah melewati tenggat dan perlu ditinjau.", href: "/tasks" });
  if (projectRisk.length) signals.push({ severity: "attention", score: 60, sourceType: "projects", sourceId: projectRisk[0]?.id, label: `${projectRisk.length} proyek berisiko`, detail: "Beberapa proyek stagnan atau mendekati tenggat.", href: "/projects" });
  if (goalRisk.length) signals.push({ severity: "attention", score: 62, sourceType: "goals", sourceId: goalRisk[0]?.id, label: `${goalRisk.length} target perlu perhatian`, detail: "Progress belum cukup tinggi untuk jarak ke tenggat.", href: "/goals" });
  if (inbox.length >= 5) signals.push({ severity: "info", score: 30, sourceType: "inbox", sourceId: inbox[0]?.id, label: `${inbox.length} item Inbox terbuka`, detail: "Menumpuknya capture dapat membuat konteks tercecer.", href: "/inbox" });
  if (upcomingSubs.length) signals.push({ severity: "info", score: 25, sourceType: "subscriptions", sourceId: upcomingSubs[0]?.id, label: `${upcomingSubs.length} langganan segera ditagih`, detail: "Ada pembayaran berulang dalam 7 hari.", href: "/subscriptions" });
  if (decisions.length) signals.push({ severity: "info", score: 20, sourceType: "decisions", sourceId: decisions[0]?.id, label: `${decisions.length} keputusan siap ditinjau`, detail: "Jurnal keputusan memiliki review date yang sudah dekat atau lewat.", href: "/decisions" });
  if (agendaMinutes > capacity * 0.85 || totalEstimated > capacity) signals.push({ severity: "attention", score: 70, sourceType: "capacity", label: "Kapasitas minggu mulai padat", detail: `${totalEstimated} menit estimasi task vs sekitar ${Math.max(0, capacity - agendaMinutes)} menit ruang kerja kasar.`, href: "/planner" });
  signals.sort((a, b) => b.score - a.score);

  const calendarConflicts = detectCalendarConflicts(agenda);
  const freeWindows = findFreeWindows(agenda, today);
  if (calendarConflicts.length) signals.push({ severity: "attention", score: 78, sourceType: "calendar", sourceId: calendarConflicts[0]?.id, label: `${calendarConflicts.length} konflik kalender`, detail: "Ada agenda yang bertumpuk pada waktu yang sama.", href: "/calendar" });
  const focusDays = new Set(focus.map((x: any) => String(x.started_at).slice(0, 10))).size;
  const workloadScore = Math.min(100, Math.max(0, Math.round((overdue.length * 12) + (projectRisk.length * 8) + (goalRisk.length * 8) + (calendarConflicts.length * 10) + Math.max(0, totalEstimated - capacity) / 10)));
  signals.sort((a, b) => b.score - a.score);
  const evidence: Evidence[] = signals.slice(0, 8).map((x) => ({ sourceType: x.sourceType, sourceId: x.sourceId, label: x.label, detail: x.detail, href: x.href }));
  return {
    generatedAt: now.toISOString(), timezone, today,
    signals: signals.slice(0, 10), evidence,
    stats: {
      overdueTasks: overdue.length, openTasks: tasks.length, projectRisk: projectRisk.length, goalRisk: goalRisk.length,
      inboxOpen: inbox.length, focusMinutes, focusDays, subscriptionsDue: upcomingSubs.length, decisionsDue: decisions.length,
      estimatedTaskMinutes: totalEstimated, agendaMinutes, capacityMinutes: capacity, workloadScore,
      calendarConflicts: calendarConflicts.length, freeWindows: freeWindows.length,
      activeHabits: habits.length, trustedMemories: memories.filter((m:any) => Number(m.confidence ?? 1) >= 0.7).length,
    },
    calendarConflicts, freeWindows,
    topTasks: tasks.slice(0, 8), topProjects: projectRisk.slice(0, 6), topGoals: goalRisk.slice(0, 6), topAgenda: agenda.slice(0, 10),
    nextMove: overdue[0]?.title ? `Tinjau tugas terlambat: ${overdue[0].title}` : goalRisk[0]?.title ? `Tinjau target: ${goalRisk[0].title}` : inbox.length >= 5 ? "Rapikan Inbox lalu pilih satu langkah utama." : "Pilih satu pekerjaan penting dan buat sesi fokus.",
  };
}

function minutesBetween(start: unknown, end: unknown) {
  const parse = (value: unknown) => { const [h, m] = String(value || "").slice(0, 5).split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; };
  let value = parse(end) - parse(start); if (value < 0) value += 1440; return value;
}

function parseTime(value: unknown) {
  const [h, m] = String(value || "").slice(0, 5).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

function detectCalendarConflicts(agenda: any[]) {
  const byDate = new Map<string, any[]>();
  for (const block of agenda) {
    const list = byDate.get(String(block.block_date)) || [];
    list.push(block);
    byDate.set(String(block.block_date), list);
  }
  const conflicts: any[] = [];
  for (const [date, blocks] of byDate) {
    const sorted = [...blocks].sort((a,b) => (parseTime(a.start_time) ?? 0) - (parseTime(b.start_time) ?? 0));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j];
        const as = parseTime(a.start_time), ae = parseTime(a.end_time), bs = parseTime(b.start_time), be = parseTime(b.end_time);
        if (as == null || ae == null || bs == null || be == null) continue;
        if (bs >= ae) break;
        if (Math.max(as, bs) < Math.min(ae, be)) conflicts.push({
          id: `${a.id}:${b.id}`, date, first: a, second: b,
          detail: `${a.title} (${String(a.start_time).slice(0,5)}–${String(a.end_time).slice(0,5)}) ↔ ${b.title} (${String(b.start_time).slice(0,5)}–${String(b.end_time).slice(0,5)})`,
        });
      }
    }
  }
  return conflicts.slice(0, 12);
}

function findFreeWindows(agenda: any[], fromDate: string) {
  const windows: Array<{date:string;start:string;end:string;minutes:number}> = [];
  const byDate = new Map<string, any[]>();
  for (const block of agenda) { const list = byDate.get(String(block.block_date)) || []; list.push(block); byDate.set(String(block.block_date), list); }
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(`${fromDate}T00:00:00`); d.setDate(d.getDate() + offset);
    const date = d.toISOString().slice(0,10);
    const sorted = [...(byDate.get(date) || [])].sort((a,b)=>(parseTime(a.start_time)??0)-(parseTime(b.start_time)??0));
    let cursor = 8 * 60;
    for (const block of sorted) {
      const start = parseTime(block.start_time); const end = parseTime(block.end_time);
      if (start == null || end == null) continue;
      const gap = start - cursor;
      if (gap >= 30) windows.push({date,start:minutesToTime(cursor),end:minutesToTime(start),minutes:gap});
      cursor = Math.max(cursor, end);
    }
    const finalGap = 18 * 60 - cursor;
    if (finalGap >= 30) windows.push({date,start:minutesToTime(cursor),end:"18:00",minutes:finalGap});
  }
  return windows.sort((a,b)=>b.minutes-a.minutes).slice(0, 8);
}

function minutesToTime(total: number) { return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
