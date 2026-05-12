/* 요리조리 PWA — 캐시 우선, 오프라인 셸 */
const CACHE = "yori-jori-v6";
const PRECACHE = [
  "./",
  "./index.html",
  "./sw.js",
  "./css/app.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/chef-mascot-idle.png",
  "./assets/chef-mascot-onboarding-4strip.png",
  "./assets/chef-mascot-success.png",
  "./assets/chef-mascot-success-2strip.png",
  "./assets/reference-mood.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const copy = res.clone();
        if (res.ok) {
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
    }),
  );
});
