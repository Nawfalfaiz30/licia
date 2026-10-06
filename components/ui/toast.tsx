"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, Undo2, X, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { isTypingTarget } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";

type ToastTone = "success" | "info" | "warning" | "error";
export type ToastAction = { label: string; onClick: () => void };
export type ToastPayload = { title: string; message?: string; tone?: ToastTone; duration?: number; action?: ToastAction };

type ToastItem = ToastPayload & { id: string; tone: ToastTone };

export function notifyToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("licia:toast", { detail: payload }));
}

const iconFor: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
};

const DEFAULT_MS = 3200;
const ACTION_MS = 5000;
const RESUME_MS = 2000;

export function ToastProvider() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());
  const itemsRef = useRef<ToastItem[]>([]);
  itemsRef.current = items;

  const dismiss = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle) window.clearTimeout(handle);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback((id: string, ms: number) => {
    const old = timers.current.get(id);
    if (old) window.clearTimeout(old);
    timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  const pause = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle) window.clearTimeout(handle);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.title) return;
      const tone: ToastTone = detail.tone ?? "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = detail.duration ?? (detail.action ? ACTION_MS : DEFAULT_MS);
      const item: ToastItem = { ...detail, tone, id, duration };
      setItems((prev) => [...prev, item].slice(-4));
      arm(id, duration);
    };
    // Ctrl/⌘+Z menjalankan Urungkan pada toast terbaru yang memilikinya (di luar kolom ketik).
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (isTypingTarget(event.target)) return;
      const latest = [...itemsRef.current].reverse().find((x) => x.action);
      if (!latest?.action) return;
      event.preventDefault();
      latest.action.onClick();
      dismiss(latest.id);
    };
    window.addEventListener("licia:toast", onToast);
    window.addEventListener("keydown", onKey);
    const map = timers.current;
    return () => {
      window.removeEventListener("licia:toast", onToast);
      window.removeEventListener("keydown", onKey);
      map.forEach((handle) => window.clearTimeout(handle));
      map.clear();
    };
  }, [arm, dismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4.75rem+env(safe-area-inset-top))] z-toast flex justify-center px-3 sm:right-4 sm:left-auto sm:w-[min(94vw,410px)] sm:px-0">
      <div className="flex w-full flex-col gap-2 sm:w-full">
        {items.map((item) => {
          const Icon = iconFor[item.tone];
          return (
            <div
              key={item.id}
              onMouseEnter={() => pause(item.id)}
              onMouseLeave={() => arm(item.id, RESUME_MS)}
              onFocusCapture={() => pause(item.id)}
              onBlurCapture={() => arm(item.id, RESUME_MS)}
              className={clsx("pointer-events-auto overflow-hidden rounded-2xl border bg-surface/95 p-3 shadow-2xl backdrop-blur-xl animate-licia-toast-in", item.tone === "success" && "border-success/20", item.tone === "error" && "border-danger/20", item.tone === "warning" && "border-accent/20", item.tone === "info" && "border-border")}
            >
              <div className="relative flex items-start gap-3">
                {item.tone === "success" && <span className="pointer-events-none absolute left-3 top-3 h-8 w-8 rounded-full border border-success/20 animate-licia-check-spark" aria-hidden />}
                <span className={clsx(
                  "relative mt-0.5 rounded-xl p-2",
                  item.tone === "success" && "animate-licia-success-pop bg-success/10 text-success",
                  item.tone === "info" && "bg-accent/10 text-accent",
                  item.tone === "warning" && "bg-accent/10 text-accent",
                  item.tone === "error" && "bg-danger/10 text-danger",
                )}><Icon size={15} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text">{t(item.title)}</p>
                  {item.message && <p className="mt-0.5 break-words text-2xs leading-relaxed text-textMuted">{t(item.message)}</p>}
                  {item.action && (
                    <button
                      type="button"
                      onClick={() => { item.action?.onClick(); dismiss(item.id); }}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/10 px-3 text-xs font-semibold text-accent transition hover:bg-accent/15"
                    >
                      <Undo2 size={13} aria-hidden="true" />{item.action.label}
                      <kbd className="licia-kbd ml-1 hidden sm:inline-flex">Ctrl Z</kbd>
                    </button>
                  )}
                </div>
                <button onClick={() => dismiss(item.id)} className="touch-target -mr-1 -mt-1 shrink-0 text-textMuted hover:text-text" aria-label={t("Tutup notifikasi")}><X size={14} aria-hidden="true" /></button>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-bg"><div className={clsx("h-full w-full origin-left animate-licia-toast-progress", item.tone === "success" ? "bg-success" : item.tone === "error" ? "bg-danger" : item.tone === "warning" ? "bg-accentSoft" : "bg-accent")} style={{ animationDuration: `${item.duration ?? DEFAULT_MS}ms` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
