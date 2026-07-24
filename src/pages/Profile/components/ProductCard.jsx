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
  active_limited:  { label: "Trial",           cls: "trial"   },
  draft:           { label: "Draft",           cls: "draft"   },
  paused:          { label: "Paused",          cls: "paused"  },
  pending_payment: { label: "Pending Payment", cls: "pending" },
  expired:         { label: "Expired",         cls: "expired" },
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

/* Safely compute days left — returns null if no date */
const safeDaysLeft = (dateStr) => {
  if (!dateStr) return null;
  try {
    return daysLeft(dateStr);
  } catch {
    return null;
  }
};

/* Safely get image — always returns a string */
const safeImg = (product) => {
  try {
    return getImg(product) || PH;
  } catch {
    return PH;
  }
};

/* Resolve product status to a canonical key */
const resolveStatus = (product) => {
  if (!product) return "draft";

  const { status, is_active, active_until } = product;

  if (status === "pending_payment") return "pending_payment";
  if (status === "draft")           return "draft";

  const days = safeDaysLeft(active_until);
  if (days !== null && days <= 0)   return "expired";

  if (
    (status === "active" || status === "active_limited") &&
    is_active !== false
  ) return status; // preserve active_limited so badge is correct

  if (status === "paused" || is_active === false) return "paused";

  return status || "draft";
};

/* ─────────────────────────────────────────────
   StatusBadge
───────────────────────────────────────────── */
const StatusBadge = memo(({ resolvedStatus }) => {
  const meta = STATUS_META[resolvedStatus] ?? {
    label: resolvedStatus ?? "Unknown",
    cls:   "draft",
  };
  return (
    <span className={`status-badge status-badge--${meta.cls}`}>
      <span className="status-badge__dot" />
      {meta.label}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

/* ─────────────────────────────────────────────
   ExpiryBadge
───────────────────────────────────────────── */
const ExpiryBadge = memo(({ activeUntil, isPromoted, resolvedStatus }) => {
  /* No expiry badge for these statuses */
  if (
    resolvedStatus === "pending_payment" ||
    resolvedStatus === "draft"
  ) return null;

  const days = safeDaysLeft(activeUntil);
  if (days === null) return null;

  if (days <= 0)
    return (
      <span className="expiry-badge expiry-badge--expired">Expired</span>
    );
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
ExpiryBadge.displayName = "ExpiryBadge";

/* ─────────────────────────────────────────────
   PendingBanner
───────────────────────────────────────────── */
const PendingBanner = memo(({
  product,
  onPayNow,
  onVerifyPayment,
  isVerifying,
}) => (
  <div className="product-card__pending-banner">
    <div className="product-card__pending-banner-text">
      <Ic.AlertCircle />
      <span>Payment required to go live</span>
    </div>
    <div className="product-card__pending-actions">
      <button
        className="product-card__pending-btn product-card__pending-btn--pay"
        onClick={() => onPayNow?.(product)}
        disabled={isVerifying}
      >
        <Ic.CreditCard />
        Pay Now
      </button>
      <button
        className="product-card__pending-btn product-card__pending-btn--check"
        onClick={() => onVerifyPayment?.(product)}
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
PendingBanner.displayName = "PendingBanner";

/* ─────────────────────────────────────────────
   DropdownMenu
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
    (fn) => () => { fn?.(); onClose(); },
    [onClose]
  );

  const isPending  = resolvedStatus === "pending_payment";
  const isActive   = resolvedStatus === "active";
  const isPaused   = resolvedStatus === "paused";
  const isExpired  = resolvedStatus === "expired";
  const isLimited  = resolvedStatus === "active_limited";
  const canRenew   = (days !== null && days <= 7) || isExpired;
  const canToggle  = isActive || isPaused || isLimited;

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

      {/* Toggle active ↔ paused */}
      {canToggle && (
        <button role="menuitem" onClick={run(onToggle)}>
          {isActive || isLimited ? (
            <><Ic.Pause /> Pause</>
          ) : (
            <><Ic.Play /> Activate</>
          )}
        </button>
      )}

      {/* Renew — when near expiry or expired */}
      {canRenew && (
        <button role="menuitem" onClick={run(onRenew)}>
          <Ic.Refresh /> Renew
        </button>
      )}

      {/* Pending: block activation */}
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
DropdownMenu.displayName = "DropdownMenu";

/* ─────────────────────────────────────────────
   Main ProductCard
───────────────────────────────────────────── */
const ProductCard = memo(function ProductCard({
  product,
  tier         = "unverified",
  isSubscriber = false,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  onPayNow,
  onVerifyPayment,
  isDeleting   = false,
  isVerifying  = false,
  isRenewing   = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /* ── Bail out early if product is malformed ── */
  if (!product || !product.id) {
    console.warn("[ProductCard] Received invalid product:", product);
    return null;
  }

  /* ── Derived values — all safe ── */
  const resolvedStatus = resolveStatus(product);
  const isPending      = resolvedStatus === "pending_payment";
  const isExpired      = resolvedStatus === "expired";
  const isActive       = resolvedStatus === "active";
  const isLimited      = resolvedStatus === "active_limited";

  /* Only compute days if we have a date & product isn't pending */
  const days = isPending ? null : safeDaysLeft(product.active_until);

  /* Safe image */
  const img = safeImg(product);

  /* Safe display values */
  const title       = product.title        || "Untitled Listing";
  const price       = product.price != null ? naira(product.price) : "₦—";
  const views       = product.views        != null ? fmtNum(product.views)           : "0";
  const saves       = product.favorites_count != null ? fmtNum(product.favorites_count) : "0";
  const createdAt   = product.created_at   ? timeAgo(product.created_at)   : "";
  const isPromoted  = Boolean(product.is_promoted);
  const categoryName = product.category_name || null;

  /* ── Close menu on outside click ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  /* ── Close menu on Escape ── */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  /* ─── Render ─── */
  return (
    <div
      className={[
        "product-card",
        isDeleting ? "product-card--deleting" : "",
        isExpired  ? "product-card--expired"  : "",
        isPending  ? "product-card--pending"  : "",
        isRenewing ? "product-card--renewing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Image ── */}
      <div className="product-card__img-wrap">
        <img
          src={img}
          alt={title}
          className="product-card__img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {isPromoted && !isPending && (
          <span className="product-card__promoted-badge">
            <Ic.Zap /> Promoted
          </span>
        )}

        {isPending && (
          <span className="product-card__pending-overlay">
            <Ic.Lock />
          </span>
        )}

        {isRenewing && (
          <span className="product-card__renewing-overlay">
            <span className="spinner spinner--sm" />
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="product-card__body">

        {/* ── Top row: title + badges + menu ── */}
        <div className="product-card__top">
          <div className="product-card__title-wrap">
            <h3 className="product-card__title">{title}</h3>
            <div className="product-card__badges">
              <StatusBadge resolvedStatus={resolvedStatus} />
              <ExpiryBadge
                activeUntil={product.active_until ?? null}
                isPromoted={isPromoted}
                resolvedStatus={resolvedStatus}
              />
            </div>
          </div>

          {/* ── Context menu ── */}
          <div className="product-card__menu-wrap" ref={menuRef}>
            <button
              className="product-card__menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={isDeleting || isRenewing}
            >
              <Ic.MoreVertical />
            </button>

            {menuOpen && (
              <DropdownMenu
                resolvedStatus={resolvedStatus}
                days={days}
                onEdit={() => onEdit?.(product)}
                onToggle={() => onToggle?.(product)}
                onRenew={() => onRenew?.(product)}
                onPromote={() => onPromote?.(product)}
                onDelete={() => onDelete?.(product)}
                isDeleting={isDeleting}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        </div>

        {/* ── Meta row ── */}
        <div className="product-card__meta">
          <span className="product-card__price">{price}</span>
          {categoryName && (
            <span className="product-card__category">{categoryName}</span>
          )}
          {createdAt && (
            <span className="product-card__time">
              <Ic.Clock /> {createdAt}
            </span>
          )}
        </div>

        {/* ── Stats row — hidden for pending ── */}
        {!isPending && (
          <div className="product-card__stats">
            <div className="product-card__stat" title="Views">
              <Ic.Eye />
              <span>{views}</span>
            </div>
            <div className="product-card__stat" title="Saves">
              <Ic.Heart />
              <span>{saves}</span>
            </div>

            {/* Renew shortcut — near expiry */}
            {days !== null && days <= 7 && days > 0 && (
              <button
                className="product-card__renew"
                onClick={() => onRenew?.(product)}
                disabled={isRenewing}
              >
                {isRenewing ? (
                  <span className="spinner spinner--xs" />
                ) : (
                  <Ic.Refresh />
                )}
                {isRenewing ? "Renewing…" : "Renew"}
              </button>
            )}

            {/* Promote shortcut — active only */}
            {(isActive || isLimited) && !isPromoted && (
              <button
                className="product-card__boost"
                onClick={() => onPromote?.(product)}
              >
                <Ic.Zap /> Boost
              </button>
            )}
          </div>
        )}

        {/* ── Pending payment banner ── */}
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

ProductCard.displayName = "ProductCard";
export default ProductCard;