/**
 * Logika murni perangkap fokus (v0.57). Dipisah dari hook React supaya bisa diuji tanpa DOM.
 *
 * Aturan: Tab pada elemen terakhir kembali ke yang pertama, Shift+Tab pada elemen pertama
 * lompat ke yang terakhir. Bila tidak ada elemen yang bisa difokuskan, fokus tetap di kontainer.
 */

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export type TrapDecision = "first" | "last" | "container" | "native";

/**
 * Menentukan ke mana fokus harus diarahkan saat Tab ditekan.
 * @param activeIndex indeks elemen aktif di daftar fokusable (-1 bila di luar daftar / kontainer)
 */
export function decideTabTarget(activeIndex: number, count: number, shift: boolean): TrapDecision {
  if (count <= 0) return "container";
  if (activeIndex < 0) return shift ? "last" : "first";
  if (shift && activeIndex === 0) return "last";
  if (!shift && activeIndex === count - 1) return "first";
  return "native";
}

/** Tumpukan overlay terbuka — hanya yang paling atas yang menangani Esc/Tab. */
const stack: string[] = [];
export function pushOverlay(id: string) {
  if (!stack.includes(id)) stack.push(id);
}
export function popOverlay(id: string) {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
}
export function isTopOverlay(id: string) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
export function overlayDepth() {
  return stack.length;
}

/** Skala z-index bertoken (A4). Gunakan konstanta ini, bukan angka acak per komponen. */
export const Z = {
  topbar: 100,
  nav: 110,
  sheet: 160,
  modal: 200,
  palette: 220,
  toast: 260,
} as const;
