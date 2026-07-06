const CACHE_NAME = 'workout-log-v2';
const PRECACHE_URLS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // MUUTOS 1: Estetään ulkopuolisten domainien ja API-kutsujen välimuistitus akunkeston säästämiseksi
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-first for navigation and API requests
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // MUUTOS 2: Tallennetaan välimuistiin vain, jos kyseessä on oikea staattinen tiedosto (js, css, kuvat),
        // mikä lopettaa iPhonen jatkuvan levykirjoituksen ja Chromen jumiutumisen.
        const url = new URL(request.url);
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2|json)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
