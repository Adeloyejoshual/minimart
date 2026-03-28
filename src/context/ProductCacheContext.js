// src/context/ProductCacheContext.js
import { createContext, useContext, useState } from "react";

const ProductCacheContext = createContext();

export function ProductCacheProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loaded, setLoaded] = useState(false);

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