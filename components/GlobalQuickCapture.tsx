"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckSquare, FileText, Inbox, Plus, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { haptic } from "@/lib/interaction";
import { notifyToast } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";
import { parseSmartCapture, smartDueAtIso } from "@/lib/text/smartParse";
import { SmartChips } from "@/components/ui/SmartChips";
import { QUICK_CAPTURE_EVENT } from "@/lib/shortcuts";
import { useLanguage } from "@/components/LanguageProvider";

type Mode = "task" | "note" | "inbox" | "ai";

/** Zona waktu perangkat bila termasuk zona Licia (WIB/WITA/WIT), selain itu WIB. */
function captureTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Asia/Makassar" || tz === "Asia/Jayapura" ? tz : "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
}

export function GlobalQuickCapture() {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  // Smart chips: tanggal/jam/prioritas dikenali langsung di perangkat (tanpa AI, tanpa jaringan).
  const smart = useMemo(
    () => (open && mode === "task" && value.trim() ? parseSmartCapture(value, { timezone: captureTimezone(), stripTags: false }) : null),
    [open, mode, value],
  );

  useEffect(() => {
    const isEnabled = () => localStorage.getItem("licia-quick-capture-global") !== "false";
    setEnabled(isEnabled());
    const refresh = () => setEnabled(isEnabled());
    const onKey = (event: KeyboardEvent) => {
      if (!isEnabled()) return;
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setOpen(true);
        haptic("light");
      }
      if (event.key === "Escape") setOpen(false);
    };
    const onOpenRequest = () => { if (isEnabled()) { setOpen(true); haptic("light"); } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("licia:preferences-change", refresh);
    window.addEventListener(QUICK_CAPTURE_EVENT, onOpenRequest);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("licia:preferences-change", refresh); window.removeEventListener(QUICK_CAPTURE_EVENT, onOpenRequest); };
  }, []);

  async function submit() {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      let selected: Exclude<Mode, "ai"> = mode === "ai" ? "inbox" : mode;
      let title = content;
      let priority = "medium";
      let dueAt: string | null = null;

      if (mode === "task") {
        const parsed = parseSmartCapture(content, { timezone: captureTimezone(), stripTags: false });
        title = parsed.title;
        priority = parsed.priority ?? "medium";
        dueAt = smartDueAtIso(parsed, captureTimezone());
      }

      if (mode === "ai") {
        if (!navigator.onLine) throw new Error(tr("Mode Licia membutuhkan koneksi untuk memilah isi dengan AI. Simpan sebagai Inbox saat offline."));
        const triage = await fetch("/api/inbox/triage", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await triage.json().catch(() => ({}));
        const item = triage.ok ? (data?.items?.[0] || data) : { kind: "inbox", title: content };
        if (item?.kind === "task") selected = "task";
        else if (item?.kind === "note") selected = "note";
        else selected = "inbox";
        title = item?.title || content;
        priority = item?.priority || "medium";
        dueAt = item?.due_at || null;
      }

      const payload = selected === "task"
        ? { title, status: "todo", priority, ...(dueAt ? { due_at: dueAt } : {}) }
        : selected === "note"
          ? { title: title.slice(0, 80), content }
          : { content, kind: "inbox", status: "open" };

      const result = await mutateEntity({ entityType: selected, operation: "create", payload, offlineOk: true });
      if (!result.ok) throw new Error(result.error || tr("Perubahan gagal disimpan."));
      haptic("success");
      notifyToast({
        title: result.queued ? tr("Disimpan di perangkat") : tr("Tersimpan"),
        message: selected === "task" ? tr("Tugas sudah masuk ke daftar.") : selected === "note" ? tr("Catatan sudah disimpan.") : tr("Masuk ke Kotak Masuk Cerdas."),
        tone: "success",
      });
      setValue("");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("licia:capture-complete"));
    } catch (error) {
      haptic("warning");
      notifyToast({ title: tr("Belum tersimpan"), message: error instanceof Error ? error.message : tr("Terjadi kesalahan."), tone: "error" });
    } finally { setBusy(false); }
  }

  if (!enabled) return null;

  return <>
    <button
      type="button"
      onClick={() => { setOpen(true); haptic("light"); }}
      className="licia-v33-ripple fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-fab flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl shadow-accent/20 transition duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95 md:bottom-6 md:right-6"
      aria-label={tr("Simpan cepat")}
      title={tr("Simpan cepat (Ctrl/Cmd+Shift+L)")}
    >
      <span className="absolute inset-0 rounded-full border border-white/20 animate-licia-pulse-ring"/><Plus size={22}/>
    </button>

    {open && <div className="fixed inset-0 z-popover flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="licia-quick-capture-title" className="w-full max-w-lg licia-v33-sheet overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-accent">{tr("Simpan cepat")}</p><h2 id="licia-quick-capture-title" className="mt-1 font-display text-xl text-text">{tr("Simpan sesuatu tanpa meninggalkan halaman ini")}</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label={tr("Tutup simpan cepat")} className="licia-v33-ripple touch-target rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-text"><X size={16} aria-hidden="true"/></button>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-bg p-1">
            {(["task", "note", "inbox", "ai"] as Mode[]).map((nextMode) => {
              const Icon = nextMode === "task" ? CheckSquare : nextMode === "note" ? FileText : nextMode === "inbox" ? Inbox : BrainCircuit;
              const label = nextMode === "task" ? tr("Tugas") : nextMode === "note" ? tr("Catatan") : nextMode === "inbox" ? tr("Inbox") : tr("Licia");
              return <button key={nextMode} onClick={() => setMode(nextMode)} className={clsx("licia-v33-ripple rounded-xl px-2 py-2.5 text-[10px] font-semibold", mode === nextMode ? "bg-surface text-accent shadow-sm" : "text-textMuted")}><Icon size={14} className="mx-auto mb-1"/>{label}</button>;
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-bg p-1">
            <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} rows={5} placeholder={mode === "task" ? tr("Contoh: kirim laporan besok jam 7 malam !1") : mode === "note" ? tr("Tulis catatan atau ide…") : mode === "inbox" ? tr("Tulis apa pun yang ingin kamu simpan…") : tr("Contoh: besok jam 7 ingatkan aku membawa dokumen")} className="w-full resize-none bg-transparent px-3 py-3 text-sm text-text outline-none placeholder:text-textMuted"/>
          </div>
          {smart ? <SmartChips chips={smart.chips.filter((chip) => chip.kind !== "tag")} hint={smart.dueDate && !smart.dueTime ? tr("Tanpa jam, tenggat diset pukul 09:00.") : null} className="mt-3" /> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[9px] leading-relaxed text-textMuted"><Sparkles size={11} className="mr-1 inline text-accent"/>{mode === "ai" ? tr("Licia memilih tempat penyimpanan yang paling sesuai.") : tr("Ctrl/Cmd + Enter untuk menyimpan.")}</p>
            </div>
            <button type="button" onClick={() => void submit()} disabled={busy || !value.trim()} className="licia-v33-ripple min-h-11 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? tr("Menyimpan…") : tr("Simpan")}</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
