"use client";

import { useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { Card, notifyToast } from "@/components/ui";
import { useLanguage } from "@/components/LanguageProvider";

/** Unduh arsip ZIP berisi Markdown (Obsidian) dan CSV (Excel) per modul. */
export function OpenExportCard() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/export-open", { cache: "no-store" });
      if (!res.ok) throw new Error(t("error_generic"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `licia-open-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notifyToast({ title: t("export_ready"), tone: "success" });
    } catch (error) {
      notifyToast({ title: t("export_failed"), message: error instanceof Error ? error.message : t("error_generic"), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <FileArchive size={18} className="text-accent" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-text">{t("export_open_formats")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-textMuted">{t("export_open_formats_desc")}</p>
        </div>
      </div>
      <button type="button" onClick={() => void download()} disabled={busy} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-text transition hover:border-accent/40 hover:text-accent disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FileArchive size={14} aria-hidden="true" />}
        {busy ? t("processing") : "Markdown + CSV (.zip)"}
      </button>
    </Card>
  );
}
