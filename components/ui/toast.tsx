"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { useLanguage } from "@/components/LanguageProvider";

type ToastTone = "success" | "info" | "warning" | "error";
export type ToastAction = { label: string; onClick: () => void | Promise<void> };
export type ToastPayload = { title: string; message?: string; tone?: ToastTone; duration?: number; action?: ToastAction };

type ToastItem = ToastPayload & { id: string; tone: ToastTone };

export function notifyToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("licia:toast", { detail: payload }));
}

/** Toast dengan tombol Urungkan (A6). Dipakai untuk aksi cepat yang mudah dibalik: selesai, hapus, arsip. */
export function notifyUndo(payload: Omit<ToastPayload, "action"> & { undoLabel: string; onUndo: () => void | Promise<void> }) {
  const { undoLabel, onUndo, ...rest } = payload;
  notifyToast({ tone: "success", duration: 7000, ...rest, action: { label: undoLabel, onClick: onUndo } });
}

const iconFor: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
};

export function ToastProvider() {
  const { tr } = useLanguage();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.title) return;
      const tone: ToastTone = detail.tone ?? "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item = { ...detail, tone, id };
      setItems((prev) => [...prev, item].slice(-4));
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), detail.duration ?? (detail.action ? 7000 : 3200));
    };
    window.addEventListener("licia:toast", onToast);
    return () => window.removeEventListener("licia:toast", onToast);
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-toast flex justify-center px-3 sm:right-4 sm:left-auto sm:w-[min(94vw,410px)] sm:px-0">
      <div className="flex w-full flex-col gap-2 sm:w-full">
        {items.map((item) => {
          const Icon = iconFor[item.tone];
          return (
            <div key={item.id} className={clsx("pointer-events-auto overflow-hidden rounded-2xl border bg-surface/95 p-3 shadow-2xl backdrop-blur-xl animate-licia-toast-in", item.tone === "success" && "border-success/20", item.tone === "error" && "border-danger/20", item.tone === "warning" && "border-accent/20", item.tone === "info" && "border-border")}>
              <div className="relative flex items-start gap-3">
                {item.tone === "success" && <span className="pointer-events-none absolute left-3 top-3 h-8 w-8 rounded-full border border-success/20 animate-licia-check-spark" aria-hidden />}
                <span className={clsx(
                  "relative mt-0.5 rounded-xl p-2",
                  item.tone === "success" && "animate-licia-success-pop bg-success/10 text-success",
                  item.tone === "info" && "bg-accent/10 text-accent",
                  item.tone === "warning" && "bg-accent/10 text-accent",
                  item.tone === "error" && "bg-danger/10 text-danger",
                )}><Icon size={15}/></span>
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{item.title}</p>{item.message && <p className="mt-0.5 break-words text-[11px] leading-relaxed text-textMuted">{item.message}</p>}{item.action && <button type="button" onClick={async () => { setItems((prev) => prev.filter((x) => x.id !== item.id)); try { await item.action!.onClick(); } catch {} }} className="mt-1.5 inline-flex min-h-8 items-center rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-[11px] font-semibold text-accent hover:bg-accent/15">{item.action.label}</button>}</div>
                <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} className="touch-target -mr-1 -mt-1 shrink-0 text-textMuted hover:text-text" aria-label={tr("Tutup notifikasi")}><X size={14}/></button>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-bg"><div className={clsx("h-full w-full origin-left animate-licia-toast-progress", item.tone === "success" ? "bg-success" : item.tone === "error" ? "bg-danger" : item.tone === "warning" ? "bg-accentSoft" : "bg-accent")} style={{ animationDuration: `${item.duration ?? (item.action ? 7000 : 3200)}ms` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
