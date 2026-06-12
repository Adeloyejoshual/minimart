// pages/Cart/RecentlyViewed.jsx

import React, {
  useState, useEffect, memo, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";

const RECENT_KEY = "mm_recently_viewed";
const MAX_RECENT = 12;

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// ═════════════════════════════════════════════════════════════
// TRACK A PRODUCT VIEW
// Call this from your product detail page
// ═════════════════════════════════════════════════════════════
export function trackProductView(product) {
  try {
    const stored  = JSON.parse(
      localStorage.getItem(RECENT_KEY) || "[]"
    );
    const filtered = stored.filter((p) => p.id !== product.id);
    const updated  = [
      {
        id:       product.id,
        name:     product.name ?? product.title,
        price:    product.price,
        image:    Array.isArray(product.images)
          ? product.images[0]
          : product.image ?? product.imageUrl ?? null,
        slug:     product.slug,
        viewedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT);

    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("recently-viewed-updated"));
  } catch {}
}

// ── Load from localStorage ──────────────────────────────────
function loadRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════
// PRODUCT MINI CARD
// ═════════════════════════════════════════════════════════════
const ProductCard = memo(function ProductCard({ product, onAddToCart }) {
  const navigate            = useNavigate();
  const [imgErr,  setImgErr]  = useState(false);
  const [adding,  setAdding]  = useState(false);
  const [added,   setAdded]   = useState(false);

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      await onAddToCart(product);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  }, [product, onAddToCart, adding, added]);

  const handleNav = useCallback(() => {
    navigate(`/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  return (
    <div
      className="ct-rp-card"
      onClick={handleNav}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleNav(); }}
      aria-label={`View ${product.name}`}
    >
      {/* Image */}
      <div className="ct-rp-img-wrap">
        {!imgErr && product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="ct-rp-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="ct-rp-img-placeholder" aria-hidden="true">
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div className="ct-rp-info">
        <p className="ct-rp-name">{product.name}</p>
        <p className="ct-rp-price">{fmt(product.price)}</p>
      </div>

      {/* Add to cart */}
      <button
        className={`ct-rp-add-btn ${
          added ? "ct-rp-add-btn--added" : ""
        }`}
        onClick={handleAdd}
        disabled={adding}
        aria-label={`Add ${product.name} to cart`}
      >
        {adding ? (
          <span className="ct-rp-spinner" aria-hidden="true" />
        ) : added ? (
          "✓ Added"
        ) : (
          "+ Cart"
        )}
      </button>
    </div>
  );
});

// ═════════════════════════════════════════════════════════════
// RECENTLY VIEWED SECTION
// ═════════════════════════════════════════════════════════════
function RecentlyViewed({ onAddToCart }) {
  const [items, setItems] = useState(() => loadRecentlyViewed());

  // Sync when another tab/component updates storage
  useEffect(() => {
    const handler = () => setItems(loadRecentlyViewed());
    window.addEventListener("recently-viewed-updated", handler);
    return () =>
      window.removeEventListener("recently-viewed-updated", handler);
  }, []);

  const handleClear = useCallback(() => {
    localStorage.removeItem(RECENT_KEY);
    setItems([]);
  }, []);

  if (!items.length) return null;

  return (
    <div className="ct-section-block">
      <div className="ct-section-header">
        <div>
          <h3 className="ct-section-title">👁️ Recently Viewed</h3>
          <p className="ct-section-sub">Products you checked out</p>
        </div>
        <button
          className="ct-section-clear"
          onClick={handleClear}
          aria-label="Clear recently viewed"
        >
          Clear
        </button>
      </div>

      <div className="ct-rp-scroll">
        <div className="ct-rp-track">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Named export for trackProductView (already exported above)
// ── Default export for the component
export default RecentlyViewed;

// ── Named export for the component (for destructured imports)
export { RecentlyViewed };