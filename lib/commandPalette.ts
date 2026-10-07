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

/* ------------------------------------------------------------------ */
/* v0.57 — palet aksi: perintah ">", halaman "/", data "?" + buat tugas */
/* ------------------------------------------------------------------ */

export type PaletteScope = "all" | "commands" | "pages" | "data";
export type PaletteKind = "create-task" | "command" | "page" | "result";

export type PaletteItem = {
  id: string;
  kind: PaletteKind;
  label: string;
  /** Kata kunci tambahan yang ikut dicocokkan (mis. label dalam bahasa lain). */
  keywords?: string;
  hint?: string;
  href?: string;
  commandId?: string;
  /** Teks mentah (untuk create-task). */
  payload?: string;
  group: string;
};

/** Awalan: ">" perintah, "/" halaman, "?" cari data. Selain itu: semuanya. */
export function parsePaletteQuery(raw: string): { scope: PaletteScope; text: string } {
  const trimmed = String(raw ?? "").replace(/^\s+/, "");
  const head = trimmed.charAt(0);
  if (head === ">") return { scope: "commands", text: trimmed.slice(1).trim() };
  if (head === "/") return { scope: "pages", text: trimmed.slice(1).trim() };
  if (head === "?") return { scope: "data", text: trimmed.slice(1).trim() };
  return { scope: "all", text: trimmed.trim() };
}

function match<T extends PaletteItem>(items: readonly T[], text: string): T[] {
  return filterPalette(
    items.map((item) => ({ ...item, href: `${item.keywords ?? ""} ${item.href ?? ""}`.trim() })),
    text,
  )
    .map((hit) => items.find((item) => item.id === hit.id)!)
    .filter(Boolean);
}

export const PALETTE_DEFAULT_COMMANDS = 5;
export const PALETTE_MAX_PER_GROUP = 6;

/**
 * Menyusun daftar akhir yang tampil. Aturan penempatan "Buat tugas" (agar Enter pada teks bebas berarti sesuatu):
 *  - bila ada halaman/perintah yang cocok → "Buat tugas" tampil SETELAH keduanya (jangan menyaingi navigasi);
 *  - bila tidak ada yang cocok → "Buat tugas" tampil paling atas.
 */
export function composePalette(input: {
  query: string;
  pages: readonly PaletteItem[];
  commands: readonly PaletteItem[];
  results: readonly PaletteItem[];
  createTask: PaletteItem | null;
}): { scope: PaletteScope; text: string; items: PaletteItem[] } {
  const { scope, text } = parsePaletteQuery(input.query);
  const items: PaletteItem[] = [];
  if (scope === "commands") {
    items.push(...match(input.commands, text));
  } else if (scope === "pages") {
    items.push(...match(input.pages, text));
  } else if (scope === "data") {
    items.push(...input.results);
  } else if (!text) {
    items.push(...input.commands.slice(0, PALETTE_DEFAULT_COMMANDS), ...input.pages);
  } else {
    const pages = match(input.pages, text).slice(0, PALETTE_MAX_PER_GROUP);
    const commands = match(input.commands, text).slice(0, PALETTE_MAX_PER_GROUP);
    const create = input.createTask ? [input.createTask] : [];
    if (pages.length + commands.length === 0) items.push(...create, ...input.results);
    else items.push(...pages, ...commands, ...create, ...input.results);
  }
  return { scope, text, items };
}
