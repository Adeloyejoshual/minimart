import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

function loadCart() {
  try { return JSON.parse(localStorage.getItem("mm_cart") || "[]"); }
  catch { return []; }
}

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const [search,    setSearch]    = useState("");

  // Cart count
  useEffect(() => {
    const update = () => {
      const cart = loadCart();
      setCartCount(cart.reduce((s, i) => s + (i.qty ?? 1), 0));
    };
    update();
    window.addEventListener("cart-updated", update);
    window.addEventListener("storage",      update);
    return () => {
      window.removeEventListener("cart-updated", update);
      window.removeEventListener("storage",      update);
    };
  }, []);

  // Shrink on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/minimart?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <>
      <nav className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
        {/* Logo */}
        <Link to="/" className="nav__logo">
          <span className="nav__logo-l">Loe</span>mart
        </Link>

        {/* Search */}
        <form className="nav__search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search"
          />
          <button type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </form>

        {/* Right actions */}
        <div className="nav__actions">
          {user ? (
            <button
              className="nav__user-btn"
              onClick={() => navigate("/account")}
              aria-label="Account"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <span className="nav__user-name">
                {user.name?.split(" ")[0] ?? "Account"}
              </span>
            </button>
          ) : (
            <button
              className="nav__login-btn"
              onClick={() => navigate("/auth")}
            >
              Login
            </button>
          )}

          {/* Cart */}
          <button
            className="nav__cart-btn"
            onClick={() => navigate("/shop/cart")}
            aria-label={`Cart, ${cartCount} items`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth={2} strokeLinecap="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            {cartCount > 0 && (
              <span className="nav__cart-badge">{cartCount}</span>
            )}
          </button>

          {/* Hamburger (mobile) */}
          <button
            className={`nav__hamburger ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`nav__mobile-menu ${menuOpen ? "nav__mobile-menu--open" : ""}`}>
        <Link to="/minimart"  onClick={() => setMenuOpen(false)}>🛍️ Shop</Link>
        <Link to="/shop/cart" onClick={() => setMenuOpen(false)}>🛒 Cart</Link>
        {user
          ? <Link to="/account" onClick={() => setMenuOpen(false)}>👤 Account</Link>
          : <Link to="/auth"    onClick={() => setMenuOpen(false)}>🔑 Login / Register</Link>
        }
        {user?.isAdmin && (
          <Link to="/admin" onClick={() => setMenuOpen(false)}>⚙️ Admin</Link>
        )}
      </div>
    </>
  );
}