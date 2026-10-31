import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/MobileTopBar.css';

export default function MobileTopBar({
  categories = [],
  activeCategory = 'All',
  onSelectCategory,
  onOpenDrawer,
  cartCount = 0,
}) {
  const navigate = useNavigate();

  const handleSearchClick = () => {
    navigate('/m/search');
  };

  const handleCategoryClick = (cat) => {
    const catName = typeof cat === 'object' ? (cat.name || cat.title) : cat;

    if (onSelectCategory) {
      onSelectCategory(catName);
    } else {
      if (catName === 'All') {
        navigate('/m/search');
      } else {
        navigate(`/m/search?category=${encodeURIComponent(catName)}`);
      }
    }
  };

  const defaultCategories = ['All', 'Phones', 'Fashion', 'Beauty', 'Electronics', 'Computers', 'Watches'];
  const rawCats = categories.length > 0 ? categories : defaultCategories;
  const displayCats = rawCats.map((c) => (typeof c === 'object' ? (c.name || c.title) : c));
  const finalCats = displayCats.includes('All') ? displayCats : ['All', ...displayCats];

  return (
    <header className="mtb-header-sticky">
      {/* ROW 1: BRAND LOGO & ACTIONS */}
      <div className="mtb-row-top">
        <button
          className="mtb-menu-btn"
          onClick={() => onOpenDrawer && onOpenDrawer()}
          aria-label="Open Menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', flexShrink: 0 }}
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="mtb-brand-logo" onClick={() => navigate('/')}>
          <span className="mtb-logo-icon">🛍️</span>
          <span className="mtb-logo-text">Loemart</span>
        </div>

        <div className="mtb-actions-right">
          {/* Wishlist Button */}
          <button
            className="mtb-icon-btn"
            onClick={() => navigate('/saved')}
            aria-label="Saved Items"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', flexShrink: 0 }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Cart Button with Live Badge */}
          <button
            className="mtb-icon-btn mtb-cart-btn"
            onClick={() => navigate('/cart')}
            aria-label={`Cart, ${cartCount} items`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', flexShrink: 0 }}
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>

            {/* BADGE */}
            {Number(cartCount) > 0 && (
              <span className="mtb-badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          {/* Profile Button */}
          <button
            className="mtb-icon-btn"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', flexShrink: 0 }}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* ROW 2: SEARCH TRIGGER */}
      <div className="mtb-row-search">
        <div className="mtb-search-box" onClick={handleSearchClick}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <span className="mtb-search-placeholder">Search products, brands, campaigns...</span>

          <button className="mtb-filter-trigger" aria-label="Filters">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px', flexShrink: 0 }}
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ROW 3: CATEGORIES HORIZONTAL STRIP */}
      <div className="mtb-row-categories">
        <div className="mtb-cat-scroll">
          {finalCats.map((cat, idx) => {
            const isSelected = String(cat).toLowerCase() === String(activeCategory).toLowerCase();
            return (
              <button
                key={cat || idx}
                className={`mtb-cat-pill ${isSelected ? 'active' : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}