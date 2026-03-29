import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState([]);
  const [open, setOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const lastScroll = useRef(0);
  const wrapperRef = useRef(null);

  // Dynamic 3-slide menu
  const menuSlides = [
    { label: "Cart", icon: "🛒", action: () => navigate("/cart") },
    { label: "Orders", icon: "📦", action: () => navigate("/orders") },
    { label: "Favorites", icon: "❤️", action: () => navigate("/favorites") },
  ];

  // Load recent searches
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("recent_searches") || "[]");
    setRecent(stored);
  }, []);

  const saveRecent = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...recent.filter((r) => r !== query)].slice(0, 8);
    setRecent(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
  };

  const handleSearch = (q) => {
    if (!q.trim()) return;
    saveRecent(q);
    setSearch("");
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // Click outside to close search panel
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll to show/hide nav
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
          {/* Brand */}
          <div className="nav-brand" onClick={() => navigate("/")}>
            <div className="logo-icon">🛒</div>
            <span className="brand-name">MiniMart</span>
          </div>

          {/* Left-aligned 3-slide menu */}
          <div className="nav-menu">
            <Swiper
              modules={[Navigation]}
              slidesPerView={3}
              navigation
              spaceBetween={12}
              loop={false}
            >
              {menuSlides.map((slide, i) => (
                <SwiperSlide key={i}>
                  <button className="menu-slide" onClick={slide.action}>
                    <span className="icon">{slide.icon}</span>
                    <span className="label">{slide.label}</span>
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="search-wrapper" ref={wrapperRef}>
        <input
          className="search-input"
          value={search}
          placeholder="Search products..."
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(search); }}
        />

        {open && (
          <div className="search-panel">
            {search.length === 0 && recent.length > 0 && (
              <div className="recent-box">
                <h4>Recent Searches</h4>
                <div className="recent-list">
                  {recent.map((r, i) => (
                    <button key={i} onClick={() => handleSearch(r)}>{r}</button>
                  ))}
                </div>
              </div>
            )}
            {search.length > 0 && (
              <div className="quick-search">
                <button className="search-btn" onClick={() => handleSearch(search)}>
                  🔍 Search "{search}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}