// src/main.jsx
import React                               from "react";
import ReactDOM                            from "react-dom/client";
import { QueryClient }                     from "@tanstack/react-query";
import { PersistQueryClientProvider }      from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister }      from "@tanstack/query-sync-storage-persister";

import App                                 from "./App";
import { ProductCacheProvider }            from "./context/ProductCacheContext";
import "./index.css";

/* ═══════════════════════════════════════════════════════════════
   REACT QUERY CLIENT
═══════════════════════════════════════════════════════════════ */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus : true,
      refetchOnReconnect   : true,
      retry                : 2,
      gcTime               : 30 * 60 * 1000,  // 30 min in-memory
      staleTime            :  2 * 60 * 1000,  //  2 min before refetch
    },
  },
});

/* ═══════════════════════════════════════════════════════════════
   LOCALSTORAGE PERSISTER
   Keeps cached data alive for 24 h — profile loads offline
   Bump "buster" string any time you want to wipe old cache
═══════════════════════════════════════════════════════════════ */
const persister = createSyncStoragePersister({
  storage      : window.localStorage,
  key          : "loemart-query-cache",
  throttleTime : 1000,
  serialize    : JSON.stringify,
  deserialize  : JSON.parse,
});

/* ═══════════════════════════════════════════════════════════════
   ROOT RENDER
═══════════════════════════════════════════════════════════════ */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge : 24 * 60 * 60 * 1000,  // 24 h offline cache
        buster : "v1",                  // bump to wipe stale cache
      }}
    >
      <ProductCacheProvider>
        <App />
      </ProductCacheProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>
);