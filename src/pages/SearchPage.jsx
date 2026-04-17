import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const observerRef = useRef();

  // Stable fetcher
  const fetchSearch = useCallback(async (reset = false) => {
    const query = searchQuery.trim();
    if (!query && !searchParams.has("price_max") && !searchParams.has("promoted")) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: query || "",
        page: reset ? "1" : page.toString(),
        limit: "24",
        ...Object.fromEntries(searchParams)
      });

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error(`API: ${res.status}`);

      const data = await res.json();
      const safeProducts = Array.isArray(data.products) ? data.products : [];

      setProducts(prev => reset ? safeProducts : [...prev, safeProducts]);
      setHasMore(safeProducts.length === 24);
      setPage(reset ? 2 : page);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to load results.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchParams, page]);

  // Initial load
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQuery(q);
    setProducts([]);
    setPage(1);
    setHasMore(true);
    if (q || searchParams.get("price_max") || searchParams.get("promoted")) {
      fetchSearch(true);
    }
  }, [searchParams, fetchSearch]);

  // Load next page
  useEffect(() => {
    if (page > 1) fetchSearch(false);
  }, [page, fetchSearch]);

  // Infinite scroll
  useEffect(() => {
    const node = observerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) setPage(p => p + 1);
      },
      { threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const openProduct = useCallback((product) => {
    navigate(`/product/${product.id}`);
  }, [navigate]);

  const resultCount = products.length === 1 ? "result" : "results";

  return (
    <div className="search-page">
      <TopNav />
      <main className="search-main">
        {/* Results count only */}
        <div className="results-header">
          <h1>{products.length} {resultCount} found</h1>
        </div>

        {/* Results */}
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

        {/* States */}
        {loading && (
          <div className="loading">
            <div className="spinner" />
            {page === 1 ? "Loading products..." : "Loading more..."}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {!loading && products.length === 0 && (
          <div className="empty">
            <div>🔍</div>
            <h3>No results found</h3>
            <p>Use TopNav search or try different keywords</p>
          </div>
        )}

        <div ref={observerRef} className="load-trigger">
          {hasMore ? "↓ Scroll for more ↓" : "All results loaded"}
        </div>
      </main>
    </div>
  );
}