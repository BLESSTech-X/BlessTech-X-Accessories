// ─── PhoneYa2 Service Worker ─────────────────────────────────────────────────
// Version: bump this number any time you want to force a cache refresh
const VERSION   = 'phoneya2-v2';
const CACHE     = VERSION;

// Files that get cached on first install (the app shell)
// These load instantly even when offline
const PRECACHE = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/manifest.json',
  '/icon-512x512.png',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
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

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
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

// ─── FETCH ───────────────────────────────────────────────────────────────────
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

  // Skip product .md files and index.json — always fresh so new products appear
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

// ─── BACKGROUND SYNC ─────────────────────────────────────────────────────────
// Listen for messages from the page (e.g. to skip waiting and update)
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
