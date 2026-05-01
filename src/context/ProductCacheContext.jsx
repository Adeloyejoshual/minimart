// src/context/ProductCacheContext.jsx
import { createContext, useContext, useState, useRef, useCallback } from "react";

const ProductCacheContext = createContext(null);

export function ProductCacheProvider({ children }) {
  const [products, setProductsState] = useState([]);
  const [trending, setTrending]      = useState([]);
  const [loaded,   setLoaded]        = useState(false);

  const seenIds = useRef(new Set());

  /**
   * FULL REPLACE — wipes existing pool and sets a new one.
   * Called by Homepage after a fresh network fetch.
   */
  const setProducts = useCallback((items = []) => {
    seenIds.current = new Set(items.map((p) => p.id));
    setProductsState(items);
  }, []);

  /**
   * APPEND — deduplicates against existing pool.
   * Called when lazily loading more pages.
   */
  const addProducts = useCallback((items = []) => {
    setProductsState((prev) => {
      const next = [...prev];
      for (const p of items) {
        if (!seenIds.current.has(p.id)) {
          seenIds.current.add(p.id);
          next.push(p);
        }
      }
      return next;
    });
  }, []);

  /**
   * PREPEND — adds a single freshly created listing to the top.
   * Called after a seller posts a new product.
   */
  const addSingleProduct = useCallback((product) => {
    if (!product?.id || seenIds.current.has(product.id)) return;
    seenIds.current.add(product.id);
    setProductsState((prev) => [product, ...prev]);
  }, []);

  /**
   * RESET — full wipe (called on logout or hard refresh).
   */
  const resetCache = useCallback(() => {
    seenIds.current.clear();
    setProductsState([]);
    setTrending([]);
    setLoaded(false);
  }, []);

  return (
    <ProductCacheContext.Provider
      value={{
        products,
        setProducts,     // full replace
        addProducts,     // deduplicated append
        addSingleProduct,
        trending,
        setTrending,
        loaded,
        setLoaded,
        resetCache,
      }}
    >
      {children}
    </ProductCacheContext.Provider>
  );
}

export function useProductCache() {
  const ctx = useContext(ProductCacheContext);
  if (!ctx) throw new Error("useProductCache must be used inside ProductCacheProvider");
  return ctx;
}
