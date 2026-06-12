// pages/Cart/YouMayAlsoLike.jsx

import React, {
  useState, useEffect, memo, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com/api";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

// ── Single product card ──────────────────────────────────────
const SuggCard = memo(function SuggCard({ product, onAddToCart }) {
  const navigate          = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  const image = !imgErr
    ? (Array.isArray(product.images)
        ? product.images[0]
        : product.image ?? null)
    : null;

  const hasDiscount = product.compare_price &&
    Number(product.compare_price) > Number(product.price);

  const discountPct = hasDiscount
    ? Math.round(
        ((Number(product.compare_price) - Number(product.price)) /
          Number(product.compare_price)) * 100
      )
    : 0;

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

  return (
    <div
      className="ct-sugg-card"
      onClick={() => navigate(`/product/${product.slug ?? product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          navigate(`/product/${product.slug ?? product.id}`);
        }
      }}
      aria-label={`View ${product.name ?? product.title}`}
    >
      {/* Image */}
      <div className="ct-sugg-img-wrap">
        {image ? (
          <img
            src={image}
            alt={product.name ?? product.title}
            className="ct-sugg-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="ct-sugg-img-placeholder" aria-hidden="true">
            📦
          </div>
        )}
        {hasDiscount && (
          <span className="ct-sugg-badge">-{discountPct}%</span>
        )}
        {product.isNew && (
          <span className="ct-sugg-badge ct-sugg-badge--new">New</span>
        )}
      </div>

      {/* Info */}
      <div className="ct-sugg-info">
        <p className="ct-sugg-name">
          {product.name ?? product.title}
        </p>

        {/* Rating */}
        {product.rating > 0 && (
          <div className="ct-sugg-rating">
            <span className="ct-sugg-stars">
              {"★".repeat(Math.round(product.rating))}
              {"☆".repeat(5 - Math.round(product.rating))}
            </span>
            <span className="ct-sugg-review-count">
              ({product.reviewCount ?? product.review_count ?? 0})
            </span>
          </div>
        )}

        {/* Price */}
        <div className="ct-sugg-price-row">
          <span className="ct-sugg-price">
            {fmt(product.price)}
          </span>
          {hasDiscount && (
            <span className="ct-sugg-compare">
              {fmt(product.compare_price)}
            </span>
          )}
        </div>
      </div>

      {/* Add button */}
      <button
        className={`ct-sugg-add-btn ${
          added ? "ct-sugg-add-btn--added" : ""
        }`}
        onClick={handleAdd}
        disabled={adding}
        aria-label={`Add ${product.name ?? product.title} to cart`}
      >
        {adding ? (
          <span className="ct-rp-spinner" aria-hidden="true" />
        ) : added ? (
          "✓ Added!"
        ) : (
          "Add to Cart"
        )}
      </button>
    </div>
  );
});

// ── Skeleton cards ───────────────────────────────────────────
function SuggSkeleton() {
  return (
    <div className="ct-sugg-skeleton-row">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="ct-sugg-skeleton-card">
          <div className="ct-sugg-sk-img ct-skeleton" />
          <div className="ct-sugg-sk-line ct-skeleton" />
          <div className="ct-sugg-sk-line ct-sugg-sk-line--sm ct-skeleton" />
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// YOU MAY ALSO LIKE SECTION
// ═════════════════════════════════════════════════════════════
const YouMayAlsoLike = memo(function YouMayAlsoLike({
  cartItems = [],
  onAddToCart,
}) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(false);

      try {
        // Build category hint from cart items
        const cartIds = cartItems
          .map((i) => i.productId ?? i.id)
          .filter(Boolean)
          .slice(0, 5)
          .join(",");

        // Fetch related / trending products
        const { data } = await axios.get(
          `${API_BASE}/products/suggestions`,
          {
            params: {
              exclude: cartIds,
              limit:   12,
            },
            timeout: 8000,
          }
        );

        if (!cancelled) {
          const items = data.data?.products
            ?? data.data
            ?? data.products
            ?? [];
          setProducts(items);
        }

      } catch {
        // Fallback: try trending
        try {
          const { data } = await axios.get(
            `${API_BASE}/products/trending`,
            { params: { limit: 12 }, timeout: 8000 }
          );
          if (!cancelled) {
            setProducts(
              data.data?.products ??
              data.products       ??
              []
            );
          }
        } catch {
          if (!cancelled) setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => { cancelled = true; };
  }, []); // Only on mount

  if (!loading && (error || products.length === 0)) return null;

  return (
    <div className="ct-section-block">
      <div className="ct-section-header">
        <div>
          <h3 className="ct-section-title">
            ✨ You May Also Like
          </h3>
          <p className="ct-section-sub">
            Hand-picked for you
          </p>
        </div>
        <a
          href="/minimart"
          className="ct-section-see-all"
          aria-label="See all products"
        >
          See all →
        </a>
      </div>

      {loading ? (
        <SuggSkeleton />
      ) : (
        <div className="ct-sugg-scroll">
          <div className="ct-sugg-track">
            {products.map((product) => (
              <SuggCard
                key={product.id}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default YouMayAlsoLike;