// offline: app shell up front, pages cached the first time they are opened
const CACHE = "color-buddies-v1";
const SHELL = ["./", "index.html", "manifest.json", "pages.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// images never change: cache first. App files may be updated: network first, cache when offline.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const keep = res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; };
  if (/\.(png|jpg)$/.test(new URL(e.request.url).pathname))
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(keep)));
  else
    e.respondWith(fetch(e.request).then(keep).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
