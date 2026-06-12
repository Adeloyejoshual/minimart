// pages/Cart/EmptyCart.jsx

import React, { memo } from "react";
import { useNavigate } from "react-router-dom";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG")}`;

const EmptyCart = memo(function EmptyCart({
  savedItems = [],
  onMoveToCart,
  onRemoveSaved,
}) {
  const navigate = useNavigate();

  const SUGGESTIONS = [
    { icon: "👗", label: "Fashion",     path: "/minimart?cat=fashion"     },
    { icon: "📱", label: "Electronics", path: "/minimart?cat=electronics" },
    { icon: "🏠", label: "Home",        path: "/minimart?cat=home"        },
    { icon: "💄", label: "Beauty",      path: "/minimart?cat=beauty"      },
  ];

  return (
    <div className="ct-empty">

      {/* Animated cart illustration */}
      <div className="ct-empty-icon-wrap" aria-hidden="true">
        <div className="ct-empty-icon">🛒</div>
        <div className="ct-empty-pulse" />
      </div>

      <h2 className="ct-empty-title">Your cart is empty</h2>
      <p className="ct-empty-sub">
        Discover amazing products from verified sellers.
        Add items to your cart and come back here to checkout.
      </p>

      {/* CTA buttons */}
      <div className="ct-empty-btns">
        <button
          className="ct-empty-primary-btn"
          onClick={() => navigate("/minimart")}
        >
          🛍️ Browse Minimart
        </button>
        <button
          className="ct-empty-secondary-btn"
          onClick={() => navigate("/")}
        >
          Go to Homepage
        </button>
      </div>

      {/* Category suggestions */}
      <div className="ct-empty-suggest">
        <p className="ct-empty-suggest-title">
          Browse by category
        </p>
        <div className="ct-empty-cats">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              className="ct-empty-cat-btn"
              onClick={() => navigate(s.path)}
            >
              <span className="ct-empty-cat-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Saved items section */}
      {savedItems.length > 0 && (
        <div className="ct-empty-saved">
          <h3 className="ct-empty-saved-title">
            💾 Saved for Later
            <span className="ct-empty-saved-count">
              {savedItems.length}
            </span>
          </h3>
          <div className="ct-saved-list">
            {savedItems.map((item) => (
              <SavedItem
                key={item.id}
                item={item}
                onMoveToCart={onMoveToCart}
                onRemoveSaved={onRemoveSaved}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Saved item row ───────────────────────────────────────────
const SavedItem = memo(function SavedItem({
  item,
  onMoveToCart,
  onRemoveSaved,
}) {
  const [imgErr, setImgErr] = React.useState(false);
  const imgSrc = !imgErr
    ? (Array.isArray(item.images) ? item.images[0] : item.image)
    : null;

  return (
    <div className="ct-saved-item">
      <div className="ct-saved-img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span aria-hidden="true">📦</span>
        )}
      </div>
      <div className="ct-saved-info">
        <p className="ct-saved-name">{item.name}</p>
        {item.variant && (
          <p className="ct-saved-variant">{item.variant.name}</p>
        )}
        <p className="ct-saved-price">{fmt(item.price)}</p>
      </div>
      <div className="ct-saved-actions">
        <button
          className="ct-saved-move"
          onClick={() => onMoveToCart(item.id)}
        >
          Add to Cart
        </button>
        <button
          className="ct-saved-remove"
          onClick={() => onRemoveSaved(item.id)}
          aria-label="Remove saved item"
        >
          Remove
        </button>
      </div>
    </div>
  );
});

export default EmptyCart;