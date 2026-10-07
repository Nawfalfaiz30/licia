/**
 * Pintasan keyboard Licia (v0.56). Logika dipisah dari komponen supaya bisa diuji.
 *
 * Pola "g lalu <huruf>" (seperti Gmail/GitHub) untuk berpindah halaman, "n" untuk Simpan Cepat,
 * dan "?" untuk bantuan. Semuanya dinonaktifkan saat pengguna sedang mengetik.
 */

export const SEQUENCE_TIMEOUT_MS = 1200;
export const QUICK_CAPTURE_EVENT = "licia:open-quick-capture";

export type GoTarget = { href: string; label: string };

export const GO_TO: Record<string, GoTarget> = {
  d: { href: "/today", label: "Hari Ini" },
  p: { href: "/plan", label: "Rencana" },
  c: { href: "/chat", label: "Chat Licia" },
  t: { href: "/tasks", label: "Tugas" },
  a: { href: "/calendar", label: "Kalender (agenda)" },
  f: { href: "/focus", label: "Fokus" },
  g: { href: "/goals-projects", label: "Target & Proyek" },
  k: { href: "/knowledge", label: "Knowledge & Belajar" },
  m: { href: "/finance", label: "Keuangan (money)" },
  w: { href: "/wellbeing", label: "Kesehatan & Rutinitas" },
  i: { href: "/insights", label: "Insights" },
  s: { href: "/settings", label: "Pengaturan" },
  "/": { href: "/search", label: "Pencarian" },
};

export function resolveGoTo(key: string): GoTarget | null {
  const k = String(key || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(GO_TO, k) ? GO_TO[k] : null;
}

/** True bila fokus ada di kolom ketik — pintasan satu huruf tidak boleh aktif di sana. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null;
  if (!el || typeof el !== "object") return false;
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

export type ShortcutGroup = { title: string; items: Array<{ keys: string[]; label: string }> };

export const SHORTCUT_HELP: ShortcutGroup[] = [
  {
    title: "Umum",
    items: [
      { keys: ["Ctrl/⌘", "K"], label: "Buka pusat perintah" },
      { keys: ["Ctrl/⌘", "Shift", "L"], label: "Simpan cepat" },
      { keys: ["N"], label: "Simpan cepat (di luar kolom ketik)" },
      { keys: ["?"], label: "Tampilkan bantuan pintasan ini" },
      { keys: ["Esc"], label: "Tutup dialog atau panel" },
    ],
  },
  {
    title: "Daftar tugas",
    items: [
      { keys: ["J"], label: "Tugas berikutnya" },
      { keys: ["K"], label: "Tugas sebelumnya" },
      { keys: ["X"], label: "Tandai selesai / buka lagi" },
      { keys: ["E"], label: "Ubah tugas" },
      { keys: ["Enter"], label: "Buka / tutup detail" },
      { keys: ["#"], label: "Hapus (bisa diurungkan)" },
      { keys: ["Ctrl/⌘", "Z"], label: "Urungkan aksi terakhir di notifikasi" },
    ],
  },
  {
    title: "Palet perintah",
    items: [
      { keys: [">"], label: "Hanya perintah (tema, bahasa, ukuran teks…)" },
      { keys: ["/"], label: "Hanya halaman" },
      { keys: ["?"], label: "Cari data di semua modul" },
    ],
  },
  {
    title: "Pindah halaman (tekan G, lalu huruf)",
    items: Object.entries(GO_TO).map(([key, target]) => ({ keys: ["G", key === "/" ? "/" : key.toUpperCase()], label: target.label })),
  },
];

/** Event kustom v0.57: dibuka dari palet, dibaca KeyboardShortcuts. */
export const SHORTCUTS_HELP_EVENT = "licia:open-shortcuts";
export const PALETTE_OPEN_EVENT = "licia:open-palette";
/** detail: { mode?: "task" | "note" | "inbox" | "ai"; text?: string } */
export type QuickCaptureRequest = { mode?: "task" | "note" | "inbox" | "ai"; text?: string };
