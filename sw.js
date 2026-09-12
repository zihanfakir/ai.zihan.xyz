/* Alokpoth AI - Progressive Web App Service Worker (v1.0.8) */
const CACHE_NAME = 'alokpoth-ai-v1.0.8';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/account.html',
  '/plans.html',
  '/login.html',
  '/manifest.json',
  '/favicon.png',
  '/app_logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).then(() => {
        console.log('[SW] All core assets cached successfully');
      }).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning;', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('SW Removing old cache', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET-requests and API calls
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML navigation requests (Page Loads)
  if (req.mode === 'navigate' || req.destination === 'document' || (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          if (fallback) return fallback;
          return new Response('Please check your internet connection', { headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  // Static Assets (Cache First with Stale While Revalidate)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
