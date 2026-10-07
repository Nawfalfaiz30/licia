"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckSquare, FileText, Inbox, Plus, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import { haptic } from "@/lib/interaction";
import { notifyToast } from "@/components/ui";
import { mutateEntity } from "@/lib/sync/client";
import { parseSmartCapture, smartDueAtIso } from "@/lib/text/smartParse";
import { SmartChips } from "@/components/ui/SmartChips";
import { QUICK_CAPTURE_EVENT, type QuickCaptureRequest } from "@/lib/shortcuts";
import { captureTimezone } from "@/lib/ui/captureTimezone";
import { Overlay } from "@/components/ui/Overlay";
import { MoneyAction } from "@/components/ui/MoneyAction";
import { useLanguage } from "@/components/LanguageProvider";

type Mode = "task" | "note" | "inbox" | "ai";

export function GlobalQuickCapture() {
  const { t: tr } = useLanguage();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  // Smart chips: tanggal/jam/prioritas dikenali langsung di perangkat (tanpa AI, tanpa jaringan).
  const smart = useMemo(
    () =>
      open && mode === "task" && value.trim()
        ? parseSmartCapture(value, { timezone: captureTimezone(), stripTags: false, lang: language })
        : null,
    [open, mode, value, language],
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
    };
    const onOpenRequest = (event: Event) => {
      if (!isEnabled()) return;
      const detail = (event as CustomEvent<QuickCaptureRequest | undefined>).detail;
      if (detail?.mode) setMode(detail.mode);
      if (detail?.text) setValue(detail.text);
      setOpen(true);
      haptic("light");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("licia:preferences-change", refresh);
    window.addEventListener(QUICK_CAPTURE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("licia:preferences-change", refresh);
      window.removeEventListener(QUICK_CAPTURE_EVENT, onOpenRequest);
    };
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
        const parsed = parseSmartCapture(content, { timezone: captureTimezone(), stripTags: false, lang: language });
        title = parsed.title;
        priority = parsed.priority ?? "medium";
        dueAt = smartDueAtIso(parsed, captureTimezone());
      }

      if (mode === "ai") {
        if (!navigator.onLine)
          throw new Error(
            t("Mode Licia membutuhkan koneksi untuk memilah isi dengan AI. Simpan sebagai Inbox saat offline."),
          );
        const triage = await fetch("/api/inbox/triage", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await triage.json().catch(() => ({}));
        const item = triage.ok ? data?.items?.[0] || data : { kind: "inbox", title: content };
        if (item?.kind === "task") selected = "task";
        else if (item?.kind === "note") selected = "note";
        else selected = "inbox";
        title = item?.title || content;
        priority = item?.priority || "medium";
        dueAt = item?.due_at || null;
      }

      const payload =
        selected === "task"
          ? { title, status: "todo", priority, ...(dueAt ? { due_at: dueAt } : {}) }
          : selected === "note"
            ? { title: title.slice(0, 80), content }
            : { content, kind: "inbox", status: "open" };

      const result = await mutateEntity({ entityType: selected, operation: "create", payload, offlineOk: true });
      if (!result.ok) throw new Error(result.error || tr("Perubahan gagal disimpan."));
      haptic("success");
      notifyToast({
        title: result.queued ? tr("Disimpan di perangkat") : tr("Tersimpan"),
        message:
          selected === "task"
            ? tr("Tugas sudah masuk ke daftar.")
            : selected === "note"
              ? tr("Catatan sudah disimpan.")
              : tr("Masuk ke Kotak Masuk Cerdas."),
        tone: "success",
      });
      setValue("");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("licia:capture-complete"));
    } catch (error) {
      haptic("warning");
      notifyToast({
        title: "Belum tersimpan",
        message: error instanceof Error ? error.message : tr("Terjadi kesalahan."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          haptic("light");
        }}
        className="licia-v33-ripple fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-float flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl shadow-accent/20 transition duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95 md:bottom-6 md:right-6"
        aria-label={t("Simpan cepat")}
        title={t("Simpan cepat") + " (Ctrl/Cmd+Shift+L)"}
      >
        <span className="absolute inset-0 rounded-full border border-white/20 animate-licia-pulse-ring" />
        <Plus size={22} />
      </button>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        tier="modal"
        align="bottom"
        dismissible={!busy}
        labelledBy="licia-quick-capture-title"
        panelClassName="w-full max-w-lg licia-v33-sheet overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-accent">{t("Simpan cepat")}</p>
            <h2 id="licia-quick-capture-title" className="mt-1 font-display text-xl text-text">
              {t("Simpan sesuatu tanpa meninggalkan halaman ini")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("Tutup simpan cepat")}
            className="licia-v33-ripple touch-target rounded-xl border border-border bg-bg p-2 text-textMuted hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 sm:p-5">
          <div
            className="grid grid-cols-4 gap-1.5 rounded-2xl bg-bg p-1"
            role="tablist"
            aria-label={t("Simpan sebagai")}
          >
            {(["task", "note", "inbox", "ai"] as Mode[]).map((nextMode) => {
              const Icon =
                nextMode === "task"
                  ? CheckSquare
                  : nextMode === "note"
                    ? FileText
                    : nextMode === "inbox"
                      ? Inbox
                      : BrainCircuit;
              const label =
                nextMode === "task"
                  ? t("Tugas")
                  : nextMode === "note"
                    ? t("Catatan")
                    : nextMode === "inbox"
                      ? t("Inbox")
                      : "Licia";
              return (
                <button
                  key={nextMode}
                  role="tab"
                  aria-selected={mode === nextMode}
                  onClick={() => setMode(nextMode)}
                  className={clsx(
                    "licia-v33-ripple rounded-xl px-2 py-2.5 text-2xs font-semibold",
                    mode === nextMode ? "bg-surface text-accent shadow-sm" : "text-textMuted",
                  )}
                >
                  <Icon size={14} className="mx-auto mb-1" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-bg p-1">
            <textarea
              data-autofocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={5}
              aria-label={t("Isi yang akan disimpan")}
              placeholder={
                mode === "task"
                  ? t("Contoh: kirim laporan besok jam 7 malam !1")
                  : mode === "note"
                    ? t("Tulis catatan atau ide…")
                    : mode === "inbox"
                      ? t("Tulis apa pun yang ingin kamu simpan…")
                      : t("Contoh: besok jam 7 ingatkan aku membawa dokumen")
              }
              className="w-full resize-none bg-transparent px-3 py-3 text-sm text-text outline-none placeholder:text-textMuted"
            />
          </div>
          {smart ? (
            <SmartChips
              chips={smart.chips.filter((chip) => chip.kind !== "tag")}
              hint={smart.dueDate && !smart.dueTime ? t("Tanpa jam, tenggat diset pukul 09:00.") : null}
              className="mt-3"
            />
          ) : null}
          {mode === "task" && smart?.amount ? (
            <div className="mt-2">
              <MoneyAction
                amount={smart.amount}
                text={value}
                onDone={() => {
                  setValue("");
                  setOpen(false);
                }}
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs leading-relaxed text-textMuted">
              <Sparkles size={11} className="mr-1 inline text-accent" aria-hidden="true" />
              {mode === "ai"
                ? t("Licia memilih tempat penyimpanan yang paling sesuai.")
                : t("Ctrl/Cmd + Enter untuk menyimpan.")}
            </p>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !value.trim()}
              className="licia-v33-ripple min-h-11 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy ? t("Menyimpan…") : t("Simpan")}
            </button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
