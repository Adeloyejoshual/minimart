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
    str.toLowerCase().replace(/[^a-z0-9s]/g, "").trim();

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
    <div className="topnav-wrapper">
      {/* 📌 STICKY HEADER */}
      <header className="top-nav sticky-header">
        <div className="nav-container">
          <button className="menu-dots" onClick={() => navigate("/menu")}>
            ⋮⋮⋮
          </button>

          <div className="nav-brand" onClick={() => navigate("/")}>
            🛒 MiniMart
          </div>
        </div>
      </header>

      {/* 🔍 STICKY SEARCH BAR */}
      <div className="search-section sticky-search">
        <div className="search-wrapper">
          <div className="search-box">
            <input
              className="search-input"
              value={search}
              placeholder="Search 10,000+ products..."
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
          </div>

          {/* 📋 SEARCH DROPDOWN */}
          {open && (search || results.length > 0) && (
            <div className="search-dropdown">
              <p className="dropdown-title">
                {results.length ? `${results.length} results` : "No results"}
              </p>

              {results.map((p, i) => (
                <div
                  key={p.id}
                  className="dropdown-item"
                  onClick={() => {
                    navigate(`/product/${p.id}`);
                    setOpen(false);
                  }}
                >
                  <img 
                    src={p?.images?.[0] || "https://via.placeholder.com/48x48/eee?text=?"} 
                    alt="" 
                    loading="lazy"
                  />

                  <div className="item-content">
                    <p className="title">
                      {i === 0 && "⭐ "}
                      {p.title}
                    </p>

                    <span className="meta">
                      ₦{Number(p.price).toLocaleString()}
                      {p.location_city && ` • ${p.location_city}`}
                    </span>
                  </div>
                </div>
              ))}

              {search && results.length === 0 && (
                <div className="dropdown-item empty">
                  <p>Try "{search}" in search</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}