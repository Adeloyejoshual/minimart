// src/pages/Profile/components/ProductCard.jsx
import { memo, useState, useEffect, useRef } from "react";
import { Ic } from "./icons";
import { getImg, PH, naira, fmtNum, timeAgo, daysLeft } from "./helpers";
import "./ProductCard.css";

const StatusBadge = memo(({ status, isActive }) => {
  const s =
    isActive && (status === "active" || status === "active_limited")
      ? "active"
      : status === "draft"
      ? "draft"
      : status === "paused"
      ? "paused"
      : status === "pending_payment"
      ? "pending"
      : status || "unknown";

  const labels = {
    active: "Active",
    draft: "Draft",
    paused: "Paused",
    pending: "Pending",
    unknown: "Unknown",
  };

  return (
    <span className={`status-badge status-badge--${s}`}>
      <span className="status-badge__dot" />
      {labels[s] || s}
    </span>
  );
});

const ExpiryBadge = memo(({ activeUntil, isPromoted }) => {
  const days = daysLeft(activeUntil);
  if (days === null) return null;
  if (days <= 0)
    return (
      <span className="expiry-badge expiry-badge--expired">Expired</span>
    );
  if (days <= 3)
    return (
      <span className="expiry-badge expiry-badge--critical">{days}d left</span>
    );
  if (days <= 7)
    return (
      <span className="expiry-badge expiry-badge--warn">{days}d left</span>
    );
  if (isPromoted)
    return (
      <span className="expiry-badge expiry-badge--promoted">
        <Ic.Zap /> {days}d
      </span>
    );
  return (
    <span className="expiry-badge expiry-badge--ok">{days}d left</span>
  );
});

const ProductCard = memo(function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  isDeleting,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const img = getImg(product);
  const active =
    (product.status === "active" || product.status === "active_limited") &&
    product.is_active !== false;
  const days = daysLeft(product.active_until);
  const expired = days !== null && days <= 0;

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className={`product-card${isDeleting ? " product-card--deleting" : ""}${
        expired ? " product-card--expired" : ""
      }`}
    >
      {/* Image */}
      <div className="product-card__img-wrap">
        <img
          src={img}
          alt={product.title}
          className="product-card__img"
          onError={(e) => {
            e.currentTarget.src = PH;
          }}
        />
        {product.is_promoted && (
          <span className="product-card__promoted-badge">
            <Ic.Zap /> Promoted
          </span>
        )}
      </div>

      {/* Body */}
      <div className="product-card__body">
        <div className="product-card__top">
          <div className="product-card__title-wrap">
            <h3 className="product-card__title">{product.title}</h3>
            <div className="product-card__badges">
              <StatusBadge
                status={product.status}
                isActive={product.is_active}
              />
              <ExpiryBadge
                activeUntil={product.active_until}
                isPromoted={product.is_promoted}
              />
            </div>
          </div>

          {/* Context menu */}
          <div className="product-card__menu-wrap" ref={menuRef}>
            <button
              className="product-card__menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Ic.MoreVertical />
            </button>
            {menuOpen && (
              <div className="product-card__dropdown">
                <button
                  onClick={() => {
                    onEdit(product);
                    setMenuOpen(false);
                  }}
                >
                  <Ic.Edit /> Edit
                </button>
                <button
                  onClick={() => {
                    onPromote(product);
                    setMenuOpen(false);
                  }}
                >
                  <Ic.Zap /> Promote
                </button>
                <button
                  onClick={() => {
                    onToggle(product);
                    setMenuOpen(false);
                  }}
                >
                  {active ? (
                    <>
                      <Ic.Pause /> Pause
                    </>
                  ) : (
                    <>
                      <Ic.Play /> Activate
                    </>
                  )}
                </button>
                {days !== null && days <= 7 && (
                  <button
                    onClick={() => {
                      onRenew(product);
                      setMenuOpen(false);
                    }}
                  >
                    <Ic.Refresh /> Renew
                  </button>
                )}
                <button
                  className="product-card__dropdown-danger"
                  onClick={() => {
                    onDelete(product);
                    setMenuOpen(false);
                  }}
                >
                  <Ic.Trash /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="product-card__meta">
          <span className="product-card__price">{naira(product.price)}</span>
          {product.category_name && (
            <span className="product-card__category">
              {product.category_name}
            </span>
          )}
          <span className="product-card__time">
            <Ic.Clock /> {timeAgo(product.created_at)}
          </span>
        </div>

        {/* Stats */}
        <div className="product-card__stats">
          <div className="product-card__stat" title="Views">
            <Ic.Eye />
            <span>{fmtNum(product.views)}</span>
          </div>
          <div className="product-card__stat" title="Saves">
            <Ic.Heart />
            <span>{fmtNum(product.favorites_count)}</span>
          </div>
          {days !== null && days <= 7 && days > 0 && (
            <button
              className="product-card__renew"
              onClick={() => onRenew(product)}
            >
              <Ic.Refresh /> Renew
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductCard;