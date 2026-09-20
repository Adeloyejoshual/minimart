/**
 * src/loemart/mobile/MobileTopBar.jsx
 * 10/10 Production-Ready Glassmorphic TopBar
 */

import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiSliders, FiX, FiUser, FiMenu } from "react-icons/fi";
import categories from "../../config/categories";
import { haptic } from "./mobileHelpers";

// Import styles
import "./styles/MobileTopBar.css";

const MobileTopBar = memo(function MobileTopBar({
  searchQuery,
  onSearchOpen,
  onClearSearch,
  activeCategory,
  onCategoryChange,
  hasFilters,
  onFilterOpen,
  showFilters,
  onMenuOpen,
}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  /* Track scroll position to apply background blur shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categoryTabs = [{ id: "all", name: "Explore All", icon: "🔥" }, ...categories];

  const handleSearchClick = () => {
    haptic(8);
    if (onSearchOpen) {
      onSearchOpen();
    } else {
      navigate("/loemart/search");
    }
  };

  return (
    <header className={`lmm-topbar ${scrolled ? "lmm-topbar--scrolled" : ""}`}>
      
      {/* ── Main Top Bar Row ── */}
      <div className="lmm-topbar__row">
        
        {/* 1. Hamburger Menu Trigger */}
        <button
          type="button"
          className="lmm-topbar__icon-btn"
          onClick={() => {
            onMenuOpen?.();
            haptic(8);
          }}
          aria-label="Open menu"
        >
          <FiMenu size={22} color="currentColor" />
        </button>

        {/* 2. Logo */}
        <button
          type="button"
          className="lmm-topbar__logo"
          onClick={() => navigate("/loemart")}
          aria-label="Loemart Home"
        >
          <span className="lmm-topbar__logo-icon">🛍️</span>
          <span className="lmm-topbar__logo-text">Loemart</span>
        </button>

        {/* 3. Clickable Search Bar Input */}
        <button
          type="button"
          className="lmm-topbar__search-btn"
          onClick={handleSearchClick}
          aria-label="Search products"
        >
          <FiSearch size={16} strokeWidth={2.5} color="#888" />
          <span className="lmm-topbar__search-placeholder">
            {searchQuery || "Search..."}
          </span>
          {searchQuery && (
            <span
              className="lmm-topbar__search-x"
              onClick={(e) => {
                e.stopPropagation();
                onClearSearch?.();
              }}
              role="button"
              aria-label="Clear search"
            >
              <FiX size={12} strokeWidth={3} />
            </span>
          )}
        </button>

        {/* 4. Right Action Buttons: User Profile & Filter */}
        <div className="lmm-topbar__actions">
          
          {/* User Profile Icon */}
          <button
            type="button"
            className="lmm-topbar__icon-btn"
            onClick={() => {
              haptic(8);
              navigate("/profile");
            }}
            aria-label="My Profile"
          >
            <FiUser size={20} strokeWidth={2.2} color="currentColor" />
          </button>

          {/* Filter Icon */}
          <button
            type="button"
            className="lmm-topbar__icon-btn"
            onClick={() => {
              onFilterOpen?.();
              haptic(8);
            }}
            aria-label="Filter products"
            aria-expanded={showFilters}
          >
            <FiSliders 
              size={20} 
              strokeWidth={2.2} 
              color={showFilters ? "var(--o, #ff6000)" : "currentColor"} 
            />
            {hasFilters && <span className="lmm-topbar__badge--dot" />}
          </button>

        </div>
      </div>

      {/* ── Horizontal Category Strip ── */}
      <nav className="lmm-topbar__cats" aria-label="Categories">
        {categoryTabs.map((c) => {
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`lmm-cat ${isActive ? "lmm-cat--on" : ""}`}
              onClick={() => {
                onCategoryChange?.(c.id);
                haptic(8);
              }}
              aria-pressed={isActive}
            >
              <span className="lmm-cat__icon">{c.icon}</span>
              <span className="lmm-cat__label">{c.name}</span>
            </button>
          );
        })}
      </nav>

    </header>
  );
});

export default MobileTopBar;