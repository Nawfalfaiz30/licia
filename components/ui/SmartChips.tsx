"use client";

import { CalendarDays, Clock, Flag, Hash, Wallet, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import type { SmartChip, SmartChipKind } from "@/lib/text/smartParse";
import { useLanguage } from "@/components/LanguageProvider";

const ICONS: Record<SmartChipKind, LucideIcon> = {
  date: CalendarDays,
  time: Clock,
  priority: Flag,
  tag: Hash,
  money: Wallet,
};

const TONES: Record<SmartChipKind, string> = {
  date: "border-accent/30 bg-accent/10 text-accent",
  time: "border-accent/30 bg-accent/10 text-accent",
  priority: "border-danger/30 bg-danger/10 text-danger",
  tag: "border-border bg-bg text-textMuted",
  money: "border-success/30 bg-success/10 text-success",
};

/**
 * Menampilkan hasil parseSmartCapture sebagai "chip" kecil di bawah kolom ketik, sehingga
 * pengguna melihat apa yang dikenali (tanggal, jam, prioritas, tag, nominal) sebelum menyimpan.
 */
export function SmartChips({ chips, hint, className }: { chips: SmartChip[]; hint?: string | null; className?: string }) {
  const { t } = useLanguage();
  if (!chips.length) return null;
  return (
    <div className={clsx("licia-smart-chips", className)} aria-live="polite">
      <p className="sr-only">{t("Terdeteksi otomatis dari teks:")}</p>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip, index) => {
          const Icon = ICONS[chip.kind];
          return (
            <li
              key={`${chip.kind}-${chip.label}-${index}`}
              className={clsx("licia-smart-chip inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-semibold", TONES[chip.kind])}
            >
              <Icon size={11} aria-hidden="true" />
              {chip.label}
            </li>
          );
        })}
      </ul>
      {hint ? <p className="mt-1.5 text-2xs leading-relaxed text-textMuted">{hint}</p> : null}
    </div>
  );
}
