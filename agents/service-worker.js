// ═══════════════════════════════════════════════════════════════════════
// PhoneYa2 Agent Network — Service Worker
// Caches static assets for offline use; network-first for API
// ═══════════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'phoneya2-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './apply.html',
  './status.html',
  './check.html',
  './verify.html',
  './agent.html',
  './admin.html',
  './shared.css',
  './config.js',
  './manifest.json',
];

// Install — pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — smart strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co')) return;

  // Never cache external CDNs — let browser handle them
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('i.ibb.co')) return;

  // For our own HTML/CSS/JS — network-first with cache fallback
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
  }
});

// Message handler — allows pages to trigger skipWaiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
