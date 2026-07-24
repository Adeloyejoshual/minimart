// src/pages/Notifications.jsx

import React, {
  useState, useEffect, useCallback,
  useRef, useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Notifications.css";

/* ══════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/notifications`;
const PAGE_SIZE = 20;

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
  welcome              : { icon: "👋", color: "#2563eb", bg: "#eff6ff", label: "Welcome"         },
  email_verified       : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Email Verified"  },
  identity_approved    : { icon: "🛡️", color: "#10b981", bg: "#ecfdf5", label: "Verified"        },
  identity_rejected    : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Rejected"        },
  store_approved       : { icon: "🏪", color: "#10b981", bg: "#ecfdf5", label: "Store Approved"  },
  store_rejected       : { icon: "🏪", color: "#ef4444", bg: "#fef2f2", label: "Store Rejected"  },
  account_flagged      : { icon: "⚠️", color: "#f59e0b", bg: "#fffbeb", label: "Account Flagged" },
  password_changed     : { icon: "🔒", color: "#6b7280", bg: "#f3f4f6", label: "Security"        },

  /* Referral */
  referral_signup      : { icon: "👤", color: "#2563eb", bg: "#eff6ff", label: "Referral"        },
  referral_rewarded    : { icon: "🎁", color: "#8b5cf6", bg: "#f5f3ff", label: "Reward"          },
  bonus_spin_earned    : { icon: "🎡", color: "#e8630a", bg: "#fff0e6", label: "Bonus Spin"      },

  /* Spin */
  spin_win             : { icon: "🎉", color: "#16a34a", bg: "#f0fdf4", label: "You Won!"        },
  spin_coupon_expiring : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon"   },

  /* Orders */
  order_placed         : { icon: "📦", color: "#2563eb", bg: "#eff6ff", label: "Order Placed"    },
  order_confirmed      : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Confirmed"       },
  order_shipped        : { icon: "🚚", color: "#0891b2", bg: "#f0f9ff", label: "Shipped"         },
  order_delivered      : { icon: "🎊", color: "#16a34a", bg: "#f0fdf4", label: "Delivered"       },
  order_cancelled      : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Cancelled"       },

  /* Products */
  product_approved     : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Product Live"    },
  product_rejected     : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Product Rejected"},
  product_expiring     : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon"   },

  /* Messages */
  new_message          : { icon: "💬", color: "#2563eb", bg: "#eff6ff", label: "Message"         },

  /* System */
  system               : { icon: "🔔", color: "#6b7280", bg: "#f3f4f6", label: "System"          },
  promotion            : { icon: "🎯", color: "#e8630a", bg: "#fff0e6", label: "Promotion"       },
};

const getCfg = (type) => NOTIF_CFG[type] || NOTIF_CFG.system;

/* ══════════════════════════════════════════════════════════════
   FILTER TABS
══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",      label: "All"        },
  { key: "unread",   label: "Unread"     },
  { key: "orders",   label: "Orders"     },
  { key: "referral", label: "Referrals"  },
  { key: "spin",     label: "Spin & Win" },
  { key: "system",   label: "System"     },
];

const FILTER_TYPES = {
  orders   : ["order_placed","order_confirmed","order_shipped",
               "order_delivered","order_cancelled"],
  referral : ["referral_signup","referral_rewarded","bonus_spin_earned"],
  spin     : ["spin_win","spin_coupon_expiring"],
  system   : ["system","promotion","welcome","email_verified",
               "identity_approved","identity_rejected","store_approved",
               "store_rejected","account_flagged","password_changed"],
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)      return "just now";
  if (s < 3_600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)  return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
};

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION ITEM
══════════════════════════════════════════════════════════════ */
function NotifItem({ notif, onRead, onDelete }) {
  const cfg  = getCfg(notif.type);
  const meta = notif.metadata || {};

  return (
    <div
      className={`notif-item${notif.is_read ? "" : " notif-item--unread"}`}
      role="listitem"
    >
      {/* Unread stripe */}
      {!notif.is_read && <div className="notif-stripe" aria-hidden="true" />}

      {/* Icon */}
      <div
        className="notif-icon"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
        aria-hidden="true"
      >
        {cfg.icon}
      </div>

      {/* Body */}
      <div className="notif-body">
        {/* Row 1 — badge + time */}
        <div className="notif-row notif-row--top">
          <span
            className="notif-badge"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="notif-time">{timeAgo(notif.created_at)}</span>
        </div>

        {/* Title */}
        <p className="notif-title">{notif.title}</p>

        {/* Message */}
        <p className="notif-message">{notif.message}</p>

        {/* Coupon pill */}
        {meta.coupon_code && (
          <div className="notif-coupon">
            <span aria-hidden="true">🎟</span>
            <code>{meta.coupon_code}</code>
          </div>
        )}

        {/* Spin pill */}
        {meta.spins_awarded && (
          <div className="notif-spin-pill">
            🎡 +{meta.spins_awarded} bonus spin
            {meta.spins_awarded > 1 ? "s" : ""}
          </div>
        )}

        {/* Actions row */}
        <div className="notif-actions">
          {/* View → goes to detail page */}
          <Link
            to={`/notifications/${notif.id}`}
            className="notif-link"
            onClick={() => { if (!notif.is_read) onRead(notif.id); }}
            aria-label="View notification details"
          >
            View details
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>

          {!notif.is_read && (
            <button
              className="notif-btn notif-btn--read"
              onClick={() => onRead(notif.id)}
              aria-label="Mark as read"
            >
              ✓ Mark read
            </button>
          )}

          <button
            className="notif-btn notif-btn--delete"
            onClick={() => onDelete(notif.id)}
            aria-label="Delete notification"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════════ */
function EmptyState({ filter }) {
  const messages = {
    unread   : { icon: "🎉", title: "All caught up!", sub: "No unread notifications." },
    orders   : { icon: "📦", title: "No order updates", sub: "Your order activity will appear here." },
    referral : { icon: "👥", title: "No referrals yet", sub: "Share your link to earn rewards." },
    spin     : { icon: "🎡", title: "No spin activity", sub: "Play Spin & Win to earn prizes." },
    system   : { icon: "🔔", title: "No system alerts", sub: "System messages will appear here." },
    all      : { icon: "🔔", title: "No notifications yet", sub: "We'll notify you of important updates here." },
  };

  const m = messages[filter] || messages.all;

  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">{m.icon}</div>
      <p className="notif-empty__title">{m.title}</p>
      <p className="notif-empty__sub">{m.sub}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SKELETON LOADER
══════════════════════════════════════════════════════════════ */
function Skeletons() {
  return (
    <div className="notif-skeletons" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="notif-skeleton">
          <div className="notif-skeleton__icon" />
          <div className="notif-skeleton__body">
            <div className="notif-skeleton__line" style={{ width: "35%" }} />
            <div className="notif-skeleton__line" style={{ width: "65%" }} />
            <div className="notif-skeleton__line" style={{ width: "50%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function Notifications() {
  const navigate = useNavigate();

  /* ── State ── */
  const [notifs,      setNotifs]      = useState([]);
  const [total,       setTotal]       = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [filter,      setFilter]      = useState("all");
  const [offset,      setOffset]      = useState(0);
  const [toast,       setToast]       = useState({ show: false, text: "" });
  const [deleting,    setDeleting]    = useState(new Set());

  const toastTimer = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/notifications");
  }, [navigate]);

  /* ── Toast helper ── */
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
     FETCH
  ══════════════════════════════════════════════ */
  const fetchNotifs = useCallback(async (reset = true) => {
    reset ? setLoading(true) : setLoadingMore(true);
    setError(null);

    const currentOffset = reset ? 0 : offset;
    const p = new URLSearchParams({
      limit  : String(PAGE_SIZE),
      offset : String(currentOffset),
    });
    if (filter === "unread") p.set("unread", "true");

    try {
      const res = await fetch(`${API}?${p}`, { headers: authH() });

      if (res.status === 401) {
        navigate("/auth?redirect=/notifications");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setTotal(data.total        ?? 0);
      setUnreadCount(data.unread_count ?? 0);

      if (reset) {
        setNotifs(data.data || []);
        setOffset(data.data?.length || 0);
      } else {
        setNotifs((prev) => [...prev, ...(data.data || [])]);
        setOffset((prev) => prev + (data.data?.length || 0));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, offset, navigate]);

  /* Refetch when filter changes */
  useEffect(() => { fetchNotifs(true); }, [filter]); // eslint-disable-line

  /* ── Client-side type filter ── */
  const displayed = useMemo(() => {
    if (!FILTER_TYPES[filter]) return notifs;
    return notifs.filter((n) => FILTER_TYPES[filter].includes(n.type));
  }, [notifs, filter]);

  /* ══════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════ */

  /* Mark one read */
  const handleRead = useCallback(async (id) => {
    setNotifs((p) => p.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch(`${API}/read/${id}`, {
        method: "POST", headers: authH(),
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifs((p) => p.map((n) => n.id === id ? { ...n, is_read: false } : n));
      setUnreadCount((c) => c + 1);
      showToast("❌ Could not mark as read");
    }
  }, [showToast]);

  /* Mark all read */
  const handleReadAll = useCallback(async () => {
    const prev = notifs;
    const prevC = unreadCount;
    setNotifs((p) => p.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    showToast("✅ All marked as read");
    try {
      const res = await fetch(`${API}/read-all`, {
        method: "POST", headers: authH(),
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifs(prev);
      setUnreadCount(prevC);
      showToast("❌ Could not mark all as read");
    }
  }, [notifs, unreadCount, showToast]);

  /* Delete one */
  const handleDelete = useCallback(async (id) => {
    setDeleting((p) => new Set(p).add(id));
    const removed = notifs.find((n) => n.id === id);
    setNotifs((p) => p.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const res = await fetch(`${API}/${id}`, {
        method: "DELETE", headers: authH(),
      });
      if (!res.ok) throw new Error();
      showToast("🗑 Deleted");
    } catch {
      if (removed) setNotifs((p) => [removed, ...p]);
      setTotal((t) => t + 1);
      if (removed && !removed.is_read) setUnreadCount((c) => c + 1);
      showToast("❌ Could not delete");
    } finally {
      setDeleting((p) => { const s = new Set(p); s.delete(id); return s; });
    }
  }, [notifs, showToast]);

  /* Delete all */
  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    const prev = notifs;
    setNotifs([]); setTotal(0); setUnreadCount(0);
    showToast("🗑 All notifications cleared");
    try {
      const res = await fetch(API, { method: "DELETE", headers: authH() });
      if (!res.ok) throw new Error();
    } catch {
      setNotifs(prev);
      showToast("❌ Could not clear notifications");
    }
  }, [notifs, showToast]);

  const hasMore = offset < total;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="notif-page">
      <div className="notif-wrap">

        {/* ── Toast ── */}
        <div
          className={`notif-toast${toast.show ? " show" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>

        {/* ══════════════════════════════════════
            HEADER
        ══════════════════════════════════════ */}
        <header className="notif-header">
          <div className="notif-header__left">
            <button
              className="notif-back"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>

            <div className="notif-header__title-group">
              <h1 className="notif-header__title">Notifications</h1>
              {unreadCount > 0 && (
                <span className="notif-header__unread-chip">
                  {unreadCount} new
                </span>
              )}
            </div>
          </div>

          <div className="notif-header__actions">
            {unreadCount > 0 && (
              <button
                className="notif-pill notif-pill--read"
                onClick={handleReadAll}
                aria-label="Mark all as read"
              >
                ✓ Read all
              </button>
            )}
            {notifs.length > 0 && (
              <button
                className="notif-pill notif-pill--danger"
                onClick={handleDeleteAll}
                aria-label="Clear all notifications"
              >
                🗑 Clear
              </button>
            )}
          </div>
        </header>

        {/* ══════════════════════════════════════
            FILTER TABS
        ══════════════════════════════════════ */}
        <div
          className="notif-tabs"
          role="tablist"
          aria-label="Filter notifications"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`notif-tab${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
              role="tab"
              aria-selected={filter === f.key}
            >
              {f.label}
              {f.key === "unread" && unreadCount > 0 && (
                <span className="notif-tab__count">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            BODY
        ══════════════════════════════════════ */}
        <main className="notif-main">

          {loading && <Skeletons />}

          {!loading && error && (
            <div className="notif-error" role="alert">
              <span className="notif-error__icon">⚠️</span>
              <p className="notif-error__text">{error}</p>
              <button
                className="notif-error__retry"
                onClick={() => fetchNotifs(true)}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && displayed.length === 0 && (
            <EmptyState filter={filter} />
          )}

          {!loading && !error && displayed.length > 0 && (
            <div className="notif-list" role="list">
              {displayed.map((notif) => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  onRead={handleRead}
                  onDelete={handleDelete}
                  isDeleting={deleting.has(notif.id)}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {!loading && hasMore && displayed.length > 0 && (
            <button
              className="notif-load-more"
              onClick={() => fetchNotifs(false)}
              disabled={loadingMore}
              aria-label="Load more notifications"
            >
              {loadingMore
                ? <><span className="notif-spinner" aria-hidden="true" /> Loading…</>
                : `Load more · ${total - offset} remaining`}
            </button>
          )}

        </main>

        {/* Footer */}
        <footer className="notif-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </footer>

      </div>
    </div>
  );
}