// ─── PhoneYa2 Service Worker ─────────────────────────────────────────────────
// Version: bump this number any time you want to force a cache refresh
const VERSION   = 'phoneya2-v19';
const CACHE     = VERSION;
// Navigation documents are reused for five minutes, then refreshed from the network.
const PAGE_TTL_MS = 5 * 60 * 1000;

function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('X-PhoneYa2-Cached-At', String(Date.now()));
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Files that get cached on first install (the app shell)
// These load instantly even when offline
const PRECACHE = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/blog.html',
  '/blog-post.html',
  '/checkout.html',
  '/cart.html',
  '/cart.js',
  '/phoneya2-premium-layer.css',
  '/account.html',
  '/agents/py2-360.html',
  '/manifest.json',
  '/pwa-install.js',
  '/navigation-boost.js',
  '/icon-512x512.jpg',
];

// ─── INSTALL ──────────────────────────────────────────────────────────
// Runs once when the service worker is first registered.
// Pre-caches the core app shell so the site loads offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(PRECACHE);
      })
      .then(() => self.skipWaiting()) // activate immediately, don't wait
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────
// Runs after install. Cleans up old caches from previous versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE) // delete everything except current cache
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open pages immediately
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────
// Intercepts every network request and decides: serve from cache or network.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, etc.)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (external APIs, CDNs) — let them go to network
  if (url.origin !== self.location.origin) return;

  // Skip admin panel — always fetch fresh so CMS always works
  if (url.pathname.startsWith('/admin')) return;

  // Skip XML and text files (sitemap.xml, robots.txt) — let network handle directly
  if (url.pathname.endsWith('.xml') || url.pathname.endsWith('.txt')) {
    return;
  }

  // Keep transactional/personal pages network-first and out of the navigation cache.
  // This prevents a cached checkout, cart or account document from appearing authoritative.
  if (request.mode === 'navigate') {
    const path = url.pathname.toLowerCase();
    const sensitive = path === '/checkout.html' || path === '/cart.html' ||
      path === '/account.html' || path.startsWith('/admin') || path.startsWith('/api/');
    if (sensitive) {
      event.respondWith(fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        const fallback = await cache.match(request);
        return fallback || new Response('You appear to be offline. Reconnect to continue.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }));
      return;
    }
    // Stale-while-revalidate for browse pages: show a warmed page immediately,
    // refresh its cache in the background, and use fresh HTML on the next visit.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const cachedAt = cached ? Number(cached.headers.get('X-PhoneYa2-Cached-At') || 0) : 0;
      const isFresh = cached && cachedAt > 0 && (Date.now() - cachedAt) < PAGE_TTL_MS;
      if (isFresh) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          const stamped = stampResponse(response);
          await cache.put(request, stamped.clone());
          return stamped;
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        const home = await cache.match('/index.html');
        if (home) return home;
        return new Response('You appear to be offline. Reconnect and try again.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Link-intent prefetches are cached with the same five-minute freshness window.
  if (request.headers.get('X-PhoneYa2-Prefetch') === '1') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
          const cache = await caches.open(CACHE);
          const stamped = stampResponse(response);
          await cache.put(new Request(url.href), stamped.clone());
          return stamped;
        }
        return response;
      } catch (error) {
        return caches.match(new Request(url.href)).then(cached => cached || new Response('', {status: 504}));
      }
    })());
    return;
  }

  // Always fetch .json files fresh from network, never serve from cache first
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh copy for offline fallback
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)) // if offline, serve cached copy
    );
    return;
  }

  // Always fetch content/products/ and content/ fresh from network
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh copy for offline fallback
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)) // if offline, serve cached copy
    );
    return;
  }

  // For all other requests: Network First with Cache Fallback
  // Try the network; if it fails (offline), serve from cache.
  event.respondWith(
    fetch(request)
      .then(response => {
        // Only cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // If the page isn't cached either, serve the homepage
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          // Nothing we can do
          return new Response('Offline — no cached version available.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// ─── BACKGROUND SYNC ───────────────────────────────────────────────────────
// Listen for messages from the page (e.g. to skip waiting and update)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
