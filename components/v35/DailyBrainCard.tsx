"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, RefreshCw, Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui";

type Brain = {
  ok: boolean;
  healthScore: number;
  priorities: Array<{ title: string; reason: string; href: string; id?: string }>;
  risks: Array<{ message: string }>;
  capacity: { availableMinutes: number; workloadMinutes: number; overloadMinutes: number };
  counts: Record<string, number>;
  nextMove: string;
};

export function DailyBrainCard() {
  const [data, setData] = useState<Brain | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    fetch("/api/v35/brain", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setData(json?.ok || json?.healthScore !== undefined ? json : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); const h = () => load(); window.addEventListener("licia:capture-complete", h); window.addEventListener("licia:sync-complete", h); return () => { window.removeEventListener("licia:capture-complete", h); window.removeEventListener("licia:sync-complete", h); }; }, []);

  return <Card className="overflow-hidden border-accent/15 bg-gradient-to-br from-surface to-accent/5">
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-accent/10 p-3 text-accent"><BrainCircuit size={20}/></div>
          <div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-accent">Otak Hari Ini</p><h2 className="mt-1 font-display text-xl text-text">Apa yang paling penting sekarang?</h2><p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-textMuted">Licia menggabungkan tugas, agenda, target, proyek, fokus, pengingat, inbox, dan sinyal risiko untuk menentukan langkah berikutnya.</p></div>
        </div>
        <button onClick={load} className="rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-accent" aria-label="Muat ulang"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/></button>
      </div>

      {loading && <div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-2xl bg-bg"/><div className="h-20 animate-pulse rounded-2xl bg-bg"/><div className="h-20 animate-pulse rounded-2xl bg-bg"/></div>}
      {!loading && data && <>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Kondisi</p><p className="mt-1 text-2xl font-semibold text-accent">{data.healthScore}%</p><p className="text-[9px] text-textMuted">kesiapan hari ini</p></div>
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Beban</p><p className="mt-1 text-2xl font-semibold text-text">{Math.round(data.capacity.workloadMinutes/60)}j</p><p className="text-[9px] text-textMuted">perkiraan task</p></div>
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Kapasitas</p><p className="mt-1 text-2xl font-semibold text-text">{Math.round(data.capacity.availableMinutes/60)}j</p><p className="text-[9px] text-textMuted">slot kosong</p></div>
          <div className="rounded-2xl bg-bg p-3"><p className="text-[9px] text-textMuted">Risiko</p><p className="mt-1 text-2xl font-semibold text-danger">{data.risks.length}</p><p className="text-[9px] text-textMuted">sinyal perlu perhatian</p></div>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-2xl border border-accent/15 bg-accent/5 p-3.5"><div className="flex items-start gap-3"><Sparkles size={16} className="mt-0.5 shrink-0 text-accent"/><div><p className="text-[9px] font-bold uppercase tracking-wider text-accent">Langkah berikutnya</p><p className="mt-1 text-sm font-semibold text-text">{data.nextMove}</p></div></div></div>
          <div className="rounded-2xl border border-border bg-bg p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-textMuted">Sinyal</p>{data.risks.slice(0,2).map((risk) => <p key={risk.message} className="mt-1 flex items-start gap-1.5 text-[10px] leading-relaxed text-textMuted"><AlertTriangle size={12} className="mt-0.5 shrink-0 text-danger"/>{risk.message}</p>)}{!data.risks.length && <p className="mt-1 text-[10px] text-textMuted">Tidak ada risiko besar yang terdeteksi.</p>}</div>
        </div>

        <div className="mt-4 space-y-2">{data.priorities.slice(0,3).map((item, i) => <div key={`${item.id || item.title}-${i}`} className="licia-v35-interactive flex items-center gap-3 rounded-xl border border-border bg-bg p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[10px] font-bold text-accent">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text">{item.title}</p><p className="mt-0.5 text-[10px] text-textMuted">{item.reason}</p></div><Link href={item.href} className="rounded-lg bg-surface px-2 py-1 text-[9px] font-semibold text-textMuted hover:text-accent">Buka</Link><Link href={`/chat?prompt=${encodeURIComponent(`Analisis item ${item.title} dan beri langkah berikutnya.`)}`} className="rounded-lg bg-accent/10 px-2 py-1 text-[9px] font-semibold text-accent">Tanya Licia</Link></div>)}{!data.priorities.length && <div className="rounded-xl bg-bg p-3 text-[10px] text-textMuted">Belum ada prioritas mendesak. Kamu bisa mulai dari target atau sesi fokus.</div>}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-textMuted"><span className="rounded-full bg-bg px-2 py-1">✓ {data.counts.tasks ?? 0} tugas</span><span className="rounded-full bg-bg px-2 py-1">📅 {data.counts.agendaToday ?? 0} agenda</span><span className="rounded-full bg-bg px-2 py-1">🎯 {data.counts.goals ?? 0} target</span><span className="rounded-full bg-bg px-2 py-1">📥 {data.counts.inbox ?? 0} inbox</span></div>
      </>}
      {!loading && !data && <div className="mt-4 rounded-2xl border border-dashed border-border p-5 text-center text-xs text-textMuted">Otak Hari Ini belum dapat dimuat. Coba lagi beberapa saat.</div>}
    </div>
  </Card>;
}
