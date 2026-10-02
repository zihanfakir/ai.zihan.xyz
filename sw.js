/* Alora AI - Progressive Web App Service Worker (v1.6.0) */
const CACHE_NAME = 'alora-ai-v1.6.0';

// Core assets to pre-cache on service worker install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/download.html',
  '/account.html',
  '/plans.html',
  '/login.html',
  '/profile.html',
  '/security.html',
  '/subscription.html',
  '/usage.html',
  '/theme.html',
  '/sound.html',
  '/personalization.html',
  '/language.html',
  '/help.html',
  '/redeem.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/app_logo.png',
  '/logo_icon_white.png',
  '/logo_icon_black.png',
  '/logo_wordmark_white.png',
  '/logo_wordmark_black.png'
];

/**
 * Service Worker Installation
 * Pre-caches critical app shell assets with resilient error handling
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core assets...');
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'no-cache' });
            if (response.ok) {
              await cache.put(asset, response);
            } else {
              console.warn(`[SW] Pre-cache skipped for ${asset} (status: ${response.status})`);
            }
          } catch (err) {
            console.warn(`[SW] Pre-cache network failure for ${asset}:`, err.message);
          }
        })
      );
      console.log('[SW] Core assets pre-caching finished');
    }).then(() => self.skipWaiting())
  );
});

/**
 * Service Worker Activation
 * Cleans up previous cache versions and takes immediate control
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removing outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Client Message Listener
 * Allows clients to trigger skipWaiting
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

/**
 * Push Notification Support
 */
self.addEventListener('push', (event) => {
  let data = {
    title: 'Alora AI',
    body: 'নতুন আপডেট বা বার্তা পাওয়া গেছে',
    icon: '/favicon.png',
    badge: '/favicon-32x32.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon-32x32.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/**
 * Check if a request is an API, dynamic data, or binary download
 * These MUST NEVER be cached in CacheStorage to prevent stale auth/chat data
 */
function isDynamicOrApiRequest(url, req) {
  // Non-GET requests (POST, PUT, DELETE, PATCH, etc.)
  if (req.method !== 'GET') return true;

  const path = url.pathname;

  // Backend API and dynamic routes
  if (
    path === '/api' ||
    path.startsWith('/api/') ||
    path === '/auth' ||
    path.startsWith('/auth/') ||
    path === '/chat' ||
    path.startsWith('/chat/') ||
    path === '/redeem' ||
    path.startsWith('/redeem/') ||
    path === '/search' ||
    path.startsWith('/search/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/health' ||
    path.startsWith('/health/') ||
    path === '/debug-route'
  ) {
    return true;
  }

  // App binaries / large downloads
  if (
    path.endsWith('.apk') ||
    path.endsWith('.ipa') ||
    path.endsWith('.zip') ||
    path.endsWith('.tar.gz')
  ) {
    return true;
  }

  // Anti-cache / timestamp parameters
  if (url.searchParams.has('_t') || url.searchParams.has('nocache') || url.searchParams.has('timestamp')) {
    return true;
  }

  // External APIs (e.g., LLM providers, OAuth endpoints)
  if (url.origin !== self.location.origin) {
    const host = url.hostname;
    if (
      host.includes('googleapis.com') ||
      host.includes('openrouter.ai') ||
      host.includes('groq.com') ||
      host.includes('anthropic.com') ||
      host.includes('openai.com') ||
      host.includes('huggingface.co') ||
      host.includes('pollinations.ai') ||
      host.includes('onrender.com') ||
      host.includes('render.com') ||
      host.includes('supabase.co')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. API & Dynamic Requests: Strictly Network-Only (NEVER CACHED)
  if (isDynamicOrApiRequest(url, req)) {
    // For non-GET requests, bypass service worker completely so browser handles it natively
    if (req.method !== 'GET') {
      return;
    }

    // For GET API requests, perform network-only fetch and return clean offline JSON if disconnected
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Network connection lost. Please check your internet connection.',
            offline: true
          }),
          {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
          }
        );
      })
    );
    return;
  }

  // 2. HTML Navigation Requests (Page Loads): Network-First with Cache Fallback
  if (
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    (req.headers.get('accept') && req.headers.get('accept').includes('text/html'))
  ) {
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
          // Direct cache match
          const cached = await caches.match(req);
          if (cached) return cached;

          // Clean URL handling (e.g. /download -> /download.html)
          const cleanPath = url.pathname;
          const htmlPath = cleanPath.endsWith('.html') ? cleanPath : `${cleanPath.replace(/\/$/, '')}.html`;
          const altCached = await caches.match(htmlPath);
          if (altCached) return altCached;

          // Fallback to home page
          const fallback = (await caches.match('/index.html')) || (await caches.match('/'));
          if (fallback) return fallback;

          // Final offline page fallback
          return new Response(
            `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Alora</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 24px; box-sizing: border-box; }
    .box { max-width: 420px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px 24px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }
    h1 { font-size: 1.4rem; margin-bottom: 10px; font-weight: 700; }
    p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px; }
    button { background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; border: none; padding: 12px 28px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: opacity 0.2s; }
    button:active { opacity: 0.8; }
  </style>
</head>
<body>
  <div class="box">
    <h1>ইন্টারনেট সংযোগ বিচ্ছিন্ন</h1>
    <p>আপনি বর্তমানে অফলাইনে আছেন। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় লোড করুন।</p>
    <button onclick="window.location.reload()">পুনরায় চেষ্টা করুন</button>
  </div>
</body>
</html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images): Cache-First with Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise.then((response) => {
        if (response) return response;
        return new Response('Asset unavailable offline', { status: 408 });
      });
    })
  );
});
