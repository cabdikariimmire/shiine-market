// Shiine Supermarket PWA Service Worker
const CACHE_VERSION = 'shiine-pwa-v1.0.0';
const STATIC_CACHE_NAME = `shiine-static-${CACHE_VERSION}`;
const APP_SHELL_CACHE_NAME = `shiine-shell-${CACHE_VERSION}`;

// Application shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/sales/new',
  '/products',
  '/manifest.webmanifest',
  '/favicon.png',
  '/favicon-32x32.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/icon-maskable-512x512.png',
  '/apple-touch-icon.png',
];

// URLs that must NEVER be cached by the service worker
function isBlacklisted(url) {
  const urlObj = new URL(url);
  // Never cache Supabase endpoints, APIs, or auth calls
  if (urlObj.hostname.includes('supabase.co')) return true;
  if (urlObj.pathname.startsWith('/api/')) return true;
  if (urlObj.pathname.includes('/auth/')) return true;
  if (urlObj.pathname.includes('/rest/')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE_NAME).then(async (cache) => {
      // Use individual caching to prevent one failed asset from aborting install
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Pre-caching asset skipped or failed:', asset, err);
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('shiine-') && name !== STATIC_CACHE_NAME && name !== APP_SHELL_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never touch blacklisted requests (Supabase, Auth, private APIs)
  if (isBlacklisted(request.url)) {
    return;
  }

  const url = new URL(request.url);

  // 1. Static immutable Next.js chunks, fonts, and images: Cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          // If both fail and it's an image, return empty or cached fallback
          return cachedResponse || new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // 2. Navigation requests (HTML pages): Network-first with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(APP_SHELL_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(request);
          if (cached) return cached;

          // If requesting /sales/new or /dashboard, try fallback
          if (url.pathname.startsWith('/sales')) {
            const salesFallback = await caches.match('/sales/new');
            if (salesFallback) return salesFallback;
          }
          const dashboardFallback = await caches.match('/dashboard');
          if (dashboardFallback) return dashboardFallback;

          const rootFallback = await caches.match('/');
          if (rootFallback) return rootFallback;

          return new Response(
            `<!DOCTYPE html>
            <html lang="so">
            <head><meta charset="utf-8"><title>Shiine Supermarket - Offline</title></head>
            <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:#fff;">
              <h2>Shiine Supermarket</h2>
              <p>Waxaad ku jirtaa khadka ka baxsanaan (Offline).</p>
              <a href="/sales/new" style="color:#10b981;font-weight:bold;">Fur POS-ka Offline</a>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Default: Stale-while-revalidate for local static assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
