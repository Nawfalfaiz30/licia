import Link from "next/link";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { dateStrInTimezone, startOfDayIsoForTimezone, startOfMonthIsoForTimezone } from "@/lib/date";
import { ActivityFeed } from "@/components/intelligence/ActivityFeed";
import { LifeInsights } from "@/components/v35/LifeInsights";
import { WeeklyReviewCard } from "@/components/v36/WeeklyReviewCard";
import { AnimatedNumber, Card, SectionTitle, StatTile } from "@/components/ui";
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Inbox,
  ListChecks,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  Target,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import { memoizeUserData } from "@/lib/performance/userCache";
import { DashboardLayoutProvider } from "@/components/dashboard/DashboardLayoutProvider";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { OnboardingChecklist } from "@/components/intelligence/OnboardingChecklist";
import { getServerT } from "@/lib/i18n-server";

function rupiahIn(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
function time(v: string | null | undefined) {
  return String(v || "").slice(0, 5);
}
function dateLabelIn(v: string, tz: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(
      new Date(`${v}T12:00:00`),
    );
  } catch {
    return v;
  }
}
function whenLabelIn(v: string | null, tz: string, locale: string) {
  if (!v) return "Tanpa waktu";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(v));
  } catch {
    return v;
  }
}
function daysTo(v: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(`${v}T23:59:59`).getTime() - Date.now()) / 86400000);
}

type Expense = { amount: number | string | null; category: string | null; occurred_at: string; note: string | null };
type Income = { amount: number | string | null; source: string | null; occurred_at: string; note: string | null };

export default async function DashboardPage() {
  const { t: tr, locale } = await getServerT();
  const rupiah = (n: number) => rupiahIn(n, locale);
  const dateLabel = (v: string, tz: string) => dateLabelIn(v, tz, locale);
  const whenLabel = (v: string | null, tz: string) => whenLabelIn(v, tz, locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("display_name,timezone,preferences")
    .eq("id", user.id)
    .single();
  const resolved = profile ?? (await getOrCreateProfile(supabase, user.id, user.user_metadata?.display_name));
  const timezone = profile?.timezone ?? (resolved as any)?.timezone ?? "Asia/Jakarta";
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const weekAhead = dateStrInTimezone(new Date(now.getTime() + 7 * 86400000), timezone);
  const startToday = startOfDayIsoForTimezone(now, timezone);
  const startMonth = startOfMonthIsoForTimezone(now, timezone);
  const nowClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number(nowClock.slice(0, 2));
  const greetingPool =
    hour < 12
      ? [
          "Selamat pagi",
          tr("Pagi yang baik"),
          "Pagi, siap mulai?",
          tr("Hari baru dimulai"),
          tr("Pagi yang tenang, mari mulai"),
          tr("Selamat datang di pagi ini"),
        ]
      : hour < 18
        ? [
            "Selamat siang",
            tr("Siang yang baik"),
            tr("Halo, bagaimana ritmemu siang ini?"),
            tr("Siang, mari lihat yang penting"),
            "Semoga siangmu berjalan lancar",
            "Mari lanjutkan harimu",
          ]
        : [
            "Selamat malam",
            tr("Malam yang tenang"),
            "Halo, bagaimana harimu?",
            tr("Malam ini, mari lihat apa yang tersisa"),
            tr("Hari hampir selesai, mari cek sebentar"),
            "Selamat menikmati sisa harimu",
          ];
  const greetingSeed =
    today
      .replace(/\D/g, "")
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0) + Math.floor(hour / 2);
  const greeting = greetingPool[greetingSeed % greetingPool.length];

  const dashboardData = await memoizeUserData(
    "dashboard",
    user.id,
    () =>
      Promise.all([
        supabase
          .from("tasks")
          .select("id,title,status,priority,due_at,estimated_minutes,project_id")
          .eq("user_id", user.id)
          .neq("status", "done")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(60),
        supabase
          .from("tasks")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "done")
          .gte("updated_at", startToday)
          .limit(200),
        supabase
          .from("schedule_blocks")
          .select("id,title,block_date,start_time,end_time,location,task_id,project_id")
          .eq("user_id", user.id)
          .eq("block_date", today)
          .order("start_time")
          .limit(32),
        supabase
          .from("schedule_blocks")
          .select("id,title,block_date,start_time,end_time,location,task_id,project_id")
          .eq("user_id", user.id)
          .gt("block_date", today)
          .lte("block_date", weekAhead)
          .order("block_date")
          .order("start_time")
          .limit(16),
        supabase
          .from("projects")
          .select("id,name,status,target_date,goal_id,updated_at")
          .eq("user_id", user.id)
          .in("status", ["active", "paused"])
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("goals")
          .select("id,title,status,progress,target_date,next_step,category,updated_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("target_date", { ascending: true, nullsFirst: false })
          .limit(10),
        supabase
          .from("smart_inbox_items")
          .select("id,content,status,created_at")
          .eq("user_id", user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("habits").select("id,name,goal_id").eq("user_id", user.id).eq("active", true).limit(16),
        supabase
          .from("habit_checkins")
          .select("id,habit_id,checkin_date")
          .eq("user_id", user.id)
          .eq("checkin_date", today)
          .limit(100),
        supabase
          .from("pomodoro_sessions")
          .select("focus_minutes,started_at")
          .eq("user_id", user.id)
          .gte("started_at", startToday)
          .limit(40),
        supabase
          .from("pomodoro_sessions")
          .select("focus_minutes,started_at")
          .eq("user_id", user.id)
          .gte("started_at", new Date(now.getTime() - 6 * 86400000).toISOString())
          .limit(100),
        supabase
          .from("expenses")
          .select("amount,category,occurred_at,note")
          .eq("user_id", user.id)
          .gte("occurred_at", startMonth)
          .order("occurred_at", { ascending: false })
          .limit(600),
        supabase
          .from("incomes")
          .select("amount,source,occurred_at,note")
          .eq("user_id", user.id)
          .gte("occurred_at", startMonth)
          .order("occurred_at", { ascending: false })
          .limit(600),
        supabase.from("accounts").select("id,starting_balance").eq("user_id", user.id).limit(50),
        supabase.from("expenses").select("amount").eq("user_id", user.id).limit(2000),
        supabase.from("incomes").select("amount").eq("user_id", user.id).limit(2000),
        supabase
          .from("hydration_logs")
          .select("amount_ml,logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", startToday)
          .limit(100),
        supabase
          .from("movement_logs")
          .select("activity,duration_minutes,logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", startToday)
          .order("logged_at", { ascending: false })
          .limit(20),
        supabase
          .from("fatigue_logs")
          .select("fatigue_score,logged_at,note")
          .eq("user_id", user.id)
          .gte("logged_at", startToday)
          .order("logged_at", { ascending: false })
          .limit(8),
        supabase
          .from("health_metrics")
          .select("weight_kg,systolic,diastolic,resting_hr,measured_at")
          .eq("user_id", user.id)
          .order("measured_at", { ascending: false })
          .limit(1),
        supabase
          .from("reminders")
          .select("id,title,body,remind_at,target_type,target_id,status")
          .eq("user_id", user.id)
          .eq("enabled", true)
          .in("status", ["pending", "waiting_for_device"])
          .order("remind_at")
          .limit(8),
        supabase
          .from("notification_events")
          .select("id,title,body,href,read_at,created_at,tone")
          .eq("user_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("subscriptions")
          .select("id,name,amount,next_billing_date,active")
          .eq("user_id", user.id)
          .eq("active", true)
          .order("next_billing_date")
          .limit(8),
        supabase.from("user_memories").select("id").eq("user_id", user.id).eq("enabled", true).limit(50),
        supabase.from("automations").select("id,name,enabled,last_run_at").eq("user_id", user.id).limit(20),
      ]),
    7_500,
  );

  const [
    tasks,
    doneToday,
    todaySchedule,
    upcomingSchedule,
    projects,
    goals,
    inbox,
    habits,
    habitCheckins,
    focusToday,
    focusWeek,
    expensesMonth,
    incomesMonth,
    accounts,
    expensesAll,
    incomesAll,
    waterToday,
    movementToday,
    fatigueToday,
    healthMetric,
    reminders,
    notifications,
    subscriptions,
    memories,
    automations,
  ] = dashboardData;

  const openTasks = tasks.data ?? [];
  // Jadwal kartu "Hari ini" hanya berasal dari query yang sudah dibatasi block_date = today.
  // Query terpisah untuk agenda mendatang mencegah item hari lain bocor ke snapshot hari ini.
  const todayAgenda = todaySchedule.data ?? [];
  const upcomingAgenda = (upcomingSchedule.data ?? []).slice(0, 5);
  const overdue = openTasks.filter((x) => x.due_at && new Date(x.due_at).getTime() < now.getTime());
  const priorityTask = openTasks.find((x) => x.priority === "high") ?? openTasks[0];
  const nextAgenda = todayAgenda.find((x) => time(x.start_time) >= nowClock) ?? todayAgenda[0] ?? upcomingAgenda[0];
  const monthIncome = ((incomesMonth.data as Income[] | null) ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const monthExpense = ((expensesMonth.data as Expense[] | null) ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const balance =
    (accounts.data ?? []).reduce((s, x) => s + Number(x.starting_balance || 0), 0) +
    (expensesAll.data ?? []).reduce((s, x) => s - Number(x.amount || 0), 0) +
    (incomesAll.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const focusTodayMin = (focusToday.data ?? []).reduce((s, x) => s + Number(x.focus_minutes || 0), 0);
  const focusWeekMin = (focusWeek.data ?? []).reduce((s, x) => s + Number(x.focus_minutes || 0), 0);
  const water = (waterToday.data ?? []).reduce((s, x) => s + Number(x.amount_ml || 0), 0);
  const movement = (movementToday.data ?? []).reduce((s, x) => s + Number(x.duration_minutes || 0), 0);
  const fatigue = (fatigueToday.data ?? [])[0]?.fatigue_score ?? null;
  const health = (healthMetric.data ?? [])[0];
  const activeGoals = goals.data ?? [];
  const avgGoal = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + Number(g.progress || 0), 0) / activeGoals.length)
    : 0;
  const nextGoal = activeGoals[0];
  const taskDone = (doneToday.data ?? []).length;
  const taskBase = taskDone + openTasks.length;
  const taskCompletion = taskBase ? Math.round((taskDone / taskBase) * 100) : 0;
  const unread = notifications.data ?? [];
  const activeAutomation = (automations.data ?? []).filter((x) => x.enabled).length;
  const reminder = (reminders.data ?? [])[0];
  const categories = Object.entries(
    ((expensesMonth.data as Expense[] | null) ?? []).reduce<Record<string, number>>((m, x) => {
      const key = x.category || "Lainnya";
      m[key] = (m[key] || 0) + Number(x.amount || 0);
      return m;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const signedNet = monthIncome - monthExpense;
  const focusWeekDays = new Set((focusWeek.data ?? []).map((x) => String(x.started_at).slice(0, 10))).size;
  const averageFocusPerDay = focusWeekDays ? Math.round(focusWeekMin / focusWeekDays) : 0;
  const focusCapacity7d = averageFocusPerDay * 7;
  const forecastEndMs = now.getTime() + 7 * 86400000;
  const dueNext7d = openTasks.filter((task) => {
    if (!task.due_at) return false;
    const dueMs = new Date(task.due_at).getTime();
    return Number.isFinite(dueMs) && dueMs >= now.getTime() && dueMs <= forecastEndMs;
  });
  const dueNext7dMinutes = dueNext7d.reduce((sum, task) => sum + Math.max(0, Number(task.estimated_minutes) || 0), 0);
  const [localYear, localMonth] = today.split("-").map(Number);
  const daysInMonth =
    Number.isFinite(localYear) && Number.isFinite(localMonth)
      ? new Date(Date.UTC(localYear, localMonth, 0)).getUTCDate()
      : 30;
  const elapsedMonthDays = Math.max(1, Number(today.slice(8, 10)) || 1);
  const projectedMonthlySpend = monthExpense > 0 ? Math.round((monthExpense / elapsedMonthDays) * daysInMonth) : 0;
  const briefPriorities = [...openTasks]
    .sort((a, b) => {
      const priorityWeight = (value: unknown) => (value === "high" ? 3 : value === "medium" ? 2 : 1);
      const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
      const aScore = (Number.isFinite(aDue) && aDue < now.getTime() ? 100 : 0) + priorityWeight(a.priority) * 20;
      const bScore = (Number.isFinite(bDue) && bDue < now.getTime() ? 100 : 0) + priorityWeight(b.priority) * 20;
      if (aScore !== bScore) return bScore - aScore;
      return aDue - bDue;
    })
    .slice(0, 3);
  const nearGoal = activeGoals.find(
    (goal) =>
      goal.target_date &&
      new Date(`${goal.target_date}T23:59:59`).getTime() >= now.getTime() &&
      new Date(`${goal.target_date}T23:59:59`).getTime() <= forecastEndMs &&
      Number(goal.progress || 0) < 70,
  );
  const nearSubscription = (subscriptions.data ?? []).find(
    (subscription) =>
      subscription.next_billing_date &&
      new Date(`${subscription.next_billing_date}T23:59:59`).getTime() >= now.getTime() &&
      new Date(`${subscription.next_billing_date}T23:59:59`).getTime() <= forecastEndMs,
  );
  const proactiveRisk = overdue.length
    ? tr("{n} tugas melewati tenggat.", { n: overdue.length })
    : nearGoal
      ? tr("Target {title} mendekati batas dengan progres {progress}%.", {
          title: nearGoal.title,
          progress: Number(nearGoal.progress || 0),
        })
      : nearSubscription
        ? tr("Langganan {name} jatuh tempo dalam 7 hari.", { name: nearSubscription.name })
        : inbox.data?.length
          ? tr("{n} item Inbox masih belum diproses.", { n: inbox.data.length })
          : null;
  const proactiveRecommendation = overdue.length
    ? tr("Selesaikan satu tugas terlambat sebelum menambah komitmen baru.")
    : dueNext7dMinutes > 0 && focusCapacity7d > 0 && dueNext7dMinutes > focusCapacity7d
      ? tr(
          "Beban tugas berestimasi melebihi kapasitas fokus 7 hari; pertimbangkan memindahkan atau memecah satu tugas.",
        )
      : nextAgenda &&
          priorityTask &&
          priorityTask.due_at &&
          new Date(priorityTask.due_at).getTime() < new Date(`${nextAgenda.block_date}T23:59:59`).getTime()
        ? tr("Gunakan ruang sebelum agenda berikutnya untuk mengerjakan tugas prioritas.")
        : inbox.data?.length
          ? tr("Proses satu item Inbox agar tidak menambah beban mental.")
          : tr("Pilih satu pekerjaan penting dan beri blok Fokus nyata hari ini.");
  const smartMove = overdue.length
    ? {
        eyebrow: tr("Prioritas sekarang"),
        title: overdue[0].title,
        detail: tr("Ada tugas yang sudah melewati tenggat. Selesaikan atau atur ulang sebelum mengambil beban baru."),
        href: "/tasks",
        cta: tr("Buka tugas"),
        tone: "danger" as const,
      }
    : nextAgenda
      ? {
          eyebrow: tr("Yang sebentar lagi datang"),
          title: nextAgenda.title,
          detail: `${dateLabel(nextAgenda.block_date, timezone)} · ${time(nextAgenda.start_time)}–${time(nextAgenda.end_time)}`,
          href: "/calendar",
          cta: tr("Buka agenda"),
          tone: "accent" as const,
        }
      : inbox.data?.length
        ? {
            eyebrow: tr("Bereskan yang menumpuk"),
            title: "Kotak Masuk Cerdas",
            detail: tr("{data_length} item masih menunggu dipilah.", { data_length: inbox.data.length }),
            href: "/capture",
            cta: tr("Buka inbox"),
            tone: "accent" as const,
          }
        : priorityTask
          ? {
              eyebrow: "Langkah berikutnya",
              title: priorityTask.title,
              detail: priorityTask.due_at
                ? `Tenggat ${whenLabel(priorityTask.due_at, timezone)}.`
                : tr("Belum ada tenggat, jadi kamu bisa menentukan ritmenya sendiri."),
              href: "/tasks",
              cta: "Kerjakan",
              tone: "accent" as const,
            }
          : {
              eyebrow: "Licia siap membantu",
              title: tr("Tentukan satu hal penting untuk hari ini"),
              detail: tr("Tanya Licia, simpan cepat, atau mulai sesi fokus untuk mengubah niat menjadi langkah nyata."),
              href: "/chat",
              cta: "Tanya Licia",
              tone: "accent" as const,
            };

  return (
    <DashboardLayoutProvider>
      <div className="dashboard-v29 flex flex-col gap-5 animate-licia-page-in">
        <header className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 sm:px-5">
          <div className="flex min-h-[76px] items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-accent/15">
              <img src="/licia-avatar.png" alt={tr("Licia")} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-semibold text-accent">{tr("LIFE OS")}</p>
              <h1 className="truncate font-display text-2xl text-text">
                {greeting}, {profile?.display_name || tr("kamu")}.
              </h1>
              <p className="truncate text-2xs text-textMuted">
                {tr("{agenda} jadwal · {tasks} tugas aktif", { agenda: todayAgenda.length, tasks: openTasks.length })}
                {proactiveRisk ? tr(" · Perlu perhatian") : ""}
              </p>
            </div>
            <DashboardCustomizer />
          </div>
        </header>
        <section className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label={tr("Aksi cepat")}>
          <Link
            href="/tasks"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-xs font-semibold text-white"
          >
            <Plus size={15} />
            {tr("Tugas")}
          </Link>
          <Link
            href="/capture"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
          >
            <Plus size={15} />
            {tr("Catatan")}
          </Link>
          <Link
            href="/finance?tab=transactions"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
          >
            <Wallet size={15} />
            {tr("Pengeluaran")}
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"
          >
            <Search size={15} />
            {tr("Cari")}
          </Link>
        </section>

        <DashboardWidget id="overview">
          <section className="dashboard-top-overview grid gap-3 sm:grid-cols-2">
            <Link
              href="/calendar"
              className="dashboard-overview-card rounded-2xl border border-accent/15 bg-accent/5 p-4 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-accent">
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarDays size={13} /> {tr("Jadwal hari ini")}
                </span>
                <ArrowRight size={13} className="shrink-0 text-accent" />
              </div>
              <p className="mt-3 font-display text-2xl text-text">{todayAgenda.length}</p>
              <p className="mt-1 line-clamp-2 text-2xs text-textMuted">
                {nextAgenda
                  ? tr("Mulai {time} · {nextAgenda_title}", {
                      time: time(nextAgenda.start_time),
                      nextAgenda_title: nextAgenda.title,
                    })
                  : tr("Belum ada agenda untuk hari ini.")}
              </p>
            </Link>

            <Link
              href="/finance"
              className="dashboard-overview-card rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-success">
                <span className="flex min-w-0 items-center gap-2">
                  <Wallet size={13} /> {tr("Keuangan")}
                </span>
                <ArrowRight size={13} className="shrink-0 text-textMuted" />
              </div>
              <p className={clsx("mt-3 text-base font-semibold", signedNet < 0 ? "text-danger" : "text-success")}>
                {rupiah(signedNet)}
              </p>
              <p className="mt-1 text-2xs font-semibold text-textMuted">{tr("Selisih bulan ini")}</p>
              <p className="mt-1 text-2xs text-textMuted">
                {tr("Pemasukan")} <span className="font-semibold text-success">{rupiah(monthIncome)}</span> ·{" "}
                {tr("Pengeluaran")} <span className="font-semibold text-danger">{rupiah(monthExpense)}</span>
              </p>
            </Link>

            <Link
              href="/goals-projects"
              className="dashboard-overview-card rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-accent">
                <span className="flex min-w-0 items-center gap-2">
                  <Target size={13} /> {tr("Target & proyek")}
                </span>
                <ArrowRight size={13} className="shrink-0 text-textMuted" />
              </div>
              {activeGoals.length ? (
                <>
                  <p className="mt-3 text-base font-semibold text-text">
                    {tr("{avgGoal}% rata-rata target", { avgGoal })}
                  </p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("{activeGoals_length} target aktif ·", { activeGoals_length: activeGoals.length })}{" "}
                    {(projects.data ?? []).length} {tr("proyek aktif")}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-base font-semibold text-text">{tr("Belum ada target")}</p>
                  <p className="mt-1 inline-flex rounded-lg bg-accent/10 px-2 py-1 text-2xs font-semibold text-accent">
                    {tr("Buat target pertama")}
                  </p>
                </>
              )}
            </Link>

            <Link
              href="/wellbeing"
              className="dashboard-overview-card rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-accent">
                <span className="flex min-w-0 items-center gap-2">
                  <HeartPulse size={13} /> {tr("Kondisi hari ini")}
                </span>
                <ArrowRight size={13} className="shrink-0 text-textMuted" />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-base font-semibold text-text">{Math.min(2, water / 1000).toFixed(1)} / 2 L</p>
                <span className="text-2xs text-textMuted">{Math.min(100, Math.round((water / 2000) * 100))}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.min(100, Math.round((water / 2000) * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-2xs text-textMuted">
                {movement > 0 ? tr("{movement} menit gerak", { movement }) : tr("Belum bergerak hari ini")}
                {water < 2000 && <span className="text-accent"> · +250 ml</span>}
              </p>
            </Link>
          </section>
        </DashboardWidget>

        <DashboardWidget id="nextmove">
          <section className="rounded-[1.5rem] border border-accent/15 bg-accent/5 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{tr("LAPISAN PROAKTIF")}</p>
                <h2 className="mt-1 font-display text-xl text-text">{tr("brief")}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-textMuted">
                  {tr("Tiga prioritas, risiko, kapasitas, fokus, dan sinyal penting hari ini.")}
                </p>
              </div>
              <Link
                href="/insights"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-surface px-3.5 text-2xs font-semibold text-text shadow-sm hover:text-accent"
              >
                {tr("Buka review")}
                <ArrowRight size={11} />
              </Link>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xs font-bold uppercase tracking-[.14em] text-textMuted">
                    {tr("Prioritas sekarang")}
                  </p>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-1 text-2xs font-semibold",
                      proactiveRisk ? "bg-danger/10 text-danger" : "bg-success/10 text-success",
                    )}
                  >
                    {proactiveRisk ? tr("Perlu perhatian") : tr("Tidak ada sinyal kritis")}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {briefPriorities.length ? (
                    briefPriorities.map((task) => (
                      <Link
                        href="/tasks"
                        key={task.id}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-bg p-3 transition hover:border-accent/30 hover:bg-accent/5"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                          <CheckCircle2 size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-xs font-semibold text-text">{task.title}</span>
                          <span className="mt-1 block text-2xs text-textMuted">
                            {task.priority === "high" ? tr("Prioritas tinggi") : tr("Prioritas normal")}
                            {task.due_at ? ` · ${whenLabel(task.due_at, timezone)}` : ` · ${tr("Tanpa tenggat")}`}
                          </span>
                        </span>
                        <ArrowRight size={12} className="mt-1 shrink-0 text-textMuted group-hover:text-accent" />
                      </Link>
                    ))
                  ) : (
                    <p className="rounded-xl bg-bg p-3 text-xs text-textMuted">
                      {tr("Tidak ada tugas terbuka. Hari ini bisa dipakai untuk menjaga ritme atau meninjau target.")}
                    </p>
                  )}
                </div>
                {proactiveRisk && (
                  <div className="mt-3 rounded-xl border border-danger/15 bg-danger/5 p-3">
                    <p className="text-2xs font-semibold text-danger">{tr("Risiko")}</p>
                    <p className="mt-1 text-2xs leading-relaxed text-textMuted">{proactiveRisk}</p>
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-accent/15 bg-accent/5 p-3">
                  <p className="text-2xs font-semibold text-accent">{tr("Rekomendasi Licia")}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-textMuted">{proactiveRecommendation}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xs font-bold uppercase tracking-[.14em] text-textMuted">
                    {tr("Kapasitas & beban")}
                  </p>
                  <span className="text-2xs text-textMuted">7 hari</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Fokus")}</p>
                    <p className="mt-1 font-display text-lg text-text">
                      {focusCapacity7d ? `${focusCapacity7d}m` : "—"}
                    </p>
                    <p className="mt-1 text-2xs text-textMuted">
                      {focusWeekDays
                        ? tr("berdasarkan {n} hari fokus", { n: focusWeekDays })
                        : tr("belum ada ritme fokus")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Tugas jatuh tempo")}</p>
                    <p className="mt-1 font-display text-lg text-text">
                      {dueNext7dMinutes ? `${dueNext7dMinutes}m` : "—"}
                    </p>
                    <p className="mt-1 text-2xs text-textMuted">{tr("estimasi tersedia")}</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-border bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Keuangan")}</p>
                    <p className="mt-1 text-sm font-semibold text-text">
                      {projectedMonthlySpend ? rupiah(projectedMonthlySpend) : "—"}
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-textMuted">
                      {projectedMonthlySpend
                        ? tr("Proyeksi pengeluaran bulanan dari laju bulan berjalan; ini bukan prediksi pasti.")
                        : tr("Belum ada pengeluaran bulan ini untuk diproyeksikan.")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border bg-surface p-3.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2.5">
                  <BrainCircuit size={15} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{smartMove.eyebrow}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-text">{smartMove.title}</p>
                    <p className="mt-1 text-2xs leading-relaxed text-textMuted">{smartMove.detail}</p>
                  </div>
                </div>
                <Link
                  href={smartMove.href}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-3.5 text-2xs font-semibold text-textMuted hover:border-accent/25 hover:text-accent"
                >
                  {smartMove.cta}
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </section>
        </DashboardWidget>

        <DashboardWidget id="stats">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Link href="/tasks">
              <StatTile
                label={tr("Tugas terbuka")}
                value={String(openTasks.length)}
                icon={CheckCircle2}
                tone={overdue.length ? "danger" : "accent"}
                hint={
                  overdue.length
                    ? tr("{overdue_length} terlambat", { overdue_length: overdue.length })
                    : tr("{taskCompletion}% selesai hari ini", { taskCompletion })
                }
              />
            </Link>
            <Link href="/calendar">
              <StatTile
                label={tr("Agenda hari ini")}
                value={String(todayAgenda.length)}
                icon={CalendarDays}
                tone="default"
                hint={nextAgenda ? tr("{time} berikutnya", { time: time(nextAgenda.start_time) }) : tr("Hari kosong")}
              />
            </Link>
            <Link href="/focus">
              <StatTile
                label={tr("Fokus hari ini")}
                value={`${focusTodayMin} m`}
                icon={Timer}
                tone="success"
                hint={tr("{focusWeekMin} m minggu ini", { focusWeekMin })}
              />
            </Link>
            <Link href="/goals-projects">
              <StatTile
                label={tr("Target aktif")}
                value={`${avgGoal}%`}
                icon={Target}
                tone="accent"
                hint={tr("{activeGoals_length} target aktif", { activeGoals_length: activeGoals.length })}
              />
            </Link>
          </section>
        </DashboardWidget>

        <DashboardWidget id="now">
          <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/today" className="text-xs font-semibold text-accent">
                    {tr("Buka Hari Ini")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Yang perlu kamu lakukan")}
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/tasks"
                  className="rounded-2xl border border-accent/15 bg-accent/5 p-4 transition hover:-translate-y-0.5 hover:border-accent/30"
                >
                  <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-accent">
                    <ListChecks size={12} /> {tr("Langkah berikutnya")}
                  </div>
                  {priorityTask ? (
                    <>
                      <p className="mt-2 break-words text-sm font-semibold text-text">{priorityTask.title}</p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {priorityTask.priority === "high" ? tr("Prioritas tinggi") : tr("Tugas berikutnya")} ·{" "}
                        {priorityTask.due_at ? whenLabel(priorityTask.due_at, timezone) : tr("Tanpa tenggat")}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-textMuted">
                      {tr("Tidak ada tugas mendesak. Kamu bisa mulai dari target atau sesi fokus.")}
                    </p>
                  )}
                </Link>
                <Link
                  href="/calendar"
                  className="rounded-2xl border border-border bg-bg p-4 transition hover:-translate-y-0.5 hover:border-accent/25"
                >
                  <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-accent">
                    <CalendarDays size={12} /> {tr("Agenda berikutnya")}
                  </div>
                  {nextAgenda ? (
                    <>
                      <p className="mt-2 break-words text-sm font-semibold text-text">{nextAgenda.title}</p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {dateLabel(nextAgenda.block_date, timezone)} · {time(nextAgenda.start_time)}–
                        {time(nextAgenda.end_time)}
                        {nextAgenda.location ? tr(" · {location}", { location: nextAgenda.location }) : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-textMuted">{tr("Belum ada agenda terdekat.")}</p>
                  )}
                </Link>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Link
                  href="/capture"
                  className="rounded-2xl border border-dashed border-accent/20 bg-accent/5 p-3 transition hover:border-accent/30"
                >
                  <div className="flex items-center gap-2">
                    <Inbox size={13} className="text-accent" />
                    <p className="text-xs font-semibold text-text">{tr("Kotak masuk")}</p>
                    <span className="ml-auto text-2xs text-accent">{(inbox.data ?? []).length}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-2xs text-textMuted">
                    {(inbox.data ?? [])[0]?.content || tr("Tidak ada catatan mentah yang menunggu dipilah.")}
                  </p>
                </Link>
                <Link
                  href="/reminders"
                  className="rounded-2xl border border-border bg-bg p-3 transition hover:border-accent/25"
                >
                  <div className="flex items-center gap-2">
                    <BellRing size={13} className="text-accent" />
                    <p className="text-xs font-semibold text-text">{tr("Pengingat")}</p>
                    <span className="ml-auto text-2xs text-accent">
                      {reminder ? whenLabel(reminder.remind_at, timezone) : "—"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-2xs text-textMuted">
                    {reminder?.title || tr("Belum ada pengingat terdekat.")}
                  </p>
                </Link>
                <Link
                  href="/focus"
                  className="rounded-2xl border border-border bg-bg p-3 transition hover:border-accent/25"
                >
                  <div className="flex items-center gap-2">
                    <Timer size={13} className="text-accent" />
                    <p className="text-xs font-semibold text-text">{tr("Fokus")}</p>
                    <span className="ml-auto text-2xs text-accent">{focusTodayMin}m</span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-2xs text-textMuted">
                    {focusTodayMin
                      ? tr("Sesi fokus sudah tercatat hari ini.")
                      : tr("Mulai sesi fokus untuk satu pekerjaan penting.")}
                  </p>
                </Link>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/planner" className="text-xs font-semibold text-accent">
                    {tr("Buka Planner")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Perencanaan hari ini")}
              </SectionTitle>
              <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4">
                <div className="flex items-start gap-3">
                  <BrainCircuit size={17} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-2xs font-bold uppercase tracking-wider text-accent">{tr("Kapasitas & beban")}</p>
                    <p className="mt-1 text-sm font-semibold text-text">
                      {openTasks.length
                        ? tr("{openTasks_length} tugas terbuka", { openTasks_length: openTasks.length })
                        : tr("Tugasmu sudah cukup tertata")}
                    </p>
                    <p className="mt-1 text-2xs leading-relaxed text-textMuted">
                      {tr(
                        "Gunakan Planner untuk menyusun waktu, mensimulasikan perubahan, dan mencari ruang fokus tanpa langsung mengubah kalender.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Terlambat")}</p>
                    <p className="mt-1 text-lg font-semibold text-danger">{overdue.length}</p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Fokus hari ini")}</p>
                    <p className="mt-1 text-lg font-semibold text-text">{focusTodayMin}m</p>
                  </div>
                  <div className="rounded-xl bg-bg p-3">
                    <p className="text-2xs text-textMuted">{tr("Target")}</p>
                    <p className="mt-1 text-lg font-semibold text-accent">{avgGoal}%</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/planner"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
                  >
                    {tr("Atur hari")} <ArrowRight size={11} />
                  </Link>
                  <Link
                    href="/planner?mode=what-if"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
                  >
                    {tr("Simulasikan perubahan")}
                  </Link>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Link href="/goals-projects" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-2xs font-bold uppercase tracking-wider text-textMuted">{tr("Target terdekat")}</p>
                  <p className="mt-1 text-xs font-semibold text-text">
                    {nextGoal?.title || tr("Belum ada target aktif")}
                  </p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {nextGoal
                      ? tr("{Number}% progres", { Number: Number(nextGoal.progress || 0) })
                      : tr("Buat target untuk membangun arah.")}
                  </p>
                </Link>
                <Link href="/goals-projects" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-2xs font-bold uppercase tracking-wider text-textMuted">{tr("Proyek aktif")}</p>
                  <p className="mt-1 text-xs font-semibold text-text">{(projects.data ?? []).length}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {(projects.data ?? [])[0]?.name || tr("Belum ada proyek aktif.")}
                  </p>
                </Link>
              </div>
            </Card>
          </section>
        </DashboardWidget>

        <DashboardWidget id="insights">
          <LifeInsights />
        </DashboardWidget>

        <DashboardWidget id="direction">
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/goals-projects" className="text-xs font-semibold text-accent">
                    {tr("Semua target")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Arah yang sedang dikejar")}
              </SectionTitle>
              {nextGoal ? (
                <div className="rounded-2xl border border-accent/15 bg-accent/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-accent/10 p-2.5 text-accent">
                      <Target size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-2xs font-bold uppercase tracking-wider text-accent">{tr("Target terdekat")}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-text">{nextGoal.title}</p>
                      <p className="mt-1 text-2xs text-textMuted">
                        {Number(nextGoal.progress || 0)}% ·{" "}
                        {nextGoal.target_date
                          ? tr("{dateLabel} · {v}", {
                              dateLabel: dateLabel(nextGoal.target_date, timezone),
                              v:
                                daysTo(nextGoal.target_date) !== null && daysTo(nextGoal.target_date)! < 0
                                  ? "terlambat"
                                  : `H-${daysTo(nextGoal.target_date)}`,
                            })
                          : tr("tanpa deadline")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(0, Math.min(100, Number(nextGoal.progress || 0)))}%` }}
                    />
                  </div>
                  {nextGoal.next_step && (
                    <p className="mt-2 text-2xs text-textMuted">
                      {tr("Langkah berikutnya: {next_step}", { next_step: nextGoal.next_step })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-bg p-4">
                  <p className="text-sm font-semibold text-text">{tr("Belum ada target aktif.")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Buat target untuk membangun roadmap yang terhubung ke proyek dan tugas.")}
                  </p>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {activeGoals.slice(0, 4).map((g) => (
                  <Link
                    href="/goals-projects"
                    key={g.id}
                    className="rounded-xl border border-border bg-bg p-3 transition hover:border-accent/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-2xs font-semibold text-text">{g.title}</span>
                      <span className="text-2xs font-semibold text-accent">{Number(g.progress || 0)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent/70"
                        style={{ width: `${Math.max(0, Math.min(100, Number(g.progress || 0)))}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/calendar" className="text-xs font-semibold text-accent">
                    {tr("Buka Kalender")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Agenda")}
              </SectionTitle>
              <div className="space-y-2">
                {todayAgenda.slice(0, 5).map((a) => (
                  <Link
                    href="/calendar"
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-bg p-3 transition hover:-translate-y-0.5 hover:border-accent/25"
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-xs font-semibold text-accent">{time(a.start_time)}</p>
                      <p className="text-2xs text-textMuted">{time(a.end_time)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-text">{a.title}</p>
                      <p className="mt-1 truncate text-2xs text-textMuted">{a.location || "Tanpa lokasi"}</p>
                    </div>
                    <ArrowRight size={13} className="shrink-0 text-textMuted" />
                  </Link>
                ))}
                {!todayAgenda.length && (
                  <p className="rounded-xl bg-bg p-4 text-sm text-textMuted">{tr("Tidak ada agenda hari ini.")}</p>
                )}
              </div>
              {upcomingAgenda.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-textMuted">
                    {tr("Agenda mendatang")}
                  </p>
                  <div className="space-y-1.5">
                    {upcomingAgenda.slice(0, 3).map((a) => (
                      <Link href="/calendar" key={a.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-2xs text-text">{a.title}</span>
                        <span className="shrink-0 text-2xs text-textMuted">
                          {dateLabel(a.block_date, timezone)} · {time(a.start_time)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </section>
        </DashboardWidget>

        <DashboardWidget id="body">
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/wellbeing" className="text-xs font-semibold text-accent">
                    {tr("Lihat kesehatan")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Kondisi tubuh hari ini")}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-bg p-3">
                  <Droplets size={14} className="text-accent" />
                  <p className="mt-2 text-lg font-semibold text-text">{(water / 1000).toFixed(1)} L</p>
                  <p className="text-2xs text-textMuted">{tr("hidrasi")}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <Timer size={14} className="text-accent" />
                  <p className="mt-2 text-lg font-semibold text-text">{movement} m</p>
                  <p className="text-2xs text-textMuted">{tr("gerak")}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <HeartPulse size={14} className="text-accent" />
                  <p className="mt-2 text-lg font-semibold text-text">
                    {fatigue ? tr("{fatigue}/5", { fatigue }) : "—"}
                  </p>
                  <p className="text-2xs text-textMuted">{tr("kelelahan")}</p>
                </div>
                <div className="rounded-xl bg-bg p-3">
                  <HeartPulse size={14} className="text-accent" />
                  <p className="mt-2 text-lg font-semibold text-text">
                    {health?.resting_hr ? tr("{resting_hr}", { resting_hr: health.resting_hr }) : "—"}
                  </p>
                  <p className="text-2xs text-textMuted">{tr("nadi istirahat")}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-border bg-bg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xs font-bold uppercase tracking-wider text-textMuted">{tr("Rutinitas")}</p>
                  <Link href="/wellbeing" className="text-2xs font-semibold text-accent">
                    {tr("Kelola")} <ArrowRight size={10} className="inline" />
                  </Link>
                </div>
                <p className="mt-1 text-xs font-semibold text-text">
                  {(habitCheckins.data ?? []).length} / {(habits.data ?? []).length} {tr("check-in hari ini")}
                </p>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/finance" className="text-xs font-semibold text-accent">
                    {tr("Lihat keuangan")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Keuangan bulan ini")}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Masuk")}</p>
                  <p className="mt-1 text-sm font-semibold text-success">
                    <AnimatedNumber value={monthIncome} format="idr" />
                  </p>
                </div>
                <div className="rounded-2xl bg-bg p-3">
                  <p className="text-2xs text-textMuted">{tr("Keluar")}</p>
                  <p className="mt-1 text-sm font-semibold text-danger">
                    <AnimatedNumber value={monthExpense} format="idr" />
                  </p>
                </div>
                <div className="col-span-2 rounded-2xl border border-accent/15 bg-accent/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-2xs text-textMuted">{tr("Saldo berjalan")}</p>
                    <p className="text-sm font-semibold text-accent">
                      <AnimatedNumber value={balance} format="idr" />
                    </p>
                  </div>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Net bulan ini")} <AnimatedNumber value={signedNet} format="idr" />
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {categories.map(([cat, value]) => (
                  <div key={cat}>
                    <div className="flex justify-between gap-2 text-2xs">
                      <span className="truncate text-textMuted">{cat}</span>
                      <span className="font-semibold text-text">{rupiah(value)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                      <div
                        className="h-full rounded-full bg-accent/60"
                        style={{
                          width: `${monthExpense ? Math.min(100, Math.round((value / monthExpense) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!categories.length && (
                  <p className="text-xs text-textMuted">{tr("Belum ada pengeluaran bulan ini.")}</p>
                )}
              </div>
            </Card>
          </section>
        </DashboardWidget>

        <DashboardWidget id="review">
          <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
            <WeeklyReviewCard />
            <ActivityFeed limit={6} />
          </section>
        </DashboardWidget>

        <DashboardWidget id="control">
          <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/guide" className="text-xs font-semibold text-accent">
                    {tr("Panduan lengkap")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Pusat kendali Licia")}
              </SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/insights" className="rounded-xl bg-accent/5 p-3 transition hover:bg-accent/10">
                  <p className="text-xs font-semibold text-text">{tr("Insights")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Pantau pola, risiko, review, dan sinyal penting dari data terbaru.")}
                  </p>
                </Link>
                <Link href="/plan" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-xs font-semibold text-text">{tr("Rencana & simulasi")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Atur kapasitas, jadwal, fokus, dan perencana tanpa menu terpisah.")}
                  </p>
                </Link>
                <Link href="/sync" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-xs font-semibold text-text">{tr("Sinkronisasi & konflik")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {unread.length
                      ? tr("{unread_length} notifikasi belum dibaca · ", { unread_length: unread.length })
                      : ""}
                    {tr("{activeAutomation} otomatisasi aktif.", { activeAutomation })}
                  </p>
                </Link>
                <Link href="/search" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-xs font-semibold text-text">{tr("Pencarian terpadu")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Temukan tugas, catatan, agenda, proyek, dan konteks Life OS dari satu tempat.")}
                  </p>
                </Link>
                <Link href="/system" className="rounded-xl bg-bg p-3 transition hover:bg-accent/5">
                  <p className="text-xs font-semibold text-text">{tr("Kesehatan sistem")}</p>
                  <p className="mt-1 text-2xs text-textMuted">
                    {tr("Pantau AI, sync, push, worker, dan layanan Licia.")}
                  </p>
                </Link>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle
                action={
                  <Link href="/settings" className="text-xs font-semibold text-accent">
                    {tr("Pengaturan")} <ArrowRight size={12} className="inline" />
                  </Link>
                }
              >
                {tr("Akses cepat")}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/chat" className="rounded-xl border border-accent/15 bg-accent/5 p-3">
                  <MessageCircle size={15} className="text-accent" />
                  <p className="mt-2 text-2xs font-semibold text-text">{tr("Chat Licia")}</p>
                  <p className="mt-1 text-2xs text-textMuted">{tr("Tanya, baca, dan lakukan tindakan.")}</p>
                </Link>
                <Link href="/capture" className="rounded-xl border border-border bg-bg p-3">
                  <Zap size={15} className="text-accent" />
                  <p className="mt-2 text-2xs font-semibold text-text">{tr("Tangkap cepat")}</p>
                  <p className="mt-1 text-2xs text-textMuted">{tr("Catatan, tugas, agenda, suara, atau foto.")}</p>
                </Link>
                <Link href="/search" className="rounded-xl border border-border bg-bg p-3">
                  <Search size={15} className="text-accent" />
                  <p className="mt-2 text-2xs font-semibold text-text">{tr("Cari")}</p>
                  <p className="mt-2 text-2xs text-textMuted">{tr("Satu pintu untuk semua data.")}</p>
                </Link>
                <Link href="/settings" className="rounded-xl border border-border bg-bg p-3">
                  <Settings2 size={15} className="text-accent" />
                  <p className="mt-2 text-2xs font-semibold text-text">{tr("Pengaturan")}</p>
                  <p className="mt-1 text-2xs text-textMuted">{tr("AI, sync, notifikasi, tampilan.")}</p>
                </Link>
              </div>
            </Card>
          </section>
        </DashboardWidget>
      </div>
    </DashboardLayoutProvider>
  );
}
