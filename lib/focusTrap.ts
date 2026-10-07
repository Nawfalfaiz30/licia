/**
 * Logika murni perangkap fokus (v0.57). Dipisah dari komponen supaya bisa diuji tanpa DOM.
 */

export const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Menentukan ke indeks mana fokus harus dipaksa saat Tab ditekan. Mengembalikan null bila
 * perilaku bawaan browser sudah benar (fokus berpindah di dalam panel).
 *
 * @param activeIndex indeks elemen terfokus dalam daftar tabbable, atau -1 bila fokus ada di luar daftar
 *                    (mis. di panel itu sendiri, atau di latar belakang).
 */
export function resolveTabTarget(activeIndex: number, count: number, shift: boolean): number | null {
  if (count <= 0) return -1; // tidak ada elemen fokus: tahan fokus di panel
  if (activeIndex < 0) return shift ? count - 1 : 0;
  if (shift && activeIndex === 0) return count - 1;
  if (!shift && activeIndex === count - 1) return 0;
  return null;
}
