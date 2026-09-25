export type OfflineActionType = "quick_capture";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  userId: string;
  createdAt: string;
  payload: {
    mode: "task" | "note";
    content: string;
  };
};

const DB_NAME = "licia-pwa";
const DB_VERSION = 1;
const STORE_NAME = "offline_actions";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function actionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Gagal membuka penyimpanan offline."));
  });
}

export async function enqueueOfflineAction(input: Omit<OfflineAction, "id" | "createdAt">): Promise<OfflineAction | null> {
  if (!isBrowser()) return null;

  const action: OfflineAction = {
    ...input,
    id: actionId(),
    createdAt: new Date().toISOString(),
  };
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(action);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan aksi offline."));
      tx.onabort = () => reject(tx.error || new Error("Penyimpanan offline dibatalkan."));
    });
    window.dispatchEvent(new CustomEvent("licia:offline-queue-change"));
    return action;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function listOfflineActions(): Promise<OfflineAction[]> {
  if (!isBrowser()) return [];
  const db = await openDb();
  try {
    return await new Promise<OfflineAction[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const index = tx.objectStore(STORE_NAME).index("createdAt");
      const request = index.getAll();
      request.onsuccess = () => resolve((request.result || []) as OfflineAction[]);
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

export async function countOfflineActions(): Promise<number> {
  if (!isBrowser()) return 0;
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error || new Error("Gagal menghitung antrean offline."));
    });
  } finally {
    db.close();
  }
}

export async function requestBackgroundSync(): Promise<void> {
  if (!isBrowser() || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    }).sync;
    if (syncManager) await syncManager.register("licia-offline-sync");
  } catch {
    // Background Sync is progressive enhancement; online/focus events still flush the queue.
  }
}
