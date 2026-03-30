import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HamburgerMenu from "./HamburgerMenu";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState([]);
  const [showNav, setShowNav] = useState(true);
  const lastScroll = useRef(0);
  const wrapperRef = useRef(null);

  const menuItems = [
    { label: "Cart", icon: "🛒", action: () => navigate("/cart") },
    { label: "Orders", icon: "📦", action: () => navigate("/orders") },
    { label: "Favorites", icon: "❤️", action: () => navigate("/favorites") },
    { label: "Categories", icon: "📂", action: () => navigate("/categories") },
  ];

  // Load recent searches
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recent_searches") || "[]");
    setRecent(stored);
  }, []);

  const handleSearch = (q) => {
    if (!q.trim()) return;
    setSearch("");
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Show/hide navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      if (current <= 0) setShowNav(true);
      else if (current > lastScroll.current) setShowNav(false);
      else setShowNav(true);
      lastScroll.current = current;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className={`top-nav ${showNav ? "show" : "hide"}`}>
        <div className="nav-container">
          {/* Left: Hamburger menu */}
          <HamburgerMenu items={menuItems} />

          {/* Brand */}
          <div className="nav-brand" onClick={() => navigate("/")}>
            <div className="logo-icon">🛒</div>
            <span className="brand-name">MiniMart</span>
          </div>

          {/* Search (desktop) */}
          <div className="search-wrapper" ref={wrapperRef}>
            <input
              className="search-input"
              value={search}
              placeholder="Search products..."
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(search); }}
            />
          </div>
        </div>
      </header>
    </>
  );
}