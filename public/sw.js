const CACHE = 'licia-v30-pwa-r1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/licia-avatar.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('licia-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (event) => { if (event.data?.type === 'LICIA_SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('sync', (event) => {
  if (event.tag !== 'licia-offline-sync') return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => clients.forEach((client) => client.postMessage({ type: 'LICIA_OFFLINE_SYNC' }))));
});
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Licia';
  const options = { body: payload.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: payload.tag || `licia-${Date.now()}`, renotify: true, data: { href: payload.href || '/' }, vibrate: [100, 60, 120] };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification?.data?.href || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const absolute = new URL(href, self.location.origin).href;
    for (const client of clients) if ('focus' in client) { client.navigate?.(absolute); return client.focus(); }
    return self.clients.openWindow(absolute);
  }));
});
self.addEventListener('fetch', (event) => {
  const req = event.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')) return;
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(fetch(req).then((res) => res).catch(() => caches.match(OFFLINE_URL))); return;
  }
  event.respondWith(caches.match(req).then((cached) => fetch(req).then((res) => { if (res.ok && ['script','style','image','font','manifest'].includes(req.destination)) { const copy=res.clone(); caches.open(CACHE).then((cache)=>cache.put(req,copy)).catch(()=>undefined); } return res; }).catch(()=>cached||caches.match(OFFLINE_URL))));
});
