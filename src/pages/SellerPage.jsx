/**
 * src/pages/SellerPage.jsx
 * Route: /seller/store/:sellerId
 * Public seller storefront — products, search, profile header
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  formatPrice,
  getProductImage,
  calcDiscount,
} from "../config/marketplace";
import "../styles/SellerPage.css";

/* ── API ── */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_ROOT = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api";

/* ── Icons ── */
const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={20} height={20}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
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
};

/* ── Helpers ── */
function getInitials(name) {
  if (!name) return "S";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function humanizeSlug(slug) {
  return decodeURIComponent(String(slug || "Seller"))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickSeller(payload, fallbackId) {
  if (!payload) return { id: fallbackId, name: humanizeSlug(fallbackId) };
  const d = payload.data ?? payload.seller ?? payload.store ?? payload.vendor ?? payload;
  if (typeof d !== "object" || Array.isArray(d)) {
    return { id: fallbackId, name: humanizeSlug(fallbackId) };
  }
  return {
    id: d.id ?? d.slug ?? fallbackId,
    slug: d.slug ?? d.id ?? fallbackId,
    name: d.name || d.store_name || d.business_name || humanizeSlug(fallbackId),
    logo: d.logo || d.avatar || d.image || d.profile_image || null,
    rating: d.rating ?? d.average_rating ?? null,
    reviews_count: d.reviews_count ?? d.rating_count ?? null,
    products_count: d.products_count ?? d.listings_count ?? null,
    is_verified: d.is_verified ?? d.verified ?? true,
    fulfillment_text: d.fulfillment_text || "Fulfilled through Minimart",
    bio: d.bio || d.description || d.about || "",
    location: d.location || d.city || d.state || "",
  };
}

function pickList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const d = payload.data ?? payload;
  if (Array.isArray(d)) return d;
  return d?.products || d?.items || d?.listings || payload.products || [];
}

/* ── Sub-component: Product Card ── */
const ProductCard = memo(function ProductCard({ product, isSaved, onToggleWish, onOpen }) {
  const price = Number(product?.price ?? product?.sale_price ?? product?.selling_price ?? 0);
  const orig = Number(product?.original_price ?? product?.compare_price ?? product?.list_price ?? 0);
  const discount = calcDiscount(price, orig);
  const img = getProductImage(product);
  
  const rawRating = Number(product?.rating ?? product?.average_rating ?? 0);
  const rating = rawRating > 0 ? rawRating : null;

  return (
    <article
      className="sp-product-card"
      onClick={() => onOpen(product)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(product)}
    >
      <div className="sp-card-img-wrap">
        {discount > 0 && <span className="sp-card-discount">-{discount}%</span>}
        {img ? (
          <img src={img} alt={product.name || ""} loading="lazy" />
        ) : (
          <div className="sp-card-img-ph" aria-hidden="true">📦</div>
        )}
        <button
          type="button"
          className="sp-card-wish"
          onClick={(e) => onToggleWish(product.id, e)}
          aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
        >
          {isSaved ? Icon.heartFilled : Icon.heart}
        </button>
      </div>

      <div className="sp-card-body">
        <h3 className="sp-card-title">{product.name}</h3>

        <div className="sp-card-price-row">
          <span className="sp-card-price">{formatPrice(price)}</span>
          {orig > price && <span className="sp-card-orig">{formatPrice(orig)}</span>}
        </div>

        {rating != null && (
          <div className="sp-card-rating">
            {Icon.star}
            <span>{rating.toFixed(1)}</span>
          </div>
        )}

        <span className="sp-card-express">⚡ EXPRESS</span>
      </div>
    </article>
  );
});

/* ── Main Page Component ── */
export default function SellerPage() {
  const { sellerId } = useParams();
  const navigate = useNavigate();

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  
  const [wishlist, setWishlist] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("mm_wishlist") || "[]"));
    } catch {
      return new Set();
    }
  });

  const sellerName = useMemo(() => {
    if (seller?.name) return seller.name;
    return humanizeSlug(sellerId);
  }, [seller, sellerId]);

  /* Fetch Data */
  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const id = encodeURIComponent(sellerId);

    // 1. Fetch Seller Info (fallback to raw ID if endpoint fails)
    const fetchSeller = axios
      .get(`${API_ROOT}/sellers/${id}`, { timeout: 12000 })
      .catch(() => axios.get(`${API_ROOT}/stores/${id}`, { timeout: 12000 }).catch(() => null));

    // 2. Fetch Products
    const fetchProducts = axios.get(`${API_ROOT}/products`, {
      params: { seller: sellerId, limit: 60, page: 1 },
      timeout: 15000,
    });

    Promise.all([fetchSeller, fetchProducts])
      .then(([sellerRes, productsRes]) => {
        if (cancelled) return;

        setSeller(pickSeller(sellerRes?.data, sellerId));
        
        const list = pickList(productsRes?.data);
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        console.error("[SellerPage]", err);
        if (!cancelled) {
          setSeller(pickSeller(null, sellerId));
          setProducts([]);
          setError("load_failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sellerId]);

  /* Set Document Title */
  useEffect(() => {
    document.title = `${sellerName} · Store - Loemart`;
    return () => { document.title = "Loemart Marketplace"; };
  }, [sellerName]);

  /* Local Search Filter */
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => String(p.name || "").toLowerCase().includes(q));
  }, [products, query]);

  /* Handlers */
  const toggleWishlist = useCallback((id, e) => {
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem("mm_wishlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const openProduct = useCallback((p) => navigate(`/shop/${p.slug || p.id}`), [navigate]);

  /* Display Vars */
  const ratingDisplay = seller?.rating != null && Number(seller.rating) > 0 ? Number(seller.rating).toFixed(1) : "—";
  const productsCount = seller?.products_count != null ? seller.products_count : products.length;

  return (
    <div className="sp-page">
      {/* Header */}
      <header className="sp-header">
        <button type="button" className="sp-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          {Icon.back}
        </button>
        <h1 className="sp-header-title">{sellerName}</h1>
      </header>

      {/* Hero */}
      <section className="sp-hero">
        <div className="sp-hero-top">
          <div className="sp-avatar-wrap">
            {seller?.logo ? (
              <img src={seller.logo} alt="" className="sp-avatar-img" />
            ) : (
              <div className="sp-avatar-initials" aria-hidden="true">
                {getInitials(sellerName)}
              </div>
            )}
          </div>

          <div className="sp-hero-info">
            <div className="sp-name-row">
              <h2 className="sp-store-name">{sellerName}</h2>
              {(seller?.is_verified ?? true) && (
                <span className="sp-verified-badge">✓ Verified</span>
              )}
            </div>

            <p className="sp-fulfillment-tag">
              {Icon.shield}
              <span>{seller?.fulfillment_text || "Fulfilled through Minimart"}</span>
            </p>

            {seller?.location && <p className="sp-location">{seller.location}</p>}

            <div className="sp-stats-row">
              <div className="sp-stat">
                <span className="sp-stat-val">
                  {Icon.star} {ratingDisplay}
                </span>
                <span className="sp-stat-lbl">Rating</span>
              </div>
              <div className="sp-stat-sep" aria-hidden="true" />
              <div className="sp-stat">
                <span className="sp-stat-val">{productsCount}</span>
                <span className="sp-stat-lbl">Products</span>
              </div>
              <div className="sp-stat-sep" aria-hidden="true" />
              <div className="sp-stat">
                <span className="sp-stat-val">98%</span>
                <span className="sp-stat-lbl">On-Time</span>
              </div>
            </div>
          </div>
        </div>

        {seller?.bio && <p className="sp-bio">{seller.bio}</p>}
      </section>

      {/* Search in store */}
      <div className="sp-search-wrap">
        <div className="sp-search-box">
          {Icon.search}
          <input
            type="search"
            placeholder={`Search in ${sellerName}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search seller products"
          />
          {query && (
            <button type="button" className="sp-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tab */}
      <div className="sp-tabs">
        <button type="button" className="sp-tab sp-tab--active">
          All Products ({filteredProducts.length})
        </button>
      </div>

      {/* Grid */}
      <main className="sp-grid-container">
        {loading ? (
          <div className="sp-skel-grid" aria-busy="true" aria-label="Loading">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="sp-skel-card" />)}
          </div>
        ) : error && products.length === 0 ? (
          <div className="sp-empty">
            <p>Could not load this store right now.</p>
            <button type="button" className="sp-empty-btn" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="sp-empty">
            <p>{query ? `No products match “${query}”.` : "No products in this store yet."}</p>
            {query ? (
              <button type="button" className="sp-empty-btn" onClick={() => setQuery("")}>
                Clear search
              </button>
            ) : (
              <button type="button" className="sp-empty-btn" onClick={() => navigate("/loemart")}>
                Browse marketplace
              </button>
            )}
          </div>
        ) : (
          <div className="sp-product-grid">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id || p.slug}
                product={p}
                isSaved={wishlist.has(p.id)}
                onToggleWish={toggleWishlist}
                onOpen={openProduct}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}