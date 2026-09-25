import type { SupabaseClient } from "@supabase/supabase-js";
import { dateStrInTimezone } from "@/lib/date";

type Signal = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  reason: string;
  score: number;
  href: string;
};

async function safe<T>(job: PromiseLike<{ data?: T | null } | { error?: unknown; data?: T | null }>, fallback: T): Promise<T> {
  try {
    const result = await job;
    return (result as any)?.data ?? fallback;
  } catch {
    return fallback;
  }
}

export async function buildActionableContext(supabase: SupabaseClient, userId: string, timezone = "Asia/Jakarta") {
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const horizon = new Date(now.getTime() + 7 * 86400000);
  const [tasks, agenda, projects, goals, reminders, notifications] = await Promise.all([
    safe(supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id,updated_at").eq("user_id", userId).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(80), []),
    safe(supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,task_id,project_id").eq("user_id", userId).gte("block_date", today).lte("block_date", dateStrInTimezone(horizon, timezone)).order("block_date", { ascending: true }).order("start_time", { ascending: true }).limit(80), []),
    safe(supabase.from("projects").select("id,name,status,target_date,updated_at,goal_id").eq("user_id", userId).in("status", ["active", "paused"]).limit(60), []),
    safe(supabase.from("goals").select("id,title,status,progress,target_date,next_step,updated_at").eq("user_id", userId).eq("status", "active").limit(60), []),
    safe(supabase.from("reminders").select("id,title,remind_at,status,enabled,target_type,target_id,last_attempt_at,last_error").eq("user_id", userId).eq("enabled", true).in("status", ["pending", "waiting_for_device", "failed", "processing"]).order("remind_at", { ascending: true }).limit(80), []),
    safe(supabase.from("notification_events").select("id,title,source_type,scheduled_at,delivered_at,read_at,last_delivery_error").eq("user_id", userId).order("created_at", { ascending: false }).limit(40), []),
  ]);

  const signals: Signal[] = [];
  for (const t of tasks as any[]) {
    const due = t.due_at ? new Date(t.due_at).getTime() : NaN;
    if (Number.isFinite(due)) {
      const hours = (due - now.getTime()) / 3600000;
      if (hours < 0) signals.push({ id: `overdue-task-${t.id}`, type: "overdue_task", entityType: "task", entityId: t.id, title: t.title, reason: `Terlambat ${Math.max(1, Math.round(Math.abs(hours) / 24))} hari.`, score: 96, href: "/tasks" });
      else if (hours <= 24) signals.push({ id: `due-task-${t.id}`, type: "due_soon", entityType: "task", entityId: t.id, title: t.title, reason: `Tenggat dalam ${Math.max(1, Math.round(hours))} jam.`, score: 88, href: "/tasks" });
      else if (hours <= 72) signals.push({ id: `near-task-${t.id}`, type: "due_72h", entityType: "task", entityId: t.id, title: t.title, reason: "Tenggat berada dalam 3 hari.", score: 72, href: "/tasks" });
    }
    if (t.priority === "high") signals.push({ id: `priority-task-${t.id}`, type: "high_priority", entityType: "task", entityId: t.id, title: t.title, reason: "Prioritas tinggi dan masih terbuka.", score: 82, href: "/tasks" });
  }

  const agendaByDate = new Map<string, any[]>();
  for (const item of agenda as any[]) {
    const key = String(item.block_date);
    const list = agendaByDate.get(key) ?? [];
    list.push(item);
    agendaByDate.set(key, list);
  }
  for (const [date, blocks] of agendaByDate) {
    const sorted = blocks.slice().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = String(sorted[i - 1].end_time).slice(0, 8);
      const start = String(sorted[i].start_time).slice(0, 8);
      if (start < prevEnd) {
        signals.push({ id: `conflict-${date}-${sorted[i].id}`, type: "schedule_conflict", entityType: "schedule", entityId: sorted[i].id, title: sorted[i].title, reason: `Bertabrakan dengan ${sorted[i - 1].title}.`, score: 93, href: "/calendar" });
      }
    }
  }

  for (const p of projects as any[]) {
    const updated = new Date(p.updated_at || 0).getTime();
    const staleDays = (now.getTime() - updated) / 86400000;
    if (Number.isFinite(updated) && staleDays >= 7 && p.status === "active") signals.push({ id: `stale-project-${p.id}`, type: "stale_project", entityType: "project", entityId: p.id, title: p.name, reason: `Tidak diperbarui sekitar ${Math.floor(staleDays)} hari.`, score: 64, href: "/projects" });
    if (p.target_date) {
      const d = new Date(`${p.target_date}T23:59:59`).getTime();
      const days = (d - now.getTime()) / 86400000;
      if (days >= 0 && days <= 3 && p.status === "active") signals.push({ id: `project-deadline-${p.id}`, type: "project_deadline", entityType: "project", entityId: p.id, title: p.name, reason: `Target project tinggal ${Math.max(1, Math.ceil(days))} hari.`, score: 86, href: "/projects" });
    }
  }

  for (const g of goals as any[]) {
    const target = g.target_date ? new Date(`${g.target_date}T23:59:59`).getTime() : NaN;
    if (Number.isFinite(target)) {
      const days = (target - now.getTime()) / 86400000;
      if (days >= 0 && days <= 14 && Number(g.progress || 0) < 80) signals.push({ id: `goal-risk-${g.id}`, type: "goal_risk", entityType: "goal", entityId: g.id, title: g.title, reason: `Progress ${Number(g.progress || 0)}% dengan target dalam ${Math.max(1, Math.ceil(days))} hari.`, score: 78, href: "/goals" });
    }
  }

  for (const r of reminders as any[]) {
    if (r.status === "failed") signals.push({ id: `reminder-failed-${r.id}`, type: "reminder_delivery_failed", entityType: "reminder", entityId: r.id, title: r.title, reason: r.last_error || "Pengiriman pengingat gagal.", score: 94, href: "/reminders" });
    if (r.status === "processing" && r.last_attempt_at && now.getTime() - new Date(r.last_attempt_at).getTime() > 10 * 60_000) signals.push({ id: `reminder-stuck-${r.id}`, type: "reminder_stuck", entityType: "reminder", entityId: r.id, title: r.title, reason: "Pengingat berhenti di status processing terlalu lama.", score: 91, href: "/reminders" });
  }

  const unreadDeliveryIssues = (notifications as any[]).filter((n) => n.last_delivery_error && !n.delivered_at).length;
  if (unreadDeliveryIssues) signals.push({ id: "notification-delivery-issues", type: "notification_delivery_issue", entityType: "notification", entityId: String((notifications as any[]).find((n) => n.last_delivery_error)?.id || "summary"), title: "Pengiriman notifikasi perlu diperiksa", reason: `${unreadDeliveryIssues} event belum berhasil dikirim.`, score: 90, href: "/system" });

  signals.sort((a, b) => b.score - a.score);
  const focusCandidates = signals.filter((s) => ["overdue_task", "due_soon", "high_priority", "schedule_conflict", "goal_risk"].includes(s.type)).slice(0, 6);
  return {
    generatedAt: now.toISOString(),
    date: today,
    timezone,
    signals: signals.slice(0, 20),
    focusCandidates,
    stats: {
      openTasks: tasks.length,
      overdueTasks: signals.filter((s) => s.type === "overdue_task").length,
      upcomingAgenda: agenda.length,
      activeProjects: projects.filter((p: any) => p.status === "active").length,
      activeGoals: goals.length,
      activeReminders: reminders.length,
      notificationDeliveryIssues: unreadDeliveryIssues,
    },
  };
}
