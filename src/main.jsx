// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import App from "./App";
import { ProductCacheProvider } from "./context/ProductCacheContext";
import { ErrorBoundary } from "./components/AppRecovery";
import "./index.css";

/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER
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
      // Keep unused query data in memory for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Consider query data fresh for 2 minutes
      staleTime: 2 * 60 * 1000,
    },
  },
});

/* ═══════════════════════════════════════════════════════════════
   LOCALSTORAGE PERSISTER
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
    {/* ErrorBoundary catches blank-screen crashes & chunk load failures */}
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // Keep persisted data for 24 hours
          maxAge: 24 * 60 * 60 * 1000,
          // Bump to "v2", "v3" etc. to wipe old cache structure
          buster: "v1",
        }}
      >
        <ProductCacheProvider>
          <App />
        </ProductCacheProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);