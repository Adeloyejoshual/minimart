import React, { forwardRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/MobileTopBar.css';

/* ══════════════════════════════════════════════════════════
   Auth helpers (same key strategy as the rest of the app)
══════════════════════════════════════════════════════════ */
function getAuthToken() {
  const keys = [
    'token',
    'buyer_token',
    'auth_token',
    'access_token',
    'lm_token',
    'lm-token',
    'jwt',
  ];
  for (const k of keys) {
    const val = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (val) return val;
  }
  try {
    const rawUser =
      localStorage.getItem('user') || localStorage.getItem('buyer');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.token || parsed.accessToken) {
        return parsed.token || parsed.accessToken;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem('user') ||
      localStorage.getItem('buyer') ||
      localStorage.getItem('lm-user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getUserInitials(user) {
  if (!user) return '';
  const name =
    user.name ||
    user.full_name ||
    user.fullName ||
    user.username ||
    user.email ||
    '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ══════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════ */
const MobileTopBar = forwardRef(function MobileTopBar(
  {
    categories = [],
    activeCategory = 'All',
    onSelectCategory,
    onOpenDrawer,
  },
  ref
) {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initials, setInitials] = useState('');

  const refreshAuth = useCallback(() => {
    const token = getAuthToken();
    const user = getStoredUser();
    const loggedIn = Boolean(token || user);
    setIsLoggedIn(loggedIn);
    setInitials(loggedIn ? getUserInitials(user) : '');
  }, []);

  useEffect(() => {
    refreshAuth();

    // Stay in sync across tabs / login-logout elsewhere
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('focus', refreshAuth);
    window.addEventListener('auth-changed', refreshAuth);

    return () => {
      window.removeEventListener('storage', refreshAuth);
      window.removeEventListener('focus', refreshAuth);
      window.removeEventListener('auth-changed', refreshAuth);
    };
  }, [refreshAuth]);

  const handleSearchClick = () => {
    navigate('/m/search');
  };

  const handleCategoryClick = (cat) => {
    const catName = typeof cat === 'object' ? cat.name || cat.title : cat;

    if (onSelectCategory) {
      onSelectCategory(catName);
    } else if (catName === 'All') {
      navigate('/m/search');
    } else {
      navigate(`/m/search?category=${encodeURIComponent(catName)}`);
    }
  };

  const handleAccountClick = () => {
    if (isLoggedIn) {
      navigate('/profile');
    } else {
      // Professional guest flow
      navigate('/login', { state: { from: window.location.pathname } });
    }
  };

  const defaultCategories = [
    'All',
    'Phones',
    'Fashion',
    'Beauty',
    'Electronics',
    'Computers',
    'Watches',
  ];
  const rawCats = categories.length > 0 ? categories : defaultCategories;
  const displayCats = rawCats.map((c) =>
    typeof c === 'object' ? c.name || c.title : c
  );
  const finalCats = displayCats.includes('All')
    ? displayCats
    : ['All', ...displayCats];

  return (
    <header className="mtb-header-sticky" ref={ref}>
      {/* ── ROW 1: Brand + Actions ── */}
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
            style={{
              width: 22,
              height: 22,
              minWidth: 22,
              minHeight: 22,
              flexShrink: 0,
            }}
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
          {/* Wishlist — only useful when logged in; still ok for guests (can prompt login later) */}
          <button
            className="mtb-icon-btn"
            onClick={() => {
              if (isLoggedIn) navigate('/saved');
              else navigate('/login', { state: { from: '/saved' } });
            }}
            aria-label="Saved Items"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                width: 20,
                height: 20,
                minWidth: 20,
                minHeight: 20,
                flexShrink: 0,
              }}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* ── Account: Login / Register (guest) OR Profile (logged in) ── */}
          {isLoggedIn ? (
            <button
              className="mtb-icon-btn mtb-avatar-btn"
              onClick={handleAccountClick}
              aria-label="Profile"
              title="My Profile"
            >
              {initials ? (
                <span className="mtb-avatar-initials">{initials}</span>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    minHeight: 20,
                    flexShrink: 0,
                  }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </button>
          ) : (
            <button
              className="mtb-auth-btn"
              onClick={handleAccountClick}
              aria-label="Login or Register"
            >
              Login
            </button>
          )}
        </div>
      </div>

      {/* ── ROW 2: Search ── */}
      <div className="mtb-row-search">
        <div className="mtb-search-box" onClick={handleSearchClick}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            style={{
              width: 18,
              height: 18,
              minWidth: 18,
              minHeight: 18,
              flexShrink: 0,
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="mtb-search-placeholder">
            Search products, brands, campaigns...
          </span>
          <button className="mtb-filter-trigger" aria-label="Filters">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                width: 18,
                height: 18,
                minWidth: 18,
                minHeight: 18,
                flexShrink: 0,
              }}
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

      {/* ── ROW 3: Categories ── */}
      <div className="mtb-row-categories">
        <div className="mtb-cat-scroll">
          {finalCats.map((cat, idx) => {
            const isSelected =
              String(cat).toLowerCase() ===
              String(activeCategory).toLowerCase();
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
});

export default MobileTopBar;