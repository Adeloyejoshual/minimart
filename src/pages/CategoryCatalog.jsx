/**
 * src/pages/CategoryCatalog.jsx
 * Route: /catalog
 * Query: ?category=slug&brand=Name&q=search
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  formatPrice,
  getProductImage,
  calcDiscount,
} from "../config/marketplace";
import "../styles/CategoryCatalog.css";

/* Same API root style as MarketDetail */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_ROOT = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api";

const PRODUCTS_URL = `${API_ROOT}/products`;
// if your backend uses /shop instead:
// const PRODUCTS_URL = `${API_ROOT}/shop`;

const Icon = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  heartFilled: (
    <svg viewBox="0 0 24 24" fill="#ff5722" stroke="#ff5722" strokeWidth={2} width={18} height={18}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  sort: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="12" x2="12" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
    </svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={20} height={20}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

function titleCase(str) {
  return String(str || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickRating(p) {
  const r = Number(p?.rating ?? p?.average_rating ?? 0);
  return r > 0 ? r : null;
}

export default function CategoryCatalog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const categorySlug = searchParams.get("category") || "";
  const brandParam = searchParams.get("brand") || "";
  const searchQuery = searchParams.get("q") || "";
  const sortParam = searchParams.get("sort") || "newest";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMoreSeo, setShowMoreSeo] = useState(false);
  const [wishlist, setWishlist] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("mm_wishlist") || "[]"));
    } catch {
      return new Set();
    }
  });

  const displayTitle = useMemo(() => {
    if (brandParam) return titleCase(brandParam);
    if (categorySlug) return titleCase(categorySlug);
    if (searchQuery) return `“${searchQuery}”`;
    return "All Products";
  }, [categorySlug, brandParam, searchQuery]);

  const breadcrumbLabel = displayTitle;

  /* Fetch — try common param names so API actually returns data */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = {
      page: 1,
      limit: 48,
      sort: sortParam || undefined,
    };

    // send several aliases; backend usually ignores unknowns
    if (categorySlug) {
      params.category = categorySlug;
      params.category_slug = categorySlug;
      params.slug = categorySlug;
    }
    if (brandParam) {
      params.brand = brandParam;
      params.brand_name = brandParam;
    }
    if (searchQuery) {
      params.q = searchQuery;
      params.search = searchQuery;
    }

    axios
      .get(PRODUCTS_URL, { params, timeout: 15000 })
      .then(({ data }) => {
        if (cancelled) return;
        const list =
          data?.data?.products ??
          data?.data?.items ??
          data?.data ??
          data?.products ??
          data?.items ??
          (Array.isArray(data) ? data : []);
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error("[CategoryCatalog] Fetch error:", err);
        if (!cancelled) {
          setProducts([]);
          setError(err?.response?.status === 404 ? "not_found" : "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug, brandParam, searchQuery, sortParam]);

  const toggleWishlist = useCallback((id, e) => {
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("mm_wishlist", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const goProduct = useCallback(
    (p) => {
      navigate(`/shop/${p.slug || p.id}`);
    },
    [navigate]
  );

  return (
    <div className="jumia-cat-page">
      <header className="jumia-cat-header">
        <button
          type="button"
          className="jumia-cat-back"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          {Icon.back}
        </button>
        <div
          className="jumia-search-bar"
          onClick={() => navigate("/search")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/search")}
        >
          {Icon.search}
          <span>
            {categorySlug || brandParam
              ? titleCase(categorySlug || brandParam)
              : "Search products, brands..."}
          </span>
        </div>
      </header>

      {/* Breadcrumbs — match MarketDetail destinations */}
      <nav className="jumia-breadcrumbs" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate("/loemart")}>
          Home
        </button>
        {(categorySlug || brandParam || searchQuery) && (
          <>
            <span className="sep">&gt;</span>
            <span className="current">{breadcrumbLabel}</span>
          </>
        )}
      </nav>

      <div className="jumia-filter-pills">
        <button type="button" className="pill pill--express">
          ⚡ EXPRESS
        </button>
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

      <div className="jumia-seo-block">
        <h1 className="jumia-seo-title">
          {displayTitle.toUpperCase()}
          {brandParam || categorySlug ? " IN NIGERIA" : ""}
        </h1>
        <p
          className={`jumia-seo-text ${
            showMoreSeo ? "jumia-seo-text--open" : ""
          }`}
        >
          Explore {displayTitle} on Loemart Nigeria — competitive prices, trusted
          sellers, and fast delivery options across Nigeria.
        </p>
        <button
          type="button"
          className="jumia-seo-more"
          onClick={() => setShowMoreSeo((v) => !v)}
        >
          {showMoreSeo ? "See less ▲" : "See more ▼"}
        </button>
      </div>

      <main className="jumia-grid-wrap">
        {loading ? (
          <div className="jumia-grid-skel">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="jumia-skel-card" />
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div className="jumia-empty">
            <p>Could not load products. Check API route / catalog path.</p>
            <p className="jumia-empty-hint">
              Request: {PRODUCTS_URL}
              {categorySlug ? `?category=${categorySlug}` : ""}
              {brandParam ? `${categorySlug ? "&" : "?"}brand=${brandParam}` : ""}
            </p>
            <button type="button" onClick={() => navigate("/loemart")}>
              Browse All Items
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="jumia-empty">
            <p>No products found for “{displayTitle}”.</p>
            <button type="button" onClick={() => navigate("/loemart")}>
              Browse All Items
            </button>
          </div>
        ) : (
          <div className="jumia-product-grid">
            {products.map((p) => {
              const displayPrice = Number(
                p.price ?? p.sale_price ?? p.selling_price ?? 0
              );
              const origPrice = Number(
                p.original_price || p.compare_price || p.list_price || 0
              );
              const discount = calcDiscount(displayPrice, origPrice);
              const isSaved = wishlist.has(p.id);
              const rating = pickRating(p);
              const reviewsCount = p.reviews_count ?? p.rating_count ?? 0;
              const img = getProductImage(p);

              return (
                <div
                  key={p.id}
                  className="jumia-product-card"
                  onClick={() => goProduct(p)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && goProduct(p)}
                >
                  <div className="jumia-card__img-wrap">
                    {discount > 0 && (
                      <span className="jumia-card__discount">-{discount}%</span>
                    )}
                    {img ? (
                      <img src={img} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="jumia-card__img-ph">📦</div>
                    )}
                    <button
                      type="button"
                      className="jumia-card__wish"
                      onClick={(e) => toggleWishlist(p.id, e)}
                      aria-label="Wishlist"
                    >
                      {isSaved ? Icon.heartFilled : Icon.heart}
                    </button>
                  </div>

                  <div className="jumia-card__body">
                    {p.is_official && (
                      <span className="jumia-card__badge-official">
                        Official Store
                      </span>
                    )}
                    <h3 className="jumia-card__title">{p.name}</h3>

                    <div className="jumia-card__price-row">
                      <span className="jumia-card__price">
                        {formatPrice(displayPrice)}
                      </span>
                      {origPrice > displayPrice && (
                        <span className="jumia-card__orig">
                          {formatPrice(origPrice)}
                        </span>
                      )}
                    </div>

                    {rating != null && (
                      <div className="jumia-card__rating">
                        {Icon.star}
                        <span className="num">{rating.toFixed(1)}</span>
                        {reviewsCount > 0 && (
                          <span className="count">({reviewsCount})</span>
                        )}
                      </div>
                    )}

                    <span className="jumia-card__express">⚡ EXPRESS</span>

                    <button
                      type="button"
                      className="jumia-card__add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        goProduct(p);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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