import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const query = params.get("q") || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    brand: "",
    minPrice: "",
    maxPrice: "",
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  /* ================= SAFE FETCH ================= */
  const fetchSearch = async (reset = false) => {
    if (!query) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/search?q=${query}&page=${reset ? 1 : page}&brand=${filters.brand}&minPrice=${filters.minPrice}&maxPrice=${filters.maxPrice}`
      );

      if (!res.ok) throw new Error("Search request failed");

      const data = await res.json();

      const safeProducts = Array.isArray(data?.products)
        ? data.products
        : [];

      setProducts((prev) =>
        reset ? safeProducts : [...prev, ...safeProducts]
      );

      setHasMore(safeProducts.length > 0);
    } catch (err) {
      console.error("Search error:", err);
      setProducts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    setProducts([]);
    setPage(1);
    fetchSearch(true);
  }, [query, filters]);

  /* ================= PAGINATION ================= */
  useEffect(() => {
    if (page > 1) fetchSearch();
  }, [page]);

  /* ================= INFINITE SCROLL ================= */
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        if (!loading && hasMore) {
          setPage((p) => p + 1);
        }
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasMore]);

  /* ================= PRODUCT CLICK ================= */
  const handleClick = (product) => {
    navigate(`/product/${product.id}`);
  };

  /* ================= EMPTY STATE ================= */
  if (!query) {
    return (
      <div className="p-6 text-gray-600">
        Enter a search term to start searching products.
      </div>
    );
  }

  return (
    <div className="flex gap-6 p-4">

      {/* ================= FILTERS ================= */}
      <aside className="w-64 border-r pr-4 space-y-3">
        <h2 className="font-bold text-lg">Filters</h2>

        <input
          className="border p-2 w-full"
          placeholder="Brand"
          onChange={(e) =>
            setFilters((f) => ({ ...f, brand: e.target.value }))
          }
        />

        <input
          className="border p-2 w-full"
          type="number"
          placeholder="Min Price"
          onChange={(e) =>
            setFilters((f) => ({ ...f, minPrice: e.target.value }))
          }
        />

        <input
          className="border p-2 w-full"
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
          Results for "{query}"
        </h1>

        {/* PRODUCTS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => handleClick(p)}
              className="border rounded p-2 cursor-pointer hover:shadow"
            >
              <img
                src={p.images?.[0] || "/placeholder.png"}
                className="h-32 w-full object-cover"
                alt=""
              />

              <p className="font-semibold mt-2 line-clamp-2">
                {p.title}
              </p>

              <p className="text-green-600 font-bold">
                ₦{p.price}
              </p>
            </div>
          ))}
        </div>

        {/* LOADING */}
        {loading && (
          <div className="text-center py-4 text-gray-500">
            Loading...
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && products.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            No products found
          </div>
        )}

      </main>
    </div>
  );
}