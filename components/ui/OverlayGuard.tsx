"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
const DIALOG = '[role="dialog"][aria-modal="true"]';

function isVisible(el: HTMLElement) {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}
const focusables = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);

/**
 * Perangkap fokus global (A3). Setiap `role="dialog" aria-modal="true"` yang muncul di DOM otomatis:
 *  1. menerima fokus (elemen `autofocus`/`data-autofocus` lebih dulu, lalu elemen fokus pertama),
 *  2. menjaga Tab/Shift+Tab tetap berputar di dalam dialog paling atas,
 *  3. mengembalikan fokus ke elemen pemicu saat ditutup.
 * Satu mekanisme untuk semua overlay (dialog, sheet, palet, pencarian cepat) sehingga tidak ada yang terlewat.
 */
export function OverlayGuard() {
  useEffect(() => {
    type Entry = { el: HTMLElement; opener: HTMLElement | null };
    const stack: Entry[] = [];
    let lastOutside: HTMLElement | null = null;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest(DIALOG)) lastOutside = target;
    };

    const sync = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>(DIALOG));
      for (const el of dialogs) {
        if (stack.some((s) => s.el === el)) continue;
        stack.push({ el, opener: lastOutside });
        if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
        const focusInside = el.contains(document.activeElement);
        if (!focusInside) {
          const preferred = el.querySelector<HTMLElement>("[data-autofocus],[autofocus]");
          const target = preferred ?? focusables(el)[0] ?? el;
          requestAnimationFrame(() => {
            if (el.isConnected && !el.contains(document.activeElement)) target.focus({ preventScroll: true });
          });
        }
      }
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].el.isConnected) continue;
        const [removed] = stack.splice(i, 1);
        const wasTop = i === stack.length; // yang dibuang adalah yang paling atas
        const opener = removed.opener;
        if (
          wasTop &&
          opener &&
          opener.isConnected &&
          (document.activeElement === document.body || !document.activeElement || !document.activeElement.isConnected)
        ) {
          requestAnimationFrame(() => opener.focus({ preventScroll: true }));
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !stack.length) return;
      const top = stack[stack.length - 1].el;
      if (!top.isConnected) return;
      const items = focusables(top);
      if (!items.length) {
        event.preventDefault();
        top.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !top.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === top)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
  return null;
}
