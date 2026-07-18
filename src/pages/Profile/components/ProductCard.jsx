// src/pages/Profile/components/ProductCard.jsx
import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Ic } from "./icons";
import { getImg, PH, naira, fmtNum, timeAgo, daysLeft } from "./helpers";
import "./ProductCard.css";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const STATUS_META = {
  active:          { label: "Active",          cls: "active"  },
  active_limited:  { label: "Active",          cls: "active"  },
  draft:           { label: "Draft",           cls: "draft"   },
  paused:          { label: "Paused",          cls: "paused"  },
  pending_payment: { label: "Pending Payment", cls: "pending" },
  expired:         { label: "Expired",         cls: "expired" },
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const resolveStatus = (product) => {
  const { status, is_active, active_until } = product;

  if (status === "pending_payment") return "pending_payment";
  if (status === "draft")           return "draft";

  const days = daysLeft(active_until);
  if (days !== null && days <= 0)   return "expired";

  if (
    (status === "active" || status === "active_limited") &&
    is_active !== false
  ) return "active";

  if (status === "paused" || is_active === false) return "paused";

  return status || "draft";
};

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
const StatusBadge = memo(({ resolvedStatus }) => {
  const meta = STATUS_META[resolvedStatus] || {
    label: resolvedStatus,
    cls:   "draft",
  };
  return (
    <span className={`status-badge status-badge--${meta.cls}`}>
      <span className="status-badge__dot" />
      {meta.label}
    </span>
  );
});

const ExpiryBadge = memo(({ activeUntil, isPromoted, resolvedStatus }) => {
  if (resolvedStatus === "pending_payment") return null;
  if (resolvedStatus === "draft")           return null;

  const days = daysLeft(activeUntil);
  if (days === null) return null;

  if (days <= 0)
    return <span className="expiry-badge expiry-badge--expired">Expired</span>;
  if (days <= 3)
    return (
      <span className="expiry-badge expiry-badge--critical">
        {days}d left
      </span>
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

/* ─────────────────────────────────────────────
   Pending Payment Banner
───────────────────────────────────────────── */
const PendingBanner = memo(({ product, onPayNow, onVerifyPayment, isVerifying }) => (
  <div className="product-card__pending-banner">
    <div className="product-card__pending-banner-text">
      <Ic.AlertCircle />
      <span>Payment required to go live</span>
    </div>
    <div className="product-card__pending-actions">
      <button
        className="product-card__pending-btn product-card__pending-btn--pay"
        onClick={() => onPayNow(product)}
        disabled={isVerifying}
      >
        <Ic.CreditCard />
        Pay Now
      </button>
      <button
        className="product-card__pending-btn product-card__pending-btn--check"
        onClick={() => onVerifyPayment(product)}
        disabled={isVerifying}
        title="Already paid? Check your payment status"
      >
        {isVerifying ? (
          <>
            <span className="spinner spinner--xs" />
            Checking…
          </>
        ) : (
          <>
            <Ic.Refresh />
            Check Status
          </>
        )}
      </button>
    </div>
  </div>
));

/* ─────────────────────────────────────────────
   Dropdown Menu
───────────────────────────────────────────── */
const DropdownMenu = memo(({
  resolvedStatus,
  days,
  onEdit,
  onToggle,
  onRenew,
  onPromote,
  onDelete,
  isDeleting,
  onClose,
}) => {
  const run = useCallback(
    (fn) => () => { fn(); onClose(); },
    [onClose]
  );

  const isPending = resolvedStatus === "pending_payment";
  const isActive  = resolvedStatus === "active";
  const isPaused  = resolvedStatus === "paused";
  const isExpired = resolvedStatus === "expired";
  const showRenew = days !== null && days <= 7;

  return (
    <div className="product-card__dropdown" role="menu">

      {/* Edit — always available */}
      <button role="menuitem" onClick={run(onEdit)}>
        <Ic.Edit /> Edit
      </button>

      {/* Promote — only when active */}
      {isActive && (
        <button role="menuitem" onClick={run(onPromote)}>
          <Ic.Zap /> Promote
        </button>
      )}

      {/* Toggle active ↔ paused — not for pending/expired */}
      {(isActive || isPaused) && (
        <button role="menuitem" onClick={run(onToggle)}>
          {isActive ? (
            <><Ic.Pause /> Pause</>
          ) : (
            <><Ic.Play /> Activate</>
          )}
        </button>
      )}

      {/* Renew — when near expiry or expired */}
      {(showRenew || isExpired) && (
        <button role="menuitem" onClick={run(onRenew)}>
          <Ic.Refresh /> Renew
        </button>
      )}

      {/* Pending: no Activate option — payment must be completed */}
      {isPending && (
        <button
          role="menuitem"
          className="product-card__dropdown-info"
          disabled
        >
          <Ic.Lock /> Complete payment to activate
        </button>
      )}

      <div className="product-card__dropdown-divider" />

      {/* Delete — always available */}
      <button
        role="menuitem"
        className="product-card__dropdown-danger"
        onClick={run(onDelete)}
        disabled={isDeleting}
      >
        <Ic.Trash />
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
});

/* ─────────────────────────────────────────────
   Main ProductCard
───────────────────────────────────────────── */
const ProductCard = memo(function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  onPayNow,
  onVerifyPayment,
  isDeleting,
  isVerifying,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef(null);

  const resolvedStatus = resolveStatus(product);
  const days           = daysLeft(product.active_until);
  const img            = getImg(product);

  const isPending = resolvedStatus === "pending_payment";
  const isExpired = resolvedStatus === "expired";
  const isActive  = resolvedStatus === "active";

  /* ── close menu on outside click ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  /* ── close menu on Escape ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <div
      className={[
        "product-card",
        isDeleting          ? "product-card--deleting" : "",
        isExpired           ? "product-card--expired"  : "",
        isPending           ? "product-card--pending"  : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Image ── */}
      <div className="product-card__img-wrap">
        <img
          src={img}
          alt={product.title}
          className="product-card__img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {product.is_promoted && !isPending && (
          <span className="product-card__promoted-badge">
            <Ic.Zap /> Promoted
          </span>
        )}
        {isPending && (
          <span className="product-card__pending-overlay">
            <Ic.Lock />
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="product-card__body">

        {/* Top row: title + badges + menu */}
        <div className="product-card__top">
          <div className="product-card__title-wrap">
            <h3 className="product-card__title">{product.title}</h3>
            <div className="product-card__badges">
              <StatusBadge resolvedStatus={resolvedStatus} />
              <ExpiryBadge
                activeUntil={product.active_until}
                isPromoted={product.is_promoted}
                resolvedStatus={resolvedStatus}
              />
            </div>
          </div>

          {/* Context menu */}
          <div className="product-card__menu-wrap" ref={menuRef}>
            <button
              className="product-card__menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Ic.MoreVertical />
            </button>

            {menuOpen && (
              <DropdownMenu
                resolvedStatus={resolvedStatus}
                days={days}
                onEdit={() => onEdit(product)}
                onToggle={() => onToggle(product)}
                onRenew={() => onRenew(product)}
                onPromote={() => onPromote(product)}
                onDelete={() => onDelete(product)}
                isDeleting={isDeleting}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Meta row */}
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

        {/* Stats row — hidden for pending */}
        {!isPending && (
          <div className="product-card__stats">
            <div className="product-card__stat" title="Views">
              <Ic.Eye />
              <span>{fmtNum(product.views)}</span>
            </div>
            <div className="product-card__stat" title="Saves">
              <Ic.Heart />
              <span>{fmtNum(product.favorites_count)}</span>
            </div>

            {/* Renew shortcut */}
            {days !== null && days <= 7 && days > 0 && (
              <button
                className="product-card__renew"
                onClick={() => onRenew(product)}
              >
                <Ic.Refresh /> Renew
              </button>
            )}

            {/* Promote shortcut for active */}
            {isActive && !product.is_promoted && (
              <button
                className="product-card__boost"
                onClick={() => onPromote(product)}
              >
                <Ic.Zap /> Boost
              </button>
            )}
          </div>
        )}

        {/* Pending payment banner */}
        {isPending && (
          <PendingBanner
            product={product}
            onPayNow={onPayNow}
            onVerifyPayment={onVerifyPayment}
            isVerifying={isVerifying}
          />
        )}
      </div>
    </div>
  );
});

export default ProductCard;