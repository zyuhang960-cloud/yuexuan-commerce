/* 悦选商城 Service Worker：静态资源缓存，接口一律走网络，保证数据实时 */
const CACHE = "yuexuan-v1";
const SHELL = [
  "/",
  "/styles.css",
  "/app.js",
  "/catalog-data.js",
  "/data-service.js",
  "/server-api.js",
  "/vendor/aos/aos.css",
  "/vendor/aos/aos.js",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // 接口不缓存

  // 页面导航走网络优先，避免改版后仍显示旧页面；断网时回退缓存
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && /\.(css|js|png|webp|woff2|svg|webmanifest)$/i.test(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached || Response.error());
    })
  );
});
