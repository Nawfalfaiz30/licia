export function haptic(kind: "light" | "selection" | "success" | "warning" | "medium" = "light") {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    const enabled = localStorage.getItem("licia-haptics");
    if (enabled === "false") return;
  } catch {}
  const native = (window as Window & { LiciaNative?: { haptic?: (kind: string) => void } }).LiciaNative;
  if (native?.haptic) {
    try { native.haptic(kind); return; } catch {}
  }
  if (typeof navigator.vibrate !== "function") return;
  const pattern = kind === "success" ? [12, 18, 12] : kind === "warning" ? [22, 14, 22] : kind === "medium" ? 18 : kind === "selection" ? 6 : 10;
  try { navigator.vibrate(pattern); } catch {}
}

export function announce(message: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const live = document.getElementById("licia-live-region") || (() => {
    const node = document.createElement("div");
    node.id = "licia-live-region";
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "true");
    node.className = "sr-only";
    document.body.appendChild(node);
    return node;
  })();
  live.textContent = "";
  window.setTimeout(() => { live.textContent = message; }, 20);
}
