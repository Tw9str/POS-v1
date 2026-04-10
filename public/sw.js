/// <reference lib="webworker" />

const CACHE_NAME = "shampay-pos-v1";
const STATIC_ASSETS = ["/", "/dashboard/pos", "/manifest.json"];

// Install: cache static assets
self.addEventListener("install", (event) => {
  const e = event;
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  const e = event;
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const e = event;
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== "GET") return;

  // API requests: network only (offline orders handled by IndexedDB)
  if (url.pathname.startsWith("/api/")) return;

  // For page navigations and static assets: network-first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return cached root page
          if (e.request.mode === "navigate") {
            return caches.match("/dashboard/pos");
          }
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});
