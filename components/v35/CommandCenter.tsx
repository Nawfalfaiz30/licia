"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckSquare,
  CircleHelp,
  Command,
  Download,
  Globe,
  Home,
  Inbox,
  Keyboard,
  ListChecks,
  LogOut,
  MessageCircle,
  Moon,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Sun,
  Target,
  Timer,
  Type,
  Wallet,
  Zap,
  HeartPulse,
  X,
  type LucideIcon,
} from "lucide-react";
import { clsx } from "clsx";
import { Overlay } from "@/components/ui/Overlay";
import { useLanguage } from "@/components/LanguageProvider";
import { notifyToast } from "@/components/ui/toast";
import { composePalette, moveActive, parsePaletteQuery, type PaletteItem } from "@/lib/commandPalette";
import {
  PALETTE_OPEN_EVENT,
  QUICK_CAPTURE_EVENT,
  SHORTCUTS_HELP_EVENT,
  type QuickCaptureRequest,
} from "@/lib/shortcuts";
import { parseSmartCapture } from "@/lib/text/smartParse";
import { captureTimezone } from "@/lib/ui/captureTimezone";
import { createTaskFromText, deleteTaskById } from "@/lib/ui/taskCapture";
import { toastWithUndo } from "@/lib/ui/undoToast";
import { TEXT_SCALES, applyTextScale, applyThemePreference, resolveTextScale, type TextScale } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/interaction";

type PageDef = { label: string; href: string; icon: LucideIcon; keywords: string };
const PAGES: PageDef[] = [
  { label: "Hari Ini", href: "/today", icon: Home, keywords: "home dashboard today" },
  { label: "Rencana", href: "/plan", icon: ListChecks, keywords: "plan planner inbox" },
  { label: "Tugas", href: "/tasks", icon: CheckSquare, keywords: "tasks todo kanban matriks matrix" },
  { label: "Kalender", href: "/calendar", icon: CalendarDays, keywords: "calendar agenda schedule" },
  { label: "Fokus", href: "/focus", icon: Timer, keywords: "focus pomodoro" },
  { label: "Chat Licia", href: "/chat", icon: MessageCircle, keywords: "chat ai assistant" },
  { label: "Tangkap", href: "/capture", icon: Zap, keywords: "capture voice scan" },
  { label: "Target & Proyek", href: "/goals-projects", icon: Target, keywords: "goals projects" },
  { label: "Knowledge & Belajar", href: "/knowledge", icon: BrainCircuit, keywords: "knowledge notes learning memory" },
  { label: "Keuangan", href: "/finance", icon: Wallet, keywords: "finance money budget expense" },
  { label: "Kesehatan & Rutinitas", href: "/wellbeing", icon: HeartPulse, keywords: "health habits wellbeing sleep" },
  { label: "Insights", href: "/insights", icon: BarChart3, keywords: "insights analytics review" },
  { label: "Pencarian", href: "/search", icon: Search, keywords: "search find" },
  { label: "Panduan", href: "/guide", icon: CircleHelp, keywords: "guide help" },
  { label: "Pengaturan", href: "/settings", icon: Settings, keywords: "settings preferences" },
];

type CommandDef = { id: string; label: string; icon: LucideIcon; keywords: string };
const COMMANDS: CommandDef[] = [
  { id: "new-task", label: "Buat tugas baru", icon: Plus, keywords: "new task create add" },
  { id: "new-note", label: "Buat catatan cepat", icon: StickyNote, keywords: "new note create add" },
  { id: "new-inbox", label: "Simpan ke Inbox", icon: Inbox, keywords: "inbox capture save" },
  { id: "theme-light", label: "Tema terang", icon: Sun, keywords: "theme light mode" },
  { id: "theme-dark", label: "Tema gelap", icon: Moon, keywords: "theme dark mode" },
  { id: "theme-system", label: "Tema ikut perangkat", icon: Monitor, keywords: "theme system auto" },
  {
    id: "language-toggle",
    label: "Ganti bahasa Indonesia / English",
    icon: Globe,
    keywords: "language bahasa english indonesia",
  },
  { id: "text-bigger", label: "Perbesar ukuran teks", icon: Type, keywords: "text size bigger larger font" },
  { id: "text-smaller", label: "Perkecil ukuran teks", icon: Type, keywords: "text size smaller font" },
  { id: "sync-now", label: "Sinkronkan sekarang", icon: RefreshCw, keywords: "sync refresh" },
  { id: "shortcuts", label: "Lihat pintasan keyboard", icon: Keyboard, keywords: "shortcuts keyboard help" },
  { id: "export", label: "Buka ekspor & cadangan data", icon: Download, keywords: "export backup data" },
  { id: "logout", label: "Keluar", icon: LogOut, keywords: "logout sign out" },
];

const TYPE_ICON: Record<string, LucideIcon> = {
  Tugas: CheckSquare,
  Proyek: Target,
  Target,
  Catatan: StickyNote,
  Inbox,
  Bacaan: BookOpen,
  Kalender: CalendarDays,
};

type Remote = { id: string; type: string; title: string; detail?: string; href: string };

export function CommandCenter() {
  const { t: tr } = useLanguage();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<Remote[]>([]);
  const [searching, setSearching] = useState(false);
  const viaKeyboard = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemote([]);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  const { scope, text } = useMemo(() => parsePaletteQuery(query), [query]);

  // Pencarian data lintas modul (/api/search) — ditunda 200 md, dibatalkan bila kueri berubah.
  useEffect(() => {
    if (!open || (scope !== "all" && scope !== "data") || text.length < 2 || !navigator.onLine) {
      setRemote([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = res.ok ? await res.json() : { results: [] };
        setRemote(Array.isArray(data.results) ? data.results.slice(0, 12) : []);
      } catch {
        /* dibatalkan atau offline */
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, scope, text]);

  const pageItems = useMemo<PaletteItem[]>(
    () =>
      PAGES.map((p) => ({
        id: `page:${p.href}`,
        kind: "page",
        label: t(p.label),
        keywords: `${p.label} ${p.keywords}`,
        hint: p.href,
        href: p.href,
        group: t("Halaman"),
      })),
    [t],
  );
  const commandItems = useMemo<PaletteItem[]>(
    () =>
      COMMANDS.map((c) => ({
        id: `cmd:${c.id}`,
        kind: "command",
        commandId: c.id,
        label: t(c.label),
        keywords: `${c.label} ${c.keywords}`,
        group: t("Aksi"),
      })),
    [t],
  );
  const resultItems = useMemo<PaletteItem[]>(
    () =>
      remote.map((r) => ({
        id: `res:${r.type}:${r.id}`,
        kind: "result",
        label: r.title,
        hint: [t(r.type), r.detail ? t(r.detail) : ""].filter(Boolean).join(" · "),
        href: r.href,
        keywords: r.type,
        group: t("Hasil pencarian"),
      })),
    [remote, t],
  );

  const createTask = useMemo<PaletteItem | null>(() => {
    if (scope !== "all" || text.length < 3) return null;
    const parsed = parseSmartCapture(text, { timezone: captureTimezone(), stripTags: false, lang: language });
    const detail = parsed.chips
      .filter((c) => c.kind !== "tag" && c.kind !== "money")
      .map((c) => c.label)
      .join(" · ");
    return {
      id: "create-task",
      kind: "create-task",
      label: t("Buat tugas: {title}", { title: parsed.title || text }),
      hint: detail || t("Tugas baru"),
      payload: text,
      group: t("Buat"),
    };
  }, [scope, text, language, t]);

  const composed = useMemo(
    () => composePalette({ query, pages: pageItems, commands: commandItems, results: resultItems, createTask }),
    [query, pageItems, commandItems, resultItems, createTask],
  );
  const items = composed.items;

  useEffect(() => {
    setActive(items.length ? 0 : -1);
  }, [items.length, query]);
  useEffect(() => {
    if (viaKeyboard.current && active >= 0)
      document.getElementById(`licia-cmd-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const runCommand = useCallback(
    async (id: string) => {
      const quick = (detail: QuickCaptureRequest) =>
        window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT, { detail }));
      const cycleScale = (dir: 1 | -1) => {
        const current = resolveTextScale(document.documentElement.dataset.textScale);
        const next = TEXT_SCALES[
          Math.max(0, Math.min(TEXT_SCALES.length - 1, TEXT_SCALES.indexOf(current) + dir))
        ] as TextScale;
        applyTextScale(next);
        notifyToast({
          title: "Ukuran teks diubah",
          message:
            next === "small"
              ? tr("Kecil")
              : next === "normal"
                ? tr("Normal")
                : next === "large"
                  ? tr("Besar")
                  : tr("Sangat besar"),
          tone: "info",
          duration: 1800,
        });
      };
      switch (id) {
        case "new-task":
          quick({ mode: "task" });
          break;
        case "new-note":
          quick({ mode: "note" });
          break;
        case "new-inbox":
          quick({ mode: "inbox" });
          break;
        case "theme-light":
        case "theme-dark":
        case "theme-system": {
          const mode = id.replace("theme-", "");
          applyThemePreference(mode);
          notifyToast({
            title:
              mode === "light"
                ? tr("Tema terang aktif")
                : mode === "dark"
                  ? tr("Tema gelap aktif")
                  : tr("Tema mengikuti perangkat"),
            tone: "info",
            duration: 1800,
          });
          break;
        }
        case "language-toggle": {
          const next = language === "id" ? "en" : "id";
          const { applyLanguage } = await import("@/lib/i18n");
          applyLanguage(next);
          notifyToast({
            title: next === "en" ? tr("Language: English") : tr("Bahasa: Indonesia"),
            tone: "info",
            duration: 1800,
          });
          break;
        }
        case "text-bigger":
          cycleScale(1);
          break;
        case "text-smaller":
          cycleScale(-1);
          break;
        case "sync-now":
          window.dispatchEvent(new CustomEvent("licia:sync-request"));
          notifyToast({ title: "Sinkronisasi dimulai", tone: "info", duration: 1800 });
          break;
        case "shortcuts":
          window.dispatchEvent(new CustomEvent(SHORTCUTS_HELP_EVENT));
          break;
        case "export":
          router.push("/settings#data");
          break;
        case "logout":
          await createClient().auth.signOut();
          router.replace("/login");
          router.refresh();
          break;
      }
    },
    [language, router],
  );

  const choose = useCallback(
    async (item: PaletteItem) => {
      haptic("selection");
      close();
      if (item.kind === "page" || item.kind === "result") {
        if (item.href) router.push(item.href);
        return;
      }
      if (item.kind === "command" && item.commandId) {
        // Perintah yang membuka overlay lain ditunda satu frame agar palet selesai menutup dan fokus kembali dulu.
        window.setTimeout(() => void runCommand(item.commandId!), 30);
        return;
      }
      if (item.kind === "create-task" && item.payload) {
        const created = await createTaskFromText(item.payload, language);
        if (!created.ok) {
          notifyToast({ title: "Belum tersimpan", message: created.error, tone: "error" });
          return;
        }
        haptic("success");
        if (created.id && !created.queued) {
          toastWithUndo({
            title: t("Tugas dibuat"),
            message: created.title,
            undoLabel: t("Urungkan"),
            revert: async () => {
              await deleteTaskById(created.id!);
              window.dispatchEvent(new CustomEvent("licia:capture-complete"));
            },
          });
        } else {
          notifyToast({
            title: created.queued ? tr("Disimpan di perangkat") : tr("Tugas dibuat"),
            message: created.title,
            tone: "success",
          });
        }
        window.dispatchEvent(new CustomEvent("licia:capture-complete"));
      }
    },
    [close, language, router, runCommand, t],
  );

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) viaKeyboard.current = true;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => moveActive(i, 1, items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => moveActive(i, -1, items.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(moveActive(active, "first", items.length));
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(moveActive(active, "last", items.length));
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      const target = items[active >= 0 ? active : 0];
      if (target) {
        event.preventDefault();
        void choose(target);
      }
    }
  };

  const activeId = active >= 0 && items[active] ? `licia-cmd-opt-${active}` : undefined;
  const iconFor = (item: PaletteItem): LucideIcon => {
    if (item.kind === "create-task") return Plus;
    if (item.kind === "page") return PAGES.find((p) => p.href === item.href)?.icon ?? Sparkles;
    if (item.kind === "command") return COMMANDS.find((c) => c.id === item.commandId)?.icon ?? Sparkles;
    return TYPE_ICON[(item.keywords ?? "").trim()] ?? Search;
  };

  // Kelompokkan untuk tampilan, mempertahankan indeks datar (untuk keyboard).
  const groups: Array<{ name: string; rows: Array<{ item: PaletteItem; index: number }> }> = [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.rows.push({ item, index });
    else groups.push({ name: item.group, rows: [{ item, index }] });
  });

  const placeholder =
    scope === "commands"
      ? t("Cari perintah…")
      : scope === "pages"
        ? t("Cari halaman…")
        : scope === "data"
          ? t("Cari catatan, tugas, proyek…")
          : t("Ketik untuk mencari, atau tulis tugas baru…");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-20 top-3 z-header hidden min-h-9 items-center gap-2 rounded-xl border border-border bg-surface/90 px-2.5 text-2xs font-semibold text-textMuted shadow-sm backdrop-blur md:flex"
        aria-label={t("Buka pusat perintah")}
      >
        <Command size={13} aria-hidden="true" />
        <span>{tr("Ctrl K")}</span>
      </button>
      <Overlay
        open={open}
        onClose={close}
        tier="palette"
        align="top"
        label={t("Pusat perintah")}
        panelClassName="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-2xl animate-licia-sheet-in"
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <Search size={17} className="text-textMuted" aria-hidden="true" />
          <input
            data-autofocus
            role="combobox"
            aria-expanded="true"
            aria-controls="licia-cmd-list"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label={t("Cari halaman atau aksi")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-textMuted"
          />
          {scope !== "all" && (
            <span className="rounded-lg bg-accent/10 px-2 py-1 text-2xs font-bold text-accent">
              {scope === "commands" ? t("Perintah") : scope === "pages" ? t("Halaman") : t("Data")}
            </span>
          )}
          {searching && (
            <span className="text-2xs text-textMuted" role="status">
              {t("Mencari…")}
            </span>
          )}
          <button
            onClick={close}
            aria-label={t("Tutup pusat perintah")}
            className="rounded-xl p-2 text-textMuted hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div id="licia-cmd-list" role="listbox" aria-label={t("Hasil")} className="max-h-[55vh] overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <p className="px-3 pb-1 pt-2 text-2xs font-bold uppercase tracking-[.14em] text-textMuted">
                {group.name}
              </p>
              {group.rows.map(({ item, index }) => {
                const Icon = iconFor(item);
                return (
                  <div
                    key={item.id}
                    id={`licia-cmd-opt-${index}`}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    onClick={() => void choose(item)}
                    onMouseMove={() => {
                      viaKeyboard.current = false;
                      setActive(index);
                    }}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 rounded-xl p-3 transition hover:bg-bg",
                      index === active && "bg-bg ring-1 ring-accent/30",
                    )}
                  >
                    <span className="rounded-xl bg-accent/10 p-2.5 text-accent">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-text">{item.label}</p>
                      {item.hint && <p className="truncate text-2xs text-textMuted">{item.hint}</p>}
                    </span>
                    <ArrowRight size={13} className="text-textMuted" aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          ))}
          {!items.length && (
            <div className="p-8 text-center text-xs text-textMuted">
              {searching ? t("Mencari…") : t("Tidak ada yang cocok.")}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-2xs text-textMuted">
          <span>{t("Esc menutup · ↑↓ memilih · Enter menjalankan")}</span>
          <span className="ml-auto">
            <kbd className="licia-kbd">&gt;</kbd> {t("perintah")} · <kbd className="licia-kbd">/</kbd> {t("halaman")} ·{" "}
            <kbd className="licia-kbd">?</kbd> {t("data")}
          </span>
        </div>
      </Overlay>
    </>
  );
}
