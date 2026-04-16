"use client";

import { useEffect, useCallback, useState } from "react";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const [showUpdate, setShowUpdate] = useState(false);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
      // Reload once the new SW takes control
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for waiting worker on load
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Detect new SW installing
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setShowUpdate(true);
            }
          });
        });

        // Register Background Sync
        registerBackgroundSync(registration);

        // Precache key app routes after SW active
        if (registration.active) {
          precacheAppShell();
        } else {
          navigator.serviceWorker.ready.then(() => precacheAppShell());
        }
      })
      .catch(() => {
        // SW registration failed · silently ignore
      });

    // Listen for sync requests from SW
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        // Dispatch custom event so useOffline hook can pick it up
        window.dispatchEvent(new CustomEvent("sw-sync-requested"));
      }
    });
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-9999 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm font-medium">
      <span>A new version is available</span>
      <button
        onClick={applyUpdate}
        className="bg-white text-indigo-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
      >
        Update
      </button>
    </div>
  );
}

/** Register Background Sync if supported */
function registerBackgroundSync(registration: ServiceWorkerRegistration) {
  // One-shot background sync
  if ("sync" in registration) {
    (
      registration as unknown as {
        sync: { register: (tag: string) => Promise<void> };
      }
    ).sync
      .register("shampay-sync")
      .catch(() => {});
  }

  // Periodic background sync (if available)
  if ("periodicSync" in registration) {
    (
      registration as unknown as {
        periodicSync: {
          register: (
            tag: string,
            opts: { minInterval: number },
          ) => Promise<void>;
        };
      }
    ).periodicSync
      .register("shampay-periodic-sync", { minInterval: 60 * 60 * 1000 })
      .catch(() => {});
  }
}

/** Ask SW to cache key dashboard routes for offline access */
function precacheAppShell() {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;

  controller.postMessage({
    type: "CACHE_URLS",
    urls: [
      "/dashboard",
      "/dashboard/pos",
      "/dashboard/products",
      "/dashboard/orders",
      "/dashboard/customers",
    ],
  });
}
