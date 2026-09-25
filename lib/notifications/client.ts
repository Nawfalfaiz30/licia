export type PushClientState = "unsupported" | "permission" | "subscribed" | "unsubscribed" | "denied" | "unconfigured" | "error";

function toUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function getPushStatus(): Promise<PushClientState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const vapid = await fetch("/api/push/vapid-public", { cache: "no-store" }).then(async (r) => r.ok ? r.json() : ({ enabled: false })).catch(() => ({ enabled: false }));
  if (!vapid?.enabled) return "unconfigured";
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return "error";
  const subscription = await registration.pushManager.getSubscription().catch(() => null);
  return subscription ? "subscribed" : Notification.permission === "granted" ? "unsubscribed" : "permission";
}

export async function subscribeToLiciaPush(): Promise<{ ok: boolean; state: PushClientState; error?: string }> {
  try {
    if (!window.isSecureContext) return { ok: false, state: "error", error: "Notifikasi perangkat membutuhkan HTTPS atau localhost." };
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { ok: false, state: "unsupported", error: "Browser ini tidak mendukung Web Push." };
    const permission = await Notification.requestPermission();
    if (permission === "denied") return { ok: false, state: "denied", error: "Izin notifikasi ditolak oleh browser." };
    if (permission !== "granted") return { ok: false, state: "permission", error: "Izin notifikasi belum diberikan." };
    const vapidRes = await fetch("/api/push/vapid-public", { cache: "no-store" });
    const vapid = await vapidRes.json().catch(() => ({}));
    if (!vapidRes.ok || !vapid?.enabled || !vapid?.publicKey) return { ok: false, state: "unconfigured", error: "Push server belum siap. Isi VAPID + service-role + cron di server." };
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(String(vapid.publicKey)) });
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, state: "error", error: data?.error || "Subscription push gagal disimpan." };
    window.dispatchEvent(new CustomEvent("licia:push-status-change"));
    return { ok: true, state: "subscribed" };
  } catch (error) {
    return { ok: false, state: "error", error: error instanceof Error ? error.message : "Push gagal diaktifkan." };
  }
}

export async function unsubscribeFromLiciaPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    const response = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
    await subscription.unsubscribe();
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { ok: false, error: data?.error || "Subscription belum berhasil dihapus dari server." };
    }
    window.dispatchEvent(new CustomEvent("licia:push-status-change"));
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Push gagal dimatikan." }; }
}


export async function requestBrowserNotifications(): Promise<{ ok: boolean; permission: NotificationPermission | "unsupported"; error?: string }> {
  if (typeof window === "undefined" || !("Notification" in window)) return { ok: false, permission: "unsupported", error: "Browser tidak mendukung notifikasi." };
  if (!window.isSecureContext) return { ok: false, permission: Notification.permission, error: "Notifikasi browser memerlukan HTTPS atau localhost." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, permission, error: permission === "denied" ? "Izin notifikasi diblokir browser." : "Izin notifikasi belum diberikan." };
  try { localStorage.setItem("licia-browser-notifications", "true"); } catch {}
  return { ok: true, permission };
}

export function disableBrowserNotifications() {
  try { localStorage.setItem("licia-browser-notifications", "false"); } catch {}
}
