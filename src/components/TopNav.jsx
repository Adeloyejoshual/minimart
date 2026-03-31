import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);

  /* ================= FETCH ================= */
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
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ================= NORMALIZE ================= */
  const normalize = (str = "") =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  const similarity = (a, b) => {
    a = normalize(a);
    b = normalize(b);

    if (!a || !b) return 0;

    let matches = 0;
    const len = Math.max(a.length, b.length);

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) matches++;
    }

    return matches / len;
  };

  /* ================= SEARCH ================= */
  const smartSearch = (items, query) => {
    const q = normalize(query);

    return items
      .map((p) => ({
        ...p,
        _score: similarity(q, normalize(p.title)) * 100,
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  };

  const results = useMemo(() => {
    if (!debounced) return [];
    return smartSearch(products, debounced);
  }, [debounced, products]);

  /* ================= NAV ================= */
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
    <>
      {/* ================= TOP NAV ================= */}
      <header className="top-nav">
        <div className="nav-container">
          <button
            className="menu-dots"
            onClick={() => navigate("/menu")}
          >
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

          {/* 🔥 INLINE SEARCH ICON */}
          <button
            className="search-icon"
            onClick={() => goSearch(search)}
          >
            🔍
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
    </>
  );
}