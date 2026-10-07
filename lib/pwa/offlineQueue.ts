export type SyncEntityType =
  | "task"
  | "schedule"
  | "project"
  | "goal"
  | "note"
  | "inbox"
  | "reminder"
  | "memory"
  | "subtask"
  | "milestone"
  | "decision"
  | "skill"
  | "expense"
  | "income"
  | "subscription"
  | "sleep"
  | "hydration"
  | "caffeine"
  | "meal"
  | "medication"
  | "fatigue"
  | "movement"
  | "healthMetric"
  | "pomodoro"
  | "habit"
  | "habitCheckin"
  | "reading"
  | "readingSession"
  | "relation"
  | "interaction"
  | "budget"
  | "account"
  | "accountTransfer"
  | "automation"
  | "vault"
  | "link";
export type SyncOperation = "create" | "update" | "delete";

export type OfflineAction = {
  id: string;
  type: "mutation" | "quick_capture";
  userId: string;
  deviceId: string;
  entityType: SyncEntityType;
  operation: SyncOperation;
  entityId?: string;
  baseVersion?: number | null;
  clientUpdatedAt?: string | null;
  conflictStrategy?: "server" | "latest" | "manual" | "smart";
  createdAt: string;
  payload: Record<string, unknown> & { mode?: "task" | "note"; content?: string };
};

export type OfflineConflict = {
  id: string;
  actionId: string;
  userId: string;
  createdAt: string;
  error: string;
  response?: Record<string, unknown>;
};

const DB_NAME = "licia-pwa";
const DB_VERSION = 4;
const STORE_NAME = "offline_actions";
const CONFLICT_STORE = "sync_conflicts";
const WORKSPACE_CACHE_STORE = "workspace_cache";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function getDeviceId(): string {
  if (!isBrowser()) return "licia-server";
  try {
    const key = "licia-sync-device-id-v2";
    const current = localStorage.getItem(key) || localStorage.getItem("licia-sync-device-id-v1");
    if (current) {
      localStorage.setItem(key, current);
      return current;
    }
    const id = `licia-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `licia-${Math.random().toString(36).slice(2)}`;
  }
}

function getQueueLimit(): number {
  try {
    const parsed = Number(localStorage.getItem("licia-offline-queue-limit"));
    return Number.isFinite(parsed) && parsed >= 20 ? Math.min(1000, Math.floor(parsed)) : 100;
  } catch {
    return 100;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("IndexedDB tidak tersedia."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("status", "status", { unique: false });
      } else {
        const store = request.transaction?.objectStore(STORE_NAME);
        if (store && !store.indexNames.contains("status")) store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
        const conflict = db.createObjectStore(CONFLICT_STORE, { keyPath: "id" });
        conflict.createIndex("userId", "userId", { unique: false });
        conflict.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_CACHE_STORE)) {
        const cache = db.createObjectStore(WORKSPACE_CACHE_STORE, { keyPath: "key" });
        cache.createIndex("userId", "userId", { unique: false });
        cache.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Gagal membuka penyimpanan offline."));
  });
}

export async function enqueueMutation(
  input: Omit<OfflineAction, "id" | "type" | "createdAt" | "deviceId"> & { deviceId?: string },
): Promise<OfflineAction | null> {
  if (!isBrowser()) return null;
  const action: OfflineAction = {
    ...input,
    id: newId(),
    type: "mutation",
    deviceId: input.deviceId || getDeviceId(),
    createdAt: new Date().toISOString(),
  };
  const db = await openDb();
  try {
    const accepted = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        if (countRequest.result >= getQueueLimit()) {
          try {
            tx.abort();
          } catch {}
          resolve(false);
          return;
        }
        store.put(action);
      };
      countRequest.onerror = () => reject(countRequest.error || new Error("Gagal membaca antrean."));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan antrean."));
      tx.onabort = () => {
        if (countRequest.result >= getQueueLimit()) resolve(false);
        else reject(tx.error || new Error("Penyimpanan dibatalkan."));
      };
    });
    if (!accepted) return null;
    window.dispatchEvent(new CustomEvent("licia:offline-queue-change"));
    await requestBackgroundSync();
    return action;
  } finally {
    db.close();
  }
}

export async function enqueueOfflineAction(input: {
  userId: string;
  type?: "quick_capture";
  payload: { mode: "task" | "note"; content: string };
}): Promise<OfflineAction | null> {
  const entityType: SyncEntityType = input.payload.mode === "task" ? "task" : "note";
  return enqueueMutation({
    userId: input.userId,
    deviceId: getDeviceId(),
    entityType,
    operation: "create",
    payload: input.payload,
    conflictStrategy: "server",
  });
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  try {
    return await new Promise<OfflineAction[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).index("createdAt").getAll();
      request.onsuccess = () =>
        resolve(((request.result || []) as OfflineAction[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      request.onerror = () => reject(request.error || new Error("Gagal membaca antrean offline."));
    });
  } finally {
    db.close();
  }
}

export async function removeOfflineAction(id: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Gagal menghapus antrean offline."));
    });
    window.dispatchEvent(new CustomEvent("licia:offline-queue-change"));
  } finally {
    db.close();
  }
}

export async function listOfflineConflicts(): Promise<OfflineConflict[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  try {
    return await new Promise<OfflineConflict[]>((resolve, reject) => {
      const tx = db.transaction(CONFLICT_STORE, "readonly");
      const request = tx.objectStore(CONFLICT_STORE).index("createdAt").getAll();
      request.onsuccess = () => resolve((request.result || []) as OfflineConflict[]);
      request.onerror = () => reject(request.error || new Error("Gagal membaca konflik lokal."));
    });
  } finally {
    db.close();
  }
}

export async function saveOfflineConflict(conflict: Omit<OfflineConflict, "id" | "createdAt">): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CONFLICT_STORE, "readwrite");
      tx.objectStore(CONFLICT_STORE).put({ ...conflict, id: newId(), createdAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan konflik."));
    });
    window.dispatchEvent(new CustomEvent("licia:sync-conflict"));
  } finally {
    db.close();
  }
}

export async function countOfflineActions(): Promise<number> {
  if (!isBrowser()) return 0;
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error("Gagal menghitung antrean."));
    });
  } finally {
    db.close();
  }
}

export async function requestBackgroundSync(): Promise<void> {
  if (!isBrowser() || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }
    ).sync;
    if (syncManager) await syncManager.register("licia-offline-sync");
  } catch {
    // Fallback handled by online/focus events.
  }
}

export async function cacheWorkspaceSnapshot(userId: string, key: string, snapshot: unknown): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_CACHE_STORE, "readwrite");
      tx.objectStore(WORKSPACE_CACHE_STORE).put({
        key: `${userId}:${key}`,
        userId,
        workspaceKey: key,
        snapshot,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan workspace offline."));
    });
  } finally {
    db.close();
  }
}

export async function getWorkspaceSnapshot<T = unknown>(
  userId: string,
  key: string,
): Promise<{ snapshot: T; updatedAt: string } | null> {
  if (!isBrowser()) return null;
  const db = await openDb();
  try {
    return await new Promise<{ snapshot: T; updatedAt: string } | null>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_CACHE_STORE, "readonly");
      const request = tx.objectStore(WORKSPACE_CACHE_STORE).get(`${userId}:${key}`);
      request.onsuccess = () => {
        const value = request.result as any;
        resolve(value ? { snapshot: value.snapshot as T, updatedAt: String(value.updatedAt) } : null);
      };
      request.onerror = () => reject(request.error || new Error("Gagal membaca workspace offline."));
    });
  } finally {
    db.close();
  }
}
