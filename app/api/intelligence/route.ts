import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateStrInTimezone, ensureTimezoneOffset, startOfDayIsoForTimezone, startOfMonthIsoForTimezone, startOfWeekIsoForTimezone } from "@/lib/date";
import { rateLimit } from "@/lib/security";
import { upsertNotificationEvent } from "@/lib/notifications/events";
import { buildActionableContext } from "@/lib/ai/contextEngine";

export const dynamic = "force-dynamic";

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const gate = rateLimit(`intelligence:${user.id}`, 30, 60_000); if (gate) return gate;

  const url = new URL(req.url);
  const clientNowIso = url.searchParams.get("now");
  const now = clientNowIso ? new Date(clientNowIso) : new Date();
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  const timezone = profile?.timezone || "Asia/Jakarta";
  const today = dateStrInTimezone(now, timezone);
  const leadDaysRaw = Number(url.searchParams.get("leadDays"));
  const leadDays = [1, 3, 7, 14].includes(leadDaysRaw) ? leadDaysRaw : 7;
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const monthStart = startOfMonthIsoForTimezone(now, timezone);

  // Lightweight path used by the global notification bell. It avoids the full
  // intelligence workload so every page does not pay for 13 queries just to
  // render an unread badge.
  if (url.searchParams.get("mode") === "notifications") {
    const leadEnd = new Date(now.getTime() + leadDays * 86400000);
    const today = dateStrInTimezone(now, timezone);
    const endDate = dateStrInTimezone(leadEnd, timezone);
    const [tasksRes, subsRes, decisionsRes, projectsRes, automationsRes, scheduleRes] = await Promise.all([
      supabase.from("tasks").select("id,title,due_at").eq("user_id", user.id).neq("status", "done").lt("due_at", leadEnd.toISOString()).order("due_at", { ascending: true }).limit(20),
      supabase.from("subscriptions").select("id,name,next_billing_date").eq("user_id", user.id).eq("active", true).gte("next_billing_date", today).lte("next_billing_date", endDate).order("next_billing_date", { ascending: true }).limit(20),
      supabase.from("decisions").select("id,title,review_date,outcome").eq("user_id", user.id).is("outcome", null).not("review_date", "is", null).lte("review_date", today).limit(20),
      supabase.from("projects").select("id,name,target_date,status").eq("user_id", user.id).eq("status", "active").gte("target_date", today).lte("target_date", endDate).order("target_date", { ascending: true }).limit(20),
      supabase.from("automations").select("id,name,trigger_type,trigger_config,action_type,enabled").eq("user_id", user.id).eq("enabled", true).eq("trigger_type", "schedule_soon").limit(20),
      supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time").eq("user_id", user.id).gte("block_date", today).lte("block_date", endDate).order("block_date", { ascending: true }).order("start_time", { ascending: true }).limit(80),
    ]);
    const notifications = [
      ...((tasksRes.data ?? []) as any[]).filter((t) => t.due_at && new Date(t.due_at).getTime() < now.getTime()).slice(0, 5).map((t) => ({ id: `task-${t.id}`, title: "Tugas melewati tenggat", detail: t.title, href: "/tasks", tone: "danger" })),
      ...((subsRes.data ?? []) as any[]).slice(0, 5).map((s) => ({ id: `sub-${s.id}`, title: "Langganan mendekati tagihan", detail: s.name, href: "/subscriptions", tone: "accent" })),
      ...((decisionsRes.data ?? []) as any[]).slice(0, 5).map((d) => ({ id: `decision-${d.id}`, title: "Keputusan perlu ditinjau", detail: d.title, href: "/decisions", tone: "accentSoft" })),
      ...((projectsRes.data ?? []) as any[]).slice(0, 5).map((p) => ({ id: `project-${p.id}`, title: "Project mendekati deadline", detail: p.name, href: "/projects", tone: "accent" })),
    ].slice(0, 15);
    for (const item of notifications) {
      await upsertNotificationEvent(supabase, {
        userId: user.id,
        dedupeKey: `intelligence:${item.id}:${today}`,
        title: item.title,
        body: item.detail,
        href: item.href,
        tone: item.tone,
        sourceType: "intelligence",
        scheduledAt: now.toISOString(),
        push: false,
      }).catch(() => null);
    }
    return NextResponse.json({ generatedAt: now.toISOString(), date: today, timezone, notifications }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const previousMonth = new Date(now.getTime()); previousMonth.setUTCDate(1); previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const previousMonthStart = startOfMonthIsoForTimezone(previousMonth, timezone);
  const weekStart = startOfWeekIsoForTimezone(now, timezone);

  const [tasksRes, agendaRes, inboxRes, projectsRes, goalsRes, expensesRes, incomesRes, subsRes, focusRes, habitsRes, decisionsRes, previousExpensesRes, previousIncomesRes] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,updated_at,project_id").eq("user_id", user.id).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(120),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,location,task_id,project_id").eq("user_id", user.id).gte("block_date", today).lte("block_date", dateStrInTimezone(weekAhead, timezone)).order("block_date").order("start_time").limit(40),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: false }).limit(50),
    supabase.from("projects").select("id,name,status,target_date,updated_at,goal_id").eq("user_id", user.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(80),
    supabase.from("goals").select("id,title,status,progress,target_date,next_step").eq("user_id", user.id).eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(60),
    supabase.from("expenses").select("amount,category,occurred_at").eq("user_id", user.id).gte("occurred_at", monthStart).limit(500),
    supabase.from("incomes").select("amount,occurred_at").eq("user_id", user.id).gte("occurred_at", monthStart).limit(500),
    supabase.from("subscriptions").select("id,name,amount,billing_cycle,next_billing_date,active").eq("user_id", user.id).eq("active", true).order("next_billing_date", { ascending: true }).limit(30),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at,completed").eq("user_id", user.id).gte("started_at", weekStart).limit(200),
    supabase.from("habit_checkins").select("habit_id,checkin_date").eq("user_id", user.id).eq("checkin_date", today),
    supabase.from("decisions").select("id,title,review_date,outcome").eq("user_id", user.id).is("outcome", null).not("review_date", "is", null).lte("review_date", today).limit(20),
    supabase.from("expenses").select("amount,category,occurred_at").eq("user_id", user.id).gte("occurred_at", previousMonthStart).lt("occurred_at", monthStart).limit(500),
    supabase.from("incomes").select("amount,occurred_at").eq("user_id", user.id).gte("occurred_at", previousMonthStart).lt("occurred_at", monthStart).limit(500),
  ]);

  const tasks = tasksRes.data ?? [];
  const overdue = tasks.filter((t: any) => t.due_at && new Date(t.due_at).getTime() < now.getTime());
  const todayAgenda = (agendaRes.data ?? []).filter((a: any) => a.block_date === today);
  const projects = projectsRes.data ?? [];
  const staleProjects = projects.filter((p: any) => ["active", "paused"].includes(p.status) && now.getTime() - new Date(p.updated_at).getTime() > 3 * 86400000);
  const nearProjects = projects.filter((p: any) => p.target_date && new Date(`${p.target_date}T23:59:59`).getTime() - now.getTime() <= leadDays * 86400000 && new Date(`${p.target_date}T23:59:59`).getTime() >= now.getTime() && p.status === "active");
  const goals = goalsRes.data ?? [];
  const atRiskGoals = goals.filter((g: any) => g.target_date && Number(g.progress || 0) < 70 && new Date(`${g.target_date}T23:59:59`).getTime() - now.getTime() <= leadDays * 86400000);
  const expenses = expensesRes.data ?? [];
  const incomes = incomesRes.data ?? [];
  const monthExpense = expenses.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const monthIncome = incomes.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
  const focusMinutes = (focusRes.data ?? []).reduce((s: number, x: any) => s + Number(x.focus_minutes || 0), 0);
  const dueSubs = (subsRes.data ?? []).filter((s: any) => s.next_billing_date && new Date(`${s.next_billing_date}T23:59:59`).getTime() - now.getTime() <= leadDays * 86400000 && new Date(`${s.next_billing_date}T23:59:59`).getTime() >= now.getTime());
  const categories: Record<string, number> = {};
  for (const e of expenses as any[]) categories[e.category] = (categories[e.category] || 0) + Number(e.amount || 0);
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const previousExpense = (previousExpensesRes.data ?? []).reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
  const previousIncome = (previousIncomesRes.data ?? []).reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
  const expenseDeltaPct = previousExpense > 0 ? Math.round(((monthExpense - previousExpense) / previousExpense) * 100) : null;
  const incomeDeltaPct = previousIncome > 0 ? Math.round(((monthIncome - previousIncome) / previousIncome) * 100) : null;
  const focusDays = new Set((focusRes.data ?? []).map((x: any) => String(x.started_at).slice(0, 10))).size;
  const workloadScore = Math.max(0, Math.min(100, 100 - overdue.length * 10 - Math.max(0, tasks.length - 8) * 4 + Math.min(focusDays * 6, 24)));
  const projectRiskCount = staleProjects.length + nearProjects.length;
  const actionableContext = await buildActionableContext(supabase, user.id, timezone);

  const suggestions: any[] = [];
  if (overdue.length) suggestions.push({ id: "overdue", title: "Rapikan tugas yang terlambat", detail: `${overdue.length} tugas melewati tenggat. Pilih satu untuk dibereskan lebih dulu.`, href: "/tasks", action: "Buka tugas", tone: "danger" });
  if (todayAgenda.length === 0 && tasks.length) suggestions.push({ id: "no-agenda", title: "Hari ini masih punya ruang", detail: "Kamu punya tugas aktif tetapi belum ada agenda. Pertimbangkan satu blok Fokus.", href: "/focus", action: "Mulai fokus", tone: "accent" });
  if (staleProjects.length) suggestions.push({ id: "stale-project", title: "Ada project yang mulai stagnan", detail: `${staleProjects.length} project aktif tidak disentuh selama beberapa hari.`, href: "/projects", action: "Tinjau project", tone: "accentSoft" });
  if (atRiskGoals.length) suggestions.push({ id: "goal-risk", title: "Beberapa target mendekati batas", detail: atRiskGoals.slice(0, 2).map((g: any) => g.title).join(" · "), href: "/goals", action: "Tinjau target", tone: "accent" });
  if (dueSubs.length) suggestions.push({ id: "subscription", title: "Langganan segera ditagihkan", detail: dueSubs.slice(0, 3).map((s: any) => `${s.name} ${rupiah(Number(s.amount))}`).join(" · "), href: "/subscriptions", action: "Lihat langganan", tone: "danger" });
  if (inboxRes.data?.length) suggestions.push({ id: "inbox", title: "Inbox masih menumpuk", detail: `${inboxRes.data.length} tangkapan terbuka menunggu diproses.`, href: "/inbox", action: "Proses Inbox", tone: "accent" });
  if (topCategory) suggestions.push({ id: "finance-pattern", title: `Kategori pengeluaran terbesar: ${topCategory[0]}`, detail: `Bulan ini sekitar ${rupiah(topCategory[1])}.`, href: "/finance", action: "Buka keuangan", tone: "success" });
  if (expenseDeltaPct !== null && Math.abs(expenseDeltaPct) >= 10) suggestions.push({ id: "finance-delta", title: expenseDeltaPct > 0 ? "Pengeluaran bulan ini meningkat" : "Pengeluaran bulan ini menurun", detail: `${Math.abs(expenseDeltaPct)}% dibanding bulan sebelumnya.`, href: "/finance", action: "Lihat pola", tone: expenseDeltaPct > 0 ? "danger" : "success" });
  if (focusDays >= 3) suggestions.push({ id: "focus-rhythm", title: "Ritme fokus mulai terbentuk", detail: `Sesi fokus tercatat pada ${focusDays} hari minggu ini.`, href: "/focus", action: "Lanjutkan ritme", tone: "accent" });

  const notifications = [
    ...overdue.slice(0, 5).map((t: any) => ({ id: `task-${t.id}`, title: "Tugas melewati tenggat", detail: t.title, href: "/tasks", tone: "danger" })),
    ...dueSubs.slice(0, 5).map((s: any) => ({ id: `sub-${s.id}`, title: "Langganan mendekati tagihan", detail: s.name, href: "/subscriptions", tone: "accent" })),
    ...(decisionsRes.data ?? []).slice(0, 5).map((d: any) => ({ id: `decision-${d.id}`, title: "Keputusan perlu ditinjau", detail: d.title, href: "/decisions", tone: "accentSoft" })),
    ...nearProjects.slice(0, 5).map((p: any) => ({ id: `project-${p.id}`, title: "Project mendekati deadline", detail: p.name, href: "/projects", tone: "accent" })),
  ].slice(0, 12);

  for (const item of notifications) {
    await upsertNotificationEvent(supabase, {
      userId: user.id,
      dedupeKey: `intelligence:${item.id}:${today}`,
      title: item.title,
      body: item.detail,
      href: item.href,
      tone: item.tone,
      sourceType: "intelligence",
      scheduledAt: now.toISOString(),
      push: false,
    }).catch(() => null);
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    date: today,
    timezone,
    insightSummary: {
      workloadScore,
      projectRiskCount,
      focusDays,
      expenseDeltaPct,
      incomeDeltaPct,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
      signals: { overdue: overdue.length, inbox: inboxRes.data?.length ?? 0, dueSubscriptions: dueSubs.length, decisionsDue: decisionsRes.data?.length ?? 0 },
    },
    stats: {
      openTasks: tasks.length,
      overdueTasks: overdue.length,
      todayAgenda: todayAgenda.length,
      inboxOpen: inboxRes.data?.length ?? 0,
      focusMinutes,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      projectsActive: projects.filter((p: any) => p.status === "active").length,
      staleProjects: staleProjects.length,
      goalsActive: goals.length,
      habitsChecked: habitsRes.data?.length ?? 0,
    },
    nextActions: tasks.slice(0, 5).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, dueAt: t.due_at, href: "/tasks" })),
    actionableContext: { signals: actionableContext.signals.slice(0, 10), focusCandidates: actionableContext.focusCandidates, stats: actionableContext.stats },
    suggestions: suggestions.slice(0, 6),
    notifications,
    focusMessage: focusMinutes ? `Minggu ini ${focusMinutes} menit fokus sudah tercatat.` : "Belum ada sesi fokus minggu ini.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
