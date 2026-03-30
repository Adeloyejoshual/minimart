import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showNav, setShowNav] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const lastScroll = useRef(0);
  const ticking = useRef(false);

  // ---------------- SCROLL ----------------
  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;

      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          if (current <= 0) setShowNav(true);
          else if (current > lastScroll.current) setShowNav(false);
          else setShowNav(true);

          lastScroll.current = current;
          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---------------- SEARCH ----------------
  const handleSearch = useCallback(
    (q) => {
      const query = q.trim();
      if (!query) return;
      setSearch("");
      navigate(`/search?q=${encodeURIComponent(query)}`);
    },
    [navigate]
  );

  return (
    <>
      {/* TOP NAV */}
      <header className={`top-nav ${showNav ? "show" : "hide"}`}>
        <div className="nav-container">
          {/* 3 DOT BUTTON */}
          <button className="menu-dots" onClick={() => setMenuOpen(true)}>
            ⋮
          </button>

          {/* BRAND */}
          <div className="nav-brand" onClick={() => navigate("/")}>
            <span className="logo-icon">🛒</span>
            <span className="brand-name">MiniMart</span>
          </div>
        </div>
      </header>

      {/* SEARCH */}
      <div className="search-below-nav">
        <input
          className="search-input"
          value={search}
          placeholder="Search products..."
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(search)}
        />
        <button className="search-btn" onClick={() => handleSearch(search)}>
          Search
        </button>
      </div>

      {/* OVERLAY */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* LEFT SLIDE MENU */}
      <div className={`side-drawer ${menuOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <h3>Menu</h3>
          <button onClick={() => setMenuOpen(false)}>✕</button>
        </div>

        <ul className="drawer-list">
          <li onClick={() => { navigate("/"); setMenuOpen(false); }}>Home</li>
          <li onClick={() => { navigate("/add-product"); setMenuOpen(false); }}>Sell Product</li>
          <li onClick={() => { navigate("/search"); setMenuOpen(false); }}>Search</li>
          <li onClick={() => { navigate("/categories"); setMenuOpen(false); }}>Categories</li>
        </ul>
      </div>
    </>
  );
}