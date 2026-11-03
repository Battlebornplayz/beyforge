/* BeyForge offline cache. Bump VERSION on every release so phones pick up the update. */
const VERSION = 'beyforge-v7-0';
const CORE = ['./','index.html','manifest.webmanifest','css/beyforge.css',
  'lib/three.min.js','lib/OrbitControls.js','lib/jszip.min.js','lib/font.js',
  'lib/peerjs.min.js','js/data.js','js/data4.js','js/moves.js','js/terrain.js','js/settings.js','js/ui6.js','css/theme6.css','js/paint.js','js/ui4.js','js/firebase-config.js','js/account.js','js/social.js','js/admin.js','js/ranked.js','js/native.js','js/shop.js','js/cards.js','js/gallery.js','js/parts.js','js/packs.js','js/catalog.js','js/parts-ui.js','js/dex.js','js/store.js','js/packopen.js','js/live.js','js/adventure.js','js/home.js','js/engage.js','js/tour.js','js/hd.js','lib/post.js','lib/firebase-app-compat.js','lib/firebase-auth-compat.js','lib/firebase-firestore-compat.js','js/battle.js','js/net.js','js/sfx.js','js/battle-ui.js','js/geometry.js','js/viewer.js','js/physics.js','js/export.js','js/storage.js','js/ui.js','js/app.js',
  'icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// network first so updates land right away; cache when offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
