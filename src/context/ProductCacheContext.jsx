import { createContext, useContext, useState, useRef } from "react";

const ProductCacheContext = createContext();

export function ProductCacheProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // prevents duplicate inserts across pages
  const productIdsRef = useRef(new Set());

  const addProducts = (newItems) => {
    setProducts((prev) => {
      const filtered = [];

      for (const p of newItems) {
        if (!productIdsRef.current.has(p.id)) {
          productIdsRef.current.add(p.id);
          filtered.push(p);
        }
      }

      return [...prev, ...filtered];
    });
  };

  const addSingleProduct = (product) => {
    if (productIdsRef.current.has(product.id)) return;

    productIdsRef.current.add(product.id);
    setProducts((prev) => [product, ...prev]);
  };

  const resetCache = () => {
    setProducts([]);
    setTrending([]);
    productIdsRef.current.clear();
    setLoaded(false);
  };

  return (
    <ProductCacheContext.Provider
      value={{
        products,
        setProducts: addProducts,
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
  return useContext(ProductCacheContext);
}