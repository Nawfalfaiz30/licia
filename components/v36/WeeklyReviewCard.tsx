"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, Sparkles, Timer } from "lucide-react";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";
export function WeeklyReviewCard() {
  const { t: tr } = useLanguage();
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/v36/review", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => null);
  }, []);
  if (!data) return null;
  const s = data.stats || {};
  return (
    <Card className="border-accent/15 bg-accent/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[.16em] text-accent">{tr("7 hari terakhir")}</p>
          <h2 className="mt-1 font-display text-xl text-text">
            {tr("Review mingguan: apa yang benar-benar terjadi?")}
          </h2>
        </div>
        <Sparkles size={18} className="text-accent" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={CheckCircle2} value={s.completedTasks || 0} label={tr("tugas selesai")} />
        <Metric icon={Timer} value={s.focusMinutes || 0} label={tr("menit fokus")} />
        <Metric icon={BookOpenCheck} value={s.inboxProcessed || 0} label={tr("inbox diproses")} />
        <Metric icon={CalendarDays} value={s.focusDays || 0} label={tr("hari fokus")} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-textMuted">{data.narrative}</p>
      <div className="mt-3 flex gap-2">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
        >
          {tr("Buka Review")} <ArrowRight size={11} />
        </Link>
        <Link
          href="/chat?prompt=Analisis%20minggu%20saya%20berdasarkan%20data%20dan%20jelaskan%20evidence-nya"
          className="inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-2 text-2xs font-semibold text-textMuted hover:text-accent"
        >
          {tr("Tanya Licia")}
        </Link>
      </div>
    </Card>
  );
}
function Metric({ icon: Icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <Icon size={13} className="text-accent" />
      <p className="mt-1 text-lg font-semibold text-text tabular-nums">{value}</p>
      <p className="text-2xs text-textMuted">{label}</p>
    </div>
  );
}
