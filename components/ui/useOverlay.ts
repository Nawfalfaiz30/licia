"use client";

import { useEffect, useId, useRef } from "react";
import { FOCUSABLE_SELECTOR, decideTabTarget, isTopOverlay, popOverlay, pushOverlay } from "@/lib/focusTrap";

type Options = {
  open: boolean;
  onClose?: () => void;
  /** Cegah Esc menutup (mis. saat proses berjalan). */
  disableEscape?: boolean;
  /** Kunci scroll body selama overlay terbuka. Default true. */
  lockScroll?: boolean;
};

/**
 * Perilaku overlay bersama: perangkap fokus, fokus awal, pengembalian fokus ke pemicu,
 * penutupan dengan Esc (hanya overlay paling atas), dan penguncian scroll berhitung referensi.
 * Pasang `ref` pada kontainer dialog.
 */
let scrollLocks = 0;
let previousOverflow = "";

export function useOverlay<T extends HTMLElement = HTMLDivElement>({ open, onClose, disableEscape, lockScroll = true }: Options) {
  const ref = useRef<T>(null);
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pushOverlay(id);

    if (lockScroll) {
      if (scrollLocks === 0) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      scrollLocks += 1;
    }

    const container = ref.current;
    const focusables = (): HTMLElement[] => {
      if (!container) return [];
      const nodes: HTMLElement[] = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      return nodes.filter((el: HTMLElement) => el.offsetParent !== null || el === document.activeElement);
    };

    // Fokus awal: elemen ber-autoFocus bila sudah mengambil fokus di dalam kontainer; selain itu elemen pertama.
    const raf = window.requestAnimationFrame(() => {
      if (!container) return;
      if (container.contains(document.activeElement) && document.activeElement !== container) return;
      const first = focusables()[0];
      if (first) first.focus();
      else {
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
        container.focus();
      }
    });

    const onKey = (event: KeyboardEvent) => {
      if (!isTopOverlay(id)) return;
      if (event.key === "Escape" && !disableEscape) {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const list = focusables();
      const activeIndex = list.indexOf(document.activeElement as HTMLElement);
      const decision = decideTabTarget(activeIndex, list.length, event.shiftKey);
      if (decision === "native") return;
      event.preventDefault();
      if (decision === "first") list[0].focus();
      else if (decision === "last") list[list.length - 1].focus();
      else container.focus();
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      popOverlay(id);
      if (lockScroll) {
        scrollLocks = Math.max(0, scrollLocks - 1);
        if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
      }
      // Kembalikan fokus ke pemicu bila masih ada di dokumen.
      if (returnTo && document.contains(returnTo)) returnTo.focus();
    };
  }, [open, id, disableEscape, lockScroll]);

  return ref;
}
