"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CheckSquare, Loader2 } from "lucide-react";
import { SmartChips } from "@/components/ui/SmartChips";
import { MoneyAction } from "@/components/ui/MoneyAction";
import { notifyToast } from "@/components/ui/toast";
import { useLanguage } from "@/components/LanguageProvider";
import { parseSmartCapture, type SmartParseResult } from "@/lib/text/smartParse";
import { captureTimezone } from "@/lib/ui/captureTimezone";
import { createTaskFromText, deleteTaskById } from "@/lib/ui/taskCapture";
import { toastWithUndo } from "@/lib/ui/undoToast";
import { haptic } from "@/lib/interaction";

export type ScheduleSuggestion = { title: string; date: string | null; start: string | null; end: string | null };

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Chip cerdas + aksi lanjutan di bawah kolom ketik (A1). Dipakai di Inbox, Catatan, dan Kalender:
 *  - chip: tanggal, jam, prioritas, tag, nominal;
 *  - nominal → "Catat sebagai pengeluaran/pemasukan";
 *  - `allowTask` → "Jadikan tugas" (tanggal/jam/prioritas ikut terbawa);
 *  - `onApplySchedule` → mengisi form Kalender dari judul ("rapat besok jam 3 sore").
 */
export function SmartCaptureHint({ text, allowTask = false, onApplySchedule, onTaskCreated, onMoneyDone, className }: {
  text: string;
  allowTask?: boolean;
  onApplySchedule?: (s: ScheduleSuggestion) => void;
  onTaskCreated?: () => void;
  onMoneyDone?: () => void;
  className?: string;
}) {
  const { t: tr } = useLanguage();
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const parsed: SmartParseResult | null = useMemo(() => {
    const value = text.trim();
    if (value.length < 3) return null;
    return parseSmartCapture(value, { timezone: captureTimezone(), stripTags: false, lang: language });
  }, [text, language]);
  if (!parsed || !parsed.chips.length) return null;

  const hasWhen = Boolean(parsed.dueDate || parsed.dueTime || parsed.priority);

  async function makeTask() {
    if (busy) return;
    setBusy(true);
    const created = await createTaskFromText(text, language);
    setBusy(false);
    if (!created.ok) { haptic("warning"); notifyToast({ title: "Belum tersimpan", message: created.error, tone: "error" }); return; }
    haptic("success");
    if (created.id && !created.queued) toastWithUndo({ title: t("Tugas dibuat"), message: created.title, undoLabel: t("Urungkan"), revert: async () => { await deleteTaskById(created.id!); } });
    else notifyToast({ title: created.queued ? tr("Disimpan di perangkat") : tr("Tugas dibuat"), message: created.title, tone: "success" });
    onTaskCreated?.();
  }

  return (
    <div className={className}>
      <SmartChips chips={parsed.chips} hint={parsed.dueDate && !parsed.dueTime && allowTask ? t("Tanpa jam, tenggat diset pukul 09:00.") : null} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {parsed.amount ? <MoneyAction amount={parsed.amount} text={text} onDone={onMoneyDone} /> : null}
        {allowTask && hasWhen ? (
          <button type="button" onClick={() => void makeTask()} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 text-xs font-semibold text-accent transition hover:bg-accent/15 disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <CheckSquare size={13} aria-hidden="true" />}{t("Jadikan tugas")}
          </button>
        ) : null}
        {onApplySchedule && (parsed.dueDate || parsed.dueTime) ? (
          <button type="button" onClick={() => onApplySchedule({ title: parsed.title || text.trim(), date: parsed.dueDate, start: parsed.dueTime, end: parsed.dueTime ? addHour(parsed.dueTime) : null })} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/10 px-3 text-xs font-semibold text-accent transition hover:bg-accent/15">
            <CalendarCheck size={13} aria-hidden="true" />{t("Isi tanggal & jam dari judul")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
