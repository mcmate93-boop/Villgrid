const VERSION = 'villgrid-v3';
const STATIC = [
  '/Villgrid/',
  '/Villgrid/index.html',
  '/Villgrid/data.js',
  '/Villgrid/manifest.json',
  '/Villgrid/icon-192.png',
  '/Villgrid/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Telepítéskor azonnal cache-eli a fő fájlokat
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(cache => {
      return Promise.allSettled(
        STATIC.map(url => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// Régi cache törlése
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Térképcsempék: cache-first, majd háttérben frissít
  if (url.hostname.includes('carto') || url.hostname.includes('tile')) {
    e.respondWith(
      caches.open('villgrid-tiles').then(async cache => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request)
          .then(res => { cache.put(e.request, res.clone()); return res; })
          .catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // data.js: network-first (mindig a legfrissebbet próbálja), fallback cache
  if (url.pathname.includes('data.js')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(VERSION).then(cache => cache.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Minden más: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(VERSION).then(cache => cache.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match('/Villgrid/index.html'));
    })
  );
});
