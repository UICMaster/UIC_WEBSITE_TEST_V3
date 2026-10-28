(() => {
  const CACHE_NAME = 'UIC-System-v49';

  const PRECACHE_URLS = [
    '/',
    '/manifest.json',
    '/favicon.ico',
    '/icon512_maskable.png',
    '/android-chrome-512x512.png'
  ];

  // 1. INSTALL: Pre-cache only valid Astro V12 static shell assets
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
  });

  // 2. ACTIVATE: Purge legacy V11 caches (e.g., UIC-System-v48) immediately
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.map((key) => {
              if (key !== CACHE_NAME) {
                return caches.delete(key);
              }
              return undefined;
            })
          )
        )
        .then(() => self.clients.claim())
    );
  });

  // 3. FETCH: Network-First for HTML & JSON data; Cache-First for immutable hashed assets
  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const reqUrl = new URL(event.request.url);
    if (reqUrl.origin !== self.location.origin) return;

    const isNavigation =
      event.request.mode === 'navigate' ||
      (event.request.headers.get('accept') || '').includes('text/html');
    const isDataJson =
      reqUrl.pathname.startsWith('/data/') || reqUrl.pathname.endsWith('.json');

    if (isNavigation || isDataJson) {
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request))
      );
      return;
    }

    // Static assets (_astro/*, /assets/*, icons): Cache-First with network fallback
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request).then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.ok &&
              reqUrl.pathname.startsWith('/_astro/')
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
        );
      })
    );
  });
})();
