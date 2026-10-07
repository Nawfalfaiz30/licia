/** Navigasi daftar dengan keyboard (A12). Logika murni agar bisa diuji; DOM ada di components/layout/ListShortcuts.tsx. */
export const LIST_ITEM_ATTR = "data-list-item";
export type ListAction = "toggle" | "edit" | "open" | "delete";
export const LIST_KEYS: Record<string, ListAction | "next" | "prev" | "first" | "last"> = {
  j: "next",
  ArrowDown: "next",
  k: "prev",
  ArrowUp: "prev",
  Home: "first",
  End: "last",
  x: "toggle",
  e: "edit",
  Enter: "open",
};

/** Indeks berikutnya; tidak berputar (berhenti di ujung) supaya posisi daftar tetap jelas. -1 = belum ada fokus. */
export function nextIndex(current: number, count: number, move: "next" | "prev" | "first" | "last"): number {
  if (count <= 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  if (current < 0) return move === "next" ? 0 : count - 1;
  return Math.max(0, Math.min(count - 1, current + (move === "next" ? 1 : -1)));
}
