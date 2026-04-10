/// <reference lib="webworker" />

const CACHE_NAME = "shampay-pos-v2";
const STATIC_ASSETS = ["/manifest.json"];

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

// Fetch: network-first for pages and assets, skip API
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
        // Only cache successful, non-redirected, non-opaque responses
        if (
          response.status === 200 &&
          !response.redirected &&
          response.type !== "opaque"
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, return a minimal offline page
          if (e.request.mode === "navigate") {
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shampay POS - Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#334155;text-align:center}div{padding:2rem}h1{font-size:1.5rem;margin-bottom:0.5rem}p{color:#64748b}button{margin-top:1rem;padding:0.75rem 1.5rem;background:#4f46e5;color:white;border:none;border-radius:0.75rem;font-size:1rem;cursor:pointer}</style></head><body><div><h1>You are offline</h1><p>Please check your internet connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
              { status: 200, headers: { "Content-Type": "text/html" } },
            );
          }
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});
