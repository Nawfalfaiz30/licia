"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";

/**
 * Primitif overlay tunggal (A4): satu tempat untuk scrim, penutup Esc, kunci scroll, role/aria dan lapisan z-index.
 * Fokus ditangani oleh <OverlayGuard/> untuk SEMUA elemen `role="dialog" aria-modal="true"` (A3).
 *
 *   variant "center"  → dialog di tengah (di ponsel menempel ke bawah)
 *   variant "sheet"   → lembar bawah di ponsel, kartu di tengah pada layar lebar
 *   variant "top"     → palet perintah (menempel di atas)
 */
export type OverlayVariant = "center" | "sheet" | "top";

const VARIANT: Record<OverlayVariant, { wrap: string; z: string }> = {
  center: { wrap: "items-end p-3 sm:items-center", z: "z-modal" },
  sheet: { wrap: "items-end sm:items-center", z: "z-sheet" },
  top: { wrap: "items-start p-3 pt-[12vh]", z: "z-palette" },
};

export function Overlay({ open, onClose, variant = "center", label, labelledBy, dismissable = true, lockScroll = true, scrimClassName, panelClassName, children }: {
  open: boolean;
  onClose: () => void;
  variant?: OverlayVariant;
  label?: string;
  labelledBy?: string;
  dismissable?: boolean;
  lockScroll?: boolean;
  scrimClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const closeRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dismissable || event.defaultPrevented) return;
      // hanya overlay paling atas yang menutup
      const all = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (all.length && all[all.length - 1] !== panelRef.current) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissable]);

  useEffect(() => {
    if (!open || !lockScroll) return;
    document.body.classList.add("licia-scroll-locked");
    return () => document.body.classList.remove("licia-scroll-locked");
  }, [open, lockScroll]);

  if (!open) return null;
  const v = VARIANT[variant];
  return (
    <div
      className={clsx("fixed inset-0 flex justify-center bg-black/45 backdrop-blur-[3px]", v.z, v.wrap, scrimClassName)}
      onMouseDown={(event) => { if (dismissable && event.target === event.currentTarget) closeRef.current(); }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} className={panelClassName}>
        {children}
      </div>
    </div>
  );
}
