"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, CloudUpload, Download, RefreshCw, WifiOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  countOfflineActions,
  listOfflineActions,
  removeOfflineAction,
  requestBackgroundSync,
  type OfflineAction,
  getDeviceId,
  saveOfflineConflict,
} from "@/lib/pwa/offlineQueue";

import { useLanguage } from "@/components/LanguageProvider";
const INSTALL_DISMISSED = "licia-pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PWARegister() {
  const { t: tr } = useLanguage();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [isIOSInstall, setIsIOSInstall] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const flushingRef = useRef(false);

  async function refreshQueueCount() {
    try {
      setQueued(await countOfflineActions());
    } catch {
      setQueued(0);
    }
  }

  async function flushQueue() {
    if (flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const actions = await listOfflineActions();
      if (!actions.length) return;
      let conflictStrategy = "server";
      try {
        const stored = localStorage.getItem("licia-conflict-strategy");
        if (["server", "latest", "manual", "smart"].includes(stored || "")) conflictStrategy = stored || "server";
      } catch {}
      for (const action of actions) {
        try {
          const payload =
            action.type === "quick_capture"
              ? action.payload.mode === "task"
                ? { title: action.payload.content, status: "todo", priority: "medium" }
                : { content: action.payload.content }
              : action.payload;
          const result = await fetch("/api/sync/mutation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              mutationId: action.id,
              deviceId: action.deviceId || getDeviceId(),
              entityType: action.entityType,
              operation: action.operation,
              entityId: action.entityId,
              baseVersion: action.baseVersion ?? null,
              clientUpdatedAt: action.clientUpdatedAt || action.createdAt,
              payload,
              conflictStrategy: action.conflictStrategy || conflictStrategy,
            }),
          });
          const data = await result.json().catch(() => ({}));
          if (result.ok || data?.replayed) {
            await removeOfflineAction(action.id);
          } else if (result.status === 409 && data?.conflict) {
            await saveOfflineConflict({
              actionId: action.id,
              userId: action.userId,
              error: "SYNC_CONFLICT",
              response: data,
            });
            await removeOfflineAction(action.id);
          } else if (result.status >= 500 || !navigator.onLine) {
            break;
          }
        } catch {
          if (!navigator.onLine) break;
        }
      }
      window.dispatchEvent(new CustomEvent("licia:sync-complete"));
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      await refreshQueueCount();
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshQueueCount();

    const onOnline = () => {
      setOnline(true);
      void flushQueue();
    };
    const onOffline = () => setOnline(false);
    const onQueueChange = () => {
      void refreshQueueCount();
      void requestBackgroundSync();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void flushQueue();
    };
    const onFocus = () => void flushQueue();
    const onSyncRequest = () => void flushQueue();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("licia:offline-queue-change", onQueueChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("licia:sync-request", onSyncRequest);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("licia:offline-queue-change", onQueueChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("licia:sync-request", onSyncRequest);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let controllerChanged = false;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        if (cancelled) return;
        registrationRef.current = registration;

        const markWaiting = () => {
          if (registration.waiting && navigator.serviceWorker.controller) setShowUpdate(true);
        };

        markWaiting();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) markWaiting();
          });
        });

        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "LICIA_OFFLINE_SYNC" || event.data?.type === "LICIA_OFFLINE_SYNC_COMPLETE") {
            void flushQueue();
            window.dispatchEvent(new CustomEvent("licia:sync-complete", { detail: event.data?.result }));
          }
          if (event.data?.type === "LICIA_SW_UPDATED") setShowUpdate(true);
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (controllerChanged) return;
          controllerChanged = true;
          window.location.reload();
        });

        await registration.update().catch(() => undefined);
        await refreshQueueCount();
        await flushQueue();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (sessionStorage.getItem(INSTALL_DISMISSED) !== "1") {
        window.setTimeout(() => setShowInstall(true), 2800);
      }
    }

    function onInstalled() {
      setInstallEvent(null);
      setShowInstall(false);
    }

    const installed = isStandalone();
    if (!installed && isIOS() && sessionStorage.getItem(INSTALL_DISMISSED) !== "1") {
      setIsIOSInstall(true);
      window.setTimeout(() => setShowInstall(true), 3500);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setShowInstall(false);
    }
  }

  async function updateNow() {
    const registration = registrationRef.current;
    if (!registration?.waiting) {
      setShowUpdate(false);
      return;
    }
    registration.waiting.postMessage({ type: "LICIA_SKIP_WAITING" });
  }

  function dismissInstall() {
    sessionStorage.setItem(INSTALL_DISMISSED, "1");
    setShowInstall(false);
  }

  const statusVisible = !online || queued > 0 || syncing;
  const installVisible = showInstall && !isStandalone() && (!!installEvent || isIOSInstall);

  return (
    <>
      {statusVisible && (
        <div className="fixed inset-x-3 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-banner mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 text-xs shadow-xl backdrop-blur-xl md:bottom-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            {online ? <CloudUpload size={15} /> : <WifiOff size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">
              {online ? (syncing ? tr("Menyinkronkan…") : tr("Data siap disinkronkan")) : tr("Licia sedang offline")}
            </p>
            <p className="mt-0.5 text-2xs leading-relaxed text-textMuted">
              {!online
                ? tr("Capture baru tetap bisa masuk antrean lokal.")
                : queued > 0
                  ? tr("{queued} item menunggu sinkronisasi.", { queued })
                  : tr("Perubahan lokal sudah tersinkron.")}
            </p>
          </div>
          {queued > 0 && online && !syncing && (
            <button
              onClick={() => void flushQueue()}
              className="rounded-lg p-2 text-textMuted hover:bg-bg hover:text-accent"
              aria-label={tr("Sinkronkan sekarang")}
              title={tr("Sinkronkan sekarang")}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      )}

      {installVisible && (
        <div className="fixed inset-x-3 bottom-[calc(4.9rem+env(safe-area-inset-bottom)+6.25rem)] z-banner mx-auto max-w-md rounded-3xl border border-accent/20 bg-surface/95 p-4 shadow-2xl backdrop-blur-xl md:bottom-5 md:right-5 md:left-auto md:mx-0">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Download size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text">{tr("Pasang Licia")}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-textMuted">
                    {tr("Buka lebih cepat seperti aplikasi, dengan pengalaman mobile yang lebih nyaman.")}
                  </p>
                </div>
                <button
                  onClick={dismissInstall}
                  className="rounded-lg p-1.5 text-textMuted hover:bg-bg hover:text-text"
                  aria-label={tr("Tutup")}
                >
                  <X size={14} />
                </button>
              </div>
              {isIOSInstall ? (
                <div className="mt-3 rounded-xl bg-bg p-3 text-2xs leading-relaxed text-textMuted">
                  {tr("Di Safari iPhone/iPad: tekan")} <strong className="text-text">{tr("Bagikan")}</strong> →{" "}
                  <strong className="text-text">{tr("Tambahkan ke Layar Utama")}</strong>.
                </div>
              ) : (
                <button
                  onClick={() => void install()}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <Download size={14} /> {tr("Install Licia")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpdate && (
        <div className="fixed inset-x-3 bottom-3 z-banner mx-auto max-w-md rounded-2xl border border-accent/20 bg-surface/95 px-4 py-3 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Bell size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text">{tr("Pembaruan Licia tersedia")}</p>
              <p className="mt-0.5 text-2xs text-textMuted">{tr("Muat ulang untuk memakai versi terbaru.")}</p>
            </div>
            <button
              onClick={() => void updateNow()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-2xs font-semibold text-white"
            >
              <Check size={12} /> {tr("Perbarui")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }
}
