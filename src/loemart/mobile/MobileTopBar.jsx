/**
 * src/loemart/mobile/MobileTopBar.jsx
 * 10/10 Premium Glassmorphic TopBar
 */
import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiSliders, FiX, FiHeart } from "react-icons/fi";
import categories from "../../config/categories";
import { haptic } from "./mobileHelpers";

const MobileTopBar = memo(function MobileTopBar({
  searchQuery, onSearchOpen, onClearSearch,
  activeCategory, onCategoryChange,
  hasFilters, wishCount, onFilterOpen, showFilters,
}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const categoryTabs = [{ id: "all", name: "Explore All", icon: "🔥" }, ...categories];

  return (
    <header className={`lmm-topbar ${scrolled ? "lmm-topbar--scrolled" : ""}`}>
      
      {/* Main Row */}
      <div className="lmm-topbar__row">
        <button type="button" className="lmm-topbar__logo" onClick={() => navigate("/loemart")}>
          <div className="lmm-topbar__logo-icon">🛍️</div>
        </button>

        <button type="button" className="lmm-topbar__search-btn" onClick={() => { onSearchOpen(); haptic(8); }}>
          <FiSearch size={16} strokeWidth={2.5} color="#888" />
          <span className="lmm-topbar__search-placeholder">
            {searchQuery || "Search for products..."}
          </span>
          {searchQuery && (
            <div className="lmm-topbar__search-x" onClick={(e) => { e.stopPropagation(); onClearSearch(); }}>
              <FiX size={12} strokeWidth={3} />
            </div>
          )}
        </button>

        <div className="lmm-topbar__actions">
          <button type="button" className="lmm-topbar__icon-btn" onClick={() => navigate("/saved")}>
            <FiHeart size={20} strokeWidth={2.2} fill={wishCount > 0 ? "#e53935" : "none"} color={wishCount > 0 ? "#e53935" : "#111"} />
            {wishCount > 0 && <span className="lmm-topbar__badge">{wishCount}</span>}
          </button>

          <button type="button" className="lmm-topbar__icon-btn" onClick={() => { onFilterOpen(); haptic(8); }}>
            <FiSliders size={20} strokeWidth={2.2} color={showFilters ? "#ff6b00" : "#111"} />
            {hasFilters && <span className="lmm-topbar__badge lmm-topbar__badge--dot" />}
          </button>
        </div>
      </div>

      {/* Category Strip */}
      <nav className="lmm-topbar__cats">
        {categoryTabs.map((c) => {
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`lmm-cat ${isActive ? "lmm-cat--on" : ""}`}
              onClick={() => { onCategoryChange(c.id); haptic(8); }}
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