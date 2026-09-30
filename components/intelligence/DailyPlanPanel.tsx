"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Loader2, RefreshCw, Sparkles, Target, Timer } from "lucide-react";
import { Card, notifyToast } from "@/components/ui";

type PlanBlock = { start_time: string; end_time: string; title: string; task_id?: string | null; reason?: string };
type DailyPlan = {
  date: string;
  focus: string;
  priorities: Array<{ id: string; title: string; reason: string; href?: string }>;
  blocks: PlanBlock[];
  open_tasks: number;
  available_minutes: number;
  suggested_focus_minutes: number;
  conflicts: string[];
};

function dateLabel(date: string) {
  try { return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)); } catch { return date; }
}

export function DailyPlanPanel() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(force = false) {
    setLoading(true);
    try {
      const url = `/api/v38/daily-plan${force ? "?refresh=1" : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rencana harian belum tersedia.");
      setPlan(data.plan || null);
    } catch (error) {
      notifyToast({ title: "Rencana harian gagal dimuat", message: error instanceof Error ? error.message : "Coba lagi.", tone: "error" });
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <Card className="overflow-hidden border-accent/15 bg-gradient-to-br from-accent/5 via-surface to-surface p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">Smart Daily Plan</p>
        <h2 className="mt-1 font-display text-xl text-text">Apa yang paling penting hari ini?</h2>
        <p className="mt-1 text-xs text-textMuted">Satu lapisan yang menggabungkan deadline, agenda, ruang fokus, dan target tanpa memenuhi kalender.</p>
      </div>
      <button onClick={() => void load(true)} disabled={loading} className="touch-target shrink-0 rounded-xl border border-border bg-bg px-2.5 py-2 text-textMuted hover:border-accent/25 hover:text-accent" aria-label="Perbarui rencana harian">
        {loading ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>}<span className="sr-only">Perbarui</span>
      </button>
    </div>

    {!plan && loading && <div className="mt-4 h-32 animate-pulse rounded-2xl bg-bg"/>}
    {plan && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[9px] uppercase tracking-wider text-textMuted">Hari</p><p className="mt-1 text-xs font-semibold text-text">{dateLabel(plan.date)}</p></div>
        <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[9px] uppercase tracking-wider text-textMuted">Task terbuka</p><p className="mt-1 font-display text-xl text-text">{plan.open_tasks}</p></div>
        <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[9px] uppercase tracking-wider text-textMuted">Ruang fokus</p><p className="mt-1 font-display text-xl text-text">{plan.available_minutes}m</p></div>
        <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-[9px] uppercase tracking-wider text-textMuted">Fokus disarankan</p><p className="mt-1 font-display text-xl text-accent">{plan.suggested_focus_minutes}m</p></div>
      </div>

      <div className="mt-4 rounded-2xl border border-accent/15 bg-accent/5 p-3.5">
        <div className="flex items-start gap-2.5"><Sparkles size={15} className="mt-0.5 shrink-0 text-accent"/><div><p className="text-xs font-semibold text-text">Fokus utama</p><p className="mt-1 text-xs leading-relaxed text-textMuted">{plan.focus}</p></div></div>
      </div>

      {plan.priorities.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-3">
        {plan.priorities.map((priority, index) => <Link key={priority.id} href={priority.href || "/tasks"} className="rounded-2xl border border-border bg-bg p-3 transition hover:border-accent/30 hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-accent/10 px-2 py-1 text-[9px] font-bold text-accent">#{index + 1}</span><Target size={14} className="text-textMuted"/></div>
          <p className="mt-2 text-xs font-semibold text-text">{priority.title}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-textMuted">{priority.reason}</p>
        </Link>)}
      </div>}

      {plan.blocks.length > 0 && <div className="mt-4 space-y-2"><div className="flex items-center gap-2"><CalendarClock size={14} className="text-accent"/><p className="text-xs font-semibold text-text">Slot fokus yang disarankan</p></div>{plan.blocks.slice(0, 4).map((block, index) => <div key={`${block.start_time}-${block.title}-${index}`} className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5"><span className="w-20 shrink-0 text-[10px] font-semibold tabular-nums text-accent">{block.start_time}–{block.end_time}</span><span className="min-w-0 flex-1 text-xs text-text">{block.title}</span><span className="hidden text-[9px] text-textMuted sm:block">{block.reason}</span></div>)}</div>}

      {plan.conflicts.length > 0 && <div className="mt-3 rounded-xl border border-warning/20 bg-warning/5 p-3 text-[10px] leading-relaxed text-textMuted">{plan.conflicts.slice(0, 2).map((x, i) => <p key={i}>• {x}</p>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/chat?prompt=Susunkan langkah paling penting untuk hari ini berdasarkan rencana saya" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-[10px] font-semibold text-white"><Sparkles size={13}/> Tanyakan ke Licia</Link><Link href="/focus" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-bg px-3.5 text-[10px] font-semibold text-textMuted"><Timer size={13}/> Mulai fokus</Link></div>
    </>}
    {!plan && !loading && <div className="mt-4 rounded-2xl border border-dashed border-border p-5 text-center text-xs text-textMuted"><CheckCircle2 size={18} className="mx-auto mb-2 text-accent"/>Belum ada rencana. Tekan perbarui untuk menghitungnya dari data hari ini.</div>}
  </Card>;
}
