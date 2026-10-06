"use client";
import { Check, X } from "lucide-react";
import { clsx } from "clsx";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";

export function ActionDialog({ open, title, description, children, onClose, onConfirm, confirmLabel, cancelLabel, tone = "accent", busy = false }: { open: boolean; title: string; description?: string; children?: React.ReactNode; onClose: () => void; onConfirm?: () => void; confirmLabel?: string; cancelLabel?: string; tone?: "accent" | "danger"; busy?: boolean }) {
  const { t } = useLanguage();
  return (
    <Overlay open={open} onClose={onClose} tier="modal" align="bottom" dismissible={!busy} labelledBy="licia-dialog-title" panelClassName="w-full max-w-md overflow-hidden rounded-[1.6rem] border border-border bg-surface shadow-2xl animate-licia-dialog-in">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div className={clsx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent")}>{tone === "danger" ? <X size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 id="licia-dialog-title" className="break-words font-display text-lg text-text">{title}</h2>
            <button onClick={onClose} disabled={busy} className="touch-target -mr-2 -mt-2 rounded-xl text-textMuted hover:bg-bg hover:text-text disabled:opacity-50" aria-label={t("Tutup")}><X size={16} aria-hidden="true" /></button>
          </div>
          {description && <p className="mt-1 break-words text-xs leading-relaxed text-textMuted">{description}</p>}
        </div>
      </div>
      {children && <div className="px-4 pb-4 sm:px-5">{children}</div>}
      {onConfirm && (
        <div className="flex gap-2 border-t border-border bg-bg/45 px-4 py-3 sm:px-5">
          <button onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-textMuted hover:text-text">{cancelLabel ?? t("Batal")}</button>
          <button onClick={onConfirm} disabled={busy} className={clsx("min-h-11 flex-1 rounded-xl px-3 text-xs font-semibold text-white", tone === "danger" ? "bg-danger" : "bg-accent", busy && "opacity-60")}>{busy ? t("Memproses…") : (confirmLabel ?? t("Lanjutkan"))}</button>
        </div>
      )}
    </Overlay>
  );
}

export function TextPromptDialog({ open, title, description, value, onChange, onClose, onSubmit, placeholder, submitLabel, multiline = false, busy = false }: { open: boolean; title: string; description?: string; value: string; onChange: (v: string) => void; onClose: () => void; onSubmit: () => void; placeholder?: string; submitLabel?: string; multiline?: boolean; busy?: boolean }) {
  const { t } = useLanguage();
  const ph = placeholder ?? t("Tulis di sini…");
  return (
    <ActionDialog open={open} title={title} description={description} onClose={onClose} onConfirm={onSubmit} confirmLabel={submitLabel ?? t("Simpan")} busy={busy}>
      <label className="block">
        <span className="sr-only">{title}</span>
        {multiline
          ? <textarea data-autofocus rows={5} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="min-h-28 w-full resize-none rounded-xl border border-border bg-bg px-3 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30" />
          : <input data-autofocus value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit(); } }} placeholder={ph} className="min-h-11 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-accent/30" />}
      </label>
    </ActionDialog>
  );
}
