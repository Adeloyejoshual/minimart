import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/SearchPage.css";

export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [recent, setRecent] = useState([]);
  const [trending] = useState([
    "iPhone 6",
    "iPhone 11",
    "Samsung Galaxy",
    "Blender",
    "Shoes",
    "Laptop"
  ]);

  /* ================= LOAD RECENT ================= */
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recent_searches") || "[]");
    setRecent(stored);
  }, []);

  const saveRecent = (q) => {
    if (!q.trim()) return;

    const updated = [q, ...recent.filter((r) => r !== q)].slice(0, 10);
    setRecent(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
  };

  /* ================= SMART GROUPING ================= */
  const normalizeQuery = (q) => {
    const lower = q.toLowerCase();

    if (lower.includes("iphone")) return "iphone";
    if (lower.includes("samsung")) return "samsung";
    return q;
  };

  /* ================= SEARCH ================= */
  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);

      try {
        const res = await axios.get(
          `/api/search/live?q=${encodeURIComponent(normalizeQuery(query))}`
        );

        setResults(Array.isArray(res.data) ? res.data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200); // ⚡ instant feel

    return () => clearTimeout(timeout);
  }, [query]);

  /* ================= NAV ================= */
  const openProduct = (id) => {
    saveRecent(query);
    navigate(`/product/${id}`);
  };

  const runSearch = (q) => {
    setQuery(q);
    setParams({ q });
  };

  const addToWishlist = (p) => {
    const list = JSON.parse(localStorage.getItem("wishlist") || "[]");
    const exists = list.find((x) => x.id === p.id);

    if (!exists) {
      const updated = [...list, p];
      localStorage.setItem("wishlist", JSON.stringify(updated));
    }
  };

  return (
    <div className="search-page">

      {/* ================= SEARCH BAR ================= */}
      <div className="search-header">
        <input
          value={query}
          placeholder="Search products..."
          onChange={(e) => {
            setQuery(e.target.value);
            setParams({ q: e.target.value });
          }}
        />
      </div>

      {/* ================= SUGGESTIONS ================= */}
      {!query && (
        <div className="search-section">
          <h3>🔥 Trending</h3>
          <div className="chip-list">
            {trending.map((t, i) => (
              <button key={i} onClick={() => runSearch(t)}>
                {t}
              </button>
            ))}
          </div>

          <h3>🕘 Recent</h3>
          <div className="chip-list">
            {recent.map((r, i) => (
              <button key={i} onClick={() => runSearch(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ================= RESULTS ================= */}
      <div className="results">

        {loading && <div className="loading">Searching...</div>}

        {!loading && results.length === 0 && query && (
          <div className="empty">No products found</div>
        )}

        {results.map((p) => (
          <div key={p.id} className="product-card">

            <img
              src={p.image || p.images?.[0] || "/placeholder.png"}
              alt=""
              onClick={() => openProduct(p.id)}
            />

            <div className="info" onClick={() => openProduct(p.id)}>
              <h4>{p.title}</h4>
              <p>₦{Number(p.price || 0).toLocaleString()}</p>
            </div>

            {/* ❤️ Wishlist */}
            <button
              className="wish"
              onClick={() => addToWishlist(p)}
            >
              ❤️
            </button>

          </div>
        ))}

      </div>
    </div>
  );
}