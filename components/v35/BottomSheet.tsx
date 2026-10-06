"use client";
import { X } from "lucide-react";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <Overlay open={open} onClose={onClose} tier="sheet" align="bottom" flush label={title} panelClassName="w-full max-w-xl rounded-t-[1.75rem] border border-border bg-surface p-4 shadow-2xl animate-licia-sheet-in sm:rounded-[1.75rem]">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-text">{title}</h2>
        <button onClick={onClose} aria-label={t("Tutup")} className="touch-target rounded-xl border border-border p-2 text-textMuted hover:text-text"><X size={15} aria-hidden="true" /></button>
      </div>
      <div className="mt-3">{children}</div>
    </Overlay>
  );
}
