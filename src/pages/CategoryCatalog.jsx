/**
 * src/pages/CategoryCatalog.jsx
 * Jumia-Style Category & Filter Catalog Page
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { formatPrice, getProductImage, calcDiscount } from "../config/marketplace";
import "../styles/CategoryCatalog.css";

const API = import.meta.env.VITE_API_BASE_URL;

/* ── Transparent SVG Icons ── */
const Icon = {
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  heartFilled: <svg viewBox="0 0 24 24" fill="#ff5722" stroke="#ff5722" strokeWidth={2} width={18} height={18}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  chevronDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><polyline points="6 9 12 15 18 9"/></svg>,
  sort: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><polyline points="15 18 9 12 15 6"/><polyline points="9 6 15 12 9 18" transform="rotate(90 12 12)"/></svg>,
  filter: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  cart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
};

export default function CategoryCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* Params */
  const categorySlug = searchParams.get("category") || "";
  const brandParam    = searchParams.get("brand") || "";
  const searchQuery   = searchParams.get("q") || "";

  /* State */
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showMoreSeo, setShowMoreSeo] = useState(false);
  const [wishlist, setWishlist]   = useState(new Set());

  /* Title Display */
  const displayTitle = useMemo(() => {
    if (categorySlug) {
      return categorySlug.replace(/-/g, " ").toUpperCase();
    }
    if (brandParam) return `${brandParam.toUpperCase()} STORE`;
    if (searchQuery) return `SEARCH: "${searchQuery}"`;
    return "ALL PRODUCTS";
  }, [categorySlug, brandParam, searchQuery]);

  /* Fetch Products */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axios
      .get(`${API}/api/products`, {
        params: {
          category: categorySlug || undefined,
          brand: brandParam || undefined,
          q: searchQuery || undefined,
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data?.data ?? data?.products ?? []);
      })
      .catch((err) => console.error("[CategoryCatalog] Fetch error:", err))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [categorySlug, brandParam, searchQuery]);

  const toggleWishlist = (id, e) => {
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="jumia-cat-page">
      {/* ── Top Header / Search Bar ── */}
      <header className="jumia-cat-header">
        <div className="jumia-search-bar" onClick={() => navigate("/search")}>
          {Icon.search}
          <span>{categorySlug ? categorySlug.replace(/-/g, " ") : "Search products, brands..."}</span>
        </div>
      </header>

      {/* ── Breadcrumb Bar ── */}
      <nav className="jumia-breadcrumbs">
        <span onClick={() => navigate("/loemart")}>Home</span>
        <span className="sep">&gt;</span>
        <span onClick={() => navigate("/loemart?category=phones-tablets")}>Phones & Tablets</span>
        {categorySlug && (
          <>
            <span className="sep">&gt;</span>
            <span className="current">{categorySlug.replace(/-/g, " ")}</span>
          </>
        )}
      </nav>

      {/* ── Filter Pills Row ── */}
      <div className="jumia-filter-pills">
        <button type="button" className="pill pill--express">⚡ EXPRESS</button>
        <button type="button" className="pill">
          Brand {Icon.chevronDown}
        </button>
        <button type="button" className="pill">
          Price {Icon.chevronDown}
        </button>
        <button type="button" className="pill">
          Rating {Icon.chevronDown}
        </button>
      </div>

      {/* ── Category SEO Description Block ── */}
      <div className="jumia-seo-block">
        <h1 className="jumia-seo-title">{displayTitle} IN NIGERIA</h1>
        <p className={`jumia-seo-text ${showMoreSeo ? "jumia-seo-text--open" : ""}`}>
          Explore the official {displayTitle} category on Loemart Nigeria for the latest models, 
          competitive prices, original brand warranty, and fast delivery options across Nigeria.
        </p>
        <button type="button" className="jumia-seo-more" onClick={() => setShowMoreSeo(!showMoreSeo)}>
          {showMoreSeo ? "See less ▲" : "See more ▼"}
        </button>
      </div>

      {/* ── Main Product Grid (2 Columns) ── */}
      <main className="jumia-grid-wrap">
        {loading ? (
          <div className="jumia-grid-skel">
            {[1, 2, 3, 4].map((i) => <div key={i} className="jumia-skel-card" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="jumia-empty">
            <p>No products found in this category.</p>
            <button onClick={() => navigate("/loemart")}>Browse All Items</button>
          </div>
        ) : (
          <div className="jumia-product-grid">
            {products.map((p) => {
              const displayPrice = Number(p.price);
              const origPrice = Number(p.original_price || p.compare_price || 0);
              const discount = calcDiscount(displayPrice, origPrice);
              const isSaved = wishlist.has(p.id);

              return (
                <div
                  key={p.id}
                  className="jumia-product-card"
                  onClick={() => navigate(`/shop/${p.slug || p.id}`)}
                >
                  {/* Image Container */}
                  <div className="jumia-card__img-wrap">
                    {discount > 0 && <span className="jumia-card__discount">-{discount}%</span>}
                    <img src={getProductImage(p)} alt={p.name} loading="lazy" />
                    <button
                      type="button"
                      className="jumia-card__wish"
                      onClick={(e) => toggleWishlist(p.id, e)}
                    >
                      {isSaved ? Icon.heartFilled : Icon.heart}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="jumia-card__body">
                    {p.is_official && <span className="jumia-card__badge-official">Official Store</span>}
                    <h3 className="jumia-card__title">{p.name}</h3>

                    {/* Price */}
                    <div className="jumia-card__price-row">
                      <span className="jumia-card__price">{formatPrice(displayPrice)}</span>
                      {origPrice > displayPrice && (
                        <span className="jumia-card__orig">{formatPrice(origPrice)}</span>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="jumia-card__rating">
                      {Icon.star}
                      <span className="num">4.2</span>
                      <span className="count">(128)</span>
                    </div>

                    <span className="jumia-card__express">⚡ EXPRESS</span>

                    {/* Add to Cart Button */}
                    <button
                      type="button"
                      className="jumia-card__add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        /* Add to cart logic */
                      }}
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Floating "Sort by | Filter" Pill ── */}
      <div className="jumia-floating-pill">
        <button type="button" className="jumia-fp-btn">
          {Icon.sort} Sort by
        </button>
        <span className="jumia-fp-divider" />
        <button type="button" className="jumia-fp-btn">
          {Icon.filter} Filter
        </button>
      </div>
    </div>
  );
}