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
  welcome              : { icon: "👋", color: "#2563eb", bg: "#eff6ff", label: "Welcome",           ctaLabel: "Go to Dashboard",     ctaLink: "/"          },
  email_verified       : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Email Verified",     ctaLabel: "Go to Settings",      ctaLink: "/settings"  },
  identity_approved    : { icon: "🛡️", color: "#10b981", bg: "#ecfdf5", label: "Identity Verified",  ctaLabel: "View Profile",        ctaLink: "/profile"   },
  identity_rejected    : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Identity Rejected",  ctaLabel: "Retry Verification",  ctaLink: "/verify"    },
  store_approved       : { icon: "🏪", color: "#10b981", bg: "#ecfdf5", label: "Store Approved",     ctaLabel: "Manage Store",        ctaLink: "/store"     },
  store_rejected       : { icon: "🏪", color: "#ef4444", bg: "#fef2f2", label: "Store Rejected",     ctaLabel: "Resubmit",            ctaLink: "/verify"    },
  account_flagged      : { icon: "⚠️", color: "#f59e0b", bg: "#fffbeb", label: "Account Flagged",    ctaLabel: "Contact Support",     ctaLink: "/support"   },
  password_changed     : { icon: "🔒", color: "#6b7280", bg: "#f3f4f6", label: "Security Alert",     ctaLabel: "Security Settings",   ctaLink: "/settings"  },
  referral_signup      : { icon: "👤", color: "#2563eb", bg: "#eff6ff", label: "Referral",           ctaLabel: "Invite More Friends", ctaLink: "/invite"    },
  referral_rewarded    : { icon: "🎁", color: "#8b5cf6", bg: "#f5f3ff", label: "Reward Earned",      ctaLabel: "View Rewards",        ctaLink: "/invite"    },
  bonus_spin_earned    : { icon: "🎡", color: "#e8630a", bg: "#fff0e6", label: "Bonus Spin",         ctaLabel: "Spin Now!",           ctaLink: "/spin"      },
  spin_win             : { icon: "🎉", color: "#16a34a", bg: "#f0fdf4", label: "You Won!",           ctaLabel: "Spin Again",          ctaLink: "/spin"      },
  spin_coupon_expiring : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",      ctaLabel: "Use Coupon Now",      ctaLink: "/spin"      },
  order_placed         : { icon: "📦", color: "#2563eb", bg: "#eff6ff", label: "Order Placed",       ctaLabel: "Track Order",         ctaLink: "/orders"    },
  order_confirmed      : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Order Confirmed",    ctaLabel: "View Order",          ctaLink: "/orders"    },
  order_shipped        : { icon: "🚚", color: "#0891b2", bg: "#f0f9ff", label: "Order Shipped",      ctaLabel: "Track Shipment",      ctaLink: "/orders"    },
  order_delivered      : { icon: "🎊", color: "#16a34a", bg: "#f0fdf4", label: "Delivered",          ctaLabel: "Leave a Review",      ctaLink: "/orders"    },
  order_cancelled      : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Order Cancelled",    ctaLabel: "View Orders",         ctaLink: "/orders"    },
  product_approved     : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Product Live",       ctaLabel: "View Listing",        ctaLink: "/listings"  },
  product_rejected     : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Product Rejected",   ctaLabel: "Edit Listing",        ctaLink: "/listings"  },
  product_expiring     : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",      ctaLabel: "Renew Listing",       ctaLink: "/listings"  },
  new_message          : { icon: "💬", color: "#2563eb", bg: "#eff6ff", label: "New Message",        ctaLabel: "Reply Now",           ctaLink: "/messages"  },
  system               : { icon: "🔔", color: "#6b7280", bg: "#f3f4f6", label: "System",             ctaLabel: null,                  ctaLink: null         },
  promotion            : { icon: "🎯", color: "#e8630a", bg: "#fff0e6", label: "Promotion",          ctaLabel: "Shop Now",            ctaLink: "/"          },
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
   DYNAMIC CTA LINK
══════════════════════════════════════════════════════════════ */
const resolveCtaLink = (type, meta = {}, fallback) => {
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

    default:
      return fallback || null;
  }
};

/* ══════════════════════════════════════════════════════════════
   COUPON COPY
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
      <span className="nd-coupon-icon">{copied ? "✅" : "📋"}</span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   META CARDS
══════════════════════════════════════════════════════════════ */
function MetaCards({ type, meta }) {
  if (!meta || Object.keys(meta).length === 0) return null;

  const cards = [];

  /* Orders */
  if (["order_placed","order_confirmed","order_shipped",
       "order_delivered","order_cancelled"].includes(type)) {
    if (meta.order_id)
      cards.push(
        <div className="nd-meta-card" key="order_id">
          <span className="nd-meta-card__icon">📦</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Order ID</span>
            <span className="nd-meta-card__value">#{meta.order_id}</span>
          </div>
        </div>
      );
    if (meta.amount)
      cards.push(
        <div className="nd-meta-card" key="amount">
          <span className="nd-meta-card__icon">💰</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Amount</span>
            <span className="nd-meta-card__value">
              ₦{Number(meta.amount).toLocaleString()}
            </span>
          </div>
        </div>
      );
    if (meta.tracking_number)
      cards.push(
        <div className="nd-meta-card" key="tracking">
          <span className="nd-meta-card__icon">🚚</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Tracking No.</span>
            <span className="nd-meta-card__value">{meta.tracking_number}</span>
          </div>
        </div>
      );
    if (meta.items_count)
      cards.push(
        <div className="nd-meta-card" key="items">
          <span className="nd-meta-card__icon">🛒</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Items</span>
            <span className="nd-meta-card__value">{meta.items_count}</span>
          </div>
        </div>
      );
  }

  /* Referral */
  if (["referral_signup","referral_rewarded"].includes(type)) {
    if (meta.referred_name)
      cards.push(
        <div className="nd-meta-card" key="referred">
          <span className="nd-meta-card__icon">👤</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Referred User</span>
            <span className="nd-meta-card__value">{meta.referred_name}</span>
          </div>
        </div>
      );
    if (meta.reward_amount)
      cards.push(
        <div className="nd-meta-card" key="reward">
          <span className="nd-meta-card__icon">🎁</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Reward</span>
            <span className="nd-meta-card__value">
              ₦{Number(meta.reward_amount).toLocaleString()}
            </span>
          </div>
        </div>
      );
  }

  /* Spin / Coupon */
  if (["spin_win","spin_coupon_expiring","bonus_spin_earned"].includes(type)) {
    if (meta.prize_name)
      cards.push(
        <div className="nd-meta-card" key="prize">
          <span className="nd-meta-card__icon">🏆</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Prize</span>
            <span className="nd-meta-card__value">{meta.prize_name}</span>
          </div>
        </div>
      );
    if (meta.coupon_code)
      cards.push(
        <div className="nd-meta-card nd-meta-card--highlight" key="coupon">
          <span className="nd-meta-card__icon">🎟</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Coupon Code</span>
            <CouponCode code={meta.coupon_code} />
          </div>
        </div>
      );
    if (meta.coupon_expiry)
      cards.push(
        <div className="nd-meta-card" key="expiry">
          <span className="nd-meta-card__icon">⏰</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Expires</span>
            <span className="nd-meta-card__value">
              {formatDate(meta.coupon_expiry)}
            </span>
          </div>
        </div>
      );
    if (meta.spins_awarded)
      cards.push(
        <div className="nd-meta-card" key="spins">
          <span className="nd-meta-card__icon">🎡</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Spins Awarded</span>
            <span className="nd-meta-card__value">
              +{meta.spins_awarded} spin{meta.spins_awarded > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      );
  }

  /* Product */
  if (["product_approved","product_rejected","product_expiring"].includes(type)) {
    if (meta.product_name)
      cards.push(
        <div className="nd-meta-card" key="product">
          <span className="nd-meta-card__icon">🏷️</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Product</span>
            <span className="nd-meta-card__value">{meta.product_name}</span>
          </div>
        </div>
      );
    if (meta.rejection_reason)
      cards.push(
        <div className="nd-meta-card nd-meta-card--warning" key="reason">
          <span className="nd-meta-card__icon">📋</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Reason</span>
            <span className="nd-meta-card__value">{meta.rejection_reason}</span>
          </div>
        </div>
      );
  }

  /* Message */
  if (type === "new_message") {
    if (meta.sender_name)
      cards.push(
        <div className="nd-meta-card" key="sender">
          <span className="nd-meta-card__icon">💬</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">From</span>
            <span className="nd-meta-card__value">{meta.sender_name}</span>
          </div>
        </div>
      );
    if (meta.preview)
      cards.push(
        <div className="nd-meta-card" key="preview">
          <span className="nd-meta-card__icon">✉️</span>
          <div className="nd-meta-card__body">
            <span className="nd-meta-card__label">Preview</span>
            <span className="nd-meta-card__value nd-meta-card__value--muted">
              "{meta.preview}"
            </span>
          </div>
        </div>
      );
  }

  if (cards.length === 0) return null;

  return (
    <div className="nd-meta-section">
      <h3 className="nd-section-label">Details</h3>
      <div className="nd-meta-grid">{cards}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="nd-page">
      <div className="nd-container">
        <div className="nd-skeleton-bar" />
        <div className="nd-skeleton-hero">
          <div className="nd-skeleton-circle" />
          <div className="nd-skeleton-line" style={{ width: "45%", margin: "0 auto" }} />
          <div className="nd-skeleton-line" style={{ width: "70%", margin: "0 auto" }} />
          <div className="nd-skeleton-line" style={{ width: "55%", margin: "0 auto" }} />
        </div>
        <div className="nd-skeleton-cards">
          <div className="nd-skeleton-card" />
          <div className="nd-skeleton-card" />
        </div>
        <div className="nd-skeleton-cta" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function NotificationDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

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

  /* ══════════════════════════════════════════════
     FETCH — tries single endpoint first,
     falls back to scanning the list
  ══════════════════════════════════════════════ */
  const fetchNotif = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      /* ── Strategy 1: GET /api/notifications/:id ── */
      const res = await fetch(`${API}/${id}`, { headers: authH() });

      if (res.status === 401) {
        navigate(`/auth?redirect=/notifications/${id}`);
        return;
      }

      /* If endpoint exists and returns OK */
      if (res.ok) {
        const data = await res.json();
        const found = data.data ?? data;

        /* Sanity-check: make sure we got an object with an id */
        if (found && (found.id || found._id)) {
          setNotif(found);
          autoMarkRead(found);
          return;
        }
      }

      /* ── Strategy 2: scan list endpoint ── */
      console.warn(
        `GET /api/notifications/${id} returned ${res.status}. ` +
        `Falling back to list scan…`
      );
      await fetchFromList();

    } catch (err) {
      /* Network error on single — try list */
      try {
        await fetchFromList();
      } catch {
        setError(err.message || "Failed to load notification.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]); // eslint-disable-line

  /* Scan up to 5 pages of the list to find the notification */
  const fetchFromList = useCallback(async () => {
    const PAGE = 50;
    let found  = null;

    for (let page = 0; page < 5; page++) {
      const p = new URLSearchParams({
        limit  : String(PAGE),
        offset : String(page * PAGE),
      });

      const res = await fetch(`${API}?${p}`, { headers: authH() });

      if (res.status === 401) {
        navigate(`/auth?redirect=/notifications/${id}`);
        return;
      }
      if (!res.ok) throw new Error(`List fetch failed: ${res.status}`);

      const data  = await res.json();
      const items = data.data || data.notifications || data || [];

      found = items.find(
        (n) => String(n.id) === String(id) || String(n._id) === String(id)
      );

      if (found) break;

      /* No more pages */
      const total = data.total ?? data.count ?? 0;
      if ((page + 1) * PAGE >= total) break;
    }

    if (found) {
      setNotif(found);
      autoMarkRead(found);
    } else {
      setError("Notification not found. It may have been deleted.");
    }
  }, [id, navigate]);

  /* Auto-mark as read silently */
  const autoMarkRead = (n) => {
    if (!n.is_read) {
      fetch(`${API}/read/${n.id ?? n._id}`, {
        method  : "POST",
        headers : authH(),
      }).catch(() => {});
    }
  };

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
     RENDER STATES
  ══════════════════════════════════════════════ */
  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="nd-page">
        <div className="nd-container">
          <div className="nd-topbar">
            <button
              className="nd-back-btn"
              onClick={() => navigate("/notifications")}
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Notifications
            </button>
          </div>

          <div className="nd-error-state" role="alert">
            <span className="nd-error-state__icon">⚠️</span>
            <p className="nd-error-state__title">Something went wrong</p>
            <p className="nd-error-state__text">{error}</p>
            <div className="nd-error-state__actions">
              <button className="nd-error-retry" onClick={fetchNotif}>
                Try Again
              </button>
              <button
                className="nd-error-back"
                onClick={() => navigate("/notifications")}
              >
                ← Back to Notifications
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!notif) return null;

  const cfg     = getCfg(notif.type);
  const meta    = notif.metadata || {};
  const ctaLink = resolveCtaLink(notif.type, meta, cfg.ctaLink);

  /* ══════════════════════════════════════════════
     FULL RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="nd-page">
      <div className="nd-container">

        {/* Toast */}
        <div
          className={`nd-toast${toast.show ? " show" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>

        {/* ── Top bar ── */}
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

        {deleted ? (

          /* ── Deleted state ── */
          <div className="nd-deleted">
            <span className="nd-deleted__icon">🗑</span>
            <p className="nd-deleted__text">Deleted. Redirecting…</p>
          </div>

        ) : (
          <>
            {/* ══════════════════════════════════════
                HERO
            ══════════════════════════════════════ */}
            <div
              className="nd-hero"
              style={{ borderColor: cfg.color }}
            >
              {/* Decorative blob */}
              <div
                className="nd-hero__blob"
                style={{ background: cfg.bg }}
                aria-hidden="true"
              />

              {/* Unread badge */}
              {!notif.is_read && (
                <span className="nd-hero__new-badge">NEW</span>
              )}

              {/* Icon */}
              <div
                className="nd-hero__icon"
                style={{ background: cfg.bg, color: cfg.color }}
                aria-hidden="true"
              >
                {cfg.icon}
              </div>

              {/* Type */}
              <span
                className="nd-hero__type"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>

              {/* Title */}
              <h1 className="nd-hero__title">{notif.title}</h1>

              {/* Message */}
              <p className="nd-hero__message">{notif.message}</p>

              {/* Time */}
              <div className="nd-hero__times">
                <span className="nd-hero__time-ago">
                  🕐 {timeAgo(notif.created_at)}
                </span>
                <span className="nd-hero__time-full">
                  {formatDate(notif.created_at)}
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════
                META CARDS
            ══════════════════════════════════════ */}
            <MetaCards type={notif.type} meta={meta} />

            {/* ══════════════════════════════════════
                CTA
            ══════════════════════════════════════ */}
            {ctaLink && cfg.ctaLabel && (
              <div className="nd-cta-wrap">
                <Link
                  to={ctaLink}
                  className="nd-cta"
                  style={{
                    background : cfg.color,
                    boxShadow  : `0 6px 24px ${cfg.color}38`,
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
                QUICK ACTIONS
            ══════════════════════════════════════ */}
            <div className="nd-quick">
              <h3 className="nd-section-label">Quick Actions</h3>
              <div className="nd-quick-grid">
                {[
                  { to: "/notifications", icon: "🔔", label: "All Notifications" },
                  { to: "/settings",      icon: "⚙️", label: "Preferences"       },
                  { to: "/support",       icon: "🆘", label: "Get Help"          },
                  { to: "/",             icon: "🏠", label: "Home"              },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="nd-quick-card"
                  >
                    <span className="nd-quick-card__icon">{item.icon}</span>
                    <span className="nd-quick-card__label">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="nd-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>

      </div>
    </div>
  );
}