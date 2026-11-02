/* BeyForge offline cache. Bump VERSION on every release so phones pick up the update. */
const VERSION = 'beyforge-v2';
const CORE = ['./','index.html','manifest.webmanifest','css/beyforge.css',
  'lib/three.min.js','lib/OrbitControls.js','lib/jszip.min.js','lib/font.js',
  'js/data.js','js/geometry.js','js/viewer.js','js/physics.js','js/export.js','js/storage.js','js/ui.js','js/app.js',
  'icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// network first so updates land right away; cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
