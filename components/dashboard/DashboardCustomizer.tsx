"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, LayoutDashboard, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { clsx } from "clsx";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";
import { DASHBOARD_COOKIE, DEFAULT_PREFS, LOCKED, WIDGET_TITLES, moveWidget, serializePrefs, toggleWidget, type DashboardPrefs, type WidgetId } from "@/lib/dashboard/layout";

/** Bilah "Semua / Hari ini saja" + panel Sesuaikan (urutan & tampil/sembunyi). Disimpan di cookie → server merender langsung. */
export function DashboardCustomizer({ initial }: { initial: DashboardPrefs }) {
  const { tr } = useLanguage();
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const commit = (next: DashboardPrefs) => {
    setPrefs(next);
    try { document.cookie = `${DASHBOARD_COOKIE}=${serializePrefs(next)}; path=/; max-age=31536000; samesite=lax`; } catch {}
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-dashboard-toolbar>
      <div role="group" aria-label={tr("Cakupan dashboard")} className="inline-flex rounded-xl border border-border bg-surface p-1">
        {([false, true] as const).map((today) => (
          <button key={String(today)} type="button" aria-pressed={prefs.todayOnly === today} onClick={() => prefs.todayOnly !== today && commit({ ...prefs, todayOnly: today })} className={clsx("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition", prefs.todayOnly === today ? "bg-accent text-white shadow-sm" : "text-textMuted hover:text-text")}>
            {today ? <CalendarCheck size={13} aria-hidden /> : <LayoutDashboard size={13} aria-hidden />}{today ? tr("Hari ini saja") : tr("Semua")}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted hover:text-text"><SlidersHorizontal size={13} aria-hidden />{tr("Sesuaikan")}</button>

      <Overlay open={open} onClose={() => setOpen(false)} variant="sheet" labelledBy="dash-customize-title" panelClassName="w-full max-w-md rounded-t-[1.75rem] border border-border bg-surface p-4 shadow-2xl animate-licia-sheet-in sm:rounded-[1.75rem]">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="dash-customize-title" className="font-display text-lg text-text">{tr("Sesuaikan dashboard")}</h2><p className="mt-1 text-xs leading-relaxed text-textMuted">{tr("Atur urutan dan pilih bagian yang ingin ditampilkan. Berlaku di perangkat ini.")}</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label={tr("Tutup")} className="touch-target rounded-xl border border-border p-2 text-textMuted hover:text-text"><X size={15} aria-hidden /></button>
        </div>
        {prefs.todayOnly && <p className="mt-3 rounded-xl bg-accent/10 p-2.5 text-xs text-accent">{tr("Mode “Hari ini saja” aktif: pilihan di bawah berlaku saat kembali ke “Semua”.")}</p>}
        <ul className="mt-3 max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
          {prefs.order.map((id: WidgetId, index) => {
            const locked = LOCKED.has(id);
            const shown = locked || !prefs.hidden.includes(id);
            const title = tr(WIDGET_TITLES[id]);
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-border bg-bg p-2">
                <label className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 text-xs font-semibold text-text">
                  <input type="checkbox" checked={shown} disabled={locked} onChange={() => commit(toggleWidget(prefs, id))} className="h-4 w-4 accent-[rgb(var(--accent-rgb))]" />
                  <span className="truncate">{title}</span>
                </label>
                {!locked && (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" disabled={index <= 1} onClick={() => commit(moveWidget(prefs, id, -1))} aria-label={tr("Naikkan {0}", [title])} className="touch-target grid place-items-center rounded-lg border border-border bg-surface text-textMuted hover:text-text disabled:opacity-35"><ArrowUp size={14} aria-hidden /></button>
                    <button type="button" disabled={index === prefs.order.length - 1} onClick={() => commit(moveWidget(prefs, id, 1))} aria-label={tr("Turunkan {0}", [title])} className="touch-target grid place-items-center rounded-lg border border-border bg-surface text-textMuted hover:text-text disabled:opacity-35"><ArrowDown size={14} aria-hidden /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => commit({ ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order] })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-textMuted hover:text-text"><RotateCcw size={13} aria-hidden />{tr("Atur ulang")}</button>
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className="min-h-10 rounded-xl bg-accent px-4 text-xs font-semibold text-white">{tr("Selesai")}</button>
        </div>
      </Overlay>
    </div>
  );
}
