// Minimal app-shell service worker — just enough for PWA install
// criteria. No offline data sync yet (the Dexie queue handles pending
// writes at the app layer); this only keeps the shell reachable.
const CACHE_NAME = "cairn-shell-v1";
const SHELL_URLS = ["/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build assets are immutable — serve from cache, fill on miss.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Navigations go network-first; fall back to the cached login shell
  // only when the network is unreachable. Everything else (API calls,
  // server actions) passes through untouched.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/login")));
  }
});
