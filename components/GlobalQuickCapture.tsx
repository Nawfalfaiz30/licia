"use client";

import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckSquare, FileText, Inbox, Plus, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { haptic } from "@/lib/interaction";
import { notifyToast } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";
import { VoiceCaptureButton } from "@/components/capture/VoiceCaptureButton";

type Mode = "task" | "note" | "inbox" | "ai";

export function GlobalQuickCapture() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);

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
    window.addEventListener("keydown", onKey);
    window.addEventListener("licia:preferences-change", refresh);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("licia:preferences-change", refresh); };
  }, []);

  const onVoiceText = useCallback((text: string) => {
    setValue((current) => current ? `${current.trim()} ${text.trim()}`.trim() : text.trim());
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

      if (mode === "ai") {
        if (!navigator.onLine) throw new Error("Mode Licia membutuhkan koneksi untuk memilah isi dengan AI. Simpan sebagai Inbox saat offline.");
        const triage = await fetch("/api/inbox/triage", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await triage.json().catch(() => ({}));
        const item = data?.items?.[0] || data;
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
      if (!result.ok) throw new Error(result.error || "Perubahan gagal disimpan.");
      haptic("success");
      notifyToast({
        title: result.queued ? "Disimpan di perangkat" : "Tersimpan",
        message: selected === "task" ? "Tugas sudah masuk ke daftar." : selected === "note" ? "Catatan sudah disimpan." : "Masuk ke Kotak Masuk Cerdas.",
        tone: "success",
      });
      setValue("");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("licia:capture-complete"));
    } catch (error) {
      haptic("warning");
      notifyToast({ title: "Belum tersimpan", message: error instanceof Error ? error.message : "Terjadi kesalahan.", tone: "error" });
    } finally { setBusy(false); }
  }

  if (!enabled) return null;

  return <>
    <button
      type="button"
      onClick={() => { setOpen(true); haptic("light"); }}
      className="licia-v33-ripple fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-[105] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl shadow-accent/20 transition duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95 md:bottom-6 md:right-6"
      aria-label="Tangkap cepat"
      title="Tangkap cepat (Ctrl/Cmd+Shift+L)"
    >
      <span className="absolute inset-0 rounded-full border border-white/20 animate-licia-pulse-ring"/><Plus size={22}/>
    </button>

    {open && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="w-full max-w-lg licia-v33-sheet overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-accent">Tangkap cepat</p><h2 className="mt-1 font-display text-xl text-text">Simpan tanpa pindah halaman</h2></div>
          <button type="button" onClick={() => setOpen(false)} className="licia-v33-ripple touch-target rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-text"><X size={16}/></button>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-bg p-1">
            {(["task", "note", "inbox", "ai"] as Mode[]).map((nextMode) => {
              const Icon = nextMode === "task" ? CheckSquare : nextMode === "note" ? FileText : nextMode === "inbox" ? Inbox : BrainCircuit;
              const label = nextMode === "task" ? "Tugas" : nextMode === "note" ? "Catatan" : nextMode === "inbox" ? "Inbox" : "Licia";
              return <button key={nextMode} onClick={() => setMode(nextMode)} className={clsx("licia-v33-ripple rounded-xl px-2 py-2.5 text-[10px] font-semibold", mode === nextMode ? "bg-surface text-accent shadow-sm" : "text-textMuted")}><Icon size={14} className="mx-auto mb-1"/>{label}</button>;
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-bg p-1">
            <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} rows={5} placeholder={mode === "task" ? "Contoh: kirim laporan sebelum Jumat" : mode === "note" ? "Tulis catatan atau ide…" : mode === "inbox" ? "Apa pun yang ingin kamu simpan…" : "Contoh: besok jam 7 ingatkan aku membawa dokumen"} className="w-full resize-none bg-transparent px-3 py-3 text-sm text-text outline-none placeholder:text-textMuted"/>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <VoiceCaptureButton onText={onVoiceText} />
              <p className="text-[9px] leading-relaxed text-textMuted"><Sparkles size={11} className="mr-1 inline text-accent"/>{mode === "ai" ? "Licia memilih tempat penyimpanan yang paling sesuai." : "Ctrl/Cmd + Enter untuk menyimpan."}</p>
            </div>
            <button type="button" onClick={() => void submit()} disabled={busy || !value.trim()} className="licia-v33-ripple min-h-11 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
