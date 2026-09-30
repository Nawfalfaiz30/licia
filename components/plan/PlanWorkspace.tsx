"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Clock3, ListTodo, Sparkles, TimerReset } from "lucide-react";
import { clsx } from "clsx";
import { mutateEntity } from "@/lib/sync/client";
import { Card, notifyToast } from "@/components/ui";
import { DailyPlanPanel } from "@/components/intelligence/DailyPlanPanel";

type Task = { id: string; title: string; status: string; priority: string; due_at: string | null; estimated_minutes: number | null };
type Block = { id: string; title: string; block_date: string; start_time: string; end_time: string; task_id: string | null; completed_at: string | null };

export function PlanWorkspace({ tasks: initialTasks, blocks: initialBlocks, timezone }: { tasks: Task[]; blocks: Block[]; timezone: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busy, setBusy] = useState<string | null>(null);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dayLabel = new Intl.DateTimeFormat("id-ID", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const upcoming = useMemo(() => blocks.filter((x) => x.block_date >= today && !x.completed_at).slice(0, 8), [blocks, today]);
  const activeTasks = useMemo(() => tasks.filter((x) => x.status !== "done").slice(0, 8), [tasks]);
  const doneCount = tasks.filter((x) => x.status === "done").length + blocks.filter((x) => Boolean(x.completed_at)).length;

  async function completeTask(task: Task) {
    const id = `task:${task.id}`;
    setBusy(id);
    const result = await mutateEntity({ entityType: "task", operation: "update", entityId: task.id, payload: { status: "done" }, clientUpdatedAt: new Date().toISOString(), offlineOk: true });
    setBusy(null);
    if (!result.ok) return notifyToast({ title: "Tugas gagal diperbarui", message: result.error || "Coba lagi.", tone: "error" });
    setTasks((items) => items.map((x) => x.id === task.id ? { ...x, status: "done" } : x));
    notifyToast({ title: "Tugas diperbarui", message: result.queued ? "Tugas masuk antrean offline." : "Tugas ditandai selesai.", tone: "success" });
  }

  async function completeBlock(block: Block) {
    const id = `schedule:${block.id}`;
    setBusy(id);
    const completed_at = block.completed_at ? null : new Date().toISOString();
    const result = await mutateEntity({ entityType: "schedule", operation: "update", entityId: block.id, payload: { completed_at }, clientUpdatedAt: new Date().toISOString(), offlineOk: true });
    setBusy(null);
    if (!result.ok) return notifyToast({ title: "Agenda gagal diperbarui", message: result.error || "Coba lagi.", tone: "error" });
    setBlocks((items) => items.map((x) => x.id === block.id ? { ...x, completed_at } : x));
    notifyToast({ title: completed_at ? "Agenda selesai" : "Agenda diaktifkan lagi", message: completed_at ? "Agenda sudah dicatat selesai." : "Agenda dikembalikan ke status aktif.", tone: "success" });
  }

  return (
    <div className="space-y-5">
      <DailyPlanPanel />

      <section className="relative overflow-hidden rounded-[2rem] border border-accent/15 bg-surface p-5 shadow-sm sm:p-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-accent"><Sparkles size={12}/> Satu ruang rencana</div>
            <h1 className="mt-3 font-display text-3xl text-text sm:text-4xl">Rencana</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-textMuted">Tasks, agenda, planner, dan fokus kini dipandang sebagai satu alur: <span className="font-semibold text-text">rencanakan → kerjakan → tandai selesai</span>.</p>
            <p className="mt-3 text-xs font-semibold text-textMuted">{dayLabel}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
            <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[10px] text-textMuted">Tugas aktif</p><p className="mt-1 font-display text-xl text-text">{activeTasks.length}</p></div>
            <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[10px] text-textMuted">Agenda aktif</p><p className="mt-1 font-display text-xl text-text">{upcoming.length}</p></div>
            <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[10px] text-textMuted">Selesai</p><p className="mt-1 font-display text-xl text-success">{doneCount}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.05fr,.95fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Kerjakan</p><h2 className="mt-1 font-display text-xl text-text">Tugas berikutnya</h2></div><Link href="/tasks" className="text-xs font-semibold text-accent">Buka semua</Link></div>
          <div className="mt-4 space-y-2">
            {!activeTasks.length && <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">Tidak ada tugas terbuka yang perlu dikejar.</p>}
            {activeTasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3">
              <button disabled={busy === `task:${task.id}`} onClick={() => void completeTask(task)} className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-textMuted transition hover:border-success/40 hover:bg-success/5 hover:text-success disabled:opacity-50" aria-label={`Tandai ${task.title} selesai`}><Check size={16}/></button>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-text">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-textMuted"><span className="rounded-full border border-border px-2 py-0.5">{task.priority === "high" ? "Prioritas tinggi" : task.priority === "medium" ? "Sedang" : "Rendah"}</span>{task.estimated_minutes ? <span className="inline-flex items-center gap-1"><Clock3 size={11}/>{task.estimated_minutes} mnt</span> : null}</div></div>
            </div>)}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Komitmen waktu</p><h2 className="mt-1 font-display text-xl text-text">Agenda terdekat</h2></div><Link href="/calendar" className="text-xs font-semibold text-accent">Buka kalender</Link></div>
          <div className="mt-4 space-y-2">
            {!upcoming.length && <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">Agenda aktif belum ada.</p>}
            {upcoming.map((block) => <div key={block.id} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-3">
              <button disabled={busy === `schedule:${block.id}`} onClick={() => void completeBlock(block)} className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-textMuted transition hover:border-success/40 hover:bg-success/5 hover:text-success disabled:opacity-50" aria-label={`Tandai ${block.title} selesai`}><Check size={16}/></button>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-text">{block.title}</p><p className="mt-1 text-[10px] text-accent">{new Date(`${block.block_date}T12:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })} · {String(block.start_time).slice(0,5)}–{String(block.end_time).slice(0,5)}</p></div>
            </div>)}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/planner" className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/30"><BrainCircuitIcon/><p className="mt-3 text-sm font-semibold text-text">Planner mingguan</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Susun 7 hari tanpa meninggalkan ruang kosong.</p></Link>
        <Link href="/focus" className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/30"><TimerReset size={18} className="text-accent"/><p className="mt-3 text-sm font-semibold text-text">Mulai fokus</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Ubah task menjadi sesi kerja nyata.</p></Link>
        <Link href="/calendar" className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent/30"><CalendarDays size={18} className="text-accent"/><p className="mt-3 text-sm font-semibold text-text">Atur agenda</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Jadwal tetap menjadi sumber kebenaran waktu.</p></Link>
        <Link href="/capture" className="rounded-2xl border border-accent/15 bg-accent/5 p-4 transition hover:-translate-y-0.5 hover:border-accent/30"><ListTodo size={18} className="text-accent"/><p className="mt-3 text-sm font-semibold text-text">Tangkap & Inbox</p><p className="mt-1 text-[10px] leading-relaxed text-textMuted">Masukkan ide atau permintaan, lalu rapikan menjadi tindakan.</p></Link>
      </div>
    </div>
  );
}

function BrainCircuitIcon() { return <div className="text-accent"><Sparkles size={18}/></div>; }
