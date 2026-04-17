import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const debounceRef = useRef();
  const observerRef = useRef();

  // Stable fetcher
  const fetchSearch = useCallback(async (reset = false, overrideQuery = null) => {
    const query = (overrideQuery || searchQuery).trim();
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
      setTotal(data.total || safeProducts.length);
      setHasMore(safeProducts.length === 24);
      setPage(reset ? 2 : page);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to load results. Check connection.");
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
      fetchSearch(true, q);
    }
  }, [searchParams, fetchSearch]);

  // Live search - Enter only
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      navigate(`?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
    }
  };

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

  const title = useMemo(() => {
    const q = searchQuery.trim();
    if (searchParams.get("price_max") === "10000") return "🔥 Hot Deals Under ₦10K";
    if (searchParams.get("promoted") === "true") return "⚡ Flash Sales";
    if (searchParams.get("sort") === "price") return "💸 Cheapest First";
    return q ? `"${q}" (${total} results)` : "Recent Searches";
  }, [searchQuery, searchParams, total]);

  return (
    <div className="search-page">
      <TopNav />
      <main className="search-main">
        {/* Minimal Header - Like Jiji/Konga */}
        <div className="search-bar">
          <input
            className="search-input-full"
            placeholder="Search products, brands, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        {/* Results Header */}
        <div className="results-header">
          <h1>{title}</h1>
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
            {page === 1 ? "Finding products..." : "Loading more..."}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {!loading && products.length === 0 && !searchQuery && (
          <div className="empty">
            <div>🔍</div>
            <p>Type and hit Enter to search</p>
          </div>
        )}
        {!loading && products.length === 0 && searchQuery && (
          <div className="empty">
            <div>❌</div>
            <p>No results for "{searchQuery}"</p>
            <p>Try different keywords</p>
          </div>
        )}

        <div ref={observerRef} className="load-trigger">
          {hasMore ? "↓ Scroll for more ↓" : `${total} results loaded`}
        </div>
      </main>
    </div>
  );
}