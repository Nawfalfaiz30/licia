export type PushClientState =
  "unsupported" | "permission" | "subscribed" | "unsubscribed" | "denied" | "unconfigured" | "error";

function toUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function sameBytes(a: ArrayBuffer | ArrayBufferView | null | undefined, b: Uint8Array) {
  if (!a) return false;
  const view = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  return view.length === b.length && view.every((value, index) => value === b[index]);
}

async function getVapidPublicKey() {
  const response = await fetch("/api/push/vapid-public", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.vapidConfigured || !data?.publicKey)
    throw new Error(
      Array.isArray(data?.missing) && data.missing.length
        ? `VAPID belum siap: ${data.missing.join(", ")}.`
        : "VAPID server belum siap.",
    );
  return String(data.publicKey);
}

export async function getPushStatus(): Promise<PushClientState> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const vapid = await fetch("/api/push/vapid-public", { cache: "no-store" })
    .then(async (r) => (r.ok ? r.json() : { vapidConfigured: false }))
    .catch(() => ({ vapidConfigured: false }));
  // Browser subscription only needs the public VAPID key. Service-role and cron
  // determine whether the server can DELIVER/dispatch, not whether this device
  // may register its subscription.
  if (!vapid?.vapidConfigured || !vapid?.publicKey) return "unconfigured";
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return "error";
  const subscription = await registration.pushManager.getSubscription().catch(() => null);
  if (subscription) {
    try {
      const desiredKey = toUint8Array(String(vapid.publicKey));
      const currentKey = subscription.options?.applicationServerKey;
      if (currentKey && !sameBytes(currentKey, desiredKey)) return "unsubscribed";
      const rememberedKey = localStorage.getItem("licia-push-vapid-public-key");
      if (rememberedKey && rememberedKey !== String(vapid.publicKey)) return "unsubscribed";
    } catch {}
    return "subscribed";
  }
  return Notification.permission === "granted" ? "unsubscribed" : "permission";
}

export async function subscribeToLiciaPush(
  options: { forceRenew?: boolean } = {},
): Promise<{ ok: boolean; state: PushClientState; error?: string }> {
  try {
    if (!window.isSecureContext)
      return { ok: false, state: "error", error: "Notifikasi perangkat membutuhkan HTTPS atau localhost." };
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
      return { ok: false, state: "unsupported", error: "Browser ini tidak mendukung Web Push." };
    const vapidPublicKey = await getVapidPublicKey().catch((error) => {
      throw error;
    });
    // Subscription perangkat cukup membutuhkan public VAPID key. Service-role dan cron
    // diperlukan saat server benar-benar mengirim push/reminder, bukan saat browser mendaftar.
    const permission = await Notification.requestPermission();
    if (permission === "denied") return { ok: false, state: "denied", error: "Izin notifikasi ditolak oleh browser." };
    if (permission !== "granted") return { ok: false, state: "permission", error: "Izin notifikasi belum diberikan." };
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = toUint8Array(vapidPublicKey);
    let subscription = await registration.pushManager.getSubscription();
    let staleKey = Boolean(options.forceRenew);
    const currentKey = subscription?.options?.applicationServerKey;
    if (subscription && currentKey) staleKey = !sameBytes(currentKey, applicationServerKey);
    try {
      const rememberedKey = localStorage.getItem("licia-push-vapid-public-key");
      if (subscription && rememberedKey && rememberedKey !== vapidPublicKey) staleKey = true;
    } catch {}
    if (subscription && staleKey) {
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: "DELETE",
      }).catch(() => null);
      await subscription.unsubscribe().catch(() => false);
      subscription = null;
    }
    if (!subscription)
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, state: "error", error: data?.error || "Subscription push gagal disimpan." };
    try {
      localStorage.setItem("licia-push-vapid-public-key", vapidPublicKey);
    } catch {}
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
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Push gagal dimatikan." };
  }
}

export async function requestBrowserNotifications(): Promise<{
  ok: boolean;
  permission: NotificationPermission | "unsupported";
  error?: string;
}> {
  if (typeof window === "undefined" || !("Notification" in window))
    return { ok: false, permission: "unsupported", error: "Browser tidak mendukung notifikasi." };
  if (!window.isSecureContext)
    return {
      ok: false,
      permission: Notification.permission,
      error: "Notifikasi browser memerlukan HTTPS atau localhost.",
    };
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    return {
      ok: false,
      permission,
      error: permission === "denied" ? "Izin notifikasi diblokir browser." : "Izin notifikasi belum diberikan.",
    };
  try {
    localStorage.setItem("licia-browser-notifications", "true");
  } catch {}
  return { ok: true, permission };
}

export function disableBrowserNotifications() {
  try {
    localStorage.setItem("licia-browser-notifications", "false");
  } catch {}
}
