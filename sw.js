// Black Fountain Service Worker
const CACHE_NAME = 'blackfountain-v39';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/views.css',
  '/js/view-loader.js',
  '/js/supabase-sync.js',
  '/js/store.js',
  '/js/search.js',
  '/js/settings.js',
  '/js/views/nav.js',
  '/js/views/dashboard.js',
  '/js/views/production-plan.js',
  '/js/views/email.js',
  '/js/views/script.js',
  '/js/views/breakdown.js',
  '/js/views/callsheet.js',
  '/js/views/schedule.js',
  '/js/views/budget.js',
  '/js/views/locations.js',
  '/js/views/moodboard.js',
  '/js/views/callsheet-html.js',
  '/js/views/shotlist.js',
  '/js/views/risk.js',
  '/js/init.js',
  '/html/views/dashboard',
  '/html/views/project',
  '/html/views/contacts',
  '/html/views/locations',
  '/html/views/moodboards',
  '/html/views/files',
  '/html/views/settings',
  '/html/views/team',
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Bypass ALL cross-origin requests (Supabase, CDNs, anything external).
  // Do NOT call event.respondWith — just return and let the browser handle
  // them natively with full CORS and auth header support.
  if (!event.request.url.startsWith(self.location.origin)) return;

   // Never intercept the service worker script itself — must always come fresh from network
   if (event.request.url.includes('/sw.js')) return;

   // Never serve these from cache — they contain critical sync guards
   if (event.request.url.includes('/supabase-sync.js') ||
       event.request.url.includes('/bf-save-history.js')) return;

   // DEBUG — log which files are being served from cache vs network
   const url = event.request.url;
   if (url.endsWith('.js') || url.includes('/html/')) {
     const req = event.request.clone();
     event.respondWith(
       fetch(req)
         .then(response => {
           console.log('[SW] Network served:', url.split('/').pop());
           const responseToCache = response.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
           return response;
         })
         .catch(() => {
           console.warn('[SW] Cache fallback:', url.split('/').pop());
           return caches.match(event.request);
         })
     );
     return;
   }

   // For other assets, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return a fallback for HTML requests
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      })
  );
});