import { dateStrInTimezone } from "@/lib/date";
import { memoizeUserContext } from "@/lib/ai/contextCache";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildDailyBrain(supabase: SupabaseClient, userId: string, timezone: string) {
  return memoizeUserContext(`${userId}:v35:brain`, async () => {
    const now = new Date();
    const today = dateStrInTimezone(now, timezone);
    const weekAhead = dateStrInTimezone(new Date(now.getTime() + 7 * 86400000), timezone);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [tasksRes, agendaRes, projectsRes, goalsRes, focusRes, habitsRes, remindersRes, inboxRes, expenseRes, incomeRes, notificationsRes, subsRes] = await Promise.all([
      supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id", userId).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(80),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,project_id,task_id").eq("user_id", userId).gte("block_date", today).lte("block_date", weekAhead).order("block_date").order("start_time").limit(80),
      supabase.from("projects").select("id,name,status,target_date,goal_id,updated_at").eq("user_id", userId).in("status", ["active", "paused"]).order("updated_at", { ascending: false }).limit(30),
      supabase.from("goals").select("id,title,progress,status,target_date,next_step,updated_at").eq("user_id", userId).eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(30),
      supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id", userId).gte("started_at", new Date(now.getTime() - 7 * 86400000).toISOString()).limit(200),
      supabase.from("habits").select("id,name,goal_id").eq("user_id", userId).eq("active", true).limit(30),
      supabase.from("reminders").select("id,title,remind_at,status,enabled").eq("user_id", userId).eq("enabled", true).in("status", ["pending", "waiting_for_device"]).order("remind_at").limit(30),
      supabase.from("smart_inbox_items").select("id,content,created_at,status,kind").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: true }).limit(30),
      supabase.from("expenses").select("amount,category,occurred_at").eq("user_id", userId).gte("occurred_at", `${monthStart}T00:00:00`).limit(500),
      supabase.from("incomes").select("amount,source,occurred_at").eq("user_id", userId).gte("occurred_at", `${monthStart}T00:00:00`).limit(500),
      supabase.from("notification_events").select("id,title,created_at,read_at,tone").eq("user_id", userId).is("read_at", null).order("created_at", { ascending: false }).limit(20),
      supabase.from("subscriptions").select("id,name,amount,next_billing_date,active").eq("user_id", userId).eq("active", true).order("next_billing_date").limit(20),
    ]);

    const errors = [tasksRes, agendaRes, projectsRes, goalsRes, focusRes, habitsRes, remindersRes, inboxRes, expenseRes, incomeRes, notificationsRes, subsRes].filter((x) => x.error).map((x) => x.error?.message);
    const tasks = tasksRes.data ?? [];
    const agenda = agendaRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const focus = focusRes.data ?? [];
    const reminders = remindersRes.data ?? [];
    const inbox = inboxRes.data ?? [];
    const expenses = expenseRes.data ?? [];
    const incomes = incomeRes.data ?? [];
    const notifications = notificationsRes.data ?? [];
    const subscriptions = subsRes.data ?? [];

    const overdue = tasks.filter((x: any) => x.due_at && new Date(x.due_at).getTime() < now.getTime());
    const urgent = tasks.filter((x: any) => x.priority === "high").slice(0, 6);
    const staleProjects = projects.filter((x: any) => x.updated_at && now.getTime() - new Date(x.updated_at).getTime() > 5 * 86400000);
    const todayAgenda = agenda.filter((x: any) => x.block_date === today);
    const upcoming = reminders.filter((x: any) => x.remind_at && new Date(x.remind_at).getTime() - now.getTime() <= 24 * 3600000);
    const nearGoals = goals.filter((g: any) => g.target_date && new Date(`${g.target_date}T23:59:59`).getTime() - now.getTime() <= 7 * 86400000 && Number(g.progress || 0) < 80);
    const conflicts: Array<{ first: string; second: string; message: string }> = [];
    for (let i = 0; i < todayAgenda.length; i++) {
      for (let j = i + 1; j < todayAgenda.length; j++) {
        const a = todayAgenda[i], b = todayAgenda[j];
        const aStart = timeToMinutes(a.start_time), aEnd = timeToMinutes(a.end_time), bStart = timeToMinutes(b.start_time), bEnd = timeToMinutes(b.end_time);
        if (aStart < bEnd && bStart < aEnd) conflicts.push({ first: a.title, second: b.title, message: `Bentrok: ${a.title} dan ${b.title}.` });
      }
    }
    const upcomingSubscriptions = subscriptions.filter((x: any) => x.next_billing_date && new Date(`${x.next_billing_date}T23:59:59`).getTime() - now.getTime() <= 7 * 86400000);
    const focusMinutes = focus.reduce((sum: number, x: any) => sum + Number(x.focus_minutes || 0), 0);
    const income = incomes.reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
    const expense = expenses.reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
    const capacityMinutes = Math.max(0, 8 * 60 - todayAgenda.reduce((sum: number, x: any) => sum + minutesBetween(x.start_time, x.end_time), 0));
    const workloadMinutes = tasks.reduce((sum: number, x: any) => sum + Number(x.estimated_minutes || 25), 0);

    const priorities = [
      ...overdue.slice(0, 3).map((x: any) => ({ type: "task", title: x.title, reason: "Terlambat", href: "/tasks", id: x.id })),
      ...nearGoals.slice(0, 2).map((x: any) => ({ type: "goal", title: x.title, reason: `${Number(x.progress || 0)}% · tenggat dekat`, href: "/goals", id: x.id })),
      ...urgent.slice(0, 2).map((x: any) => ({ type: "task", title: x.title, reason: "Prioritas tinggi", href: "/tasks", id: x.id })),
    ].slice(0, 5);

    const risks = [
      ...(conflicts.length ? conflicts.slice(0, 3).map((x) => ({ type: "calendar_conflict", message: x.message })) : []),
      ...(todayAgenda.length >= 6 ? [{ type: "calendar", message: `Ada ${todayAgenda.length} agenda hari ini.` }] : []),
      ...(workloadMinutes > capacityMinutes ? [{ type: "capacity", message: `Beban task sekitar ${workloadMinutes} menit, kapasitas kosong diperkirakan ${capacityMinutes} menit.` }] : []),
      ...(upcomingSubscriptions.length ? [{ type: "subscription", message: `${upcomingSubscriptions.length} langganan akan ditagihkan dalam 7 hari.` }] : []),
      ...(staleProjects.length ? [{ type: "project", message: `${staleProjects.length} project tidak berubah lebih dari 5 hari.` }] : []),
      ...(inbox.length >= 5 ? [{ type: "inbox", message: `${inbox.length} item Inbox belum dipilah.` }] : []),
      ...(notifications.length >= 5 ? [{ type: "notification", message: `${notifications.length} notifikasi belum dibaca.` }] : []),
    ].slice(0, 6);

    const healthScore = Math.max(0, Math.min(100, 100 - overdue.length * 7 - (todayAgenda.length >= 8 ? 12 : 0) - (inbox.length >= 8 ? 8 : 0) - (workloadMinutes > capacityMinutes ? 12 : 0) + (focusMinutes >= 120 ? 5 : 0)));

    return {
      ok: errors.length === 0,
      generatedAt: now.toISOString(),
      freshness: errors.length ? "partial" : "fresh",
      errors,
      date: today,
      healthScore,
      priorities,
      risks,
      capacity: { availableMinutes: capacityMinutes, workloadMinutes, overloadMinutes: Math.max(0, workloadMinutes - capacityMinutes) },
      counts: { tasks: tasks.length, overdue: overdue.length, agendaToday: todayAgenda.length, projects: projects.length, goals: goals.length, inbox: inbox.length, reminders24h: upcoming.length, unreadNotifications: notifications.length, activeSubscriptions: subscriptions.length },
      focus: { minutes7d: focusMinutes },
      finance: { income, expense, net: income - expense },
      nextMove: priorities[0]?.title ? `Mulai dari ${priorities[0].title}.` : todayAgenda[0] ? `Siapkan ${todayAgenda[0].title}.` : "Pilih satu pekerjaan penting dan mulai sesi fokus.",
      agenda: todayAgenda.slice(0, 6),
      tasks: tasks.slice(0, 10),
      goals: goals.slice(0, 8),
      projects: projects.slice(0, 8),
      reminders: reminders.slice(0, 8),
      inbox: inbox.slice(0, 8),
      subscriptions: subscriptions.slice(0, 8),
      conflicts: conflicts.slice(0, 8),
      upcomingSubscriptions: upcomingSubscriptions.slice(0, 8),
    };
  }, 20_000);
}

function timeToMinutes(value: unknown) { const [h, m] = String(value || "").slice(0, 5).split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; }

function minutesBetween(start: unknown, end: unknown) {
  const parse = (value: unknown) => {
    const [h, m] = String(value || "").slice(0, 5).split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  };
  let delta = parse(end) - parse(start);
  if (delta < 0) delta += 1440;
  return delta;
}
