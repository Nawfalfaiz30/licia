"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { mutateEntity } from "@/lib/sync/client";
import { buildMoneyDraft, guessMoneyKind, moneyPayload, type MoneyKind } from "@/lib/text/moneyCapture";
import { formatMoney } from "@/lib/format";
import { notifyToast } from "@/components/ui/toast";
import { useLanguage } from "@/components/LanguageProvider";
import { haptic } from "@/lib/interaction";

/**
 * Tombol "Catat sebagai pengeluaran" yang muncul bila teks memuat nominal (A1).
 * Tebakan arah dari kata kunci (gaji → pemasukan, beli → pengeluaran); bila ragu, kedua pilihan tampil setara.
 */
export function MoneyAction({ amount, text, onDone, className }: { amount: number; text: string; onDone?: () => void; className?: string }) {
  const { t: tr } = useLanguage();
  const { t, locale } = useLanguage();
  const [busy, setBusy] = useState<MoneyKind | null>(null);
  const guess = useMemo(() => guessMoneyKind(text), [text]);
  const pretty = formatMoney(amount, locale);

  async function record(kind: MoneyKind) {
    const draft = buildMoneyDraft(text, kind, amount);
    if (!draft || busy) return;
    setBusy(kind);
    const result = await mutateEntity({ entityType: kind, operation: "create", payload: moneyPayload(draft), offlineOk: true });
    setBusy(null);
    if (!result.ok) {
      haptic("warning");
      notifyToast({ title: t("Belum tercatat"), message: result.error || t("Perubahan gagal disimpan."), tone: "error" });
      return;
    }
    haptic("success");
    notifyToast({
      title: result.queued ? t("Disimpan di perangkat") : kind === "expense" ? t("Pengeluaran tercatat") : t("Pemasukan tercatat"),
      message: tr("{draft_label} · {pretty}", { draft_label: draft.label, pretty }),
      tone: "success",
    });
    onDone?.();
  }

  const buttons: Array<{ kind: MoneyKind; label: string; Icon: typeof ArrowUpRight; primary: boolean }> = [
    { kind: "expense", label: t("Catat sebagai pengeluaran"), Icon: ArrowUpRight, primary: guess !== "income" },
    { kind: "income", label: t("Catat sebagai pemasukan"), Icon: ArrowDownLeft, primary: guess === "income" },
  ];
  // Urutkan: tebakan di depan; bila ragu, hanya pengeluaran yang menonjol.
  buttons.sort((a, b) => Number(b.primary) - Number(a.primary));

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)} role="group" aria-label={t("Catat nominal ke Keuangan")}>
      {buttons.map(({ kind, label, Icon, primary }, index) => (
        <button
          key={kind}
          type="button"
          onClick={() => void record(kind)}
          disabled={Boolean(busy)}
          className={clsx(
            "inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:opacity-60",
            index === 0 ? "border-success/30 bg-success/10 text-success hover:bg-success/15" : "border-border bg-surface text-textMuted hover:text-text",
          )}
        >
          {busy === kind ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Icon size={13} aria-hidden="true" />}
          {label} · {pretty}
          {primary && !guess ? null : null}
        </button>
      ))}
    </div>
  );
}
