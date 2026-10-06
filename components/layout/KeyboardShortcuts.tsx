"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";
import { QUICK_CAPTURE_EVENT, SHORTCUTS_HELP_EVENT, SEQUENCE_TIMEOUT_MS, SHORTCUT_HELP, isTypingTarget, resolveGoTo } from "@/lib/shortcuts";
import { notifyToast } from "@/components/ui";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Pintasan keyboard global: "g lalu d" ke Beranda, "n" simpan cepat, "?" bantuan.
 * Tidak aktif saat mengetik, saat memakai Ctrl/⌘/Alt, atau saat dialog lain terbuka.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { t } = useLanguage();
  const [helpOpen, setHelpOpen] = useState(false);
  const awaitingGo = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSequence = useCallback(() => {
    awaitingGo.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") { clearSequence(); return; }
      // Dialog modal lain sedang terbuka (konfirmasi, Simpan Cepat, dsb.): jangan membajak tombol.
      if (document.querySelector('[aria-modal="true"]')) { clearSequence(); return; }

      if (awaitingGo.current) {
        const target = resolveGoTo(event.key);
        clearSequence();
        if (target) {
          event.preventDefault();
          router.push(target.href);
          notifyToast({ title: target.label, message: "Dibuka lewat pintasan keyboard.", tone: "success" });
        }
        return;
      }

      if (event.key === "?") { event.preventDefault(); setHelpOpen(true); return; }
      if (event.key === "n" || event.key === "N") { event.preventDefault(); window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT)); return; }
      if (event.key === "g" || event.key === "G") {
        awaitingGo.current = true;
        timer.current = setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearSequence(); };
  }, [router, clearSequence]);

  useEffect(() => {
    const open = () => setHelpOpen(true);
    window.addEventListener(SHORTCUTS_HELP_EVENT, open);
    return () => window.removeEventListener(SHORTCUTS_HELP_EVENT, open);
  }, []);

  return (
    <Overlay open={helpOpen} onClose={() => setHelpOpen(false)} tier="modal" align="center" labelledBy="licia-shortcuts-title" panelClassName="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-border bg-surface p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Keyboard size={16} aria-hidden="true" /></span>
          <h2 id="licia-shortcuts-title" className="font-display text-lg text-text">{t("Pintasan keyboard")}</h2>
        </div>
        <button type="button" onClick={() => setHelpOpen(false)} className="touch-target rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-text" aria-label={t("Tutup bantuan pintasan")}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 space-y-5">
        {SHORTCUT_HELP.map((group) => (
          <section key={group.title}>
            <h3 className="text-2xs font-bold uppercase tracking-[.14em] text-accent">{t(group.title)}</h3>
            <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-bg">
              {group.items.map((item) => (
                <li key={item.label + item.keys.join("+")} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs text-text">{t(item.label)}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k, i) => <kbd key={`${k}-${i}`} className="licia-kbd">{k}</kbd>)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-4 text-2xs leading-relaxed text-textMuted">{t("Pintasan satu huruf tidak aktif saat kamu sedang mengetik di kolom isian.")}</p>
    </Overlay>
  );
}
