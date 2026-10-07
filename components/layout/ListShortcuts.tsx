"use client";

import { useEffect } from "react";
import { LIST_ITEM_ATTR, LIST_KEYS, nextIndex, type ListAction } from "@/lib/listNav";
import { isTypingTarget } from "@/lib/shortcuts";

/**
 * Pintasan daftar global (A12): J/K (atau ↑/↓) pindah item, X selesai/centang, E ubah, Enter buka.
 * Daftar cukup menandai tiap baris dengan `data-list-item` dan tombolnya dengan `data-list-action="toggle|edit|open"`.
 * Tidak aktif saat mengetik, saat dialog terbuka, atau tepat setelah awalan "G" (agar "G lalu K" tetap ke Knowledge).
 */
export function ListShortcuts() {
  useEffect(() => {
    let lastG = 0;
    const items = () =>
      Array.from(document.querySelectorAll<HTMLElement>(`[${LIST_ITEM_ATTR}]`)).filter(
        (el) => el.offsetParent !== null,
      );
    const owner = (el: Element | null) => el?.closest<HTMLElement>(`[${LIST_ITEM_ATTR}]`) ?? null;

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "g" || event.key === "G") {
        lastG = Date.now();
        return;
      }
      const action = LIST_KEYS[event.key];
      if (!action) return;
      if (Date.now() - lastG < 1300) return;
      const list = items();
      if (!list.length) return;
      const current = owner(document.activeElement);

      if (action === "next" || action === "prev" || action === "first" || action === "last") {
        // ↑/↓ hanya dibajak bila fokus memang sudah ada di dalam daftar; J/K selalu bekerja.
        if (
          (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") &&
          !current
        )
          return;
        event.preventDefault();
        const idx = nextIndex(current ? list.indexOf(current) : -1, list.length, action);
        const el = list[idx];
        if (!el) return;
        if (!el.hasAttribute("tabindex")) el.tabIndex = -1;
        el.focus({ preventScroll: true });
        el.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
        return;
      }
      if (!current) return;
      // Enter pada tombol/tautan di dalam baris tetap perilaku bawaan.
      if (action === "open" && document.activeElement !== current) return;
      const find = (a: ListAction) => current.querySelector<HTMLElement>(`[data-list-action="${a}"]`);
      const trigger = find(action as ListAction);
      if (!trigger) {
        // "E" pada baris yang detailnya masih tertutup: buka dulu, lalu tekan Ubah.
        const opener = action === "edit" ? find("open") : null;
        if (!opener) return;
        event.preventDefault();
        opener.click();
        window.setTimeout(() => find("edit")?.click(), 140);
        return;
      }
      event.preventDefault();
      trigger.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
