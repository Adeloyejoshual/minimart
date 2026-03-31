import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = params.get("q") || "";

  /* ================= STATE ================= */
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [products, setProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);

  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const debounceRef = useRef(null);

  /* ================= FETCH SEARCH ================= */
  const fetchSearch = useCallback(
    async (reset = false, queryOverride = null) => {
      const q = (queryOverride ?? searchQuery).trim();

      if (!q) return;

      try {
        setLoading(true);

        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&page=${reset ? 1 : page}`
        );

        const data = await res.json();
        const safe = Array.isArray(data?.products) ? data.products : [];

        setProducts((prev) => (reset ? safe : [...prev, ...safe]));
        setHasMore(safe.length > 0);
      } catch (err) {
        console.error(err);
        setProducts([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, page]
  );

  /* ================= FETCH TRENDING ================= */
  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(`/api/trending-products`);
      const data = await res.json();

      setTrending(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      console.error(err);
      setTrending([]);
    }
  }, []);

  /* ================= FETCH RECENT ================= */
  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/recent-products`);
      const data = await res.json();

      setRecent(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      console.error(err);
      setRecent([]);
    }
  }, []);

  /* ================= INIT LOAD ================= */
  useEffect(() => {
    fetchTrending();
    fetchRecent();
  }, []);

  /* ================= URL SYNC ================= */
  useEffect(() => {
    setSearchQuery(urlQuery);
    setProducts([]);
    setPage(1);

    if (urlQuery) fetchSearch(true, urlQuery);
  }, [urlQuery]);

  /* ================= LIVE SEARCH ================= */
  useEffect(() => {
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setProducts([]);
      setPage(1);

      if (searchQuery.trim()) {
        fetchSearch(true);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  /* ================= PAGINATION ================= */
  useEffect(() => {
    if (page === 1) return;
    fetchSearch(false);
  }, [page]);

  /* ================= SCROLL ================= */
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        if (!loading && hasMore && searchQuery.trim()) {
          setPage((p) => p + 1);
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasMore, searchQuery]);

  const openProduct = (p) => {
    navigate(`/product/${p.id}`);
  };

  /* ================= DATA DECISION ENGINE ================= */
  const hasSearch = searchQuery.trim().length > 0;

  const displayProducts = hasSearch
    ? products
    : trending.length > 0
    ? trending
    : recent;

  const title = hasSearch
    ? `Results for "${searchQuery}"`
    : trending.length > 0
    ? "🔥 Trending Products"
    : "🆕 Recent Products";

  return (
    <div className="search-page">

      {/* ================= GLOBAL NAV ================= */}
      <TopNav />

      {/* ================= RESULTS ================= */}
      <main className="results">

        <h1 className="results-title">
          {title}
        </h1>

        <div className="products-grid">
          {displayProducts.map((p) => (
            <div
              key={p.id}
              className="product-card"
              onClick={() => openProduct(p)}
            >
              <img
                src={p?.images?.[0] || "/placeholder.png"}
                alt={p.title}
              />

              <div className="info">
                <p className="title">{p.title}</p>
                <p className="price">
                  ₦{Number(p.price).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ================= LOADING ================= */}
        {loading && <div className="spinner" />}

        {/* ================= EMPTY ================= */}
        {!loading && displayProducts.length === 0 && (
          <div className="empty-state">
            No products available
          </div>
        )}
      </main>
    </div>
  );
}