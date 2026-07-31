// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import App from "./App";
import { ProductCacheProvider } from "./context/ProductCacheContext";
import "./index.css";

/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER

   The worker must exist at:
   public/sw.js

   Vite will serve it as:
   https://your-domain.com/sw.js
═══════════════════════════════════════════════════════════════ */
const registerAdvertisingServiceWorker = () => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported by this browser.");
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        console.info(
          "Advertising service worker registered:",
          registration.scope
        );

        // Check for a newer worker version.
        await registration.update();
      } catch (error) {
        console.error(
          "Advertising service worker registration failed:",
          error
        );
      }
    },
    { once: true }
  );
};

registerAdvertisingServiceWorker();

/* ═══════════════════════════════════════════════════════════════
   REACT QUERY CLIENT
═══════════════════════════════════════════════════════════════ */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,

      // Keep unused query data in memory for 30 minutes.
      gcTime: 30 * 60 * 1000,

      // Consider query data fresh for 2 minutes.
      staleTime: 2 * 60 * 1000,
    },
  },
});

/* ═══════════════════════════════════════════════════════════════
   LOCALSTORAGE PERSISTER

   Keeps cached data for 24 hours.
   Increase the buster version whenever the persisted cache
   structure needs to be reset.
═══════════════════════════════════════════════════════════════ */
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "loemart-query-cache",
  throttleTime: 1000,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

/* ═══════════════════════════════════════════════════════════════
   ROOT ELEMENT
═══════════════════════════════════════════════════════════════ */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Unable to find the root element with id="root".');
}

/* ═══════════════════════════════════════════════════════════════
   ROOT RENDER
═══════════════════════════════════════════════════════════════ */
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,

        // Keep persisted data for 24 hours.
        maxAge: 24 * 60 * 60 * 1000,

        // Change to "v2", "v3", etc. to clear old persisted data.
        buster: "v1",
      }}
    >
      <ProductCacheProvider>
        <App />
      </ProductCacheProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>
);