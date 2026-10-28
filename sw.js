// HOPPY r61: small, reliable cache. Always prefer server files when online.
const CACHE = 'hopposan-static-r61';
const SCRIPT = './app.js?v=fp-20261028-r61';
const STYLE = './styles.css?v=fp-20261028-r61';
const PRECACHE = ['./index.html','./fp-r60.html',SCRIPT,STYLE,'./manifest.webmanifest','./icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('hopposan-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET')return;
  const url = new URL(request.url);
  if(url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./',self.location.href).pathname))return;

  const navigation = request.mode === 'navigate';
  const appAsset = /\/(?:app\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname);
  const refreshPage = url.pathname.endsWith('/refresh.html');

  if(navigation || appAsset){
    event.respondWith((async()=>{
      try{
        // Avoid an iOS/Safari HTTP cache replaying stale HTML and JavaScript.
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok && !refreshPage){
          const copy=response.clone();
          const key=navigation?
            (url.pathname.endsWith('/fp-r60.html')?'./fp-r60.html':'./index.html'):
            request;
          event.waitUntil(caches.open(CACHE).then(c=>c.put(key,copy)).catch(()=>{}));
        }
        return response;
      }catch(_){
        if(refreshPage)return Response.error();
        if(navigation){
          return await caches.match(request) || await caches.match('./fp-r60.html') ||
            await caches.match('./index.html') || Response.error();
        }
        if(url.pathname.endsWith('/app.js')){
          return await caches.match(request) || await caches.match(SCRIPT) || Response.error();
        }
        if(url.pathname.endsWith('/styles.css')){
          return await caches.match(request) || await caches.match(STYLE) || Response.error();
        }
        return await caches.match(request) || Response.error();
      }
    })());
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)).catch(()=>{}));
    }
    return response;
  })));
});
