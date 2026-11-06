// Service worker de la app del jugador: deja la app instalable y, si se corta la señal,
// muestra la última versión guardada de la página en vez de un error.
const CACHE = 'ndg-gei-v1';
const BASICOS = ['/jugar', '/club-logo-gei.png', '/icono-192.png', '/vendor/qrcode.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin || r.url.includes('/socket.io/')) return;
  if (r.mode === 'navigate' && new URL(r.url).pathname.replace(/\/+$/, '') === '/jugar') {
    e.respondWith(fetch(r).then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put('/jugar', copia)); return res; }).catch(() => caches.match('/jugar')));
  }
});
