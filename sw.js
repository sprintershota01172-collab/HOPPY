const CACHE = 'hopposan-static-v53';
const STATIC = ['./','./index.html','./fp-r33.html','./fp-r34.html','./fp-r39.html','./fp-r40.html','./fp-r41.html','./styles.css','./app.js','./styles.css?v=fp-20261027-r41','./app.js?v=fp-20261027-r41','./manifest.webmanifest','./icon.svg','./icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML, JS and CSS must refresh online; cached copies remain available offline.
  const refreshOnline = request.mode === 'navigate' ||
    /\/(?:index\.html|app\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname);
  if (refreshOnline) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          const key = request.mode === 'navigate' ? './index.html' : request;
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(key, copy)));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request.mode === 'navigate' ? './index.html' : request);
        return cached || Response.error();
      })
    );
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,copy)));
    }
    return response;
  })));
});
