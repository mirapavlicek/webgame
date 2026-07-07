// NetTycoon — Service Worker
// Strategy:
//   - navigation (html): network-first, fallback cache
//   - js/css: NETWORK-FIRST, fallback cache — hra se často aktualizuje a
//     cache-first servírovala staré moduly ještě dlouho po deployi (hráč pak
//     neviděl nové funkce, protože main.js byl z cache a nové soubory ne)
//   - obrázky/vendor: cache-first se stale-while-revalidate
//
// VERSION drž v sync s package.json — změna verze zahodí staré cache.

const VERSION = 'nettycoon-v0.9.1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/constants.js',
  './js/state.js',
  './js/map.js',
  './js/capacity.js',
  './js/wifi.js',
  './js/events.js',
  './js/finance.js',
  './js/incidents.js',
  './js/morale.js',
  './js/render.js',
  './js/pixi-fx.js',
  './js/actions.js',
  './js/ui.js',
  './js/input.js',
  './js/main.js',
  './js/heatmap.js',
  './js/sprite-cache.js',
  './icons/favicon.svg',
  './icons/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // addAll selže, pokud cokoliv 404 — raději po jednom s tolerancí
    await Promise.allSettled(CORE.map(u => cache.add(u).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigation — network-first
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, net.clone());
        return net;
      } catch (_) {
        const cache = await caches.open(VERSION);
        const hit = await cache.match('./index.html');
        return hit || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // JS/CSS — network-first: čerstvý kód má přednost, cache je jen offline záloha
  const isCode = /\.(js|css)(\?.*)?$/.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const fetchAndUpdate = fetch(req).then(res => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (isCode) {
      const net = await fetchAndUpdate;
      return net || cached || new Response('Offline', { status: 503 });
    }
    if (cached) {
      // stale-while-revalidate (obrázky, fonty, vendor)
      fetchAndUpdate;
      return cached;
    }
    const net = await fetchAndUpdate;
    return net || new Response('Offline', { status: 503 });
  })());
});

// Ruční vynucení update z aplikace: postMessage({type:'skipWaiting'})
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});
