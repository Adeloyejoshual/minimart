import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ================= STATES ================= */
  const urlQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const debounceRef = useRef(null);
  const observerRef = useRef();

  /* ================= FETCH ================= */
  const fetchSearch = useCallback(async (reset = false, queryOverride = null) => {
    const q = (queryOverride ?? searchQuery).trim();
    
    try {
      setLoading(true);
      
      // Build params
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      if (!reset) params.set("page", page.toString());
      
      const url = `/api/search?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      const safeProducts = Array.isArray(data?.products) ? data.products : [];
      
      setProducts(prev => reset ? safeProducts : [...prev, ...safeProducts]);
      setTotal(data.total || 0);
      setHasMore(safeProducts.length === (reset ? data.perPage || 24 : 24));
      
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchParams, page]);

  /* ================= INIT ================= */
  useEffect(() => {
    setSearchQuery(urlQuery);
    setProducts([]);
    setPage(1);
    
    if (urlQuery || searchParams.get("price_max") || searchParams.get("promoted")) {
      fetchSearch(true, urlQuery);
    }
  }, [searchParams]);

  /* ================= LIVE SEARCH ================= */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        navigate(`?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, navigate]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    if (page === 1) return;

    fetchSearch(false);
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && hasMore) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [loading, hasMore]);

  const openProduct = (p) => {
    navigate(`/product/${p.id}`);
  };

  /* ================= TITLE ================= */
  const getTitle = () => {
    const q = searchQuery.trim();
    const priceMax = searchParams.get("price_max");
    const promoted = searchParams.get("promoted");

    if (priceMax === "10000") return "🔥 Hot Deals Under ₦10K";
    if (promoted === "true") return "⚡ Flash Sale Products";
    if (searchParams.get("sort") === "price") return "💸 Cheapest First";
    
    return q ? `"${q}"` : "Search Products";
  };

  const resultCount = products.length === 1 ? "result" : "results";

  return (
    <div className="search-page">
      <TopNav />

      <main className="search-main">
        {/* 🎯 HEADER */}
        <div className="search-header">
          <div className="search-title">
            <h1>{getTitle()}</h1>
            <p className="count">{total} {resultCount} found</p>
          </div>
          
          <div className="search-input-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 📱 RESULTS */}
        <div className="search-results">
          {products.length > 0 ? (
            products.map((product) => (
              <div
                key={product.id}
                className="search-card"
                onClick={() => openProduct(product)}
              >
                <div className="card-image">
                  <img
                    src={product.images?.[0] || "/placeholder.png"}
                    alt={product.title}
                    loading="lazy"
                  />
                  {product.is_promoted && (
                    <span className="promo-badge">🔥</span>
                  )}
                </div>
                
                <div className="card-content">
                  <h3 className="card-title">{product.title}</h3>
                  <div className="card-price">₦{Number(product.price).toLocaleString()}</div>
                  <div className="card-meta">
                    <span>{product.location_city || 'Nationwide'}</span>
                    <span>{product.views?.toLocaleString() || 0} views</span>
                  </div>
                </div>
              </div>
            ))
          ) : !loading ? (
            <div className="empty-search">
              <div className="empty-icon">🔍</div>
              <h3>No results found</h3>
              <p>Try different keywords or check spelling</p>
            </div>
          ) : null}
        </div>

        {/* 🔄 LOADING */}
        {loading && (
          <div className="loading-container">
            <div className="spinner" />
            <p>Loading more results...</p>
          </div>
        )}

        {/* 📈 LOAD MORE TRIGGER */}
        {hasMore && !loading && (
          <div ref={observerRef} className="load-trigger">
            ↓ Load more ↓
          </div>
        )}
      </main>
    </div>
  );
}