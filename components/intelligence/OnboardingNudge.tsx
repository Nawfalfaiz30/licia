"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, PartyPopper, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

type Status = { displayName: boolean; goal: boolean; project: boolean; task: boolean; finance: boolean; habit: boolean };
const DISMISS_KEY = "licia-onboarding-dismissed";
const COLLAPSE_KEY = "licia-onboarding-collapsed";

/** Checklist 5 langkah (A7): nama → tugas pertama → target → transaksi → rutinitas. Langkah berikutnya disorot. */
export function OnboardingNudge() {
  const { tr } = useLanguage();
  const [data, setData] = useState<Status | null>(null);
  const [hidden, setHidden] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/onboarding", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => setData(d?.status || null)).catch(() => {});
  }, []);

  useEffect(() => {
    try { setHidden(localStorage.getItem(DISMISS_KEY) === "true"); setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true"); } catch { setHidden(false); }
    refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", refresh); };
  }, [refresh]);

  if (hidden || !data) return null;

  const steps = [
    { id: "name", ok: data.displayName, label: tr("Atur nama panggilan"), hint: tr("Supaya Licia menyapa dengan namamu."), href: "/settings" },
    { id: "task", ok: data.task, label: tr("Tambahkan tugas pertama"), hint: tr("Ketik saja, tanggal dan prioritas dikenali otomatis."), href: "/tasks" },
    { id: "goal", ok: data.goal, label: tr("Buat target"), hint: tr("Arah yang nanti dihubungkan ke proyek dan tugas."), href: "/goals-projects" },
    { id: "money", ok: data.finance, label: tr("Catat transaksi"), hint: tr("Satu pengeluaran sudah cukup untuk memulai."), href: "/finance" },
    { id: "habit", ok: data.habit, label: tr("Buat rutinitas"), hint: tr("Mulai dari satu kebiasaan kecil."), href: "/wellbeing" },
  ];
  const done = steps.filter((s) => s.ok).length;
  const nextIndex = steps.findIndex((s) => !s.ok);
  const complete = done === steps.length;
  const percent = Math.round((done / steps.length) * 100);
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "true"); } catch {} };
  const toggle = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch {} };

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-accent/8 via-surface to-surface animate-licia-pop-in">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/10 p-2.5 text-accent">{complete ? <PartyPopper size={17} aria-hidden /> : <Sparkles size={17} aria-hidden />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{complete ? tr("Semua siap — selamat!") : tr("Siapkan Licia dalam 5 langkah")}</p>
              <p className="mt-1 text-xs leading-relaxed text-textMuted">{complete ? tr("Licia kini punya cukup konteks untuk memberi saran yang relevan.") : tr("{0} dari {1} selesai · mulai dari sedikit data agar saran terasa relevan.", [done, steps.length])}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? tr("Buka checklist") : tr("Ciutkan checklist")} className="touch-target rounded-lg p-1 text-textMuted hover:bg-bg"><ChevronDown size={15} className={clsx("transition-transform", collapsed && "-rotate-90")} /></button>
              <button type="button" onClick={dismiss} aria-label={tr("Tutup")} className="touch-target rounded-lg p-1 text-textMuted hover:bg-bg"><X size={14} /></button>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={tr("Kemajuan penyiapan")}><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${percent}%` }} /></div>
          {!collapsed && !complete && (
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {steps.map((step, index) => {
                const isNext = index === nextIndex;
                return (
                  <li key={step.id}>
                    <Link href={step.href} className={clsx("flex min-h-11 items-center gap-2 rounded-xl border p-2.5 text-xs transition hover:-translate-y-0.5 hover:border-accent/30", isNext ? "border-accent/40 bg-accent/10 shadow-sm" : "border-border bg-surface/75", step.ok && "opacity-80")}>
                      {step.ok ? <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden /> : <span className={clsx("grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[11px] font-bold", isNext ? "border-accent text-accent" : "border-border text-textMuted")} aria-hidden>{index + 1}</span>}
                      <span className="min-w-0 flex-1"><span className={clsx("block font-semibold text-text", step.ok && "line-through")}>{step.label}</span>{isNext && <span className="block text-[11px] text-textMuted">{step.hint}</span>}</span>
                      {isNext ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">{tr("Berikutnya")}</span> : <ArrowRight size={12} className="shrink-0 text-textMuted" aria-hidden />}
                      <span className="sr-only">{step.ok ? tr("Selesai") : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {complete && <button type="button" onClick={dismiss} className="mt-3 min-h-9 rounded-xl border border-accent/30 bg-accent/10 px-3 text-xs font-semibold text-accent">{tr("Sembunyikan")}</button>}
        </div>
      </div>
    </Card>
  );
}
