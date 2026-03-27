import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const query = params.get("q") || "";

  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    brand: "",
    minPrice: "",
    maxPrice: "",
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  /* ================= FETCH SEARCH ================= */
  const fetchSearch = useCallback(async (reset = false) => {
    if (!query) return;

    setLoading(true);

    const res = await fetch(
      `/api/search?q=${query}&page=${reset ? 1 : page}&brand=${filters.brand}&minPrice=${filters.minPrice}&maxPrice=${filters.maxPrice}`
    );

    const data = await res.json();

    setProducts((prev) =>
      reset ? data.products : [...prev, ...data.products]
    );

    setRelated(data.related || []);
    setSuggestions(data.suggestions || []);

    setHasMore(data.products.length > 0);
    setLoading(false);
  }, [query, page, filters]);

  /* ================= INIT SEARCH ================= */
  useEffect(() => {
    setProducts([]);
    setPage(1);
    fetchSearch(true);
  }, [query, filters]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        if (!loading && hasMore) {
          setPage((p) => p + 1);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore]);

  useEffect(() => {
    if (page > 1) fetchSearch();
  }, [page]);

  /* ================= TRACK CLICK ================= */
  const handleClick = async (product) => {
    await fetch("/api/search/track-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        product_id: product.id,
      }),
    });

    navigate(`/product/${product.id}`);
  };

  return (
    <div className="flex gap-6 p-4">

      {/* ================= FILTERS ================= */}
      <aside className="w-64 space-y-4 border-r pr-4">
        <h3 className="font-bold text-lg">Filters</h3>

        <input
          placeholder="Brand"
          className="border p-2 w-full"
          onChange={(e) =>
            setFilters((f) => ({ ...f, brand: e.target.value }))
          }
        />

        <input
          placeholder="Min Price"
          type="number"
          className="border p-2 w-full"
          onChange={(e) =>
            setFilters((f) => ({ ...f, minPrice: e.target.value }))
          }
        />

        <input
          placeholder="Max Price"
          type="number"
          className="border p-2 w-full"
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxPrice: e.target.value }))
          }
        />
      </aside>

      {/* ================= MAIN ================= */}
      <main className="flex-1">

        {/* QUERY HEADER */}
        <h2 className="text-xl font-bold mb-2">
          Results for "{query}"
        </h2>

        {/* SUGGESTIONS */}
        {suggestions.length > 0 && (
          <div className="mb-3 text-sm text-gray-600">
            Did you mean:
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => navigate(`/search?q=${s}`)}
                className="ml-2 underline"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* PRODUCTS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => handleClick(p)}
              className="border p-2 rounded cursor-pointer hover:shadow"
            >
              <img
                src={p.images?.[0]}
                className="h-32 w-full object-cover"
              />

              <h4 className="font-semibold mt-2 line-clamp-2">
                {p.title}
              </h4>

              <p className="text-green-600 font-bold">
                ₦{p.price}
              </p>
            </div>
          ))}
        </div>

        {/* LOADING */}
        {loading && (
          <p className="text-center py-4 text-gray-500">
            Loading...
          </p>
        )}

        {/* RELATED */}
        {related.length > 0 && (
          <div className="mt-10">
            <h3 className="font-bold mb-2">Related Products</h3>

            <div className="flex gap-3 overflow-x-auto">
              {related.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleClick(r)}
                  className="min-w-[150px] border p-2 cursor-pointer"
                >
                  <img
                    src={r.images?.[0]}
                    className="h-20 w-full object-cover"
                  />
                  <p className="text-sm">{r.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}