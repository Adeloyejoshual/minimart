import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

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

  /* ================= FETCH ENGINE ================= */
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

        setProducts((prev) =>
          reset ? safe : [...prev, ...safe]
        );

        setHasMore(safe.length > 0);
      } catch (err) {
        console.error("Search error:", err);
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

  /* ================= LIVE SEARCH (AI MODE) ================= */
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

  /* ================= INFINITE SCROLL ================= */
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

  /* ================= OPEN PRODUCT ================= */
  const openProduct = (p) => {
    navigate(`/product/${p.id}`);
  };

  /* ================= EMPTY STATE ================= */
  if (!searchQuery.trim()) {
    return (
      <div className="p-6 text-gray-600">
        Search products (e.g. iPhone, Samsung, cheap phone)
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4">

      {/* ================= SEARCH BAR ================= */}
      <div className="w-full md:w-64 mb-4 md:mb-0">
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <button
          className="mt-2 w-full bg-blue-600 text-white p-2 rounded"
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
      <aside className="w-full md:w-64 border-r pr-4 space-y-3">
        <h2 className="font-bold text-lg">Filters</h2>

        <input
          className="border p-2 w-full rounded"
          placeholder="Brand"
          onChange={(e) =>
            setFilters((f) => ({ ...f, brand: e.target.value }))
          }
        />

        <input
          className="border p-2 w-full rounded"
          type="number"
          placeholder="Min Price"
          onChange={(e) =>
            setFilters((f) => ({ ...f, minPrice: e.target.value }))
          }
        />

        <input
          className="border p-2 w-full rounded"
          type="number"
          placeholder="Max Price"
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxPrice: e.target.value }))
          }
        />
      </aside>

      {/* ================= RESULTS ================= */}
      <main className="flex-1">
        <h1 className="text-xl font-bold mb-4">
          AI Results for "{searchQuery}"
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => openProduct(p)}
              className="border rounded p-2 cursor-pointer hover:shadow"
            >
              <img
                src={p?.images?.[0] || "/placeholder.png"}
                className="h-32 w-full object-cover rounded"
                alt={p.title}
              />

              <p className="font-semibold mt-2 line-clamp-2">
                {p.title}
              </p>

              <p className="text-green-600 font-bold">
                ₦{Number(p.price).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* ================= LOADING ================= */}
        {loading && (
          <div className="text-center py-6">
            <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        )}

        {/* ================= EMPTY ================= */}
        {!loading && products.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            No products found
          </div>
        )}
      </main>
    </div>
  );
}