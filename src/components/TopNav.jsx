import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "../styles/TopNav.css";

export default function TopNav() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [recent, setRecent] = useState([]);

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
  const fetchResults = async (q) => {
    if (!q || q.trim().length < 1) {
      setResults([]);
      return;
    }

    try {
      const res = await axios.get(
        `/api/search/live?q=${encodeURIComponent(q)}`
      );
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      setResults([]);
    }
  };

  /* ⚡ INSTANT SEARCH */
  useEffect(() => {
    const id = setTimeout(() => {
      fetchResults(search);
    }, 150); // fast response

    return () => clearTimeout(id);
  }, [search]);

  /* ================= OUTSIDE CLICK ================= */
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* ================= HELPERS ================= */
  const go = (path) => navigate(path);

  const image = (p) =>
    p.image || p.images?.[0] || "/placeholder.png";

  const addToWishlist = (p) => {
    const list = JSON.parse(localStorage.getItem("wishlist") || "[]");
    const exists = list.find((x) => x.id === p.id);

    const updated = exists
      ? list
      : [...list, p];

    localStorage.setItem("wishlist", JSON.stringify(updated));
  };

  const selectRecent = (q) => {
    setSearch(q);
    setOpen(true);
    fetchResults(q);
  };

  const saveAndOpen = (q) => {
    saveRecent(q);
    setSearch(q);
    setOpen(true);
  };

  return (
    <>
      {/* ================= NAV ================= */}
      <header className="top-nav">
        <div className="nav-container">

          <div className="nav-brand" onClick={() => go("/")}>
            <div className="logo-icon">🛒</div>
            <span className="brand-name">MiniMart</span>
          </div>

          <div className="nav-menu">
            <Swiper modules={[Navigation]} slidesPerView={3} navigation>
              <SwiperSlide><button onClick={() => go("/profile")}>Profile</button></SwiperSlide>
              <SwiperSlide><button onClick={() => go("/minimart/add")}>Add</button></SwiperSlide>
              <SwiperSlide><button onClick={() => go("/categories")}>Categories</button></SwiperSlide>
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
        />

        {open && (
          <div className="search-panel full-screen-mobile">

            {/* ================= RECENT ================= */}
            {search.length === 0 && recent.length > 0 && (
              <div className="recent-box">
                <h4>Recent Searches</h4>
                <div className="recent-list">
                  {recent.map((r, i) => (
                    <button key={i} onClick={() => selectRecent(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ================= RESULTS ================= */}
            <div className="search-slide">

              {results.length === 0 ? (
                <div className="empty">No results</div>
              ) : (
                results.map((p) => (
                  <div key={p.id} className="search-item">

                    <img src={image(p)} className="search-img" />

                    <div className="search-info">
                      <div className="search-title">{p.title}</div>
                      <div className="search-price">
                        ₦{Number(p.price || 0).toLocaleString()}
                      </div>
                    </div>

                    {/* ❤️ Wishlist */}
                    <button
                      className="wishlist-btn"
                      onClick={() => addToWishlist(p)}
                    >
                      ❤️
                    </button>

                    <button
                      className="open-btn"
                      onClick={() => {
                        saveRecent(search);
                        go(`/product/${p.id}`);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      View
                    </button>

                  </div>
                ))
              )}

            </div>

          </div>
        )}
      </div>
    </>
  );
}