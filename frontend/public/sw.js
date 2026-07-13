const CACHE_NAME = 'aura-syncro-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  // Aggiungi qui eventuali altre rotte statiche o icone principali
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
