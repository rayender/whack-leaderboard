// Whack Group Service Worker
// Strategy: Network first, cache fallback — always serves fresh content

const CACHE = 'whack-v1';
const OFFLINE_URLS = ['/', '/index.html', '/admin.html', '/manifest.json'];

// Install — pre-cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(OFFLINE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', e => {
  // Skip non-GET and cross-origin requests (Supabase, Google Sheets)
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Network failed — serve from cache
        caches.match(e.request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  );
});

// Push notifications (future)
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Whack Group 🏸', {
      body:  data.body  || 'New update from Whack Group',
      icon:  data.icon  || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag:   data.tag   || 'whack-notification',
      data:  data.url   || '/',
      vibrate: [200, 100, 200],
      actions: data.actions || []
    })
  );
});

// Notification click — open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data || '/');
    })
  );
});
