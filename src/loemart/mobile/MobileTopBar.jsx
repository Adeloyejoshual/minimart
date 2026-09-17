/**
 * src/loemart/mobile/MobileTopBar.jsx
 * 10/10 Premium Glassmorphic TopBar
 */
import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiSliders, FiX, FiMenu, FiUser } from "react-icons/fi"; // Changed icons
import categories from "../../config/categories";
import { haptic } from "./mobileHelpers";

const MobileTopBar = memo(function MobileTopBar({
  searchQuery, onSearchOpen, onClearSearch,
  activeCategory, onCategoryChange,
  hasFilters, onFilterOpen, showFilters,
  onMenuOpen, // <-- ADDED PROP
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
        
        {/* Hamburger Menu Icon */}
        <button type="button" className="lmm-topbar__icon-btn" onClick={() => { onMenuOpen(); haptic(8); }}>
          <FiMenu size={22} color="#111" />
        </button>

        {/* Logo */}
        <button type="button" className="lmm-topbar__logo" onClick={() => navigate("/loemart")}>
          <div className="lmm-topbar__logo-icon">🛍️</div>
        </button>

        {/* Search Input */}
        <button type="button" className="lmm-topbar__search-btn" onClick={() => { onSearchOpen(); haptic(8); }}>
          <FiSearch size={16} strokeWidth={2.5} color="#888" />
          <span className="lmm-topbar__search-placeholder">
            {searchQuery || "Search..."}
          </span>
          {searchQuery && (
            <div className="lmm-topbar__search-x" onClick={(e) => { e.stopPropagation(); onClearSearch(); }}>
              <FiX size={12} strokeWidth={3} />
            </div>
          )}
        </button>

        {/* Right Actions: Profile & Filters */}
        <div className="lmm-topbar__actions">
          
          <button type="button" className="lmm-topbar__icon-btn" onClick={() => navigate("/account/profile")}>
            <FiUser size={20} strokeWidth={2.2} color="#111" />
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