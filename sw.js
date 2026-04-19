// NetTycoon — Service Worker
// Strategy:
//   - navigation (html): network-first, fallback cache
//   - js/css/svg/png/manifest: cache-first with stale-while-revalidate
//   - CDN (pixi fallback): cache-first (nechá hru fungovat offline i bez vendor/)

const VERSION = 'nettycoon-v1-2026-04-18';
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
  './src-tauri/icons/favicon.svg',
  './src-tauri/icons/logo.svg'
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

  // Assets — cache-first with background revalidate
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const fetchAndUpdate = fetch(req).then(res => {
      if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (cached) {
      // stale-while-revalidate
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
