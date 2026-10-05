"use client";

import { useMemo, useState } from "react";
import { parseSmartCapture, type SmartChip } from "@/lib/text/smartParse";
import { SmartChips } from "@/components/ui/SmartChips";
import { mutateEntity } from "@/lib/sync/client";
import { notifyToast, notifyUndo } from "@/components/ui/toast";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * "Smart chips" siap pakai untuk kolom teks mana pun (A1): memparse teks di perangkat, menampilkan chip,
 * dan — bila ada nominal — menawarkan "Catat sebagai pengeluaran" dengan tombol Urungkan.
 * Letakkan tepat di bawah input/textarea: <SmartHints text={value} timezone={tz} />
 */
export function SmartHints({ text, timezone = "Asia/Jakarta", className, hideTags = false, allowExpense = true }: { text: string; timezone?: string; className?: string; hideTags?: boolean; allowExpense?: boolean }) {
  const { tr } = useLanguage();
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim().length >= 3 ? parseSmartCapture(text, { timezone, stripTags: false }) : null), [text, timezone]);
  if (!parsed) return null;
  const chips = hideTags ? parsed.chips.filter((chip) => chip.kind !== "tag") : parsed.chips;

  async function record(chip: SmartChip) {
    if (!parsed || !chip.amount || busy) return;
    setBusy(true);
    try {
      const note = parsed.title.trim().slice(0, 120) || text.trim().slice(0, 120);
      const category = parsed.tags[0] || tr("Umum");
      const result = await mutateEntity({ entityType: "expense", operation: "create", payload: { amount: chip.amount, note, category, account_id: null } });
      if (!result.ok) { notifyToast({ title: tr("Pengeluaran belum tercatat"), message: result.error || tr("Perubahan gagal disimpan."), tone: "error" }); return; }
      const id = result.response?.record?.id as string | undefined;
      notifyUndo({
        title: tr("Pengeluaran dicatat"), message: `${chip.label} · ${category}`, undoLabel: tr("Urungkan"),
        onUndo: async () => {
          if (!id) { notifyToast({ title: tr("Gagal mengurungkan"), message: tr("Hapus transaksi dari Keuangan."), tone: "error" }); return; }
          const back = await mutateEntity({ entityType: "expense", operation: "delete", entityId: id, payload: {} });
          notifyToast({ title: back.ok ? tr("Dikembalikan") : tr("Gagal mengurungkan"), tone: back.ok ? "info" : "error" });
        },
      });
    } finally { setBusy(false); }
  }

  return <SmartChips chips={chips} className={className} moneyAction={allowExpense ? { label: tr("Catat sebagai pengeluaran"), busy, onClick: record } : undefined} />;
}
