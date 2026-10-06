/**
 * Pengelola tumpukan overlay (v0.57): hanya overlay paling atas yang merespons Esc/Tab, dan
 * penguncian scroll + `inert` latar memakai penghitung agar overlay bersarang tidak saling menimpa.
 */

const stack: string[] = [];
let scrollLocks = 0;
let savedOverflow = "";
let inertLocks = 0;

export const APP_ROOT_ID = "licia-app";

export function pushOverlay(id: string) {
  if (!stack.includes(id)) stack.push(id);
}
export function removeOverlay(id: string) {
  const index = stack.indexOf(id);
  if (index >= 0) stack.splice(index, 1);
}
export function isTopOverlay(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
export function overlayDepth(): number {
  return stack.length;
}

export function lockScroll() {
  if (typeof document === "undefined") return;
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}
export function unlockScroll() {
  if (typeof document === "undefined" || scrollLocks === 0) return;
  scrollLocks -= 1;
  if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
}

/** Menandai latar aplikasi `inert` selama ada overlay modal, sehingga fokus/pembaca layar tidak "bocor". */
export function lockBackground() {
  if (typeof document === "undefined") return;
  inertLocks += 1;
  document.getElementById(APP_ROOT_ID)?.setAttribute("inert", "");
}
export function unlockBackground() {
  if (typeof document === "undefined" || inertLocks === 0) return;
  inertLocks -= 1;
  if (inertLocks === 0) document.getElementById(APP_ROOT_ID)?.removeAttribute("inert");
}

/** Hanya untuk tes. */
export function __resetOverlayState() {
  stack.length = 0;
  scrollLocks = 0;
  inertLocks = 0;
}
