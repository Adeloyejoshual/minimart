import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const observerRef = useRef();

  // ✅ STABLE QUERY PARAMS
  const queryParams = useMemo(() => Object.fromEntries(searchParams), [searchParams]);
  const urlQuery = searchParams.get("q") || "";

  // ✅ FIXED FETCHER - No searchQuery dep!
  const fetchSearch = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: urlQuery,
        page: reset ? "1" : page.toString(),
        limit: "24",
        ...queryParams
      });

      console.log("🔍 Fetching:", `/api/search?${params}`); // DEBUG

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log("📦 API Response:", { products: data.products?.length, total: data.total }); // DEBUG

      const safeProducts = Array.isArray(data.products) ? data.products : [];
      setProducts(prev => reset ? safeProducts : [...prev, safeProducts]);
      setHasMore(safeProducts.length === 24);
      if (reset) setPage(2);
    } catch (err) {
      console.error("❌ Search error:", err);
      setError(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [urlQuery, queryParams, page]); // ✅ Stable!

  // ✅ SINGLE INIT EFFECT
  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    if (urlQuery || queryParams.price_max || queryParams.promoted) {
      fetchSearch(true);
    }
  }, [urlQuery, queryParams, fetchSearch]); // Only real changes

  // ✅ PAGE LOAD
  useEffect(() => {
    if (page > 1) fetchSearch(false);
  }, [page, fetchSearch]);

  // Infinite scroll
  useEffect(() => {
    const node = observerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && hasMore && !loading && setPage(p => p + 1),
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const openProduct = useCallback((product) => {
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  return (
    <div className="search-page">
      <TopNav />
      <main className="search-main">
        <div className="results-header">
          <h1>{products.length} results found</h1>
          <p>Query: "{urlQuery}" (Page {page})</p>
        </div>

        <div className="search-results">
          {products.map((product) => (
            <div key={product.id} className="search-card" onClick={() => openProduct(product)}>
              <div className="card-image">
                <img src={product.images?.[0] || "/placeholder.png"} alt={product.title} loading="lazy" />
                {product.is_promoted && <span className="promo-badge">🔥</span>}
              </div>
              <div className="card-content">
                <h3>{product.title}</h3>
                <div className="card-price">₦{Number(product.price).toLocaleString()}</div>
                <div className="card-meta">
                  {product.location_city} • {product.views?.toLocaleString() || 0} views
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            {page === 1 ? "Loading..." : "Loading more..."}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {!loading && !products.length && (
          <div className="empty">
            <div>🔍</div>
            <h3>No results</h3>
            <p>Check Console for API details</p>
          </div>
        )}

        <div ref={observerRef} className="load-trigger">
          {hasMore ? "↓ Scroll for more ↓" : "End"}
        </div>
      </main>
    </div>
  );
}