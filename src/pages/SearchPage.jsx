import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = params.get("q") || "";

  /* ================= STATE ================= */
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    brand: "",
    minPrice: "",
    maxPrice: "",
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const debounceRef = useRef(null);

  /* ================= FETCH ================= */
  const fetchSearch = useCallback(
    async (reset = false, queryOverride = null) => {
      const q = (queryOverride ?? searchQuery).trim();
      if (!q) return;

      try {
        setLoading(true);

        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&page=${
            reset ? 1 : page
          }&brand=${filters.brand}&minPrice=${
            filters.minPrice
          }&maxPrice=${filters.maxPrice}`
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
    [searchQuery, page, filters]
  );

  /* ================= URL SYNC ================= */
  useEffect(() => {
    setSearchQuery(urlQuery);
    setProducts([]);
    setPage(1);

    if (urlQuery) fetchSearch(true, urlQuery);
  }, [urlQuery]);

  /* ================= LIVE SEARCH ================= */
  useEffect(() => {
    if (!searchQuery.trim()) return;

    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setProducts([]);
      setPage(1);
      fetchSearch(true);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, filters]);

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
        if (!loading && hasMore) setPage((p) => p + 1);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasMore]);

  const openProduct = (p) => {
    navigate(`/product/${p.id}`);
  };

  /* ================= EMPTY ================= */
  if (!searchQuery.trim()) {
    return (
      <div className="empty-state">
        Search products (e.g. iPhone, Samsung, cheap phone)
      </div>
    );
  }

  return (
    <div className="search-page">

      {/* ================= SEARCH ================= */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <button
          onClick={() => {
            setProducts([]);
            setPage(1);
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            fetchSearch(true);
          }}
        >
          Search
        </button>
      </div>

      {/* ================= FILTERS ================= */}
      <aside className="filters">
        <h2>Filters</h2>

        <input
          placeholder="Brand"
          onChange={(e) =>
            setFilters((f) => ({ ...f, brand: e.target.value }))
          }
        />

        <input
          type="number"
          placeholder="Min Price"
          onChange={(e) =>
            setFilters((f) => ({ ...f, minPrice: e.target.value }))
          }
        />

        <input
          type="number"
          placeholder="Max Price"
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxPrice: e.target.value }))
          }
        />
      </aside>

      {/* ================= RESULTS ================= */}
      <main className="results">
        <h1>Results for "{searchQuery}"</h1>

        <div className="products-grid">
          {products.map((p) => (
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
        {!loading && products.length === 0 && (
          <div className="empty-state">No products found</div>
        )}
      </main>
    </div>
  );
}