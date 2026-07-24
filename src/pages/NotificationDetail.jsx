// src/pages/NotificationDetail.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "../styles/NotificationDetail.css";

/* ══════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/notifications`;

/* ══════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CONFIG
══════════════════════════════════════════════════════════════ */
const NOTIF_CFG = {
  /* Account */
  welcome              : { icon: "👋", color: "#2563eb", bg: "#eff6ff", label: "Welcome",          ctaLabel: "Go to Dashboard",    ctaLink: "/"           },
  email_verified       : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Email Verified",    ctaLabel: "Go to Settings",     ctaLink: "/settings"   },
  identity_approved    : { icon: "🛡️", color: "#10b981", bg: "#ecfdf5", label: "Identity Verified", ctaLabel: "View Profile",       ctaLink: "/profile"    },
  identity_rejected    : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Identity Rejected", ctaLabel: "Retry Verification", ctaLink: "/verify"     },
  store_approved       : { icon: "🏪", color: "#10b981", bg: "#ecfdf5", label: "Store Approved",    ctaLabel: "Manage Store",       ctaLink: "/store"      },
  store_rejected       : { icon: "🏪", color: "#ef4444", bg: "#fef2f2", label: "Store Rejected",    ctaLabel: "Resubmit",           ctaLink: "/verify"     },
  account_flagged      : { icon: "⚠️", color: "#f59e0b", bg: "#fffbeb", label: "Account Flagged",   ctaLabel: "Contact Support",    ctaLink: "/support"    },
  password_changed     : { icon: "🔒", color: "#6b7280", bg: "#f3f4f6", label: "Security Alert",    ctaLabel: "Security Settings",  ctaLink: "/settings"   },

  /* Referral */
  referral_signup      : { icon: "👤", color: "#2563eb", bg: "#eff6ff", label: "Referral",          ctaLabel: "Invite More Friends", ctaLink: "/invite"    },
  referral_rewarded    : { icon: "🎁", color: "#8b5cf6", bg: "#f5f3ff", label: "Reward Earned",     ctaLabel: "View Rewards",        ctaLink: "/invite"    },
  bonus_spin_earned    : { icon: "🎡", color: "#e8630a", bg: "#fff0e6", label: "Bonus Spin",        ctaLabel: "Spin Now!",           ctaLink: "/spin"      },

  /* Spin */
  spin_win             : { icon: "🎉", color: "#16a34a", bg: "#f0fdf4", label: "You Won!",          ctaLabel: "Spin Again",          ctaLink: "/spin"      },
  spin_coupon_expiring : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",     ctaLabel: "Use Coupon Now",      ctaLink: "/spin"      },

  /* Orders */
  order_placed         : { icon: "📦", color: "#2563eb", bg: "#eff6ff", label: "Order Placed",      ctaLabel: "Track Order",         ctaLink: "/orders"    },
  order_confirmed      : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Order Confirmed",   ctaLabel: "View Order",          ctaLink: "/orders"    },
  order_shipped        : { icon: "🚚", color: "#0891b2", bg: "#f0f9ff", label: "Order Shipped",     ctaLabel: "Track Shipment",      ctaLink: "/orders"    },
  order_delivered      : { icon: "🎊", color: "#16a34a", bg: "#f0fdf4", label: "Delivered",         ctaLabel: "Leave a Review",      ctaLink: "/orders"    },
  order_cancelled      : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Order Cancelled",   ctaLabel: "View Orders",         ctaLink: "/orders"    },

  /* Products */
  product_approved     : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Product Live",      ctaLabel: "View Listing",        ctaLink: "/listings"  },
  product_rejected     : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Product Rejected",  ctaLabel: "Edit Listing",        ctaLink: "/listings"  },
  product_expiring     : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",     ctaLabel: "Renew Listing",       ctaLink: "/listings"  },

  /* Messages */
  new_message          : { icon: "💬", color: "#2563eb", bg: "#eff6ff", label: "New Message",       ctaLabel: "Reply Now",           ctaLink: "/messages"  },

  /* System */
  system               : { icon: "🔔", color: "#6b7280", bg: "#f3f4f6", label: "System",            ctaLabel: null,                  ctaLink: null         },
  promotion            : { icon: "🎯", color: "#e8630a", bg: "#fff0e6", label: "Promotion",         ctaLabel: "Shop Now",            ctaLink: "/"          },
};

const getCfg = (type) => NOTIF_CFG[type] || NOTIF_CFG.system;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    weekday : "long",
    year    : "numeric",
    month   : "long",
    day     : "numeric",
    hour    : "2-digit",
    minute  : "2-digit",
  });
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)      return "just now";
  if (s < 3_600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)  return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

/* ══════════════════════════════════════════════════════════════
   DYNAMIC LINK RESOLVER
══════════════════════════════════════════════════════════════ */
const resolveCtaLink = (type, meta = {}, fallbackLink) => {
  switch (type) {
    case "order_placed":
    case "order_confirmed":
    case "order_shipped":
    case "order_delivered":
    case "order_cancelled":
      return meta.order_id ? `/orders/${meta.order_id}` : "/orders";

    case "new_message":
      return meta.conversation_id
        ? `/messages/${meta.conversation_id}`
        : "/messages";

    case "product_approved":
    case "product_rejected":
    case "product_expiring":
      return meta.product_id
        ? `/listings/${meta.product_id}`
        : "/listings";

    case "referral_signup":
    case "referral_rewarded":
    case "bonus_spin_earned":
      return "/invite";

    case "spin_win":
    case "spin_coupon_expiring":
      return "/spin";

    default:
      return fallbackLink || null;
  }
};

/* ══════════════════════════════════════════════════════════════
   METADATA RENDERER
   Renders extra info cards based on notification type
══════════════════════════════════════════════════════════════ */
function MetaCards({ type, meta }) {
  if (!meta || Object.keys(meta).length === 0) return null;

  const cards = [];

  /* ── Order details ── */
  if (["order_placed","order_confirmed","order_shipped",
       "order_delivered","order_cancelled"].includes(type)) {
    if (meta.order_id) {
      cards.push(
        <div className="nd-meta-card" key="order">
          <div className="nd-meta-card__icon">📦</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Order ID</span>
            <span className="nd-meta-card__value">#{meta.order_id}</span>
          </div>
        </div>
      );
    }
    if (meta.amount) {
      cards.push(
        <div className="nd-meta-card" key="amount">
          <div className="nd-meta-card__icon">💰</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Amount</span>
            <span className="nd-meta-card__value">
              ₦{Number(meta.amount).toLocaleString()}
            </span>
          </div>
        </div>
      );
    }
    if (meta.tracking_number) {
      cards.push(
        <div className="nd-meta-card" key="tracking">
          <div className="nd-meta-card__icon">🚚</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Tracking No.</span>
            <span className="nd-meta-card__value">{meta.tracking_number}</span>
          </div>
        </div>
      );
    }
    if (meta.items_count) {
      cards.push(
        <div className="nd-meta-card" key="items">
          <div className="nd-meta-card__icon">🛒</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Items</span>
            <span className="nd-meta-card__value">{meta.items_count}</span>
          </div>
        </div>
      );
    }
  }

  /* ── Referral details ── */
  if (["referral_signup","referral_rewarded"].includes(type)) {
    if (meta.referred_name) {
      cards.push(
        <div className="nd-meta-card" key="referred">
          <div className="nd-meta-card__icon">👤</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Referred User</span>
            <span className="nd-meta-card__value">{meta.referred_name}</span>
          </div>
        </div>
      );
    }
    if (meta.reward_amount) {
      cards.push(
        <div className="nd-meta-card" key="reward">
          <div className="nd-meta-card__icon">🎁</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Reward</span>
            <span className="nd-meta-card__value">
              ₦{Number(meta.reward_amount).toLocaleString()}
            </span>
          </div>
        </div>
      );
    }
  }

  /* ── Spin/Coupon details ── */
  if (["spin_win","spin_coupon_expiring","bonus_spin_earned"].includes(type)) {
    if (meta.prize_name) {
      cards.push(
        <div className="nd-meta-card" key="prize">
          <div className="nd-meta-card__icon">🏆</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Prize</span>
            <span className="nd-meta-card__value">{meta.prize_name}</span>
          </div>
        </div>
      );
    }
    if (meta.coupon_code) {
      cards.push(
        <div className="nd-meta-card nd-meta-card--highlight" key="coupon">
          <div className="nd-meta-card__icon">🎟</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Coupon Code</span>
            <CouponCode code={meta.coupon_code} />
          </div>
        </div>
      );
    }
    if (meta.coupon_expiry) {
      cards.push(
        <div className="nd-meta-card" key="expiry">
          <div className="nd-meta-card__icon">⏰</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Expires</span>
            <span className="nd-meta-card__value">
              {formatDate(meta.coupon_expiry)}
            </span>
          </div>
        </div>
      );
    }
    if (meta.spins_awarded) {
      cards.push(
        <div className="nd-meta-card" key="spins">
          <div className="nd-meta-card__icon">🎡</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Spins Awarded</span>
            <span className="nd-meta-card__value">
              +{meta.spins_awarded} spin{meta.spins_awarded > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      );
    }
  }

  /* ── Product details ── */
  if (["product_approved","product_rejected","product_expiring"].includes(type)) {
    if (meta.product_name) {
      cards.push(
        <div className="nd-meta-card" key="product">
          <div className="nd-meta-card__icon">🏷️</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Product</span>
            <span className="nd-meta-card__value">{meta.product_name}</span>
          </div>
        </div>
      );
    }
    if (meta.rejection_reason) {
      cards.push(
        <div className="nd-meta-card nd-meta-card--warning" key="reason">
          <div className="nd-meta-card__icon">📋</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Reason</span>
            <span className="nd-meta-card__value">{meta.rejection_reason}</span>
          </div>
        </div>
      );
    }
  }

  /* ── Message details ── */
  if (type === "new_message") {
    if (meta.sender_name) {
      cards.push(
        <div className="nd-meta-card" key="sender">
          <div className="nd-meta-card__icon">💬</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">From</span>
            <span className="nd-meta-card__value">{meta.sender_name}</span>
          </div>
        </div>
      );
    }
    if (meta.preview) {
      cards.push(
        <div className="nd-meta-card" key="preview">
          <div className="nd-meta-card__icon">✉️</div>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Preview</span>
            <span className="nd-meta-card__value nd-meta-card__value--muted">
              "{meta.preview}"
            </span>
          </div>
        </div>
      );
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="nd-meta-section">
      <h3 className="nd-section-title">Details</h3>
      <div className="nd-meta-grid">{cards}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COUPON CODE (copy to clipboard)
══════════════════════════════════════════════════════════════ */
function CouponCode({ code }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2_000);
    });
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button className="nd-coupon-copy" onClick={copy} title="Copy code">
      <code className="nd-coupon-code">{code}</code>
      <span className="nd-coupon-copy-icon">
        {copied ? "✅" : "📋"}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function NotificationDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [notif,   setNotif]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [deleted, setDeleted] = useState(false);
  const [toast,   setToast]   = useState({ show: false, text: "" });

  const toastTimer = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate(`/auth?redirect=/notifications/${id}`);
  }, [navigate, id]);

  /* ── Toast ── */
  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, text });
    toastTimer.current = setTimeout(
      () => setToast({ show: false, text: "" }),
      2_500
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ── Fetch single notification ── */
  const fetchNotif = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/${id}`, { headers: authH() });

      if (res.status === 401) {
        navigate(`/auth?redirect=/notifications/${id}`);
        return;
      }
      if (res.status === 404) {
        setError("Notification not found.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }

      const data = await res.json();
      /* Support both { data: {...} } and flat response */
      setNotif(data.data ?? data);

      /* Auto-mark as read */
      if (data.data?.is_read === false || data.is_read === false) {
        fetch(`${API}/read/${id}`, {
          method  : "POST",
          headers : authH(),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchNotif(); }, [fetchNotif]);

  /* ── Delete ── */
  const handleDelete = useCallback(async () => {
    if (!window.confirm("Delete this notification?")) return;

    try {
      const res = await fetch(`${API}/${id}`, {
        method  : "DELETE",
        headers : authH(),
      });
      if (!res.ok) throw new Error("Failed");
      setDeleted(true);
      showToast("🗑 Notification deleted");
      setTimeout(() => navigate("/notifications"), 1_500);
    } catch {
      showToast("❌ Could not delete notification");
    }
  }, [id, navigate, showToast]);

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="nd-page">
        <div className="nd-container">
          <div className="nd-skeleton-header" />
          <div className="nd-skeleton-body">
            <div className="nd-skeleton-icon" />
            <div className="nd-skeleton-lines">
              <div className="nd-skeleton-line" style={{ width: "60%" }} />
              <div className="nd-skeleton-line" style={{ width: "80%" }} />
              <div className="nd-skeleton-line" style={{ width: "40%" }} />
            </div>
          </div>
          <div className="nd-skeleton-cards">
            {[1,2].map((i) => (
              <div key={i} className="nd-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="nd-page">
        <div className="nd-container">
          <button className="nd-back-btn" onClick={() => navigate(-1)}
            aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div className="nd-error" role="alert">
            <span className="nd-error__icon">⚠️</span>
            <p className="nd-error__text">{error}</p>
            <button className="nd-error__retry" onClick={fetchNotif}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!notif) return null;

  const cfg     = getCfg(notif.type);
  const meta    = notif.metadata || {};
  const ctaLink = resolveCtaLink(notif.type, meta, cfg.ctaLink);

  return (
    <div className="nd-page">
      <div className="nd-container">

        {/* ── Toast ── */}
        <div
          className={`nd-toast${toast.show ? " show" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>

        {/* ══════════════════════════════════════
            TOP BAR
        ══════════════════════════════════════ */}
        <div className="nd-topbar">
          <button
            className="nd-back-btn"
            onClick={() => navigate("/notifications")}
            aria-label="Back to notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Notifications
          </button>

          {!deleted && (
            <button
              className="nd-delete-btn"
              onClick={handleDelete}
              aria-label="Delete notification"
            >
              🗑 Delete
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════
            HERO CARD
        ══════════════════════════════════════ */}
        {deleted ? (
          <div className="nd-deleted-state">
            <span className="nd-deleted-state__icon">🗑</span>
            <p>Notification deleted. Redirecting…</p>
          </div>
        ) : (
          <>
            <div className="nd-hero" style={{ borderColor: cfg.color }}>
              {/* Unread badge */}
              {!notif.is_read && (
                <span className="nd-unread-badge">NEW</span>
              )}

              {/* Icon */}
              <div
                className="nd-hero__icon"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
                aria-hidden="true"
              >
                {cfg.icon}
              </div>

              {/* Type badge */}
              <span
                className="nd-type-badge"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>

              {/* Title */}
              <h1 className="nd-hero__title">{notif.title}</h1>

              {/* Message */}
              <p className="nd-hero__message">{notif.message}</p>

              {/* Timestamps */}
              <div className="nd-timestamps">
                <span className="nd-timestamp">
                  🕐 {timeAgo(notif.created_at)}
                </span>
                <span className="nd-timestamp nd-timestamp--full">
                  {formatDate(notif.created_at)}
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════
                METADATA CARDS
            ══════════════════════════════════════ */}
            <MetaCards type={notif.type} meta={meta} />

            {/* ══════════════════════════════════════
                CTA BUTTON
            ══════════════════════════════════════ */}
            {ctaLink && cfg.ctaLabel && (
              <div className="nd-cta-section">
                <Link
                  to={ctaLink}
                  className="nd-cta-btn"
                  style={{
                    backgroundColor : cfg.color,
                    boxShadow       : `0 4px 20px ${cfg.color}40`,
                  }}
                >
                  {cfg.ctaLabel}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
              </div>
            )}

            {/* ══════════════════════════════════════
                RELATED ACTIONS
            ══════════════════════════════════════ */}
            <div className="nd-related">
              <h3 className="nd-section-title">Quick Actions</h3>
              <div className="nd-related-grid">
                <Link to="/notifications" className="nd-related-card">
                  <span className="nd-related-card__icon">🔔</span>
                  <span>All Notifications</span>
                </Link>
                <Link to="/settings" className="nd-related-card">
                  <span className="nd-related-card__icon">⚙️</span>
                  <span>Preferences</span>
                </Link>
                <Link to="/support" className="nd-related-card">
                  <span className="nd-related-card__icon">🆘</span>
                  <span>Get Help</span>
                </Link>
                <Link to="/" className="nd-related-card">
                  <span className="nd-related-card__icon">🏠</span>
                  <span>Home</span>
                </Link>
              </div>
            </div>

          </>
        )}

        {/* Footer */}
        <p className="nd-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>

      </div>
    </div>
  );
}