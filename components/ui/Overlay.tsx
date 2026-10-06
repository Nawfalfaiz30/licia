"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { TABBABLE_SELECTOR, resolveTabTarget } from "@/lib/focusTrap";
import { isTopOverlay, lockBackground, lockScroll, pushOverlay, removeOverlay, unlockBackground, unlockScroll } from "@/lib/overlayStack";

export type OverlayTier = "sheet" | "modal" | "palette";
export type OverlayAlign = "center" | "bottom" | "end" | "top";

const TIER_CLASS: Record<OverlayTier, string> = { sheet: "z-sheet", modal: "z-modal", palette: "z-palette" };
const ALIGN_CLASS: Record<OverlayAlign, string> = {
  center: "items-center",
  bottom: "items-end sm:items-center",
  end: "items-end",
  top: "items-start pt-[12vh]",
};

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Nama dialog untuk pembaca layar (pakai ini ATAU labelledBy). */
  label?: string;
  labelledBy?: string;
  tier?: OverlayTier;
  align?: OverlayAlign;
  /** Kelas untuk panel (kartu) di dalam backdrop. */
  panelClassName?: string;
  /** Kelas tambahan untuk backdrop. */
  backdropClassName?: string;
  /** Tutup bila backdrop diklik / Esc ditekan. Matikan sementara saat `busy`. */
  dismissible?: boolean;
  /** Elemen yang difokuskan lebih dulu; bawaan: [data-autofocus], elemen yang sudah autoFocus, lalu tombol/isian pertama. */
  initialFocus?: () => HTMLElement | null;
  /** Tanpa padding di sekeliling panel (mis. sheet yang menempel ke tepi layar). */
  flush?: boolean;
  /** Sembunyikan hanya di layar kecil / besar, mis. "md:hidden". */
  visibilityClassName?: string;
};

/**
 * Overlay tunggal untuk semua dialog, sheet, dan palet (v0.57).
 *
 * - Perangkap fokus (Tab / Shift+Tab berputar di dalam panel) dan pengembalian fokus ke pemicu saat ditutup.
 * - Esc hanya menutup overlay paling atas; scroll latar dikunci; latar aplikasi dibuat `inert`.
 * - Dirender lewat portal ke <body> agar tidak terjebak stacking context (mis. header ber-backdrop-filter).
 * - Lapisan z-index memakai token (`z-sheet`, `z-modal`, `z-palette`).
 */
export function Overlay({
  open, onClose, children, label, labelledBy, tier = "modal", align = "bottom", panelClassName, backdropClassName,
  dismissible = true, initialFocus, visibilityClassName, flush = false,
}: OverlayProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const pointerDownOnBackdrop = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Tangkap pemicu SEBELUM fokus berpindah (autoFocus pada anak terjadi saat commit, lebih awal dari efek).
  if (open && !wasOpen.current && typeof document !== "undefined") {
    const active = document.activeElement;
    returnTarget.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpen.current = open;

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    pushOverlay(id);
    lockScroll();
    lockBackground();

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const preferred = initialFocus?.() ?? panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel.querySelector<HTMLElement>(TABBABLE_SELECTOR);
      (preferred ?? panel).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(id)) return;
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (dismissibleRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((node) => node.offsetParent !== null || node === document.activeElement);
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      const target = resolveTabTarget(index, nodes.length, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      (target === -1 ? panelRef.current : nodes[target]).focus();
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      removeOverlay(id);
      unlockScroll();
      unlockBackground();
      const target = returnTarget.current;
      returnTarget.current = null;
      // Tunggu satu frame: latar baru saja berhenti `inert`, baru bisa menerima fokus.
      window.requestAnimationFrame(() => {
        const fallback = document.getElementById("main-content");
        const el = target && target.isConnected ? target : fallback;
        el?.focus?.({ preventScroll: true });
      });
    };
  }, [open, mounted, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={clsx("fixed inset-0 flex justify-center bg-black/45 backdrop-blur-[3px]", !flush && "p-3", TIER_CLASS[tier], ALIGN_CLASS[align], visibilityClassName, backdropClassName)}
      onMouseDown={(event) => { pointerDownOnBackdrop.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        // Klik hanya menutup bila tekan DAN lepas terjadi di backdrop (cegah tutup tak sengaja saat seleksi teks).
        if (dismissible && pointerDownOnBackdrop.current && event.target === event.currentTarget) onClose();
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={clsx("outline-none", panelClassName)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
