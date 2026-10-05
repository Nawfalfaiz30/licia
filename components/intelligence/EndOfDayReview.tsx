"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Moon, RefreshCw, Sparkles, Target, Timer, TrendingDown } from "lucide-react";
import { Card, notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

type Review = {
  date: string;
  completed_tasks: number;
  overdue_tasks: number;
  focus_minutes: number;
  agenda_completed: number;
  agenda_total: number;
  goals_progress: number;
  carry_over: string[];
  wins: string[];
  tomorrow: string[];
  narrative: string;
};

export function EndOfDayReview() {
  const { tr } = useLanguage();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/v38/daily-review", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr("Review belum tersedia."));
      setReview(data.review);
    } catch (error) {
      notifyToast({ title: tr("Review belum bisa dimuat"), message: error instanceof Error ? error.message : tr("Coba lagi."), tone: "error" });
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <Card className="border-accent/15 bg-surface p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-accent">{tr("End-of-Day Review")}</p><h2 className="mt-1 font-display text-xl text-text">{tr("Tutup hari dengan jelas")}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Review ini membaca jejak nyata hari ini—bukan menilai kamu.")}</p></div><button onClick={() => void load()} disabled={loading} className="touch-target rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-accent" aria-label={tr("Perbarui review")}>{loading ? <RefreshCw size={15} className="animate-spin"/> : <RefreshCw size={15}/>}</button></div>
    {review && <><div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-4"><Metric icon={CheckCircle2} label={tr("Task selesai")} value={review.completed_tasks}/><Metric icon={Timer} label={tr("Fokus")} value={`${review.focus_minutes}m`}/><Metric icon={Target} label={tr("Agenda selesai")} value={`${review.agenda_completed}/${review.agenda_total}`}/><Metric icon={TrendingDown} label={tr("Terlambat")} value={review.overdue_tasks}/></div><div className="mt-4 rounded-2xl bg-accent/5 p-3.5"><div className="flex items-start gap-2.5"><Moon size={15} className="mt-0.5 text-accent"/><p className="text-xs leading-relaxed text-textMuted">{review.narrative}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Mini title={tr("Yang berhasil")} items={review.wins}/><Mini title={tr("Bawa ke besok")} items={review.carry_over}/><Mini title={tr("Agenda berikutnya")} items={review.tomorrow}/></div></>}
    {!review && loading && <div className="mt-4 h-36 animate-pulse rounded-2xl bg-bg"/>}
  </Card>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string | number }) { return <div className="rounded-2xl border border-border bg-bg p-3"><Icon size={14} className="text-accent"/><p className="mt-2 font-display text-xl text-text">{value}</p><p className="text-[9px] uppercase tracking-wider text-textMuted">{label}</p></div>; }
function Mini({ title, items }: { title: string; items: string[] }) {
  const { tr } = useLanguage(); return <div className="rounded-2xl border border-border bg-bg p-3"><p className="text-xs font-semibold text-text">{title}</p><div className="mt-2 space-y-1.5">{items.slice(0, 3).map((x, i) => <p key={i} className="text-[10px] leading-relaxed text-textMuted">• {x}</p>)}{!items.length && <p className="text-[10px] text-textMuted">{tr("Belum ada.")}</p>}</div></div>; }
