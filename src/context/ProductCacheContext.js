// src/context/ProductCacheContext.js
import { createContext, useContext, useEffect, useState } from "react";

const ProductCacheContext = createContext();

const STORAGE_KEY = "marketplace_cache_v1";

export function ProductCacheProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loaded, setLoaded] = useState(false);

  /* ================= LOAD FROM LOCALSTORAGE ================= */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProducts(parsed.products || []);
        setTrending(parsed.trending || []);
        setLoaded(true);
      } catch (err) {
        console.error("Cache parse error", err);
      }
    }
  }, []);

  /* ================= SAVE TO LOCALSTORAGE ================= */
  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products,
        trending,
      })
    );
  }, [products, trending, loaded]);

  return (
    <ProductCacheContext.Provider
      value={{
        products,
        setProducts,
        trending,
        setTrending,
        loaded,
        setLoaded,
      }}
    >
      {children}
    </ProductCacheContext.Provider>
  );
}

export const useProductCache = () => useContext(ProductCacheContext);