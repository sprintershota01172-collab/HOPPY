// HOPPY r71: small, reliable cache. Always prefer server files when online.
const CACHE = 'hopposan-static-r71';
const SCRIPT = './app.js?v=fp-20261028-r71';
const STYLE = './styles.css?v=fp-20261028-r71';
const PRECACHE = ['./index.html','./visual-r71.html','./visual-r64.html','./fp-r60.html',SCRIPT,STYLE,'./manifest.webmanifest','./icon.svg'];

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

  // Release metadata is always network-only; never cache a stale version pointer.
  if(url.pathname.endsWith('/release.json')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }
  const navigation = request.mode === 'navigate';
  const appAsset = /\/(?:app\.js|styles\.css|manifest\.webmanifest)$/.test(url.pathname);
  const refreshPage = url.pathname.endsWith('/refresh.html') || url.pathname.endsWith('/diagnose.html');

  if(navigation || appAsset){
    event.respondWith((async()=>{
      try{
        // Avoid an iOS/Safari HTTP cache replaying stale HTML and JavaScript.
        const response=await fetch(request,{cache:'no-store'});
        if(response.ok && !refreshPage){
          const copy=response.clone();
          // Never overwrite the offline canonical index with a legacy redirect page.
          const scopePath=new URL('./',self.location.href).pathname;
          const key=navigation?
            ((url.pathname===scopePath||url.pathname.endsWith('/index.html'))?'./index.html':request):
            request;
          event.waitUntil(caches.open(CACHE).then(c=>c.put(key,copy)).catch(()=>{}));
        }
        return response;
      }catch(_){
        if(refreshPage)return Response.error();
        if(navigation){
          return await caches.match(request) || await caches.match('./index.html') ||
            await caches.match('./visual-r71.html') || Response.error();
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
