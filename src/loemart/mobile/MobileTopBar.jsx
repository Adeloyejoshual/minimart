/**
 * src/loemart/mobile/MobileTopBar.jsx
 * Production-ready mobile marketplace top navigation
 */

import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiSliders,
  FiX,
  FiUser,
  FiMenu,
} from "react-icons/fi";

import categories from "../../config/categories";
import { haptic } from "./mobileHelpers";

import "./styles/MobileTopBar.css";

const MobileTopBar = memo(function MobileTopBar({
  searchQuery = "",
  onSearchOpen,
  onClearSearch,
  activeCategory = "all",
  onCategoryChange,
  hasFilters = false,
  onFilterOpen,
  showFilters = false,
  onMenuOpen,
}) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  /* ---------------------------------------------
     Detect page scroll
  --------------------------------------------- */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /* ---------------------------------------------
     Category tabs
  --------------------------------------------- */
  const categoryTabs = [
    {
      id: "all",
      name: "Explore All",
      icon: "🔥",
    },
    ...categories,
  ];

  /* ---------------------------------------------
     Search
  --------------------------------------------- */
  const handleSearchClick = () => {
    haptic(8);

    if (onSearchOpen) {
      onSearchOpen();
      return;
    }

    navigate("/loemart/search");
  };

  /* ---------------------------------------------
     Menu
  --------------------------------------------- */
  const handleMenuClick = () => {
    haptic(8);
    onMenuOpen?.();
  };

  /* ---------------------------------------------
     Profile
  --------------------------------------------- */
  const handleProfileClick = () => {
    haptic(8);
    navigate("/profile");
  };

  /* ---------------------------------------------
     Filter
  --------------------------------------------- */
  const handleFilterClick = () => {
    haptic(8);
    onFilterOpen?.();
  };

  /* ---------------------------------------------
     Category
  --------------------------------------------- */
  const handleCategoryChange = (categoryId) => {
    haptic(8);
    onCategoryChange?.(categoryId);
  };

  return (
    <header
      className={`lmm-topbar ${
        scrolled ? "lmm-topbar--scrolled" : ""
      }`}
    >
      {/* =================================================
          MAIN NAVIGATION
      ================================================= */}
      <div className="lmm-topbar__row">

        {/* Menu */}
        <button
          type="button"
          className="lmm-topbar__icon-btn"
          onClick={handleMenuClick}
          aria-label="Open menu"
        >
          <FiMenu
            size={22}
            strokeWidth={2.2}
          />
        </button>

        {/* Loemart Logo */}
        <button
          type="button"
          className="lmm-topbar__logo"
          onClick={() => navigate("/loemart")}
          aria-label="Loemart Home"
        >
          <span
            className="lmm-topbar__logo-icon"
            aria-hidden="true"
          >
            🛍️
          </span>

          <span className="lmm-topbar__logo-text">
            Loemart
          </span>
        </button>

        {/* Search */}
        <button
          type="button"
          className="lmm-topbar__search-btn"
          onClick={handleSearchClick}
          aria-label="Search products"
        >
          <FiSearch
            className="lmm-topbar__search-icon"
            size={17}
            strokeWidth={2.4}
            aria-hidden="true"
          />

          <span className="lmm-topbar__search-placeholder">
            {searchQuery || "Search products..."}
          </span>

          {searchQuery && (
            <span
              className="lmm-topbar__search-x"
              onClick={(event) => {
                event.stopPropagation();
                haptic(6);
                onClearSearch?.();
              }}
              role="button"
              tabIndex={0}
              aria-label="Clear search"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  onClearSearch?.();
                }
              }}
            >
              <FiX
                size={13}
                strokeWidth={3}
                aria-hidden="true"
              />
            </span>
          )}
        </button>

        {/* Right-side actions */}
        <div className="lmm-topbar__actions">

          {/* Profile */}
          <button
            type="button"
            className="lmm-topbar__icon-btn"
            onClick={handleProfileClick}
            aria-label="My Profile"
          >
            <FiUser
              size={21}
              strokeWidth={2.2}
            />
          </button>

          {/* Filters */}
          <button
            type="button"
            className={`lmm-topbar__icon-btn ${
              showFilters
                ? "lmm-topbar__icon-btn--active"
                : ""
            }`}
            onClick={handleFilterClick}
            aria-label="Filter products"
            aria-expanded={showFilters}
          >
            <FiSliders
              size={21}
              strokeWidth={2.2}
            />

            {hasFilters && (
              <span
                className="lmm-topbar__filter-dot"
                aria-label="Filters active"
              />
            )}
          </button>
        </div>
      </div>

      {/* =================================================
          CATEGORY NAVIGATION
      ================================================= */}
      <nav
        className="lmm-topbar__cats"
        aria-label="Product categories"
      >
        <div className="lmm-topbar__cats-inner">
          {categoryTabs.map((category) => {
            const isActive =
              activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                className={`lmm-cat ${
                  isActive ? "lmm-cat--on" : ""
                }`}
                onClick={() =>
                  handleCategoryChange(category.id)
                }
                aria-pressed={isActive}
              >
                <span
                  className="lmm-cat__icon"
                  aria-hidden="true"
                >
                  {category.icon}
                </span>

                <span className="lmm-cat__label">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
});

export default MobileTopBar;