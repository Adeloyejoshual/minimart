import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);

  /* ================= FETCH PRODUCTS ================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage"
        );
        const data = await res.json();
        setProducts(data?.latest || []);
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, []);

  /* ================= DEBOUNCE ================= */
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  /* ================= NORMALIZE ================= */
  const normalize = (str = "") =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  /* ================= SIMPLE SCORING ================= */
  const scoreMatch = (a, b) => {
    a = normalize(a);
    b = normalize(b);

    if (!a || !b) return 0;

    let match = 0;
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
      if (a[i] === b[i]) match++;
    }

    return match / Math.max(a.length, b.length);
  };

  /* ================= SEARCH ENGINE ================= */
  const results = useMemo(() => {
    if (!debounced) return [];

    const q = normalize(debounced);

    return products
      .map((p) => ({
        ...p,
        score: scoreMatch(q, normalize(p.title)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [debounced, products]);

  /* ================= SEARCH ACTION ================= */
  const goSearch = useCallback(
    (text) => {
      const q = text.trim();
      if (!q) return;

      setSearch("");
      setOpen(false);

      navigate(`/search?q=${encodeURIComponent(q)}`);
    },
    [navigate]
  );

  return (
    <div className="sticky-header">

      {/* ================= HEADER ================= */}
      <header className="top-nav">
        <div className="nav-container">

          <button className="menu-dots" onClick={() => navigate("/menu")}>
            ⋮
          </button>

          <div className="nav-brand" onClick={() => navigate("/")}>
            🛒 MiniMart
          </div>

        </div>
      </header>

      {/* ================= SEARCH ================= */}
      <div className="search-wrapper">

        <div className="search-box">

          <input
            className="search-input"
            value={search}
            placeholder="Search products..."
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch(search);
            }}
          />

          <button
            className="search-btn"
            onClick={() => goSearch(search)}
          >
            Search
          </button>

        </div>

        {/* ================= DROPDOWN ================= */}
        {open && (search || results.length > 0) && (
          <div className="search-dropdown">

            <p className="dropdown-title">Smart Results</p>

            {results.map((p, i) => (
              <div
                key={p.id}
                className="dropdown-item"
                onClick={() => goSearch(p.title)}
              >
                <img src={p?.images?.[0]} alt="" />

                <div>
                  <p className="title">
                    {i === 0 && "⭐ "}
                    {p.title}
                  </p>

                  <span className="meta">
                    {p.category} • ₦{Number(p.price).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}

          </div>
        )}

      </div>
    </div>
  );
}