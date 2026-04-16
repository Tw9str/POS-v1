/// <reference lib="webworker" />

// ─────────────────────────────────────────────
// Shampay POS · Service Worker
// ─────────────────────────────────────────────

const CACHE_VERSION = "v3";
const STATIC_CACHE = `shampay-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `shampay-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `shampay-images-${CACHE_VERSION}`;

// Core app shell assets to precache
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// ─── Install ────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ───────────────────────────────
self.addEventListener("activate", (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !currentCaches.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch strategies ───────────────────────

/**
 * Stale-while-revalidate: return cache immediately, update in background.
 * Used for static assets (JS, CSS, fonts).
 */
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    }),
  );
}

/**
 * Network-first with cache fallback.
 * Used for HTML page navigations.
 */
function networkFirst(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response.ok && !response.redirected) {
        const clone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        // For navigations, serve inline offline page
        if (request.mode === "navigate") {
          return new Response(offlineHTML(), {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("Offline", { status: 503 });
      }),
    );
}

/**
 * Cache-first with network fallback.
 * Used for images.
 */
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      });
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== "GET") return;

  // Skip API requests — handled by IndexedDB offline layer
  if (url.pathname.startsWith("/api/")) return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith("http")) return;

  // Images: cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/) ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(event.request, IMAGE_CACHE));
    return;
  }

  // Static assets (JS, CSS, fonts): stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  // Page navigations & everything else: network-first
  event.respondWith(networkFirst(event.request, DYNAMIC_CACHE));
});

// ─── Background Sync ────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "shampay-sync") {
    event.waitUntil(notifyClientsToSync());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "shampay-periodic-sync") {
    event.waitUntil(notifyClientsToSync());
  }
});

/** Tell all client windows to trigger a sync */
function notifyClientsToSync() {
  return self.clients.matchAll({ type: "window" }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_REQUESTED" });
    });
  });
}

// ─── Push notifications (future) ────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || "Shampay POS", {
        body: data.body || "",
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        data: data.url ? { url: data.url } : undefined,
      }),
    );
  } catch {
    // ignore malformed push
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard/pos";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});

// ─── Message handler ────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_URLS") {
    const urls = event.data.urls;
    if (Array.isArray(urls)) {
      event.waitUntil(
        caches.open(DYNAMIC_CACHE).then((cache) =>
          Promise.allSettled(
            urls.map((u) =>
              fetch(u).then((res) => {
                if (res.ok) cache.put(u, res);
              }),
            ),
          ),
        ),
      );
    }
  }
});

// ─── Inline offline HTML ────────────────────
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#2563eb">
  <title>Shampay POS - Offline</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;background:#f8fafc;color:#334155;text-align:center}
    .c{padding:2rem;max-width:24rem}
    .icon{width:4rem;height:4rem;margin:0 auto 1.5rem;background:#e0e7ff;border-radius:1rem;display:flex;align-items:center;justify-content:center}
    .icon svg{width:2rem;height:2rem;color:#4f46e5}
    h1{font-size:1.25rem;font-weight:600;margin-bottom:0.5rem}
    p{color:#64748b;font-size:0.925rem;line-height:1.5;margin-bottom:1.5rem}
    button{padding:0.75rem 2rem;background:#4f46e5;color:white;border:none;border-radius:0.75rem;font-size:0.975rem;font-weight:500;cursor:pointer;transition:background 0.15s}
    button:hover{background:#4338ca}
    .sub{margin-top:1rem;font-size:0.8rem;color:#94a3b8}
  </style>
</head>
<body>
  <div class="c">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
      </svg>
    </div>
    <h1>You're offline</h1>
    <p>Don't worry — your data is saved locally. Once you reconnect, everything will sync automatically.</p>
    <button onclick="location.reload()">Try again</button>
    <p class="sub">If the POS page was loaded before, try navigating to it directly.</p>
  </div>
</body>
</html>`;
}
