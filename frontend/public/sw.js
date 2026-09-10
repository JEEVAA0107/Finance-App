const CACHE_NAME = 'finova-v13';

// Install event - force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - purge all old caches (loanflow-pro-v1, finova-v1, etc.)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event handler - Network-First for fresh UI updates
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, non-http schemes (chrome-extension, etc.), and API calls
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network First, fallback to cache (guarantees latest UI code on load)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (url.protocol.startsWith('http')) {
              cache.put(request, responseToCache).catch(() => {});
            }
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Return cached version if offline
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Finova Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});
