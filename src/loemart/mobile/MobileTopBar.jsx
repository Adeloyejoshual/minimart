/**
 * src/loemart/mobile/MobileTopBar.jsx
 *
 * Compact glass topbar with:
 * - Logo → home
 * - Search trigger (opens fullscreen sheet)
 * - Wishlist quick access
 * - Filter toggle
 * - Sticky category strip with icons
 */

import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiSliders, FiX, FiHeart } from "react-icons/fi";

import categories from "../../config/categories";
import { haptic } from "./mobileHelpers";

const MobileTopBar = memo(function MobileTopBar({
  searchQuery,
  onSearchOpen,
  onClearSearch,
  activeCategory,
  onCategoryChange,
  hasFilters,
  wishCount,
  onFilterOpen,
  showFilters,
}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  /* Track scroll for shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Category tabs */
  const categoryTabs = [
    { id: "all", name: "All", icon: "🏪" },
    ...categories,
  ];

  return (
    <header className={`lmm-topbar ${scrolled ? "lmm-topbar--scrolled" : ""}`}>
      <div className="lmm-topbar__row">

        {/* Logo */}
        <button
          type="button"
          className="lmm-topbar__logo"
          onClick={() => navigate("/loemart")}
          aria-label="Loemart home"
        >
          <span className="lmm-topbar__logo-icon">🛍️</span>
          <span className="lmm-topbar__logo-text">Loemart</span>
        </button>

        {/* Search trigger */}
        <button
          type="button"
          className="lmm-topbar__search-btn"
          onClick={() => { onSearchOpen(); haptic(8); }}
          aria-label="Open search"
        >
          <FiSearch size={16} />
          <span className="lmm-topbar__search-placeholder">
            {searchQuery || "Search products…"}
          </span>
          {searchQuery && (
            <button
              type="button"
              className="lmm-topbar__search-x"
              onClick={(e) => { e.stopPropagation(); onClearSearch(); }}
              aria-label="Clear search"
            >
              <FiX size={12} />
            </button>
          )}
        </button>

        {/* Wishlist quick access */}
        <button
          type="button"
          className={`lmm-topbar__wish-btn ${wishCount > 0 ? "lmm-topbar__wish-btn--on" : ""}`}
          onClick={() => navigate("/saved")}
          aria-label={`Wishlist — ${wishCount} saved`}
        >
          <FiHeart size={17} fill={wishCount > 0 ? "currentColor" : "none"} />
          {wishCount > 0 && (
            <span className="lmm-topbar__wish-dot">{wishCount > 9 ? "9+" : wishCount}</span>
          )}
        </button>

        {/* Filter */}
        <button
          type="button"
          className={`lmm-topbar__filter-btn ${showFilters ? "lmm-topbar__filter-btn--on" : ""}`}
          onClick={() => { onFilterOpen(); haptic(8); }}
          aria-label="Filters"
          aria-expanded={showFilters}
        >
          <FiSliders size={17} />
          {hasFilters && <span className="lmm-topbar__filter-dot" />}
        </button>
      </div>

      {/* Category strip */}
      <nav className="lmm-topbar__cats" aria-label="Categories">
        {categoryTabs.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`lmm-cat ${activeCategory === c.id ? "lmm-cat--on" : ""}`}
            onClick={() => { onCategoryChange(c.id); haptic(8); }}
            aria-pressed={activeCategory === c.id}
          >
            <span className="lmm-cat__icon" aria-hidden="true">{c.icon}</span>
            <span className="lmm-cat__label">{c.name}</span>
          </button>
        ))}
      </nav>
    </header>
  );
});

export default MobileTopBar;