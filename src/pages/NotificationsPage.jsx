// src/pages/Notifications.jsx

import React, {
  useState, useEffect, useCallback,
  useRef, useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Notifications.css";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const Icons = {
  // Navigation
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  
  // Actions
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  checkAll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 7 17l-5-5"/><path d="m22 10-9.5 9.5L10 17"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
    </svg>
  ),
  
  // Category Icons
  welcome: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11v-1a5 5 0 0 1 10 0v1"/><path d="M5 19a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2"/><path d="M12 19v3"/>
    </svg>
  ),
  verified: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  rejected: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/>
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  referral: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>
    </svg>
  ),
  reward: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 8 6 8 6h8s1-2 3.5-2a2.5 2.5 0 0 1 0 5H18"/><path d="M4 22V10h16v12"/><path d="M12 10v12"/><path d="M4 14h16"/>
    </svg>
  ),
  spin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V4h4"/><path d="M18 9h2a2 2 0 0 0 2-2V4h-4"/><path d="M4 22h16"/><path d="M10 22V16a2 2 0 0 1 4 0v6"/><path d="M6 4v5a6 6 0 0 0 12 0V4"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  order: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  shipped: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  ),
  delivered: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  coupon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

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
   NOTIFICATION CONFIG (with SVG icons)
══════════════════════════════════════════════════════════════ */
const NOTIF_CFG = {
  /* Account */
  welcome              : { icon: Icons.welcome,  color: "#2563eb", bg: "#eff6ff", label: "Welcome"         },
  email_verified       : { icon: Icons.verified, color: "#10b981", bg: "#ecfdf5", label: "Email Verified"  },
  identity_approved    : { icon: Icons.verified, color: "#10b981", bg: "#ecfdf5", label: "Verified"        },
  identity_rejected    : { icon: Icons.rejected, color: "#ef4444", bg: "#fef2f2", label: "Rejected"        },
  store_approved       : { icon: Icons.store,    color: "#10b981", bg: "#ecfdf5", label: "Store Approved"  },
  store_rejected       : { icon: Icons.store,    color: "#ef4444", bg: "#fef2f2", label: "Store Rejected"  },
  account_flagged      : { icon: Icons.alert,    color: "#f59e0b", bg: "#fffbeb", label: "Account Flagged" },
  password_changed     : { icon: Icons.security, color: "#6366f1", bg: "#eef2ff", label: "Security"        },

  /* Referral */
  referral_signup      : { icon: Icons.referral, color: "#2563eb", bg: "#eff6ff", label: "Referral"        },
  referral_rewarded    : { icon: Icons.reward,   color: "#8b5cf6", bg: "#f5f3ff", label: "Reward"          },
  bonus_spin_earned    : { icon: Icons.spin,     color: "#e8630a", bg: "#fff7ed", label: "Bonus Spin"      },

  /* Spin */
  spin_win             : { icon: Icons.trophy,   color: "#16a34a", bg: "#f0fdf4", label: "You Won!"        },
  spin_coupon_expiring : { icon: Icons.clock,    color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon"   },

  /* Orders */
  order_placed         : { icon: Icons.order,    color: "#2563eb", bg: "#eff6ff", label: "Order Placed"    },
  order_confirmed      : { icon: Icons.verified, color: "#10b981", bg: "#ecfdf5", label: "Confirmed"       },
  order_shipped        : { icon: Icons.shipped,  color: "#0891b2", bg: "#ecfeff", label: "Shipped"         },
  order_delivered      : { icon: Icons.delivered,color: "#16a34a", bg: "#f0fdf4", label: "Delivered"       },
  order_cancelled      : { icon: Icons.rejected, color: "#ef4444", bg: "#fef2f2", label: "Cancelled"       },

  /* Products */
  product_approved     : { icon: Icons.product,  color: "#10b981", bg: "#ecfdf5", label: "Product Live"    },
  product_rejected     : { icon: Icons.rejected, color: "#ef4444", bg: "#fef2f2", label: "Product Rejected"},
  product_expiring     : { icon: Icons.clock,    color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon"   },

  /* Messages */
  new_message          : { icon: Icons.message,  color: "#2563eb", bg: "#eff6ff", label: "Message"         },

  /* System */
  system               : { icon: Icons.bell,     color: "#64748b", bg: "#f1f5f9", label: "System"          },
  promotion            : { icon: Icons.target,   color: "#e8630a", bg: "#fff7ed", label: "Promotion"       },
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
            <span className="notif-coupon-icon">{Icons.coupon}</span>
            <code>{meta.coupon_code}</code>
          </div>
        )}

        {/* Spin pill */}
        {meta.spins_awarded && (
          <div className="notif-spin-pill">
            <span className="notif-spin-pill-icon">{Icons.spin}</span>
            +{meta.spins_awarded} bonus spin{meta.spins_awarded > 1 ? "s" : ""}
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
            <span className="notif-link-icon">{Icons.arrowRight}</span>
          </Link>

          {!notif.is_read && (
            <button
              className="notif-btn notif-btn--read"
              onClick={() => onRead(notif.id)}
              aria-label="Mark as read"
            >
              <span className="notif-btn-icon">{Icons.check}</span>
              Mark read
            </button>
          )}

          <button
            className="notif-btn notif-btn--delete"
            onClick={() => onDelete(notif.id)}
            aria-label="Delete notification"
          >
            {Icons.trash}
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
  const states = {
    unread   : { icon: Icons.checkAll, title: "All caught up!",       sub: "No unread notifications." },
    orders   : { icon: Icons.order,    title: "No order updates",     sub: "Your order activity will appear here." },
    referral : { icon: Icons.users,    title: "No referrals yet",     sub: "Share your link to earn rewards." },
    spin     : { icon: Icons.spin,     title: "No spin activity",     sub: "Play Spin & Win to earn prizes." },
    system   : { icon: Icons.bell,     title: "No system alerts",     sub: "System messages will appear here." },
    all      : { icon: Icons.bell,     title: "No notifications yet", sub: "We'll notify you of important updates here." },
  };

  const s = states[filter] || states.all;

  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">{s.icon}</div>
      <p className="notif-empty__title">{s.title}</p>
      <p className="notif-empty__sub">{s.sub}</p>
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
  const [toast,       setToast]       = useState({ show: false, text: "", icon: null });
  const [deleting,    setDeleting]    = useState(new Set());

  const toastTimer = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/notifications");
  }, [navigate]);

  /* ── Toast helper ── */
  const showToast = useCallback((text, icon = null) => {
    clearTimeout(toastTimer.current);
    setToast({ show: true, text, icon });
    toastTimer.current = setTimeout(
      () => setToast({ show: false, text: "", icon: null }),
      2_500
    );
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* ══════════════════════════════════════════════
     BACK HANDLER — Fixed to avoid loops
  ══════════════════════════════════════════════ */
  const handleBack = useCallback(() => {
    // Check if we can go back, otherwise go home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);

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
      showToast("Could not mark as read", Icons.rejected);
    }
  }, [showToast]);

  /* Mark all read */
  const handleReadAll = useCallback(async () => {
    const prev = notifs;
    const prevC = unreadCount;
    setNotifs((p) => p.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    showToast("All marked as read", Icons.checkAll);
    try {
      const res = await fetch(`${API}/read-all`, {
        method: "POST", headers: authH(),
      });
      if (!res.ok) throw new Error();
    } catch {
      setNotifs(prev);
      setUnreadCount(prevC);
      showToast("Could not mark all as read", Icons.rejected);
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
      showToast("Notification deleted", Icons.trash);
    } catch {
      if (removed) setNotifs((p) => [removed, ...p]);
      setTotal((t) => t + 1);
      if (removed && !removed.is_read) setUnreadCount((c) => c + 1);
      showToast("Could not delete", Icons.rejected);
    } finally {
      setDeleting((p) => { const s = new Set(p); s.delete(id); return s; });
    }
  }, [notifs, showToast]);

  /* Delete all */
  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    const prev = notifs;
    setNotifs([]); setTotal(0); setUnreadCount(0);
    showToast("All notifications cleared", Icons.trash);
    try {
      const res = await fetch(API, { method: "DELETE", headers: authH() });
      if (!res.ok) throw new Error();
    } catch {
      setNotifs(prev);
      showToast("Could not clear notifications", Icons.rejected);
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
          {toast.icon && <span className="notif-toast__icon">{toast.icon}</span>}
          {toast.text}
        </div>

        {/* ══════════════════════════════════════
            HEADER
        ══════════════════════════════════════ */}
        <header className="notif-header">
          <div className="notif-header__left">
            <button
              className="notif-back"
              onClick={handleBack}
              aria-label="Go back"
            >
              {Icons.back}
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
                <span className="notif-pill__icon">{Icons.checkAll}</span>
                Read all
              </button>
            )}
            {notifs.length > 0 && (
              <button
                className="notif-pill notif-pill--danger"
                onClick={handleDeleteAll}
                aria-label="Clear all notifications"
              >
                <span className="notif-pill__icon">{Icons.trash}</span>
                Clear
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
              <span className="notif-error__icon">{Icons.alert}</span>
              <p className="notif-error__text">{error}</p>
              <button
                className="notif-error__retry"
                onClick={() => fetchNotifs(true)}
              >
                <span className="notif-error__retry-icon">{Icons.refresh}</span>
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
                ? <><span className="notif-spinner" aria-hidden="true" /> Loading...</>
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