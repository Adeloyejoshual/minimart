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

  /* ================= LOAD RECENT ================= */
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

  /* ================= SEARCH ================= */
  const handleSearch = (q) => {
    if (!q.trim()) return;

    saveRecent(q);
    setSearch("");
    setOpen(false);

    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  /* ================= CLICK OUTSIDE ================= */
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ================= SCROLL BEHAVIOR ================= */
  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;

      if (current <= 0) {
        setShowNav(true);
      } else if (current > lastScroll.current) {
        setShowNav(false); // scroll down
      } else {
        setShowNav(true); // scroll up
      }

      lastScroll.current = current;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ================= NAVIGATION ================= */
  const go = (path) => navigate(path);

  return (
    <>
      {/* ================= HEADER ================= */}
      <header className={`top-nav ${showNav ? "show" : "hide"}`}>
        <div className="nav-container">

          {/* BRAND */}
          <div className="nav-brand" onClick={() => go("/")}>
            <div className="logo-icon">🛒</div>
            <span className="brand-name">MiniMart</span>
          </div>

          {/* MENU */}
          <div className="nav-menu">
            <Swiper modules={[Navigation]} slidesPerView={3} navigation>
              <SwiperSlide>
                <button onClick={() => go("/profile")}>Profile</button>
              </SwiperSlide>

              <SwiperSlide>
                <button onClick={() => go("/minimart/add")}>Add</button>
              </SwiperSlide>

              <SwiperSlide>
                <button onClick={() => go("/categories")}>Categories</button>
              </SwiperSlide>
            </Swiper>
          </div>

        </div>
      </header>

      {/* ================= SEARCH ================= */}
      <div className="search-wrapper" ref={wrapperRef}>
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
            if (e.key === "Enter") handleSearch(search);
          }}
        />

        {/* ================= DROPDOWN ================= */}
        {open && (
          <div className="search-panel">

            {/* RECENT */}
            {search.length === 0 && recent.length > 0 && (
              <div className="recent-box">
                <h4>Recent Searches</h4>

                <div className="recent-list">
                  {recent.map((r, i) => (
                    <button key={i} onClick={() => handleSearch(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QUICK SEARCH */}
            {search.length > 0 && (
              <div className="quick-search">
                <button
                  className="search-btn"
                  onClick={() => handleSearch(search)}
                >
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