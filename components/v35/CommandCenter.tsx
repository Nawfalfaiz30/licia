"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BellRing, CalendarDays, CheckSquare, Command, FileText, Globe2, Home, Inbox, Keyboard, MessageCircle, Monitor, Moon, PlusCircle, Search, Sparkles, Sun, Timer, Wallet, X, Zap, type LucideIcon } from "lucide-react";
import { SYSTEM_COMMANDS, createActionsFor, filterCommands, filterPalette, moveActive, parsePaletteQuery, type CreateActionId, type SystemCommandId } from "@/lib/commandPalette";
import { findMoneyMentions, formatRupiah, parseSmartCapture, smartDueAtIso } from "@/lib/text/smartParse";
import { applyThemePreference } from "@/lib/theme";
import { QUICK_CAPTURE_EVENT } from "@/lib/shortcuts";
import { mutateEntity } from "@/lib/sync/client";
import { notifyToast, notifyUndo } from "@/components/ui/toast";
import { useLanguage } from "@/components/LanguageProvider";

const PAGES: ReadonlyArray<readonly [string, string, LucideIcon]> = [
  ["Beranda", "/dashboard", Home], ["Rencana", "/plan", CalendarDays], ["Tugas", "/tasks", CheckSquare], ["Kalender", "/calendar", CalendarDays], ["Fokus", "/focus", Timer], ["Chat Licia", "/chat", MessageCircle], ["Tangkap", "/capture", Zap], ["Target & Proyek", "/goals-projects", Sparkles], ["Knowledge & Belajar", "/knowledge", Sparkles], ["Keuangan", "/finance", Wallet], ["Kesehatan & Rutinitas", "/wellbeing", Sparkles], ["Insights", "/insights", Sparkles], ["Pencarian", "/search", Search], ["Panduan", "/guide", Sparkles], ["Pengaturan", "/settings", Sparkles],
];
const COMMAND_ICON: Record<SystemCommandId, LucideIcon> = { "theme-light": Sun, "theme-dark": Moon, "theme-system": Monitor, "lang-id": Globe2, "lang-en": Globe2, "quick-capture": PlusCircle, "shortcuts-help": Keyboard, "start-focus": Timer, "open-notifications": BellRing };
const SEARCH_ICON: Record<string, LucideIcon> = { Tugas: CheckSquare, Inbox, Catatan: FileText };

type Row = { key: string; section: "create" | "command" | "page" | "result"; icon: LucideIcon; title: string; detail?: string; run: () => void | Promise<void> };
type SearchHit = { id: string; type: string; title: string; detail?: string; href: string };

function captureTimezone(): string {
  try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; return tz === "Asia/Makassar" || tz === "Asia/Jayapura" ? tz : "Asia/Jakarta"; } catch { return "Asia/Jakarta"; }
}

/** Pusat perintah (Ctrl/⌘+K): navigasi, aksi buat-tugas/Inbox/pengeluaran dari teks bebas, perintah sistem, dan pencarian lintas modul. */
export function CommandCenter() {
  const { tr, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const viaKeyboard = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("licia:open-command-center", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("licia:open-command-center", onOpen); };
  }, []);
  useEffect(() => { if (!open) { setQuery(""); setHits([]); } }, [open]);

  const parsed = useMemo(() => parsePaletteQuery(query), [query]);
  const amount = useMemo(() => (parsed.text ? findMoneyMentions(parsed.text)[0]?.amount ?? null : null), [parsed.text]);

  // pencarian lintas modul (hanya mode "all", ≥2 huruf)
  useEffect(() => {
    if (!open || parsed.mode !== "all" || parsed.text.length < 2) { setHits([]); return; }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(parsed.text)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        setHits(Array.isArray(data.results) ? data.results.slice(0, 6) : []);
      } catch { /* dibatalkan / offline */ }
    }, 180);
    return () => { window.clearTimeout(id); controller.abort(); };
  }, [open, parsed.mode, parsed.text]);

  const close = useCallback(() => setOpen(false), []);

  const create = useCallback(async (id: CreateActionId) => {
    const text = parsed.text;
    if (!text || busy) return;
    setBusy(true);
    try {
      if (id === "create-task") {
        const smart = parseSmartCapture(text, { timezone: captureTimezone(), stripTags: false });
        const dueAt = smartDueAtIso(smart, captureTimezone());
        const result = await mutateEntity({ entityType: "task", operation: "create", payload: { title: smart.title || text, status: "todo", priority: smart.priority ?? "medium", ...(dueAt ? { due_at: dueAt } : {}) }, offlineOk: true });
        if (!result.ok) throw new Error(result.error || tr("Perubahan gagal disimpan."));
        const createdId = result.response?.record?.id as string | undefined;
        notifyUndo({ title: tr("Tugas dibuat"), message: smart.title || text, undoLabel: tr("Urungkan"), onUndo: async () => { if (createdId) await mutateEntity({ entityType: "task", operation: "delete", entityId: createdId, payload: {} }); } });
      } else if (id === "create-inbox") {
        const result = await mutateEntity({ entityType: "inbox", operation: "create", payload: { content: text, kind: "inbox", status: "open" }, offlineOk: true });
        if (!result.ok) throw new Error(result.error || tr("Perubahan gagal disimpan."));
        const createdId = result.response?.record?.id as string | undefined;
        notifyUndo({ title: tr("Masuk ke Inbox"), message: text, undoLabel: tr("Urungkan"), onUndo: async () => { if (createdId) await mutateEntity({ entityType: "inbox", operation: "delete", entityId: createdId, payload: {} }); } });
      } else if (amount) {
        const smart = parseSmartCapture(text, { timezone: captureTimezone(), stripTags: false });
        const category = smart.tags[0] || tr("Umum");
        const result = await mutateEntity({ entityType: "expense", operation: "create", payload: { amount, note: smart.title.slice(0, 120) || text.slice(0, 120), category, account_id: null } });
        if (!result.ok) throw new Error(result.error || tr("Perubahan gagal disimpan."));
        const createdId = result.response?.record?.id as string | undefined;
        notifyUndo({ title: tr("Pengeluaran dicatat"), message: `${formatRupiah(amount)} · ${category}`, undoLabel: tr("Urungkan"), onUndo: async () => { if (createdId) await mutateEntity({ entityType: "expense", operation: "delete", entityId: createdId, payload: {} }); } });
      }
      setOpen(false);
    } catch (error) {
      notifyToast({ title: tr("Aksi belum berhasil"), message: error instanceof Error ? error.message : tr("Terjadi kesalahan."), tone: "error" });
    } finally { setBusy(false); }
  }, [parsed.text, amount, busy, tr]);

  const runCommand = useCallback((id: SystemCommandId) => {
    setOpen(false);
    if (id === "theme-light") applyThemePreference("light");
    else if (id === "theme-dark") applyThemePreference("dark");
    else if (id === "theme-system") applyThemePreference("system");
    else if (id === "lang-id") setLanguage("id");
    else if (id === "lang-en") setLanguage("en");
    else if (id === "quick-capture") window.setTimeout(() => window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT)), 60);
    else if (id === "shortcuts-help") window.setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" })), 60);
    else if (id === "start-focus") router.push("/focus");
  }, [router, setLanguage]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const createIcon: Record<CreateActionId, LucideIcon> = { "create-task": CheckSquare, "create-inbox": Inbox, "create-expense": Wallet };
    const createTitle: Record<CreateActionId, string> = {
      "create-task": tr("Buat tugas: {0}", [parsed.text]),
      "create-inbox": tr("Catat ke Inbox: {0}", [parsed.text]),
      "create-expense": tr("Catat pengeluaran {0}", [amount ? formatRupiah(amount) : ""]),
    };
    for (const id of createActionsFor(parsed, amount !== null)) out.push({ key: id, section: "create", icon: createIcon[id], title: createTitle[id], detail: id === "create-task" ? tr("Tanggal, jam, dan prioritas dikenali otomatis") : undefined, run: () => create(id) });
    if (parsed.mode === "all" || parsed.mode === "commands") {
      for (const command of filterCommands(SYSTEM_COMMANDS, parsed.mode === "commands" ? parsed.text : parsed.text, (label) => tr(label)).slice(0, parsed.mode === "commands" ? 12 : 4)) {
        out.push({ key: command.id, section: "command", icon: COMMAND_ICON[command.id], title: tr(command.label), run: () => runCommand(command.id) });
      }
    }
    if (parsed.mode === "all") {
      const byHref = new Map(PAGES.map((p) => [p[1], p]));
      for (const entry of filterPalette(PAGES.map(([label, href]) => ({ label: `${label} ${tr(label)}`, href })), parsed.text).map((e) => byHref.get(e.href)!)) {
        out.push({ key: entry[1], section: "page", icon: entry[2], title: tr(entry[0]), detail: entry[1], run: () => { setOpen(false); router.push(entry[1]); } });
      }
      for (const hit of hits) out.push({ key: `hit-${hit.type}-${hit.id}`, section: "result", icon: SEARCH_ICON[hit.type] ?? Search, title: hit.title, detail: `${tr(hit.type)}${hit.detail ? " · " + tr(hit.detail) : ""}`, run: () => { setOpen(false); router.push(hit.href); } });
    }
    return out;
  }, [parsed, amount, hits, tr, create, runCommand, router]);

  useEffect(() => { setActive(rows.length ? 0 : -1); }, [rows.length, query]);
  useEffect(() => { if (viaKeyboard.current && active >= 0) document.getElementById(`licia-cmd-opt-${active}`)?.scrollIntoView?.({ block: "nearest" }); }, [active]);

  const activeId = active >= 0 && rows[active] ? `licia-cmd-opt-${active}` : undefined;
  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) viaKeyboard.current = true;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => moveActive(i, 1, rows.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => moveActive(i, -1, rows.length)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(moveActive(active, "first", rows.length)); }
    else if (event.key === "End") { event.preventDefault(); setActive(moveActive(active, "last", rows.length)); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Enter" && !event.nativeEvent.isComposing) { const row = rows[active >= 0 ? active : 0]; if (row) { event.preventDefault(); void row.run(); } }
  };

  const SECTION: Record<Row["section"], string> = { create: "Buat sekarang", command: "Perintah", page: "Halaman", result: "Hasil pencarian" };
  return <>
    <button onClick={() => setOpen(true)} className="fixed right-20 top-3 z-nav hidden min-h-9 items-center gap-2 rounded-xl border border-border bg-surface/90 px-2.5 text-[11px] font-semibold text-textMuted shadow-sm backdrop-blur md:flex" aria-label={tr("Buka pusat perintah")}><Command size={13} /><span>{tr("Ctrl K")}</span></button>
    {open && <div className="fixed inset-0 z-palette flex items-start justify-center bg-black/45 p-3 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-label={tr("Pusat perintah")} className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-2xl animate-licia-sheet-in">
        <div className="flex items-center gap-2 border-b border-border p-3"><Search size={17} className="text-textMuted" /><input data-autofocus autoFocus role="combobox" aria-expanded="true" aria-controls="licia-cmd-list" aria-autocomplete="list" aria-activedescendant={activeId} aria-label={tr("Cari halaman atau aksi")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKey} placeholder={tr("Cari, atau ketik 't beli kopi besok' untuk membuat tugas…")} className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none" /><button onClick={close} aria-label={tr("Tutup pusat perintah")} className="rounded-xl p-2 text-textMuted hover:text-text"><X size={16} aria-hidden="true" /></button></div>
        <div id="licia-cmd-list" role="listbox" aria-label={tr("Hasil")} className="max-h-[55vh] overflow-y-auto p-2">
          {rows.map((row, index) => {
            const Icon = row.icon;
            const heading = index === 0 || rows[index - 1].section !== row.section ? <p role="presentation" className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[.1em] text-textMuted">{tr(SECTION[row.section])}</p> : null;
            return <div key={row.key}>{heading}
              <div id={`licia-cmd-opt-${index}`} role="option" aria-selected={index === active} tabIndex={-1} onClick={() => void row.run()} onMouseMove={() => { viaKeyboard.current = false; setActive(index); }} className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 transition hover:bg-bg ${index === active ? "bg-bg ring-1 ring-accent/30" : ""}`}>
                <span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Icon size={15} /></span>
                <span className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-text">{row.title}</p>{row.detail && <p className="truncate text-[11px] text-textMuted">{row.detail}</p>}</span>
                <ArrowRight size={13} className="text-textMuted" />
              </div></div>;
          })}
          {!rows.length && <div className="p-8 text-center text-xs text-textMuted">{tr("Tidak ada perintah yang cocok.")}</div>}
        </div>
        <div className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-textMuted">{tr("Esc menutup · ↑↓ memilih · Enter menjalankan · t / i / $ + teks = buat tugas / Inbox / pengeluaran · > = perintah")}</div>
      </div>
    </div>}
  </>;
}
