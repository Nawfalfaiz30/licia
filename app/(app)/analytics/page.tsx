import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Inbox,
  Repeat2,
  Target,
  Timer,
  Wallet,
  Waypoints,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/getOrCreateProfile";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { startOfMonthIsoForTimezone, startOfWeekIsoForTimezone, dateStrInTimezone } from "@/lib/date";
import { getServerT } from "@/lib/i18n-server";

function rupiahIn(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}
function width(v: number, max: number) {
  return `${max ? Math.max(6, Math.min(100, Math.round((v / max) * 100))) : 6}%`;
}

export default async function AnalyticsPage() {
  const { t: tr, locale } = await getServerT();
  const rupiah = (n: number) => rupiahIn(n, locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  const resolved = profile ?? (await getOrCreateProfile(supabase, user.id));
  const timezone = (resolved as any)?.timezone ?? "Asia/Jakarta";
  const now = new Date();
  const month = startOfMonthIsoForTimezone(now, timezone);
  const week = startOfWeekIsoForTimezone(now, timezone);
  const today = dateStrInTimezone(now, timezone);
  const [tasks, focus, expenses, incomes, projects, goals, inbox, reading, movement, habits, subscriptions, schedule] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id,status,priority,created_at,updated_at,project_id,due_at")
        .eq("user_id", user.id)
        .gte("updated_at", month)
        .limit(500),
      supabase
        .from("pomodoro_sessions")
        .select("focus_minutes,started_at")
        .eq("user_id", user.id)
        .gte("started_at", month)
        .limit(500),
      supabase
        .from("expenses")
        .select("amount,category,occurred_at")
        .eq("user_id", user.id)
        .gte("occurred_at", month)
        .limit(500),
      supabase
        .from("incomes")
        .select("amount,occurred_at,source")
        .eq("user_id", user.id)
        .gte("occurred_at", month)
        .limit(500),
      supabase
        .from("projects")
        .select("id,name,status,target_date")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .limit(200),
      supabase.from("goals").select("id,title,status,progress,target_date").eq("user_id", user.id).limit(200),
      supabase
        .from("smart_inbox_items")
        .select("id,status,created_at")
        .eq("user_id", user.id)
        .gte("created_at", month)
        .limit(500),
      supabase
        .from("reading_sessions")
        .select("minutes,pages_read,started_at")
        .eq("user_id", user.id)
        .gte("started_at", month)
        .limit(500),
      supabase
        .from("movement_logs")
        .select("duration_minutes,intensity,logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", month)
        .limit(500),
      supabase
        .from("habit_checkins")
        .select("checkin_date,habit_id")
        .eq("user_id", user.id)
        .gte("checkin_date", today.slice(0, 7) + "-01")
        .limit(1000),
      supabase
        .from("subscriptions")
        .select("name,amount,billing_cycle,next_billing_date,active")
        .eq("user_id", user.id)
        .eq("active", true)
        .limit(200),
      supabase.from("schedule_blocks").select("id").eq("user_id", user.id).eq("block_date", today),
    ]);
  const taskRows = tasks.data ?? [];
  const done = taskRows.filter((x) => x.status === "done").length;
  const open = taskRows.filter((x) => x.status !== "done").length;
  const focusMin = (focus.data ?? []).reduce((s, x) => s + Number(x.focus_minutes), 0);
  const spend = (expenses.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
  const income = (incomes.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
  const moveMin = (movement.data ?? []).reduce((s, x) => s + Number(x.duration_minutes), 0);
  const readMin = (reading.data ?? []).reduce((s, x) => s + Number(x.minutes), 0);
  const pages = (reading.data ?? []).reduce((s, x) => s + Number(x.pages_read || 0), 0);
  const inboxProcessed = (inbox.data ?? []).filter((x) => x.status === "processed").length;
  const activeProjects = (projects.data ?? []).length;
  const avgGoal = (goals.data ?? []).filter((x) => x.status !== "completed").length
    ? Math.round(
        (goals.data ?? []).filter((x) => x.status !== "completed").reduce((s, x) => s + Number(x.progress || 0), 0) /
          (goals.data ?? []).filter((x) => x.status !== "completed").length,
      )
    : 0;
  const recurringMonthly = (subscriptions.data ?? []).reduce(
    (s, x) => s + Number(x.amount) * (x.billing_cycle === "yearly" ? 1 / 12 : 1),
    0,
  );
  const byCat = Object.entries(
    (expenses.data ?? []).reduce<Record<string, number>>((a, x) => {
      a[x.category] = (a[x.category] || 0) + Number(x.amount);
      return a;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxSpend = byCat[0]?.[1] ?? 1;
  const weekTasks = taskRows.filter((x) => new Date(x.updated_at).getTime() >= new Date(week).getTime());
  const weekDone = weekTasks.filter((x) => x.status === "done").length;
  const noDue = taskRows.filter((x) => x.status !== "done" && !x.due_at).length;
  const emptyProjects = (projects.data ?? []).filter((p) => !taskRows.some((t) => t.project_id === p.id)).length;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-6 animate-licia-in sm:space-y-7">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <BarChart3 size={14} aria-hidden="true" /> {tr("MESIN POLA")}
          </p>
          <h1 className="break-words font-display text-2xl text-text sm:text-3xl">{tr("Analitik Pribadi")}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-textMuted">
            {tr(
              "Satu halaman untuk membaca pola dari seluruh Life OS—eksekusi, waktu, uang, pembelajaran, kebiasaan, dan arah—tanpa mengubah semuanya menjadi skor.",
            )}
          </p>
        </div>
        <Link
          href="/timeline"
          className="inline-flex min-h-11 w-fit shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-textMuted transition-colors hover:border-accent/40 hover:text-accent"
        >
          {tr("Lihat timeline")} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>
      <section
        aria-label={tr("Ringkasan analitik")}
        className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <StatTile
          label={tr("Tugas selesai")}
          value={String(done)}
          hint={tr("{pct}% dari tugas aktif di bulan ini", { pct: pct(done, taskRows.length) })}
          icon={CheckCircle2}
          tone="success"
        />
        <StatTile label={tr("Fokus")} value={`${focusMin} mnt`} hint={tr("bulan ini")} icon={Timer} tone="accent" />
        <StatTile
          label={tr("Arus bersih")}
          value={rupiah(income - spend)}
          hint={tr("Masuk {rupiah} · Keluar {rupiah2}", { rupiah: rupiah(income), rupiah2: rupiah(spend) })}
          icon={Wallet}
          tone={income >= spend ? "success" : "danger"}
        />
        <StatTile
          label={tr("Project")}
          value={String(activeProjects)}
          hint={tr("{emptyProjects} belum punya next action", { emptyProjects })}
          icon={FolderKanban}
        />
        <StatTile
          label={tr("Target rata-rata")}
          value={`${avgGoal}%`}
          hint={tr("progress target aktif")}
          icon={Target}
          tone="accent"
        />
        <StatTile
          label={tr("Inbox diproses")}
          value={String(inboxProcessed)}
          hint={tr("item bukan lagi status baru")}
          icon={Inbox}
        />
      </section>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <SectionTitle>{tr("Ritme eksekusi")}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <p className="text-xs leading-relaxed text-textMuted">{tr("Tugas selesai minggu ini")}</p>
              <p className="mt-1 font-display text-2xl text-success">{weekDone}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <p className="text-xs leading-relaxed text-textMuted">{tr("Agenda hari ini")}</p>
              <p className="mt-1 font-display text-2xl text-text">{schedule.data?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <p className="text-xs leading-relaxed text-textMuted">{tr("Tugas tanpa deadline")}</p>
              <p className="mt-1 font-display text-2xl text-text">{noDue}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <p className="text-xs leading-relaxed text-textMuted">{tr("Fokus rata-rata / sesi")}</p>
              <p className="mt-1 font-display text-2xl text-accent">
                {focus.data?.length ? Math.round(focusMin / focus.data.length) : 0}
                <span className="text-sm text-textMuted"> {tr("mnt")}</span>
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle>{tr("Pengetahuan & tubuh sehari-hari")}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <BookOpen size={15} className="text-accent" aria-hidden="true" />
              <p className="mt-2 text-xs text-textMuted">{tr("Membaca")}</p>
              <p className="mt-1 font-display text-xl text-text">{tr("{readMin} mnt", { readMin })}</p>
              <p className="text-2xs text-textMuted">{tr("{pages} halaman", { pages })}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <Waypoints size={15} className="text-accent" aria-hidden="true" />
              <p className="mt-2 text-xs text-textMuted">{tr("Aktivitas harian")}</p>
              <p className="mt-1 font-display text-xl text-text">{tr("{moveMin} mnt", { moveMin })}</p>
              <p className="text-2xs text-textMuted">{tr("catatan harian")}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <Repeat2 size={15} className="text-accent" aria-hidden="true" />
              <p className="mt-2 text-xs text-textMuted">{tr("Check-in rutinitas")}</p>
              <p className="mt-1 font-display text-xl text-text">{habits.data?.length ?? 0}</p>
              <p className="text-2xs text-textMuted">{tr("bulan berjalan")}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-bg p-3 sm:p-4">
              <CalendarDays size={15} className="text-accent" aria-hidden="true" />
              <p className="mt-2 text-xs text-textMuted">{tr("Beban recurring")}</p>
              <p className="mt-1 break-words font-display text-lg text-text">{rupiah(recurringMonthly)}</p>
              <p className="text-2xs text-textMuted">{tr("perkiraan / bulan")}</p>
            </div>
          </div>
        </Card>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <SectionTitle>{tr("Distribusi pengeluaran")}</SectionTitle>
          {byCat.length ? (
            <div className="space-y-4">
              {byCat.map(([cat, val]) => (
                <div key={cat}>
                  <div className="mb-1 flex items-start justify-between gap-3 text-xs">
                    <span className="min-w-0 break-words text-text">{cat}</span>
                    <span className="shrink-0 text-right text-textMuted">{rupiah(val)}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-bg"
                    role="img"
                    aria-label={`${cat}: ${rupiah(val)}`}
                  >
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: width(val, maxSpend) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-textMuted">{tr("Belum ada pengeluaran bulan ini.")}</p>
          )}
          <Link
            href="/finance"
            className="mt-5 inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-medium text-textMuted hover:text-accent"
          >
            {tr("Buka Keuangan")} <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </Card>
        <Card>
          <SectionTitle>{tr("Signal untuk ditindaklanjuti")}</SectionTitle>
          <div className="space-y-2">
            {emptyProjects > 0 && (
              <div className="rounded-xl border border-accent/15 bg-accent/5 p-3 text-sm leading-relaxed text-textMuted">
                <strong className="text-text">{tr("{emptyProjects} project", { emptyProjects })}</strong>{" "}
                {tr("belum punya tugas terbuka. Tambahkan satu next action.")}
              </div>
            )}
            {noDue > 0 && (
              <div className="rounded-xl border border-border/60 bg-bg p-3 text-sm leading-relaxed text-textMuted">
                <strong className="text-text">{tr("{noDue} tugas", { noDue })}</strong>{" "}
                {tr("belum punya deadline. Abaikan jika memang fleksibel.")}
              </div>
            )}
            {(inbox.data ?? []).filter((x) => x.status === "open").length > 0 && (
              <div className="rounded-xl border border-border/60 bg-bg p-3 text-sm leading-relaxed text-textMuted">
                <strong className="text-text">
                  {(inbox.data ?? []).filter((x) => x.status === "open").length} {tr("item Inbox")}
                </strong>{" "}
                {tr("masih baru dan belum diproses.")}
              </div>
            )}
            {avgGoal > 0 && (
              <div className="rounded-xl border border-border/60 bg-bg p-3 text-sm leading-relaxed text-textMuted">
                {tr("Progress target aktif saat ini berada di sekitar")}{" "}
                <strong className="text-text">{avgGoal}%</strong>
                {tr(". Buka Target untuk melihat next step.")}
              </div>
            )}
            {!emptyProjects && !noDue && !(inbox.data ?? []).some((x) => x.status === "open") && (
              <p className="text-sm text-textMuted">
                {tr("Tidak ada gap struktural yang menonjol dari data saat ini.")}
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card className="border-accent/20 bg-accent/5">
        <p className="text-sm font-semibold text-text">{tr("Analytics yang terintegrasi")}</p>
        <p className="mt-2 text-sm leading-relaxed text-textMuted">
          {tr(
            "Data diambil dari modul yang saling berhubungan: target → project → tugas → kalender → focus, sementara Inbox, Vault, Learning, Reading, Rutinitas, Finance, Subscription, dan Health memberi konteks tambahan. Tidak ada satu metrik yang dianggap sebagai “nilai hidupmu”.",
          )}
        </p>
      </Card>
    </div>
  );
}
