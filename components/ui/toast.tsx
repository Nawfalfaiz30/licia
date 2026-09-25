"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { clsx } from "clsx";

type ToastTone = "success" | "info" | "warning" | "error";
export type ToastPayload = { title: string; message?: string; tone?: ToastTone; duration?: number };

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

export function ToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.title) return;
      const tone: ToastTone = detail.tone ?? "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item = { ...detail, tone, id };
      setItems((prev) => [...prev, item].slice(-4));
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), detail.duration ?? 3200);
    };
    window.addEventListener("licia:toast", onToast);
    return () => window.removeEventListener("licia:toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex justify-center px-3 sm:justify-end sm:right-4 sm:left-auto sm:w-[min(94vw,390px)] sm:px-0">
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
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-text">{item.title}</p>{item.message && <p className="mt-0.5 break-words text-[11px] leading-relaxed text-textMuted">{item.message}</p>}</div>
                <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} className="touch-target -mr-1 -mt-1 shrink-0 text-textMuted hover:text-text" aria-label="Tutup notifikasi"><X size={14}/></button>
              </div>
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-bg"><div className="h-full w-full origin-left animate-licia-toast-progress bg-accent" /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
