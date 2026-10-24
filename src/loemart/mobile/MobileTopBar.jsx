import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWishlist, CART_KEY, haptic } from './mobileHelpers';
import './styles/MobileTopBar.css';

export default function MobileTopBar({
  categories = [],
  activeCategory = 'All',
  onSelectCategory,
  onOpenDrawer
}) {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [wishCount, setWishCount] = useState(getWishlist().length);

  useEffect(() => {
    const updateCounts = () => {
      try {
        const cartRaw = localStorage.getItem(CART_KEY);
        const cartItems = cartRaw ? JSON.parse(cartRaw) : [];
        setCartCount(Array.isArray(cartItems) ? cartItems.length : 0);
        setWishCount(getWishlist().length);
      } catch (e) {
        // Storage fallback
      }
    };

    updateCounts();
    window.addEventListener('storage', updateCounts);
    window.addEventListener('wishlist-updated', updateCounts);
    window.addEventListener('loemart_cart_updated', updateCounts);

    return () => {
      window.removeEventListener('storage', updateCounts);
      window.removeEventListener('wishlist-updated', updateCounts);
      window.removeEventListener('loemart_cart_updated', updateCounts);
    };
  }, []);

  const handleSearchClick = () => {
    haptic(10);
    navigate('/search');
  };

  const defaultCategories = ['All', 'Phones', 'Fashion', 'Beauty', 'Electronics', 'Computers', 'Watches'];
  const displayCats = categories.length > 0 ? ['All', ...categories] : defaultCategories;

  return (
    <header className="mtb-header-sticky">
      {/* ROW 1: BRAND LOGO & ACTIONS */}
      <div className="mtb-row-top">
        <button
          className="mtb-menu-btn"
          onClick={() => { haptic(12); onOpenDrawer && onOpenDrawer(); }}
          aria-label="Open Menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ width: '22px', height: '22px', minWidth: '22px', flexShrink: 0 }}
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="mtb-brand-logo" onClick={() => { haptic(10); navigate('/'); }}>
          <span className="mtb-logo-icon">🛍️</span>
          <span className="mtb-logo-text">Loemart</span>
        </div>

        <div className="mtb-actions-right">
          <button
            className="mtb-icon-btn"
            onClick={() => { haptic(10); navigate('/wishlist'); }}
            aria-label="Wishlist"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', flexShrink: 0 }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishCount > 0 && <span className="mtb-badge">{wishCount}</span>}
          </button>

          <button
            className="mtb-icon-btn"
            onClick={() => { haptic(10); navigate('/cart'); }}
            aria-label="Cart"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', flexShrink: 0 }}
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && <span className="mtb-badge">{cartCount}</span>}
          </button>

          <button
            className="mtb-icon-btn"
            onClick={() => { haptic(10); navigate('/profile'); }}
            aria-label="Profile"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '20px', height: '20px', minWidth: '20px', flexShrink: 0 }}
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
            style={{ width: '18px', height: '18px', minWidth: '18px', flexShrink: 0 }}
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
              style={{ width: '18px', height: '18px', minWidth: '18px', flexShrink: 0 }}
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
          {displayCats.map((cat) => {
            const isSelected = String(cat).toLowerCase() === String(activeCategory).toLowerCase();
            return (
              <button
                key={cat}
                className={`mtb-cat-pill ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectCategory && onSelectCategory(cat)}
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