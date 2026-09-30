"use client";

import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, CircleDollarSign, FileText, Inbox, Plus, Sparkles, Timer, Waypoints, Activity, Target, FolderKanban, Repeat2, ReceiptText, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState } from "@/components/ui";
import { previewPlainText } from "@/lib/text";

type Kind = "task" | "focus" | "finance" | "note" | "agenda" | "reading" | "health" | "inbox" | "goal" | "project" | "habit" | "subscription";
type Event = { id: string; at: string; title: string; meta: string; kind: Kind; icon: LucideIcon; tone: string; detail?: string; href: string };

function rupiah(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n); }
function monthBounds(value: string) { const [y, m] = value.split("-").map(Number); return { start: new Date(Date.UTC(y, m - 1, 1)).toISOString(), end: new Date(Date.UTC(y, m, 1)).toISOString(), dateStart: `${value}-01`, nextDateStart: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) }; }

export default function LinimasaPage() {
  const supabase = createClient();
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).single();
      const tz = profile?.timezone ?? "Asia/Jakarta";
      setTimezone(tz);
      const b = monthBounds(month);
      const [tasks, focus, expenses, incomes, notes, agenda, reading, movement, inbox, goals, projects, habitCheckins, subscriptions] = await Promise.all([
        supabase.from("tasks").select("id,title,updated_at").eq("user_id", user.id).eq("status", "done").gte("updated_at", b.start).lt("updated_at", b.end).limit(200),
        supabase.from("pomodoro_sessions").select("id,focus_minutes,started_at,task_id").eq("user_id", user.id).gte("started_at", b.start).lt("started_at", b.end).limit(200),
        supabase.from("expenses").select("id,amount,category,occurred_at,note").eq("user_id", user.id).gte("occurred_at", b.start).lt("occurred_at", b.end).limit(200),
        supabase.from("incomes").select("id,amount,source,occurred_at,note").eq("user_id", user.id).gte("occurred_at", b.start).lt("occurred_at", b.end).limit(200),
        supabase.from("brain_dump_notes").select("id,content,created_at,updated_at").eq("user_id", user.id).gte("created_at", b.start).lt("created_at", b.end).limit(200),
        supabase.from("schedule_blocks").select("id,title,block_date,start_time,end_time,description").eq("user_id", user.id).gte("block_date", b.dateStart).lt("block_date", b.nextDateStart).limit(250),
        supabase.from("reading_sessions").select("id,reading_id,pages_read,minutes,started_at,note").eq("user_id", user.id).gte("started_at", b.start).lt("started_at", b.end).limit(200),
        supabase.from("movement_logs").select("id,activity,duration_minutes,intensity,logged_at,note").eq("user_id", user.id).gte("logged_at", b.start).lt("logged_at", b.end).limit(200),
        supabase.from("smart_inbox_items").select("id,content,status,created_at").eq("user_id", user.id).gte("created_at", b.start).lt("created_at", b.end).limit(200),
        supabase.from("goals").select("id,title,progress,status,target_date,updated_at").eq("user_id", user.id).gte("updated_at", b.start).lt("updated_at", b.end).limit(200),
        supabase.from("projects").select("id,name,status,target_date,updated_at").eq("user_id", user.id).gte("updated_at", b.start).lt("updated_at", b.end).limit(200),
        supabase.from("habit_checkins").select("id,habit_id,checkin_date,created_at").eq("user_id", user.id).gte("checkin_date", b.dateStart).lt("checkin_date", b.nextDateStart).limit(300),
        supabase.from("subscriptions").select("id,name,amount,billing_cycle,next_billing_date,active,updated_at").eq("user_id", user.id).gte("updated_at", b.start).lt("updated_at", b.end).limit(200),
      ]);
      const readingIds = [...new Set((reading.data ?? []).map((r: any) => r.reading_id).filter(Boolean))];
      let readingMap: Record<string, string> = {};
      if (readingIds.length) {
        const { data } = await supabase.from("reading_logs").select("id,title").in("id", readingIds);
        readingMap = (data ?? []).reduce<Record<string, string>>((a, r: any) => { a[r.id] = r.title; return a; }, {});
      }
      const list: Event[] = [
        ...(tasks.data ?? []).map((x: any) => ({ id: `task-${x.id}`, at: x.updated_at, title: previewPlainText(x.title, 140) || "Tugas selesai", detail: "Tugas berhasil diselesaikan.", meta: "Tugas selesai", kind: "task" as const, icon: CheckCircle2, tone: "text-success bg-success/10", href: "/tasks" })),
        ...(focus.data ?? []).map((x: any) => ({ id: `focus-${x.id}`, at: x.started_at, title: `${x.focus_minutes} menit fokus`, detail: x.task_id ? "Sesi fokus terhubung ke tugas." : "Sesi fokus tanpa tugas tertentu.", meta: "Sesi fokus", kind: "focus" as const, icon: Timer, tone: "text-accent bg-accent/10", href: "/focus" })),
        ...(expenses.data ?? []).map((x: any) => ({ id: `expense-${x.id}`, at: x.occurred_at, title: rupiah(Number(x.amount)), detail: previewPlainText(x.note, 260) || `Kategori: ${x.category}`, meta: `Keluar · ${x.category}`, kind: "finance" as const, icon: CircleDollarSign, tone: "text-danger bg-danger/10", href: "/finance" })),
        ...(incomes.data ?? []).map((x: any) => ({ id: `income-${x.id}`, at: x.occurred_at, title: `+ ${rupiah(Number(x.amount))}`, detail: previewPlainText(x.note, 260) || (x.source ? `Sumber: ${x.source}` : "Pemasukan tercatat."), meta: `Masuk${x.source ? ` · ${x.source}` : ""}`, kind: "finance" as const, icon: ReceiptText, tone: "text-success bg-success/10", href: "/finance" })),
        ...(notes.data ?? []).map((x: any) => ({ id: `note-${x.id}`, at: x.updated_at || x.created_at, title: previewPlainText(x.content, 140) || "Catatan", detail: previewPlainText(x.content, 1000), meta: "Catatan", kind: "note" as const, icon: FileText, tone: "text-accentSoft bg-accentSoft/10", href: "/notes" })),
        ...(goals.data ?? []).map((x: any) => ({ id: `goal-${x.id}`, at: x.updated_at, title: previewPlainText(x.title, 140) || "Target", detail: `Progress saat ini ${Number(x.progress || 0)}%.${x.target_date ? ` Target: ${x.target_date}.` : ""}`, meta: `Target · ${Number(x.progress || 0)}%${x.target_date ? ` · ${x.target_date}` : ""}`, kind: "goal" as const, icon: Target, tone: "text-accent bg-accent/10", href: "/goals" })),
        ...(projects.data ?? []).map((x: any) => ({ id: `project-${x.id}`, at: x.updated_at, title: previewPlainText(x.name, 140) || "Proyek", detail: `Status: ${x.status}.${x.target_date ? ` Deadline: ${x.target_date}.` : ""}`, meta: `Project · ${x.status}${x.target_date ? ` · ${x.target_date}` : ""}`, kind: "project" as const, icon: FolderKanban, tone: "text-accentSoft bg-accentSoft/10", href: "/projects" })),
        ...(agenda.data ?? []).map((x: any) => ({ id: `agenda-${x.id}`, at: `${x.block_date}T${x.start_time}`, title: previewPlainText(x.title, 140) || "Agenda", detail: previewPlainText(x.description, 700) || "Agenda kalender tanpa catatan tambahan.", meta: `Agenda · ${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}`, kind: "agenda" as const, icon: CalendarDays, tone: "text-accent bg-accent/10", href: `/calendar?date=${encodeURIComponent(x.block_date)}` })),
        ...(reading.data ?? []).map((x: any) => ({ id: `reading-${x.id}`, at: x.started_at, title: previewPlainText(readingMap[x.reading_id], 140) || `Sesi membaca · ${x.pages_read || 0} halaman`, detail: previewPlainText(x.note, 500) || `${x.pages_read || 0} halaman dalam ${x.minutes || 0} menit.`, meta: `${x.minutes || 0} menit`, kind: "reading" as const, icon: BookOpen, tone: "text-accentSoft bg-accentSoft/10", href: "/reading" })),
        ...(movement.data ?? []).map((x: any) => ({ id: `move-${x.id}`, at: x.logged_at, title: `${previewPlainText(x.activity, 100) || "Aktivitas"} · ${x.duration_minutes} menit`, detail: previewPlainText(x.note, 500) || `Intensitas ${x.intensity || "tidak dicatat"}.`, meta: `Gerak · ${x.intensity}`, kind: "health" as const, icon: Activity, tone: "text-accent bg-accent/10", href: "/health" })),
        ...(habitCheckins.data ?? []).map((x: any) => ({ id: `habit-${x.id}`, at: `${x.checkin_date}T12:00:00`, title: "Rutinitas dicentang", detail: `Check-in rutinitas pada ${x.checkin_date}.`, meta: "Check-in kebiasaan", kind: "habit" as const, icon: Repeat2, tone: "text-success bg-success/10", href: "/habits" })),
        ...(subscriptions.data ?? []).map((x: any) => ({ id: `subscription-${x.id}`, at: x.updated_at, title: previewPlainText(x.name, 140) || "Langganan", detail: `Status: ${x.active ? "aktif" : "nonaktif"}. ${rupiah(Number(x.amount))}/${x.billing_cycle}.`, meta: `Langganan · ${x.active ? "aktif" : "nonaktif"}`, kind: "subscription" as const, icon: ReceiptText, tone: "text-textMuted bg-bg", href: "/subscriptions" })),
        ...(inbox.data ?? []).map((x: any) => ({ id: `inbox-${x.id}`, at: x.created_at, title: previewPlainText(x.content, 150) || "Inbox", detail: `Isi tangkapan: ${previewPlainText(x.content, 800)}`, meta: `Inbox · ${x.status}`, kind: "inbox" as const, icon: Inbox, tone: "text-accent bg-accent/10", href: "/inbox" })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      if (!cancelled) { setEvents(list); setSelectedId(null); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [month]);

  const filtered = useMemo(() => filter === "all" ? events : events.filter(e => e.kind === filter), [events, filter]);
  const visible = filtered.slice(0, visibleCount);
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of visible) {
      const key = new Intl.DateTimeFormat("id-ID", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date(e.at));
      map.set(key, [...(map.get(key) || []), e]);
    }
    return [...map.entries()];
  }, [visible, timezone]);

  return <div className="space-y-7 animate-licia-in">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><Waypoints size={14}/> JEJAK AKTIVITAS</p><h1 className="font-display text-3xl text-text">Linimasa</h1><p className="mt-1 max-w-3xl text-sm leading-relaxed text-textMuted">Jejak lintas modul. Buka detail tepat di tempat aktivitasnya berada.</p></div>
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-xs font-semibold text-textMuted hover:text-accent">Buka Analitik <ArrowRight size={13}/></Link>
    </header>
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">{[["all","Semua"],["task","Tugas"],["focus","Fokus"],["agenda","Agenda"],["finance","Keuangan"],["goal","Target"],["project","Project"],["note","Catatan"],["reading","Bacaan"],["health","Gerak"],["habit","Rutinitas"],["subscription","Langganan"],["inbox","Inbox"]].map(([v,l])=><button key={v} onClick={()=>{setFilter(v);setVisibleCount(24);setSelectedId(null)}} className={v===filter?"shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white":"shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-textMuted hover:text-text"}>{l}</button>)}</div>
      <div className="flex shrink-0 items-center gap-2"><input type="month" value={month} onChange={e=>{setMonth(e.target.value);setVisibleCount(24)}} className="min-h-10 w-full rounded-xl border border-border bg-bg px-3 text-xs text-text outline-none focus:ring-2 focus:ring-accent/40 sm:w-40"/><span className="hidden text-xs text-textMuted sm:inline">{filtered.length} aktivitas</span></div>
    </div>
    {loading ? <p className="text-sm text-textMuted">Mengumpulkan jejak aktivitas…</p> : !visible.length ? <EmptyState title="Belum ada jejak yang cocok" description="Aktivitas akan muncul otomatis saat ada perubahan pada modul yang kamu gunakan."/> : <div className="space-y-6">
      {grouped.map(([day, items]) => <section key={day}>
        <div className="mb-3 flex items-center gap-2 bg-bg/90 py-1"><span className="h-2 w-2 rounded-full bg-accent"/><p className="text-xs font-semibold text-text">{day}</p><span className="text-[10px] text-textMuted">{items.length}</span></div>
        <div className="relative ml-2 border-l border-border pl-5 sm:ml-4 sm:pl-7">
          {items.map((e) => { const Icon = e.icon; const open = selectedId === e.id; return <div key={e.id} className="relative pb-3 last:pb-0">
            <span className="absolute -left-[31px] top-3 h-4 w-4 rounded-full border border-border bg-surface sm:-left-[39px]"/>
            <Card className={open ? "border-accent/35 p-3 sm:p-4 shadow-sm" : "p-3 sm:p-4"}>
              <button onClick={() => setSelectedId(open ? null : e.id)} className="block w-full text-left" aria-expanded={open}>
                <div className="flex items-start gap-3"><div className={`shrink-0 rounded-xl p-2 ${e.tone}`}><Icon size={15}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-textMuted">{new Intl.DateTimeFormat("id-ID", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(e.at))}</span><span className="max-w-full truncate rounded-full bg-bg px-2 py-1 text-[10px] text-textMuted">{e.meta}</span></div><p className="mt-2 line-clamp-2 break-words text-sm font-medium text-text">{e.title}</p></div><span className="shrink-0 rounded-lg border border-border p-1.5 text-textMuted">{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span></div>
              </button>
              {open && <div className="mt-3 border-t border-border pt-3 animate-licia-pop-in"><p className="text-[10px] font-semibold uppercase tracking-wider text-textMuted">Detail</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{e.detail || "Tidak ada detail tambahan."}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={e.href} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white">Buka modul <ArrowRight size={12}/></Link><span className="rounded-xl border border-border px-3 py-2 text-xs text-textMuted">{new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(e.at))}</span></div></div>}
            </Card>
          </div>; })}
        </div>
      </section>)}
    </div>}
    {visibleCount < filtered.length && <div className="flex justify-center"><button onClick={() => setVisibleCount(v => v + 24)} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-textMuted hover:border-accent hover:text-accent"><Plus size={13} className="mr-1.5 inline"/>Tampilkan lebih banyak</button></div>}
  </div>;
}
