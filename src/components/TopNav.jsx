// src/components/TopNav.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "../styles/TopNav.css";

export default function TopNav({ user }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const searchRef = useRef(null);
  const timeoutRef = useRef(null);

  // Fetch live search
  const fetchSearchResults = async (query) => {
    if (!query || query.length < 2) return setResults([]);
    try {
      const res = await axios.get(`/api/search/live?q=${encodeURIComponent(query)}`);
      setResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setShowSearchPanel(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchSearchResults(value), 300);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuSlides = [
    { label: "Profile", onClick: () => navigate("/profile") },
    { label: "Add Product", onClick: () => navigate("/minimart/add") },
    { label: "Categories", onClick: () => navigate("/categories") },
  ];

  return (
    <>
      <header className="top-nav fixed top-0 left-0 right-0 z-50">
        <div className="nav-container">
          {/* Brand */}
          <div className="nav-brand" onClick={() => navigate("/")}>
            <div className="logo-icon">🛒</div>
            <span className="brand-name">MiniMart</span>
          </div>

          {/* 3-slide Menu */}
          <div className="top-nav-swiper">
            <Swiper
              modules={[Navigation]}
              slidesPerView={3}
              spaceBetween={20}
              navigation
              className="menu-swiper"
            >
              {menuSlides.map((slide, idx) => (
                <SwiperSlide key={idx}>
                  <button
                    className="menu-slide-btn"
                    onClick={slide.onClick}
                  >
                    {slide.label}
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </header>

      {/* Pinned Search Below Nav */}
      <div className="search-container pinned-search" ref={searchRef}>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={handleInputChange}
          onFocus={() => search.length >= 2 && setShowSearchPanel(true)}
          className="search-input"
        />
        {showSearchPanel && (
          <div className="search-panel">
            {results.length === 0 ? (
              <div className="search-empty">No results found</div>
            ) : (
              results.map(p => (
                <div
                  key={p.id}
                  className="search-item"
                  onClick={() => {
                    navigate(`/product/${p.id}`);
                    setSearch("");
                    setShowSearchPanel(false);
                  }}
                >
                  <img src={p.image || "/placeholder.png"} alt={p.title} className="search-item-img"/>
                  <div className="search-item-info">
                    <p className="search-item-title">{p.title}</p>
                    <span className="search-item-price">₦{p.price?.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}