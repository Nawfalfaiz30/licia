const CACHE_PREFIX = 'licia-pwa-';
const FALLBACK_APP_VERSION = '0.58.0';
let CACHE = CACHE_PREFIX + FALLBACK_APP_VERSION;
let DB_VERSION = 4;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/licia-avatar.png'];
const DB_NAME = 'licia-pwa';
const ACTIONS = 'offline_actions';
const CONFLICTS = 'sync_conflicts';

let versionMetadataPromise = null;

function loadVersionMetadata() {
  if (!versionMetadataPromise) {
    versionMetadataPromise = (async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const meta = await response.json();
        const appVersion = typeof meta?.appVersion === 'string' ? meta.appVersion.trim() : '';
        const dbVersion = Number(meta?.pwaDbVersion);
        if (appVersion) CACHE = CACHE_PREFIX + appVersion;
        if (Number.isInteger(dbVersion) && dbVersion >= 1) DB_VERSION = dbVersion;
      } catch {}
    })();
  }
  return versionMetadataPromise;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ACTIONS)) {
        const store = db.createObjectStore(ACTIONS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      } else {
        const store = request.transaction.objectStore(ACTIONS);
        if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFLICTS)) {
        const store = db.createObjectStore(CONFLICTS, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

function readActions(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS, 'readonly');
    const req = tx.objectStore(ACTIONS).index('createdAt').getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
    req.onerror = () => reject(req.error || new Error('Queue read failed'));
  });
}

function deleteAction(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACTIONS, 'readwrite');
    tx.objectStore(ACTIONS).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Queue delete failed'));
  });
}

function saveConflict(db, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFLICTS, 'readwrite');
    tx.objectStore(CONFLICTS).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Conflict save failed'));
  });
}

async function replayOfflineQueue() {
  const db = await openDb();
  try {
    const actions = await readActions(db);
    if (!actions.length) return { processed: 0, conflicts: 0 };
    let processed = 0;
    let conflicts = 0;
    for (const action of actions) {
      try {
        const payload = action.type === 'quick_capture'
          ? (action.payload?.mode === 'task'
            ? { title: action.payload.content, status: 'todo', priority: 'medium' }
            : { content: action.payload?.content || '' })
          : action.payload || {};
        const response = await fetch('/api/sync/mutation', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mutationId: action.id,
            deviceId: action.deviceId || 'licia-sw',
            entityType: action.entityType,
            operation: action.operation || 'create',
            entityId: action.entityId || undefined,
            baseVersion: action.baseVersion ?? null,
            clientUpdatedAt: action.clientUpdatedAt || action.createdAt,
            payload,
            conflictStrategy: action.conflictStrategy || 'server'
          })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok || data.replayed) {
          await deleteAction(db, action.id);
          processed += 1;
          continue;
        }
        if (response.status === 409 && data.conflict) {
          await saveConflict(db, {
            id: `${action.id}-conflict`,
            actionId: action.id,
            userId: action.userId,
            createdAt: new Date().toISOString(),
            error: 'SYNC_CONFLICT',
            response: data
          });
          await deleteAction(db, action.id);
          conflicts += 1;
          continue;
        }
        if (response.status >= 500 || !response.ok) break;
      } catch (error) {
        // Network failure: retain the remaining queue for a later sync event.
        break;
      }
    }
    return { processed, conflicts };
  } finally {
    db.close();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(loadVersionMetadata().then(() => caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined)));
  // Keep the new worker waiting until the user accepts the update banner.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    loadVersionMetadata()
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'LICIA_SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'LICIA_SYNC_NOW') {
    event.waitUntil(replayOfflineQueue().then((result) => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage({ type: 'LICIA_OFFLINE_SYNC_COMPLETE', result })))).catch(() => undefined));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'licia-offline-sync') return;
  event.waitUntil(replayOfflineQueue().then((result) => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage({ type: 'LICIA_OFFLINE_SYNC_COMPLETE', result }))).catch(() => undefined)).catch(() => undefined));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Licia';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || `licia-${Date.now()}`,
    renotify: true,
    data: { href: payload.href || '/', actions: payload.actions || [] },
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
    vibrate: [100, 60, 120]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const actions = event.notification?.data?.actions || [];
  const selected = actions.find((item) => item.action === action);
  const href = selected?.href || event.notification?.data?.href || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const absolute = new URL(href, self.location.origin).href;
    for (const client of clients) {
      if ('focus' in client) { client.navigate?.(absolute); return client.focus(); }
    }
    return self.clients.openWindow(absolute);
  }));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Next.js App Router / React Server Component requests must bypass the
  // service worker completely. Intercepting an RSC stream can turn a normal
  // client navigation into a premature/closed destination stream.
  const isRsc = req.headers.get('RSC') === '1'
    || req.headers.has('Next-Router-State-Tree')
    || req.headers.has('Next-Router-Prefetch');
  if (isRsc || url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Cache only static assets we explicitly understand. Let other GET requests
  // pass through normally so app-router resources are not altered.
  if (!['script','style','image','font','manifest'].includes(req.destination)) return;

  event.respondWith(
    loadVersionMetadata()
      .then(() =>
        caches.match(req).then((cached) =>
          fetch(req)
            .then((res) => {
              if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
              }
              return res;
            })
            .catch(() => cached || caches.match(OFFLINE_URL))
        )
      )
  );
});
