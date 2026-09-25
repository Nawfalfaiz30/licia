"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CalendarPlus, Check, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionDialog } from "@/components/ui/dialog";
import { Card, EmptyState, PrimaryButton } from "@/components/ui";
import { createDefaultScheduleReminder, getDefaultReminderMinutes } from "@/lib/reminders/schedule";

type Block = { start_time: string; end_time: string; title: string; task_id: string | null; reason: string };
type Day = { date: string; focus: string; blocks: Block[] };
type Plan = { summary: string; days: Day[]; risks: string[] };

function labelDate(v: string) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${v}T12:00:00`)); }

export default function PlannerPage() {
  const supabase = createClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
 const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSaved() {
    try {
      const res = await fetch("/api/weekly-planner");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rencana mingguan belum bisa dimuat.");
      if (data.plan) {
        setPlan(data.plan);
        setSavedAt(data.savedAt ?? null);
        setNotice(data.fallback ? (data.fallbackReason || "Rencana dasar digunakan karena AI belum tersedia.") : null);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rencana mingguan belum bisa dimuat.");
    } finally { setLoading(false); }
  }
  async function generate() {
    setLoading(true); setApplied(false); setNotice(null);
    try {
      const res = await fetch("/api/weekly-planner", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Licia belum bisa menyusun rencana minggu ini.");
      setPlan(data.plan);
      setSavedAt(data.savedAt ?? new Date().toISOString());
      setNotice(data.fallback ? (data.fallbackReason || "Rencana dasar digunakan karena AI belum tersedia.") : null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Licia belum bisa menyusun rencana minggu ini.");
    } finally { setLoading(false); }
  }
  useEffect(() => { loadSaved(); }, []);

  function requestDeletePlan() { setConfirmDelete(true); }
  async function deletePlan() {
    const res = await fetch("/api/weekly-planner", { method: "DELETE" });
    if (res.ok) { setPlan(null); setSavedAt(null); setApplied(false); }
    else setNotice("Rencana belum bisa dihapus. Coba lagi.");
  }

  async function applyToCalendar() {
    if (!plan || applying) return;
    setApplying(true);
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { setApplying(false); return; }
    const { data: profile } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
    const userTimezone = profile?.timezone || "Asia/Jakarta";
    const existing = await supabase.from("schedule_blocks").select("block_date,start_time,end_time,title").eq("user_id", user.id).gte("block_date", plan.days[0]?.date ?? "1900-01-01").lte("block_date", plan.days.at(-1)?.date ?? "1900-01-01");
    const existingKeys = new Set((existing.data ?? []).map((x) => `${x.block_date}|${x.start_time}|${x.end_time}|${x.title}`));
    const rows = plan.days.flatMap((day) => day.blocks.map((block) => ({ user_id: user.id, block_date: day.date, start_time: block.start_time, end_time: block.end_time, title: block.title, description: block.reason || null, created_by: "ai", task_id: block.task_id || null }))).filter((x) => !existingKeys.has(`${x.block_date}|${x.start_time}|${x.end_time}|${x.title}`));
    if (rows.length) {
      const inserted = await supabase.from("schedule_blocks").insert(rows).select("id,title,block_date,start_time,end_time");
      if (inserted.error) { setNotice(`Sebagian jadwal belum masuk kalender: ${inserted.error.message}`); setApplying(false); return; }
      const defaultMinutes = await getDefaultReminderMinutes(supabase, user.id);
      if (defaultMinutes > 0) for (const block of inserted.data ?? []) await createDefaultScheduleReminder(supabase, user.id, userTimezone, block, defaultMinutes);
    }
    setApplied(true); setApplying(false);
  }

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><BrainCircuit size={14} /> Rencana berbasis konteks</p><h1 className="font-display text-3xl text-text">Perencana Mingguan AI</h1><p className="mt-1 max-w-2xl text-sm text-textMuted">Licia merangkai minggu dari konteks yang sudah kamu punya—deadline, agenda, target, rutinitas, dan ritme fokus—lalu menyisakan ruang agar rencana tetap manusiawi.</p></div><div className="flex flex-wrap gap-2"><button onClick={generate} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium text-textMuted hover:border-accent hover:text-accent disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Susun dengan Licia</button>{plan && <PrimaryButton onClick={applyToCalendar} disabled={applying || applied}><CalendarPlus size={16} /> {applied ? "Sudah masuk kalender" : applying ? "Memasukkan…" : "Terapkan ke kalender"}</PrimaryButton>}{plan && <button onClick={requestDeletePlan} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-textMuted hover:border-danger hover:text-danger" title="Hapus rencana AI"><Trash2 size={15}/> Hapus</button>}</div></header>
    {notice && <Card className="border-accent/20 bg-accent/5"><p className="text-xs leading-relaxed text-textMuted">{notice}</p></Card>}
    {!plan && !loading ? <EmptyState title="Belum ada rencana" description="Licia belum menemukan cukup konteks untuk menyusun minggu ini." /> : loading && !plan ? <Card><div className="flex items-center gap-3 py-8 justify-center text-sm text-textMuted"><Loader2 size={18} className="animate-spin" /> Menghubungkan tugas, agenda, target, dan ritme fokus…</div></Card> : plan ? <>
      <Card className="border-accent/20 bg-accent/5"><div className="flex items-start gap-3"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Sparkles size={18} /></div><div className="min-w-0"><p className="text-sm font-semibold text-text">Garis besar minggu</p><p className="mt-1 text-sm leading-relaxed text-textMuted">{plan.summary}</p>{savedAt && <p className="mt-2 text-[11px] text-textMuted">Rencana terakhir diproses {new Date(savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.</p>}</div></div></Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plan.days.map((day) => <Card key={day.date} className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date(`${day.date}T12:00:00`))}</p><p className="mt-0.5 text-sm font-medium text-text">{labelDate(day.date).replace(/^\S+\s/, "")}</p></div><span className="rounded-full bg-bg px-2 py-1 text-[10px] text-textMuted">{day.blocks.length} blok</span></div><p className="mb-3 text-xs text-textMuted">{day.focus}</p>{day.blocks.length ? <div className="space-y-2">{day.blocks.map((block, i) => <div key={`${block.title}-${i}`} className="rounded-xl border border-border bg-bg p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold tabular-nums text-accent">{block.start_time}–{block.end_time}</span>{block.task_id && <span className="text-[10px] text-textMuted">terhubung tugas</span>}</div><p className="mt-1.5 text-sm font-medium text-text">{block.title}</p>{block.reason && <p className="mt-1 text-[11px] leading-relaxed text-textMuted">{block.reason}</p>}</div>)}</div> : <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-textMuted">Ruang sengaja dibiarkan kosong.</div>}</Card>)}</div>
      {plan.risks?.length > 0 && <Card><p className="text-sm font-semibold text-text">Hal yang perlu diperhatikan</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{plan.risks.map((risk, i) => <div key={i} className="rounded-xl bg-bg px-3 py-2.5 text-xs leading-relaxed text-textMuted">{risk}</div>)}</div></Card>}
    </> : null}
    <ActionDialog open={confirmDelete} title="Hapus rencana AI?" description="Rencana mingguan akan dihapus. Jadwal yang sudah diterapkan ke kalender tidak ikut terhapus." tone="danger" confirmLabel="Hapus rencana" onClose={()=>setConfirmDelete(false)} onConfirm={()=>{setConfirmDelete(false);void deletePlan();}} />
    <div className="flex flex-wrap gap-2 text-xs text-textMuted"><span>Terhubung dengan:</span><Link href="/tasks" className="hover:text-accent">Tugas</Link><span>·</span><Link href="/calendar" className="hover:text-accent">Kalender</Link><span>·</span><Link href="/goals" className="hover:text-accent">Target</Link><span>·</span><Link href="/focus" className="hover:text-accent">Fokus</Link></div>
  </div>;
}
