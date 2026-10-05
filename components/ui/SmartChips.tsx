"use client";

import { CalendarDays, Clock, Flag, Hash, Wallet, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import type { SmartChip, SmartChipKind } from "@/lib/text/smartParse";
import { addDaysYmd } from "@/lib/text/smartParse";
import { useLanguage } from "@/components/LanguageProvider";

const ICONS: Record<SmartChipKind, LucideIcon> = { date: CalendarDays, time: Clock, priority: Flag, tag: Hash, money: Wallet };
const TONES: Record<SmartChipKind, string> = {
  date: "border-accent/30 bg-accent/10 text-accent",
  time: "border-accent/30 bg-accent/10 text-accent",
  priority: "border-danger/30 bg-danger/10 text-danger",
  tag: "border-border bg-bg text-textMuted",
  money: "border-success/30 bg-success/10 text-success",
};

export type MoneyAction = { label: string; busy?: boolean; onClick: (chip: SmartChip) => void };

/** Label chip mengikuti bahasa antarmuka (parser menghasilkan teks Indonesia sebagai default). */
export function useChipLabel() {
  const { tr, locale } = useLanguage();
  return (chip: SmartChip) => {
    if (chip.kind === "date" && chip.ymd && chip.todayYmd) {
      if (chip.ymd === chip.todayYmd) return tr("Hari ini");
      if (chip.ymd === addDaysYmd(chip.todayYmd, 1)) return tr("Besok");
      if (chip.ymd === addDaysYmd(chip.todayYmd, 2)) return tr("Lusa");
      const sameYear = chip.ymd.slice(0, 4) === chip.todayYmd.slice(0, 4);
      return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(new Date(`${chip.ymd}T12:00:00Z`));
    }
    if (chip.kind === "priority") return tr(chip.label);
    return chip.label;
  };
}

/**
 * Menampilkan hasil parseSmartCapture sebagai "chip" kecil di bawah kolom ketik, sehingga
 * pengguna melihat apa yang dikenali (tanggal, jam, prioritas, tag, nominal) sebelum menyimpan.
 * Bila `moneyAction` diberikan, chip nominal menawarkan tombol aksi (mis. "Catat sebagai pengeluaran").
 */
export function SmartChips({ chips, hint, className, moneyAction }: { chips: SmartChip[]; hint?: string | null; className?: string; moneyAction?: MoneyAction }) {
  const { tr } = useLanguage();
  const labelOf = useChipLabel();
  if (!chips.length) return null;
  return (
    <div className={clsx("licia-smart-chips", className)} aria-live="polite">
      <p className="sr-only">{tr("Terdeteksi otomatis dari teks:")}</p>
      <ul className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip, index) => {
          const Icon = ICONS[chip.kind];
          return (
            <li key={`${chip.kind}-${chip.label}-${index}`} className="inline-flex items-center gap-1">
              <span className={clsx("licia-smart-chip inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", TONES[chip.kind])}>
                <Icon size={11} aria-hidden="true" />
                {labelOf(chip)}
              </span>
              {chip.kind === "money" && moneyAction && chip.amount ? (
                <button type="button" disabled={moneyAction.busy} onClick={() => moneyAction.onClick(chip)} className="min-h-7 rounded-full border border-success/40 bg-surface px-2.5 text-[11px] font-semibold text-success hover:bg-success/10 disabled:opacity-60">{moneyAction.busy ? tr("Memproses…") : moneyAction.label}</button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-textMuted">{hint}</p> : null}
    </div>
  );
}
