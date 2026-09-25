import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone, startOfDayIsoForTimezone, startOfMonthIsoForTimezone } from "@/lib/date";
import { DailyIntelligence } from "@/components/intelligence/DailyIntelligence";
import { ActivityFeed } from "@/components/intelligence/ActivityFeed";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { ArrowRight, BellRing, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Droplets, FolderKanban, HeartPulse, Inbox, MessageCircle, Sparkles, Target, Timer, Wallet, Zap } from "lucide-react";

function rupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n); }
function time(v: string | null | undefined) { return String(v || "").slice(0, 5); }
function dateLabel(v: string, tz: string) { try { return new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${v}T12:00:00`)); } catch { return v; } }
function whenLabel(v: string | null, tz: string) { if (!v) return "Tanpa waktu"; try { return new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v)); } catch { return v; } }
function daysTo(v: string | null) { if (!v) return null; return Math.ceil((new Date(`${v}T23:59:59`).getTime() - Date.now()) / 86400000); }

type Expense = { amount: number | string | null; category: string | null; occurred_at: string; note: string | null };
type Income = { amount: number | string | null; source: string | null; occurred_at: string; note: string | null };

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("display_name,timezone,preferences").eq("id", user.id).single();
  const resolved = profile ?? (await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name));
  const timezone = profile?.timezone ?? (resolved as any)?.timezone ?? "Asia/Jakarta";
  const prefs = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const weekAhead = dateStrInTimezone(new Date(now.getTime() + 7 * 86400000), timezone);
  const startToday = startOfDayIsoForTimezone(now, timezone);
  const startMonth = startOfMonthIsoForTimezone(now, timezone);
  const nowClock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const hour = Number(nowClock.slice(0, 2));
  const greeting = hour < 12 ? "Selamat pagi" : hour < 18 ? "Selamat siang" : "Selamat malam";

  const [tasks, doneToday, agenda, projects, goals, inbox, habits, habitCheckins, focusToday, focusWeek, expensesMonth, incomesMonth, accounts, expensesAll, incomesAll, waterToday, movementToday, fatigueToday, healthMetric, reminders, notifications, subscriptions, memories, automations] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_at,estimated_minutes,project_id").eq("user_id", user.id).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(60),
    supabase.from("tasks").select("id").eq("user_id", user.id).eq("status", "done").gte("updated_at", startToday).limit(200),
    supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,location,task_id,project_id").eq("user_id", user.id).gte("block_date", today).lte("block_date", weekAhead).order("block_date").order("start_time").limit(32),
    supabase.from("projects").select("id,name,status,target_date,goal_id,updated_at").eq("user_id", user.id).in("status", ["active", "paused"]).order("updated_at", { ascending: false }).limit(8),
    supabase.from("goals").select("id,title,status,progress,target_date,next_step,category,updated_at").eq("user_id", user.id).eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }).limit(10),
    supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id", user.id).eq("status", "open").order("created_at", { ascending: false }).limit(8),
    supabase.from("habits").select("id,name,goal_id").eq("user_id", user.id).eq("active", true).limit(16),
    supabase.from("habit_checkins").select("id,habit_id,checkin_date").eq("user_id", user.id).eq("checkin_date", today).limit(100),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id", user.id).gte("started_at", startToday).limit(40),
    supabase.from("pomodoro_sessions").select("focus_minutes,started_at").eq("user_id", user.id).gte("started_at", new Date(now.getTime() - 6 * 86400000).toISOString()).limit(100),
    supabase.from("expenses").select("amount,category,occurred_at,note").eq("user_id", user.id).gte("occurred_at", startMonth).order("occurred_at", { ascending: false }).limit(600),
    supabase.from("incomes").select("amount,source,occurred_at,note").eq("user_id", user.id).gte("occurred_at", startMonth).order("occurred_at", { ascending: false }).limit(600),
    supabase.from("accounts").select("id,starting_balance").eq("user_id", user.id).limit(50),
    supabase.from("expenses").select("amount").eq("user_id", user.id).limit(2000),
    supabase.from("incomes").select("amount").eq("user_id", user.id).limit(2000),
    supabase.from("hydration_logs").select("amount_ml,logged_at").eq("user_id", user.id).gte("logged_at", startToday).limit(100),
    supabase.from("movement_logs").select("activity,duration_minutes,logged_at").eq("user_id", user.id).gte("logged_at", startToday).order("logged_at", { ascending: false }).limit(20),
    supabase.from("fatigue_logs").select("fatigue_score,logged_at,note").eq("user_id", user.id).gte("logged_at", startToday).order("logged_at", { ascending: false }).limit(8),
    supabase.from("health_metrics").select("weight_kg,systolic,diastolic,resting_hr,measured_at").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(1),
    supabase.from("reminders").select("id,title,body,remind_at,target_type,target_id,status").eq("user_id", user.id).eq("enabled", true).in("status", ["pending", "waiting_for_device"]).order("remind_at").limit(8),
    supabase.from("notification_events").select("id,title,body,href,read_at,created_at,tone").eq("user_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(6),
    supabase.from("subscriptions").select("id,name,amount,next_billing_date,active").eq("user_id", user.id).eq("active", true).order("next_billing_date").limit(8),
    supabase.from("user_memories").select("id").eq("user_id", user.id).eq("enabled", true).limit(50),
    supabase.from("automations").select("id,name,enabled,last_run_at").eq("user_id", user.id).limit(20),
  ]);

  const openTasks = tasks.data ?? [];
  const todayAgenda = (agenda.data ?? []).filter((x) => x.block_date === today);
  const upcomingAgenda = (agenda.data ?? []).filter((x) => x.block_date !== today).slice(0, 5);
  const overdue = openTasks.filter((x) => x.due_at && new Date(x.due_at).getTime() < now.getTime());
  const priorityTask = openTasks.find((x) => x.priority === "high") ?? openTasks[0];
  const nextAgenda = todayAgenda.find((x) => time(x.start_time) >= nowClock) ?? todayAgenda[0] ?? upcomingAgenda[0];
  const monthIncome = (incomesMonth.data as Income[] | null ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const monthExpense = (expensesMonth.data as Expense[] | null ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const balance = (accounts.data ?? []).reduce((s, x) => s + Number(x.starting_balance || 0), 0) + (expensesAll.data ?? []).reduce((s, x) => s - Number(x.amount || 0), 0) + (incomesAll.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const focusTodayMin = (focusToday.data ?? []).reduce((s, x) => s + Number(x.focus_minutes || 0), 0);
  const focusWeekMin = (focusWeek.data ?? []).reduce((s, x) => s + Number(x.focus_minutes || 0), 0);
  const water = (waterToday.data ?? []).reduce((s, x) => s + Number(x.amount_ml || 0), 0);
  const movement = (movementToday.data ?? []).reduce((s, x) => s + Number(x.duration_minutes || 0), 0);
  const fatigue = (fatigueToday.data ?? [])[0]?.fatigue_score ?? null;
  const health = (healthMetric.data ?? [])[0];
  const activeGoals = goals.data ?? [];
  const avgGoal = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + Number(g.progress || 0), 0) / activeGoals.length) : 0;
  const nextGoal = activeGoals[0];
  const taskDone = (doneToday.data ?? []).length;
  const taskBase = taskDone + openTasks.length;
  const taskCompletion = taskBase ? Math.round(taskDone / taskBase * 100) : 0;
  const unread = notifications.data ?? [];
  const activeAutomation = (automations.data ?? []).filter((x) => x.enabled).length;
  const reminder = (reminders.data ?? [])[0];
  const categories = Object.entries((expensesMonth.data as Expense[] | null ?? []).reduce<Record<string, number>>((m, x) => { const key = x.category || "Lainnya"; m[key] = (m[key] || 0) + Number(x.amount || 0); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const signedNet = monthIncome - monthExpense;

  return <div className="dashboard-v29 space-y-5 animate-licia-page-in">
    <header className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-surface p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-accent/15 bg-bg shadow-sm">
          <img src="/licia-avatar.png" alt="Licia" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-accent">LICIA · PERSONAL OS</p>
          <h1 className="mt-1 truncate font-display text-2xl text-text sm:text-3xl">{greeting}, {profile?.display_name || "kamu"}.</h1>
          <p className="mt-1 text-xs text-textMuted">Ini ringkasanmu bersama Licia.</p>
          <p className="mt-1 text-[10px] text-textMuted">{new Intl.DateTimeFormat("id-ID", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/chat" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-xs font-semibold text-white shadow-sm"><MessageCircle size={14}/> Tanya Licia</Link>
        <Link href="/capture" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"><Zap size={14}/> Capture</Link>
        <div className="flex min-h-10 items-center rounded-xl border border-border bg-bg px-3 text-xs text-textMuted"><Clock3 size={13} className="mr-1.5 text-accent"/>{nowClock}</div>
      </div>
    </header>

    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Link href="/tasks"><StatTile label="Tugas" value={String(openTasks.length)} icon={CheckCircle2} tone={overdue.length ? "danger" : "accent"} hint={overdue.length ? `${overdue.length} terlambat` : `${taskCompletion}% selesai hari ini`}/></Link>
      <Link href="/calendar"><StatTile label="Agenda" value={String(todayAgenda.length)} icon={CalendarDays} tone="default" hint={nextAgenda ? `${time(nextAgenda.start_time)} berikutnya` : "Hari kosong"}/></Link>
      <Link href="/finance"><StatTile label="Net bulan ini" value={rupiah(signedNet)} icon={CircleDollarSign} tone={signedNet < 0 ? "danger" : "default"} hint={`${rupiah(monthExpense)} keluar`}/></Link>
      <Link href="/goals"><StatTile label="Target" value={`${avgGoal}%`} icon={Target} tone="accent" hint={`${activeGoals.length} target aktif`}/></Link>
    </section>

    {Boolean(prefs.showDailyIntelligence !== false) && <DailyIntelligence compact />}

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/today" className="text-xs font-semibold text-accent">Hari Ini <ArrowRight size={12} className="inline"/></Link>}>Fokus hari ini</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/calendar" className="rounded-2xl border border-border bg-bg p-4 transition hover:border-accent/25">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-accent"><CalendarDays size={12}/> Agenda berikutnya</div>
            {nextAgenda ? <><p className="mt-2 break-words text-sm font-semibold text-text">{nextAgenda.title}</p><p className="mt-1 text-[10px] text-textMuted">{dateLabel(nextAgenda.block_date, timezone)} · {time(nextAgenda.start_time)}–{time(nextAgenda.end_time)}{nextAgenda.location ? ` · ${nextAgenda.location}` : ""}</p></> : <p className="mt-3 text-sm text-textMuted">Belum ada agenda.</p>}
          </Link>
          <Link href="/tasks" className="rounded-2xl border border-border bg-bg p-4 transition hover:border-accent/25">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-accent"><CheckCircle2 size={12}/> Next move</div>
            {priorityTask ? <><p className="mt-2 break-words text-sm font-semibold text-text">{priorityTask.title}</p><p className="mt-1 text-[10px] text-textMuted">{priorityTask.priority === "high" ? "Prioritas tinggi" : "Tugas berikutnya"} · {priorityTask.due_at ? whenLabel(priorityTask.due_at, timezone) : "Tanpa tenggat"}</p></> : <p className="mt-3 text-sm text-textMuted">Semua tugas sudah tertata.</p>}
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/inbox" className="rounded-2xl border border-dashed border-accent/20 bg-accent/5 p-3"><div className="flex items-center gap-2"><Inbox size={13} className="text-accent"/><p className="text-xs font-semibold text-text">Inbox</p><span className="ml-auto text-[10px] text-accent">{(inbox.data ?? []).length} item</span></div><p className="mt-1 line-clamp-1 text-[10px] text-textMuted">{(inbox.data ?? [])[0]?.content || "Tidak ada hal mentah yang menunggu dipilah."}</p></Link>
          <Link href="/reminders" className="rounded-2xl border border-border bg-bg p-3"><div className="flex items-center gap-2"><BellRing size={13} className="text-accent"/><p className="text-xs font-semibold text-text">Pengingat</p><span className="ml-auto text-[10px] text-accent">{reminder ? whenLabel(reminder.remind_at, timezone) : "Tidak ada"}</span></div><p className="mt-1 line-clamp-1 text-[10px] text-textMuted">{reminder?.title || "Atur reminder untuk agenda, tugas, atau waktu tertentu."}</p></Link>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/finance" className="text-xs font-semibold text-accent">Finance <ArrowRight size={12} className="inline"/></Link>}>Keuangan bulan ini</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Masuk</p><p className="mt-1 text-sm font-semibold text-success">{rupiah(monthIncome)}</p></div>
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Keluar</p><p className="mt-1 text-sm font-semibold text-danger">{rupiah(monthExpense)}</p></div>
          <div className="col-span-2 rounded-2xl border border-accent/15 bg-accent/5 p-3"><div className="flex items-center justify-between gap-2"><p className="text-[9px] text-textMuted">Saldo berjalan</p><p className="text-sm font-semibold text-accent">{rupiah(balance)}</p></div><p className="mt-1 text-[10px] text-textMuted">Net bulan ini {rupiah(signedNet)}</p></div>
        </div>
        <div className="mt-4 space-y-2">{categories.map(([cat, value]) => <div key={cat}><div className="flex justify-between gap-2 text-[10px]"><span className="truncate text-textMuted">{cat}</span><span className="font-semibold text-text">{rupiah(value)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-accent/60" style={{ width: `${monthExpense ? Math.min(100, Math.round(value / monthExpense * 100)) : 0}%` }}/></div></div>)}{!categories.length && <p className="text-xs text-textMuted">Belum ada pengeluaran bulan ini.</p>}</div>
      </Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/goals" className="text-xs font-semibold text-accent">Semua target <ArrowRight size={12} className="inline"/></Link>}>Arah hidup</SectionTitle>
        {nextGoal ? <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Target size={16}/></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wider text-accent">Target terdekat</p><p className="mt-1 break-words text-sm font-semibold text-text">{nextGoal.title}</p><p className="mt-1 text-[10px] text-textMuted">{Number(nextGoal.progress || 0)}% · {nextGoal.target_date ? `${dateLabel(nextGoal.target_date, timezone)} · ${daysTo(nextGoal.target_date) !== null && daysTo(nextGoal.target_date)! < 0 ? "terlambat" : `H-${daysTo(nextGoal.target_date)}`}` : "tanpa deadline"}</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, Number(nextGoal.progress || 0)))}%` }}/></div>{nextGoal.next_step&&<p className="mt-2 text-[10px] text-textMuted">Next step: {nextGoal.next_step}</p>}</div> : <div className="rounded-2xl bg-bg p-4"><p className="text-sm font-semibold text-text">Belum ada target aktif.</p><p className="mt-1 text-[10px] text-textMuted">Buat target untuk membangun roadmap yang terhubung.</p></div>}
        <div className="mt-3 grid grid-cols-2 gap-2">{activeGoals.slice(0,4).map(g=><Link href="/goals" key={g.id} className="rounded-xl border border-border bg-bg p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-text">{g.title}</span><span className="text-[10px] font-semibold text-accent">{Number(g.progress||0)}%</span></div><div className="mt-2 h-1.5 rounded-full bg-surface"><div className="h-full rounded-full bg-accent/70" style={{width:`${Math.max(0,Math.min(100,Number(g.progress||0)))}%`}}/></div></Link>)}</div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/calendar" className="text-xs font-semibold text-accent">Kalender <ArrowRight size={12} className="inline"/></Link>}>Jadwal</SectionTitle>
        <div className="space-y-2">{todayAgenda.slice(0,5).map(a=><Link href="/calendar" key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3 transition hover:border-accent/25"><div className="w-12 shrink-0 text-center"><p className="text-xs font-semibold text-accent">{time(a.start_time)}</p><p className="text-[9px] text-textMuted">{time(a.end_time)}</p></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text">{a.title}</p><p className="mt-1 truncate text-[10px] text-textMuted">{a.location || "Tanpa lokasi"}</p></div><ArrowRight size={13} className="shrink-0 text-textMuted"/></Link>)}{!todayAgenda.length&&<p className="rounded-xl bg-bg p-4 text-sm text-textMuted">Tidak ada agenda hari ini.</p>}</div>
        {upcomingAgenda.length>0&&<div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-textMuted">Mendatang</p><div className="space-y-1.5">{upcomingAgenda.slice(0,3).map(a=><Link href="/calendar" key={a.id} className="flex items-center justify-between gap-2"><span className="truncate text-[10px] text-text">{a.title}</span><span className="shrink-0 text-[9px] text-textMuted">{dateLabel(a.block_date,timezone)} · {time(a.start_time)}</span></Link>)}</div></div>}
      </Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/health" className="text-xs font-semibold text-accent">Health <ArrowRight size={12} className="inline"/></Link>}>Kondisi hari ini</SectionTitle>
        <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-bg p-3"><Droplets size={14} className="text-accent"/><p className="mt-2 text-lg font-semibold text-text">{(water/1000).toFixed(1)} L</p><p className="text-[9px] text-textMuted">hidrasi</p></div><div className="rounded-xl bg-bg p-3"><Timer size={14} className="text-accent"/><p className="mt-2 text-lg font-semibold text-text">{movement} m</p><p className="text-[9px] text-textMuted">gerak</p></div><div className="rounded-xl bg-bg p-3"><HeartPulse size={14} className="text-accent"/><p className="mt-2 text-lg font-semibold text-text">{fatigue ? `${fatigue}/5` : "—"}</p><p className="text-[9px] text-textMuted">check-in</p></div><div className="rounded-xl bg-bg p-3"><Wallet size={14} className="text-accent"/><p className="mt-2 text-lg font-semibold text-text">{health?.weight_kg ? `${health.weight_kg}` : "—"}</p><p className="text-[9px] text-textMuted">kg terbaru</p></div></div>
        <div className="mt-3 rounded-xl border border-border bg-bg p-3"><p className="text-[9px] uppercase tracking-wider text-textMuted">Rutinitas</p><p className="mt-1 text-xs font-semibold text-text">{(habitCheckins.data??[]).length} / {(habits.data??[]).length} habit check-in hari ini</p></div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionTitle action={<Link href="/system" className="text-xs font-semibold text-accent">System Center <ArrowRight size={12} className="inline"/></Link>}>Sistem Licia</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Link href="/projects" className="rounded-xl bg-bg p-3"><FolderKanban size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Projects</p><p className="mt-1 text-lg font-semibold text-text">{(projects.data??[]).length}</p></Link><Link href="/automations" className="rounded-xl bg-bg p-3"><Zap size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Automation</p><p className="mt-1 text-lg font-semibold text-text">{activeAutomation}</p></Link><Link href="/subscriptions" className="rounded-xl bg-bg p-3"><CircleDollarSign size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Langganan</p><p className="mt-1 text-lg font-semibold text-text">{(subscriptions.data??[]).length}</p></Link><Link href="/memory" className="rounded-xl bg-bg p-3"><Sparkles size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Memory</p><p className="mt-1 text-lg font-semibold text-text">{(memories.data??[]).length}</p></Link><Link href="/system" className="rounded-xl bg-bg p-3"><BellRing size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Alerts</p><p className="mt-1 text-lg font-semibold text-text">{unread.length}</p></Link><Link href="/timeline" className="rounded-xl bg-bg p-3"><Clock3 size={14} className="text-accent"/><p className="mt-2 text-[10px] text-textMuted">Focus 7 hari</p><p className="mt-1 text-lg font-semibold text-text">{focusWeekMin}m</p></Link></div>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
      <ActivityFeed limit={6}/>
      <Card className="p-4 sm:p-5"><SectionTitle action={<Link href="/guide" className="text-xs font-semibold text-accent">Panduan <ArrowRight size={12} className="inline"/></Link>}>Licia terhubung</SectionTitle><div className="grid gap-2 sm:grid-cols-2"><Link href="/tasks" className="rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-text">Pekerjaan</p><p className="mt-1 text-[10px] text-textMuted">Tasks · Calendar · Focus · Projects</p></Link><Link href="/goals" className="rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-text">Arah</p><p className="mt-1 text-[10px] text-textMuted">Goals · Habits · Learning · Reading</p></Link><Link href="/finance" className="rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-text">Keuangan</p><p className="mt-1 text-[10px] text-textMuted">Finance · Subscriptions</p></Link><Link href="/memory" className="rounded-xl bg-bg p-3"><p className="text-xs font-semibold text-text">Konteks</p><p className="mt-1 text-[10px] text-textMuted">Memory · Notes · Inbox · Vault</p></Link></div><Link href="/chat" className="mt-3 flex items-center justify-between rounded-xl border border-accent/15 bg-accent/5 p-3"><div className="min-w-0"><p className="text-xs font-semibold text-text">Butuh tindakan?</p><p className="mt-1 text-[10px] text-textMuted">Tanyakan ke Licia dan gunakan konteks Life OS yang relevan.</p></div><ArrowRight size={14} className="shrink-0 text-accent"/></Link></Card>
    </section>
  </div>;
}
