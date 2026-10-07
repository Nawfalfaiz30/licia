import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Droplets,
  Plus,
  Search,
  Wallet,
  Inbox,
  Sparkles,
  Target,
  Timer,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { dateStrInTimezone, startOfDayIsoForTimezone, endOfDayIsoForTimezone } from "@/lib/date";
import { previewPlainText } from "@/lib/text";
import { getServerT } from "@/lib/i18n-server";
import { PALETTE_OPEN_EVENT } from "@/lib/shortcuts";
import { TodayPriorityList } from "@/components/today/TodayPriorityList";
function minutesLabel(n: number) {
  if (n < 60) return `${n} m`;
  return `${Math.floor(n / 60)}j ${n % 60 ? `${n % 60}m` : ""}`.trim();
}
function time(v: string) {
  return v?.slice(0, 5) || v;
}
export default async function TodayPage() {
  const { t: tr, locale } = await getServerT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("display_name,timezone").eq("id", user.id).single();
  const timezone = profile?.timezone || "Asia/Jakarta";
  const now = new Date();
  const today = dateStrInTimezone(now, timezone);
  const start = startOfDayIsoForTimezone(now, timezone);
  const end = endOfDayIsoForTimezone(now, timezone);
  const [{ data: tasks }, { data: agenda }, { data: focus }, { data: inbox }, { data: habits }, { data: hydration }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,priority,due_at,estimated_minutes,project_id")
        .eq("user_id", user.id)
        .neq("status", "done")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(25),
      supabase
        .from("schedule_blocks")
        .select("id,title,start_time,end_time,location,description,project_id,task_id")
        .eq("user_id", user.id)
        .order("start_time"),
      supabase
        .from("pomodoro_sessions")
        .select("focus_minutes,completed,started_at")
        .eq("user_id", user.id)
        .gte("started_at", start)
        .lte("started_at", end)
        .order("started_at", { ascending: false }),
      supabase
        .from("smart_inbox_items")
        .select("id,content,status,created_at")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("habit_checkins")
        .select("id,habit_id,checkin_date")
        .eq("user_id", user.id)
        .eq("checkin_date", today),
      supabase
        .from("hydration_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .gte("logged_at", start)
        .lte("logged_at", end),
    ]);
  const openTasks = (tasks || []) as any[];
  const agendaRows = (agenda || []) as any[];
  const focusRows = focus || [];
  const inboxRows = inbox || [];
  const focusMinutes = focusRows
    .filter((x: any) => x.completed !== false)
    .reduce((s: number, x: any) => s + Number(x.focus_minutes || 0), 0);
  const water = (hydration || []).reduce((s: number, x: any) => s + Number(x.amount_ml || 0), 0);
  const overdue = openTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const dueSoon = openTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() <= Date.now() + 48 * 60 * 60 * 1000);
  const hour = new Date().toLocaleTimeString(locale, { timeZone: timezone, hour: "2-digit", hour12: false });
  const currentAgenda = agendaRows.find((a: any) => String(a.start_time) <= hour && hour < String(a.end_time));
  const late = Number(hour) >= 18;
  const greeting = late ? tr("Sore yang tenang") : tr("Mari lihat hari ini");
  return (
    <div className="today-page space-y-4">
      <header className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 sm:px-5">
        <div className="flex min-h-[76px] items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-accent/15"><img src="/licia-avatar.png" alt={tr("Licia")} className="h-full w-full object-cover"/></div>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold text-accent">{today}</p>
            <h1 className="truncate font-display text-2xl text-text">{greeting}{profile?.display_name?tr(", {display_name}.",{display_name:profile.display_name}):"."}</h1>
            <p className="truncate text-2xs text-textMuted">{tr("{agenda} jadwal hari ini · {tasks} tugas aktif",{agenda:agendaRows.length,tasks:openTasks.length})}</p>
          </div>
        </div>
      </header>
      <section className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label={tr("Aksi cepat")}>
        <Link href="/tasks" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-xs font-semibold text-white"><Plus size={15}/>{tr("Tugas")}</Link>
        <Link href="/capture" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"><Plus size={15}/>{tr("Catatan")}</Link>
        <Link href="/finance?tab=transactions" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"><Wallet size={15}/>{tr("Pengeluaran")}</Link>
        <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT))} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"><Search size={15}/>{tr("Cari")}</button>
      </section>
      {currentAgenda&&<section className="rounded-2xl border border-accent/20 bg-accent/5 p-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white"><Clock3 size={16}/></span><div className="min-w-0 flex-1"><p className="text-2xs font-semibold text-accent">{tr("Sedang berlangsung")}</p><p className="truncate text-sm font-semibold text-text">{currentAgenda.title}</p><p className="text-2xs text-textMuted">{tr("Mulai {time}",{time:time(currentAgenda.start_time)})} · {tr("Selesai {time}",{time:time(currentAgenda.end_time)})}</p></div></div></section>}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1"><div><p className="text-2xs font-semibold text-accent">{tr("Prioritas sekarang")}</p><h2 className="font-display text-xl text-text">{tr("Tiga langkah yang paling perlu dilihat")}</h2></div><Link href="/tasks" className="text-2xs font-semibold text-accent">{tr("Semua tugas")}</Link></div>
        <TodayPriorityList tasks={(dueSoon.length?dueSoon:openTasks).slice(0,3).map((t:any)=>({id:t.id,title:t.title,due_at:t.due_at,priority:t.priority,timezone}))}/>
        {!openTasks.length&&<div className="rounded-2xl border border-dashed border-border p-5 text-center"><CheckCircle2 size={20} className="mx-auto text-success"/><p className="mt-2 text-sm font-semibold text-text">{tr("Hari ini cukup tertata")}</p><p className="mt-1 text-xs text-textMuted">{tr("Tidak ada tugas terbuka. Kamu bisa menjaga ritme atau membuat langkah baru.")}</p></div>}
      </section>
      <section className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2"><div><p className="text-2xs font-semibold text-accent">{tr("Jadwal hari ini")}</p><h2 className="mt-1 font-display text-xl text-text">{tr("Agenda berikutnya")}</h2></div><Link href="/calendar" className="text-2xs font-semibold text-accent">{tr("Kalender")}</Link></div>
          <div className="mt-4 space-y-2">{agendaRows.slice(0,3).map((a:any)=><Link key={a.id} href="/calendar" className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border border-border bg-bg p-3"><div className="text-right"><p className="text-xs font-bold tabular-nums text-accent">{tr("Mulai {time}",{time:time(a.start_time)})}</p><p className="mt-0.5 text-2xs text-textMuted">{tr("Selesai {time}",{time:time(a.end_time)})}</p></div><div className="min-w-0 border-l border-border pl-3"><p className="truncate text-sm font-semibold text-text">{a.title}</p><p className="mt-0.5 truncate text-2xs text-textMuted">{a.location||tr("Tanpa lokasi")}</p></div></Link>)}{!agendaRows.length&&<div className="rounded-xl border border-dashed border-border p-6 text-center"><CalendarDays size={20} className="mx-auto text-textMuted"/><p className="mt-2 text-sm font-semibold text-text">{tr("Belum ada agenda")}</p><Link href="/calendar" className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-accent px-3 text-xs font-semibold text-white">{tr("Tambah agenda")}</Link></div>}</div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Card className="p-4"><p className="text-2xs font-semibold text-textMuted">{tr("Hidrasi")}</p><p className="mt-2 font-display text-2xl text-text">{(water/1000).toFixed(1)} L</p><p className="mt-1 text-2xs text-textMuted">{water>=2000?tr("Target tercapai"):tr("{remaining} ml menuju 2 L",{remaining:Math.max(0,2000-water)})}</p></Card>
          <Card className="p-4"><p className="text-2xs font-semibold text-textMuted">{tr("Fokus")}</p><p className="mt-2 font-display text-2xl text-text">{focusMinutes} m</p><Link href="/focus" className="mt-1 inline-flex text-2xs font-semibold text-accent">{tr("Mulai Fokus")}</Link></Card>
          <Card className="p-4"><p className="text-2xs font-semibold text-textMuted">{tr("Kotak masuk")}</p><p className="mt-2 font-display text-2xl text-text">{inboxRows.length}</p><Link href="/capture" className="mt-1 inline-flex text-2xs font-semibold text-accent">{tr("Pilah")}</Link></Card>
        </div>
      </section>
      <Card className="p-3"><div className="flex items-center gap-2 text-2xs text-textMuted"><Clock3 size={13} className="text-accent"/><span>{tr("Ringkasan harian menggunakan zona waktu akunmu.")}</span></div></Card>
    </div>
  );
}
