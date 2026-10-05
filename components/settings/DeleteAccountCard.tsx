"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, ActionDialog, notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

/** Hapus akun dan semua data (E2): wajib mengetik kata konfirmasi. */
export function DeleteAccountCard() {
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const expected = t("delete_account_confirm_word");
  const matches = word.trim().toUpperCase() === expected.toUpperCase();

  async function confirmDelete() {
    if (!matches || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: word.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("delete_account_failed"));
      try { localStorage.clear(); } catch {}
      notifyToast({ title: t("delete_account_done"), tone: "success" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      notifyToast({ title: t("delete_account_failed"), message: error instanceof Error ? error.message : t("error_generic"), tone: "error" });
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-danger/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Trash2 size={18} className="text-danger" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-text">{t("delete_account")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-textMuted">{t("delete_account_desc")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-textMuted">{t("retention_note")}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setWord(""); setOpen(true); }} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 text-xs font-semibold text-danger transition hover:bg-danger/10">
          <Trash2 size={14} aria-hidden="true" />{t("delete_account")}
        </button>
      </Card>
      <ActionDialog open={open} title={t("delete_account")} description={t("delete_account_desc")} tone="danger" busy={busy} onClose={() => setOpen(false)} onConfirm={matches ? () => void confirmDelete() : undefined} confirmLabel={t("delete")}>
        <label className="block text-xs text-textMuted">
          {t("delete_account_confirm_label")}
          <input autoFocus value={word} onChange={(event) => setWord(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmDelete(); }} autoComplete="off" spellCheck={false} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm text-text outline-none focus:ring-2 focus:ring-danger/30" />
        </label>
        {!matches && <p className="mt-2 text-[11px] text-textMuted">{expected}</p>}
      </ActionDialog>
    </>
  );
}
