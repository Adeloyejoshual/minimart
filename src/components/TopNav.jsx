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
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ================= NORMALIZE ================= */
  const normalize = (str = "") =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

  /* ================= FUZZY MATCH ================= */
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

  /* ================= INTENT DETECTION ================= */
  const detectIntent = (q) => {
    const query = normalize(q);

    const intent = {
      category: null,
      maxPrice: null,
      minPrice: null,
    };

    if (
      query.includes("phone") ||
      query.includes("iphone") ||
      query.includes("laptop")
    ) {
      intent.category = "Electronics";
    }

    if (query.includes("shoe") || query.includes("shirt")) {
      intent.category = "Fashion";
    }

    if (query.includes("car")) {
      intent.category = "Vehicles";
    }

    if (["cheap", "budget", "affordable"].some((w) => query.includes(w))) {
      intent.maxPrice = 50000;
    }

    if (["expensive", "premium"].some((w) => query.includes(w))) {
      intent.minPrice = 200000;
    }

    const under = query.match(/under\s(\d+)/);
    if (under) intent.maxPrice = Number(under[1]);

    const above = query.match(/above\s(\d+)/);
    if (above) intent.minPrice = Number(above[1]);

    return intent;
  };

  /* ================= SMART SEARCH ENGINE ================= */
  const smartSearch = (items, query) => {
    const q = normalize(query);
    const intent = detectIntent(q);

    /* ---- TYPO CORRECTION (BEST MATCH GUESS) ---- */
    const corrected = items.reduce(
      (best, p) => {
        const score = similarity(q, p.title);
        return score > best.score
          ? { text: p.title, score }
          : best;
      },
      { text: q, score: 0 }
    );

    const finalQuery = corrected.score > 0.55 ? corrected.text : q;

    /* ---- RANKING ---- */
    return items
      .map((p) => {
        const title = normalize(p.title);
        let score = 0;

        /* fuzzy match */
        score += similarity(finalQuery, title) * 100;

        /* contains boost */
        if (title.includes(finalQuery)) score += 40;

        /* category boost */
        if (intent.category && p.category === intent.category) {
          score += 50;
        }

        const price = Number(p.price || 0);

        /* price penalty */
        if (intent.maxPrice && price > intent.maxPrice) score -= 80;
        if (intent.minPrice && price < intent.minPrice) score -= 50;

        return {
          ...p,
          _score: score,
          _intent: intent,
        };
      })
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 7);
  };

  /* ================= RESULTS ================= */
  const results = useMemo(() => {
    if (!debounced) return [];
    return smartSearch(products, debounced);
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
    <>
      {/* ================= TOP NAV ================= */}
      <header className="top-nav">
        <div className="nav-container">
          <button
            className="menu-dots"
            onClick={() => navigate("/marketplace?menu=open")}
          >
            ⋮
          </button>

          <div
            className="nav-brand"
            onClick={() => navigate("/marketplace")}
          >
            🛒 MiniMart
          </div>
        </div>
      </header>

      {/* ================= SEARCH ================= */}
      <div className="search-wrapper">
        <input
          className="search-input"
          value={search}
          placeholder="Search products..."
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />

        <button
          className="search-btn"
          onClick={() => goSearch(search)}
        >
          Search
        </button>

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
                    {p.category} • ₦
                    {Number(p.price).toLocaleString()}
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