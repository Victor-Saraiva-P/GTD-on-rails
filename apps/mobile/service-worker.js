const CACHE_NAME = "gtd-mobile-shell-v3";
const SHELL = [
  "/mobile/",
  "/mobile/index.html",
  "/mobile/app.css",
  "/mobile/base.css",
  "/mobile/app.js",
  "/mobile/offline-store.js",
  "/mobile/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteOldCaches());
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!new URL(event.request.url).pathname.startsWith("/mobile/")) return;
  event.respondWith(cacheFirst(event.request));
});

async function deleteOldCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}
