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
   icon + color + action link per type
══════════════════════════════════════════════════════════════ */
const NOTIF_CFG = {
  /* Account */
  welcome              : { icon: "👋", color: "#2563eb", bg: "#eff6ff", label: "Welcome",           link: "/" },
  email_verified       : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Email Verified",     link: "/settings" },
  identity_approved    : { icon: "🛡️", color: "#10b981", bg: "#ecfdf5", label: "Verified",           link: "/profile" },
  identity_rejected    : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Rejected",           link: "/verify" },
  store_approved       : { icon: "🏪", color: "#10b981", bg: "#ecfdf5", label: "Store Approved",     link: "/store" },
  store_rejected       : { icon: "🏪", color: "#ef4444", bg: "#fef2f2", label: "Store Rejected",     link: "/verify" },
  account_flagged      : { icon: "⚠️", color: "#f59e0b", bg: "#fffbeb", label: "Account Flagged",    link: "/support" },
  password_changed     : { icon: "🔒", color: "#6b7280", bg: "#f3f4f6", label: "Security",           link: "/settings" },

  /* Referral */
  referral_signup      : { icon: "👤", color: "#2563eb", bg: "#eff6ff", label: "Referral",           link: "/invite" },
  referral_rewarded    : { icon: "🎁", color: "#8b5cf6", bg: "#f5f3ff", label: "Reward",             link: "/invite" },
  bonus_spin_earned    : { icon: "🎡", color: "#e8630a", bg: "#fff0e6", label: "Bonus Spin",         link: "/spin"   },

  /* Spin */
  spin_win             : { icon: "🎉", color: "#16a34a", bg: "#f0fdf4", label: "You Won!",           link: "/spin"   },
  spin_coupon_expiring : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",      link: "/spin"   },

  /* Orders */
  order_placed         : { icon: "📦", color: "#2563eb", bg: "#eff6ff", label: "Order Placed",       link: "/orders" },
  order_confirmed      : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Confirmed",           link: "/orders" },
  order_shipped        : { icon: "🚚", color: "#0891b2", bg: "#f0f9ff", label: "Shipped",            link: "/orders" },
  order_delivered      : { icon: "🎊", color: "#16a34a", bg: "#f0fdf4", label: "Delivered",          link: "/orders" },
  order_cancelled      : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Cancelled",          link: "/orders" },

  /* Products */
  product_approved     : { icon: "✅", color: "#10b981", bg: "#ecfdf5", label: "Product Live",       link: "/listings" },
  product_rejected     : { icon: "❌", color: "#ef4444", bg: "#fef2f2", label: "Product Rejected",   link: "/listings" },
  product_expiring     : { icon: "⏰", color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",      link: "/listings" },

  /* Messages */
  new_message          : { icon: "💬", color: "#2563eb", bg: "#eff6ff", label: "Message",            link: "/messages" },

  /* System */
  system               : { icon: "🔔", color: "#6b7280", bg: "#f3f4f6", label: "System",             link: "/" },
  promotion            : { icon: "🎯", color: "#e8630a", bg: "#fff0e6", label: "Promotion",          link: "/" },
};

const getCfg = (type) => NOTIF_CFG[type] || NOTIF_CFG.system;

/* ══════════════════════════════════════════════════════════════
   FILTER TABS
══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { key: "all",      label: "All"        },
  { key: "unread",   label: "Unread"     },
  { key: "referral", label: "Referrals"  },
  { key: "spin",     label: "Spin & Win" },
  { key: "order",    label: "Orders"     },
  { key: "system",   label: "System"     },
];

const FILTER_TYPES = {
  referral : ["referral_signup","referral_rewarded","bonus_spin_earned"],
  spin     : ["spin_win","spin_coupon_expiring"],
  order    : ["order_placed","order_confirmed","order_shipped","order_delivered","order_cancelled"],
  system   : ["system","promotion","welcome","email_verified","identity_approved",
               "identity_rejected","store_approved","store_rejected","account_flagged","password_changed"],
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 604_800)return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
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
      {/* Unread dot */}
      {!notif.is_read && (
        <div className="notif-unread-dot" aria-label="Unread" />
      )}

      {/* Icon */}
      <div
        className="notif-icon"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
        aria-hidden="true"
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="notif-content">
        <div className="notif-header">
          <span
            className="notif-badge"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="notif-time">{timeAgo(notif.created_at)}</span>
        </div>

        <p className="notif-title">{notif.title}</p>
        <p className="notif-message">{notif.message}</p>

        {/* Coupon code pill */}
        {meta.coupon_code && (
          <div className="notif-coupon">
            <span>🎟</span>
            <code>{meta.coupon_code}</code>
          </div>
        )}

        {/* Spins awarded pill */}
        {meta.spins_awarded && (
          <div className="notif-spin-pill">
            🎡 +{meta.spins_awarded} bonus spin{meta.spins_awarded > 1 ? "s" : ""}
          </div>
        )}

        {/* Actions */}
        <div className="notif-actions">
          {cfg.link && (
            <Link
              to={cfg.link}
              className="notif-action-link"
              onClick={() => { if (!notif.is_read) onRead(notif.id); }}
              aria-label={`Go to ${cfg.label}`}
            >
              View →
            </Link>
          )}

          {!notif.is_read && (
            <button
              className="notif-action-btn"
              onClick={() => onRead(notif.id)}
              aria-label="Mark as read"
            >
              Mark read
            </button>
          )}

          <button
            className="notif-action-delete"
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
   MAIN COMPONENT
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
     BUILD QUERY PARAMS
  ══════════════════════════════════════════════ */
  const buildParams = useCallback((currentOffset = 0) => {
    const p = new URLSearchParams();
    p.set("limit",  String(PAGE_SIZE));
    p.set("offset", String(currentOffset));

    if (filter === "unread") {
      p.set("unread", "true");
    } else if (FILTER_TYPES[filter]) {
      /* We'll filter client-side for type groups */
    }

    return p.toString();
  }, [filter]);

  /* ══════════════════════════════════════════════
     FETCH NOTIFICATIONS
  ══════════════════════════════════════════════ */
  const fetchNotifs = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const currentOffset = reset ? 0 : offset;

    try {
      const res = await fetch(
        `${API}?${buildParams(currentOffset)}`,
        { headers: authH() }
      );

      if (res.status === 401) {
        navigate("/auth?redirect=/notifications");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `${res.status}`);
      }

      const data = await res.json();

      setTotal(data.total       ?? 0);
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
  }, [filter, offset, buildParams, navigate]);

  /* Fetch on mount + filter change */
  useEffect(() => { fetchNotifs(true); }, [filter]);

  /* ══════════════════════════════════════════════
     FILTERED LIST (client-side type grouping)
  ══════════════════════════════════════════════ */
  const displayedNotifs = useMemo(() => {
    if (!FILTER_TYPES[filter]) return notifs;
    return notifs.filter((n) => FILTER_TYPES[filter].includes(n.type));
  }, [notifs, filter]);

  /* ══════════════════════════════════════════════
     MARK ONE READ
  ══════════════════════════════════════════════ */
  const handleRead = useCallback(async (id) => {
    /* Optimistic update */
    setNotifs((prev) =>
      prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const res = await fetch(`${API}/read/${id}`, {
        method  : "POST",
        headers : authH(),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      /* Revert on failure */
      setNotifs((prev) =>
        prev.map((n) => n.id === id ? { ...n, is_read: false } : n)
      );
      setUnreadCount((c) => c + 1);
      showToast("❌ Could not mark as read");
    }
  }, [showToast]);

  /* ══════════════════════════════════════════════
     MARK ALL READ
  ══════════════════════════════════════════════ */
  const handleReadAll = useCallback(async () => {
    const prevNotifs = notifs;
    const prevCount  = unreadCount;

    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    showToast("✅ All marked as read");

    try {
      const res = await fetch(`${API}/read-all`, {
        method  : "POST",
        headers : authH(),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setNotifs(prevNotifs);
      setUnreadCount(prevCount);
      showToast("❌ Could not mark all as read");
    }
  }, [notifs, unreadCount, showToast]);

  /* ══════════════════════════════════════════════
     DELETE ONE
  ══════════════════════════════════════════════ */
  const handleDelete = useCallback(async (id) => {
    setDeleting((prev) => new Set(prev).add(id));

    /* Optimistic */
    const removed = notifs.find((n) => n.id === id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    setTotal((t)  => Math.max(0, t - 1));
    if (removed && !removed.is_read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      const res = await fetch(`${API}/${id}`, {
        method  : "DELETE",
        headers : authH(),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("🗑 Notification deleted");
    } catch {
      /* Revert */
      if (removed) setNotifs((prev) => [removed, ...prev]);
      setTotal((t)  => t + 1);
      if (removed && !removed.is_read) setUnreadCount((c) => c + 1);
      showToast("❌ Could not delete");
    } finally {
      setDeleting((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }, [notifs, showToast]);

  /* ══════════════════════════════════════════════
     DELETE ALL
  ══════════════════════════════════════════════ */
  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;

    const prevNotifs = notifs;
    setNotifs([]);
    setTotal(0);
    setUnreadCount(0);
    showToast("🗑 All notifications deleted");

    try {
      const res = await fetch(API, {
        method  : "DELETE",
        headers : authH(),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setNotifs(prevNotifs);
      showToast("❌ Could not delete all");
    }
  }, [notifs, showToast]);

  /* ══════════════════════════════════════════════
     LOAD MORE
  ══════════════════════════════════════════════ */
  const hasMore = offset < total;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="notif-page">
      <div className="notif-container">

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
        <div className="notif-header-bar">
          <div className="notif-header-left">
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
            <div>
              <h1 className="notif-title">Notifications</h1>
              {unreadCount > 0 && (
                <p className="notif-subtitle">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="notif-header-actions">
            {unreadCount > 0 && (
              <button
                className="notif-action-pill"
                onClick={handleReadAll}
                aria-label="Mark all as read"
              >
                ✓ Read all
              </button>
            )}
            {notifs.length > 0 && (
              <button
                className="notif-action-pill notif-action-pill--danger"
                onClick={handleDeleteAll}
                aria-label="Delete all notifications"
              >
                🗑 Clear
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            FILTER TABS
        ══════════════════════════════════════ */}
        <div className="notif-filters" role="tablist" aria-label="Filter notifications">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`notif-filter-btn${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
              role="tab"
              aria-selected={filter === f.key}
            >
              {f.label}
              {f.key === "unread" && unreadCount > 0 && (
                <span className="notif-filter-count">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            CONTENT
        ══════════════════════════════════════ */}

        {/* Loading */}
        {loading && (
          <div className="notif-loading" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="notif-skeleton-item">
                <div className="notif-skeleton-icon" />
                <div className="notif-skeleton-body">
                  <div className="notif-skeleton-line" style={{ width: "40%" }} />
                  <div className="notif-skeleton-line" style={{ width: "70%" }} />
                  <div className="notif-skeleton-line" style={{ width: "55%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="notif-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <p>{error}</p>
            <button onClick={() => fetchNotifs(true)} className="notif-retry">
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && displayedNotifs.length === 0 && (
          <div className="notif-empty">
            <div className="notif-empty-icon" aria-hidden="true">🔔</div>
            <p>No notifications yet</p>
            <small>
              {filter === "unread"
                ? "You're all caught up!"
                : "We'll notify you of important updates here."}
            </small>
          </div>
        )}

        {/* List */}
        {!loading && !error && displayedNotifs.length > 0 && (
          <div className="notif-list" role="list" aria-label="Notifications">
            {displayedNotifs.map((notif) => (
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
        {!loading && hasMore && displayedNotifs.length > 0 && (
          <button
            className="notif-load-more"
            onClick={() => fetchNotifs(false)}
            disabled={loadingMore}
            aria-label="Load more notifications"
          >
            {loadingMore
              ? <><span className="notif-spinner" /> Loading…</>
              : `Load more (${total - offset} remaining)`}
          </button>
        )}

        {/* Footer */}
        <p className="notif-footer">
          © {new Date().getFullYear()} Loemart · All rights reserved
        </p>

      </div>
    </div>
  );
}