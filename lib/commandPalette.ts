/** Logika murni Pusat Perintah (v0.56): penyaringan, urutan relevansi, dan gerak sorotan keyboard. */

export type PaletteEntry = { label: string; href: string };

/** Cocok di label/alamat; label yang diawali kueri diurutkan lebih dulu, lalu urutan asli (stabil). */
export function filterPalette<T extends PaletteEntry>(entries: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  const scored: Array<{ entry: T; rank: number; index: number }> = [];
  entries.forEach((entry, index) => {
    const label = entry.label.toLowerCase();
    const href = entry.href.toLowerCase();
    let rank = -1;
    if (label.startsWith(q)) rank = 0;
    else if (label.split(/[\s&]+/).some((word) => word.startsWith(q))) rank = 1;
    else if (label.includes(q)) rank = 2;
    else if (href.includes(q)) rank = 3;
    if (rank >= 0) scored.push({ entry, rank, index });
  });
  return scored.sort((a, b) => a.rank - b.rank || a.index - b.index).map((s) => s.entry);
}

/** Geser sorotan dengan wrap-around. Daftar kosong → -1. */
export function moveActive(current: number, delta: 1 | -1 | "first" | "last", length: number): number {
  if (length <= 0) return -1;
  if (delta === "first") return 0;
  if (delta === "last") return length - 1;
  const base = current < 0 || current >= length ? (delta === 1 ? -1 : 0) : current;
  return (base + delta + length) % length;
}

/* ───────── v0.57 · A2: palet perintah yang bisa menjalankan aksi ───────── */

export type PaletteMode = "all" | "task" | "inbox" | "expense" | "commands";
export type PaletteQuery = { mode: PaletteMode; text: string };

/**
 * Awalan: `t `/`+ ` buat tugas, `i ` catat ke Inbox, `$ `/`e ` catat pengeluaran, `>` hanya perintah sistem.
 * Tanpa awalan = mode "all" (halaman + perintah + hasil pencarian + tawaran membuat tugas/Inbox dari teks bebas).
 */
export function parsePaletteQuery(raw: string): PaletteQuery {
  const value = raw.replace(/^\s+/, "");
  const prefixed = /^([t+$ie>])(\s+|(?=>))(.*)$/is.exec(value);
  const lead = value[0]?.toLowerCase();
  if (value.startsWith(">")) return { mode: "commands", text: value.slice(1).trim() };
  if (prefixed && prefixed[2]) {
    const text = prefixed[3].trim();
    if (lead === "t" || lead === "+") return { mode: "task", text };
    if (lead === "i") return { mode: "inbox", text };
    if (lead === "$" || lead === "e") return { mode: "expense", text };
  }
  return { mode: "all", text: value.trim() };
}

export type CreateActionId = "create-task" | "create-inbox" | "create-expense";
/** Aksi pembuatan yang ditawarkan untuk sebuah kueri. `hasAmount` = ada nominal Rupiah di teks. */
export function createActionsFor(query: PaletteQuery, hasAmount: boolean): CreateActionId[] {
  const { mode, text } = query;
  if (!text || text.length < 2) return [];
  if (mode === "task") return ["create-task"];
  if (mode === "inbox") return ["create-inbox"];
  if (mode === "expense") return hasAmount ? ["create-expense"] : [];
  if (mode === "commands") return [];
  const out: CreateActionId[] = [];
  if (text.length >= 3) out.push("create-task", "create-inbox");
  if (hasAmount) out.push("create-expense");
  return out;
}

export type SystemCommandId = "theme-light" | "theme-dark" | "theme-system" | "lang-id" | "lang-en" | "quick-capture" | "shortcuts-help" | "start-focus" | "open-notifications";
export type SystemCommand = { id: SystemCommandId; label: string; keywords: string };
export const SYSTEM_COMMANDS: readonly SystemCommand[] = [
  { id: "theme-light", label: "Mode terang", keywords: "tema theme light terang appearance tampilan" },
  { id: "theme-dark", label: "Mode gelap", keywords: "tema theme dark gelap appearance tampilan" },
  { id: "theme-system", label: "Ikuti perangkat", keywords: "tema theme system otomatis device perangkat" },
  { id: "lang-id", label: "Bahasa Indonesia", keywords: "bahasa language indonesia ganti bahasa" },
  { id: "lang-en", label: "English", keywords: "bahasa language english inggris switch language" },
  { id: "quick-capture", label: "Simpan cepat", keywords: "capture tangkap catat simpan quick" },
  { id: "shortcuts-help", label: "Bantuan pintasan keyboard", keywords: "shortcut pintasan keyboard bantuan help" },
  { id: "start-focus", label: "Mulai sesi fokus", keywords: "focus fokus timer pomodoro mulai start" },
] as const;

/** Menyaring perintah sistem memakai label terjemahan + kata kunci (dua bahasa). */
export function filterCommands(commands: readonly SystemCommand[], query: string, translate: (label: string) => string = (x) => x): SystemCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((c) => translate(c.label).toLowerCase().includes(q) || c.label.toLowerCase().includes(q) || c.keywords.includes(q));
}
