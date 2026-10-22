// Cache-Version bei jedem Release erhöhen, damit Handys die neue Version laden.
const CACHE = 'bauplaner-v6';
const ASSETS = [
  './', './index.html', './css/styles.css', './js/optimizer.js', './js/calcs.js', './js/material.js', './js/app.js',
  './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './fonts/inter-latin.woff2'
];
self.addEventListener('install', e => {
  // cache: 'reload' umgeht den HTTP-Cache (GitHub Pages: max-age=600), damit wirklich die neuen Dateien landen.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Seiten: Netzwerk zuerst (frische index.html), offline aus dem Cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // Assets: Cache zuerst (versioniert über CACHE), sonst Netz + nachcachen.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
