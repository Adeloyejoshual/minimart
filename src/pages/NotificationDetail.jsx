// src/pages/NotificationDetail.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "../styles/NotificationDetail.css";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS (transparent, stroke-based)
══════════════════════════════════════════════════════════════ */
const I = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  ),

  /* Categories */
  welcome: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11v-1a5 5 0 0 1 10 0v1"/>
      <path d="M5 19a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2"/>
      <path d="M12 19v3"/>
    </svg>
  ),
  verified: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  rejected: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
      <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
      <path d="M12 3v6"/>
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  referral: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>
    </svg>
  ),
  reward: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 8 6 8 6h8s1-2 3.5-2a2.5 2.5 0 0 1 0 5H18"/>
      <path d="M4 22V10h16v12"/><path d="M12 10v12"/><path d="M4 14h16"/>
    </svg>
  ),
  spin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2v4m0 12v4m-7.07-17.07 2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4m-17.07 7.07 2.83-2.83m8.48-8.48 2.83-2.83"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4a2 2 0 0 1-2-2V4h4"/>
      <path d="M18 9h2a2 2 0 0 0 2-2V4h-4"/>
      <path d="M4 22h16"/><path d="M10 22V16a2 2 0 0 1 4 0v6"/>
      <path d="M6 4v5a6 6 0 0 0 12 0V4"/>
    </svg>
  ),
  order: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  shipped: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
      <path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
      <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
    </svg>
  ),
  delivered: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  product: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15"/>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
      <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  coupon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
      <path d="M13 5v2m0 10v2m0-8v2"/>
    </svg>
  ),

  /* Quick actions */
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/notifications`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ══════════════════════════════════════════════════════════════
   NOTIF TYPE CONFIG
══════════════════════════════════════════════════════════════ */
const CFG = {
  welcome              : { icon: I.welcome,  color: "#2563eb", bg: "#eff6ff", label: "Welcome",          cta: "Dashboard",     link: "/"          },
  email_verified       : { icon: I.verified, color: "#10b981", bg: "#ecfdf5", label: "Email Verified",    cta: "Settings",      link: "/settings"  },
  identity_approved    : { icon: I.verified, color: "#10b981", bg: "#ecfdf5", label: "Verified",          cta: "View Profile",  link: "/profile"   },
  identity_rejected    : { icon: I.rejected, color: "#ef4444", bg: "#fef2f2", label: "Rejected",          cta: "Verify Now",    link: "/verify"    },
  store_approved       : { icon: I.store,    color: "#10b981", bg: "#ecfdf5", label: "Store Live",        cta: "Manage Store",  link: "/store"     },
  store_rejected       : { icon: I.store,    color: "#ef4444", bg: "#fef2f2", label: "Store Rejected",    cta: "Resubmit",      link: "/verify"    },
  account_flagged      : { icon: I.alert,    color: "#f59e0b", bg: "#fffbeb", label: "Flagged",           cta: "Support",       link: "/support"   },
  password_changed     : { icon: I.security, color: "#6366f1", bg: "#eef2ff", label: "Security",          cta: "Settings",      link: "/settings"  },
  referral_signup      : { icon: I.referral, color: "#2563eb", bg: "#eff6ff", label: "Referral",          cta: "Invite More",   link: "/invite"    },
  referral_rewarded    : { icon: I.reward,   color: "#8b5cf6", bg: "#f5f3ff", label: "Reward",            cta: "My Rewards",    link: "/invite"    },
  bonus_spin_earned    : { icon: I.spin,     color: "#e8630a", bg: "#fff7ed", label: "Bonus Spin",        cta: "Spin Now",      link: "/spin"      },
  spin_win             : { icon: I.trophy,   color: "#16a34a", bg: "#f0fdf4", label: "Winner!",           cta: "Spin More",     link: "/spin"      },
  spin_coupon_expiring : { icon: I.clock,    color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",     cta: "Use Now",       link: "/spin"      },
  order_placed         : { icon: I.order,    color: "#2563eb", bg: "#eff6ff", label: "Order Placed",      cta: "View Order",    link: "/orders"    },
  order_confirmed      : { icon: I.verified, color: "#10b981", bg: "#ecfdf5", label: "Confirmed",         cta: "View Order",    link: "/orders"    },
  order_shipped        : { icon: I.shipped,  color: "#0891b2", bg: "#ecfeff", label: "Shipped",           cta: "Track",         link: "/orders"    },
  order_delivered      : { icon: I.delivered,color: "#16a34a", bg: "#f0fdf4", label: "Delivered",         cta: "Review",        link: "/orders"    },
  order_cancelled      : { icon: I.rejected, color: "#ef4444", bg: "#fef2f2", label: "Cancelled",         cta: "View Orders",   link: "/orders"    },
  product_approved     : { icon: I.product,  color: "#10b981", bg: "#ecfdf5", label: "Product Live",      cta: "View Listing",  link: "/listings"  },
  product_rejected     : { icon: I.rejected, color: "#ef4444", bg: "#fef2f2", label: "Product Rejected",  cta: "Edit Listing",  link: "/listings"  },
  product_expiring     : { icon: I.clock,    color: "#f59e0b", bg: "#fffbeb", label: "Expiring Soon",     cta: "Renew",         link: "/listings"  },
  new_message          : { icon: I.message,  color: "#2563eb", bg: "#eff6ff", label: "New Message",       cta: "Reply",         link: "/messages"  },
  system               : { icon: I.bell,     color: "#64748b", bg: "#f1f5f9", label: "System",             cta: null,            link: null         },
  promotion            : { icon: I.target,   color: "#e8630a", bg: "#fff7ed", label: "Promotion",         cta: "Shop Now",      link: "/"          },
};

const getCfg = (t) => CFG[t] || CFG.system;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1e3);
  if (s < 60)      return "just now";
  if (s < 3600)    return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800)  return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

const resolveLink = (type, meta = {}, fallback) => {
  switch (type) {
    case "order_placed": case "order_confirmed": case "order_shipped":
    case "order_delivered": case "order_cancelled":
      return meta.order_id ? `/orders/${meta.order_id}` : "/orders";
    case "new_message":
      return meta.conversation_id ? `/messages/${meta.conversation_id}` : "/messages";
    case "product_approved": case "product_rejected": case "product_expiring":
      return meta.product_id ? `/listings/${meta.product_id}` : "/listings";
    default: return fallback || null;
  }
};

/* ══════════════════════════════════════════════════════════════
   COUPON COPY
══════════════════════════════════════════════════════════════ */
function CouponCopy({ code }) {
  const [copied, setCopied] = useState(false);
  const t = useRef(null);

  const doCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => () => clearTimeout(t.current), []);

  return (
    <button className="nd-coupon" onClick={doCopy} title="Copy code">
      <code>{code}</code>
      <span className="nd-coupon__btn">
        {copied ? I.check : I.copy}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   META DETAIL CARDS
══════════════════════════════════════════════════════════════ */
function DetailCards({ type, meta }) {
  if (!meta || Object.keys(meta).length === 0) return null;

  const cards = [];
  const add = (key, icon, label, value, mod) => {
    if (!value) return;
    cards.push(
      <div className={`nd-card${mod ? ` nd-card--${mod}` : ""}`} key={key}>
        <span className="nd-card__icon">{icon}</span>
        <div className="nd-card__body">
          <span className="nd-card__label">{label}</span>
          <span className="nd-card__value">{value}</span>
        </div>
      </div>
    );
  };

  /* Order */
  if (["order_placed","order_confirmed","order_shipped","order_delivered","order_cancelled"].includes(type)) {
    add("oid",   I.order,   "Order ID",     meta.order_id && `#${meta.order_id}`);
    add("amt",   I.reward,  "Amount",       meta.amount && `₦${Number(meta.amount).toLocaleString()}`);
    add("track", I.shipped, "Tracking No.", meta.tracking_number);
    add("items", I.product, "Items",        meta.items_count);
  }

  /* Referral */
  if (["referral_signup","referral_rewarded"].includes(type)) {
    add("ref",  I.referral, "Referred User", meta.referred_name);
    add("rew",  I.reward,   "Reward",        meta.reward_amount && `₦${Number(meta.reward_amount).toLocaleString()}`);
  }

  /* Spin */
  if (["spin_win","spin_coupon_expiring","bonus_spin_earned"].includes(type)) {
    add("prize", I.trophy, "Prize",    meta.prize_name);
    add("spins", I.spin,   "Spins",    meta.spins_awarded && `+${meta.spins_awarded} spin${meta.spins_awarded > 1 ? "s" : ""}`);
    add("exp",   I.clock,  "Expires",  meta.coupon_expiry && fmtDate(meta.coupon_expiry));
    if (meta.coupon_code) {
      cards.push(
        <div className="nd-card nd-card--highlight" key="coupon">
          <span className="nd-card__icon">{I.coupon}</span>
          <div className="nd-card__body">
            <span className="nd-card__label">Coupon Code</span>
            <CouponCopy code={meta.coupon_code} />
          </div>
        </div>
      );
    }
  }

  /* Product */
  if (["product_approved","product_rejected","product_expiring"].includes(type)) {
    add("pname",  I.product,  "Product", meta.product_name);
    add("reason", I.alert,    "Reason",  meta.rejection_reason, "warn");
  }

  /* Message */
  if (type === "new_message") {
    add("sender",  I.referral, "From",    meta.sender_name);
    add("preview", I.message,  "Preview", meta.preview);
  }

  if (cards.length === 0) return null;

  return (
    <div className="nd-cards-section">
      <h3 className="nd-section-label">Details</h3>
      <div className="nd-cards-grid">{cards}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function NotificationDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [notif,    setNotif]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [deleted,  setDeleted]  = useState(false);
  const [toast,    setToast]    = useState({ show: false, text: "" });

  const toastT = useRef(null);

  /* Auth guard */
  useEffect(() => {
    if (!getToken()) navigate(`/auth?redirect=/notifications/${id}`);
  }, [navigate, id]);

  /* Toast */
  const flash = useCallback((text) => {
    clearTimeout(toastT.current);
    setToast({ show: true, text });
    toastT.current = setTimeout(() => setToast({ show: false, text: "" }), 2500);
  }, []);
  useEffect(() => () => clearTimeout(toastT.current), []);

  /* ── BACK: always go to /notifications, replace to break loop ── */
  const goBack = useCallback(() => {
    navigate("/notifications", { replace: true });
  }, [navigate]);

  /* ── Fetch ── */
  const fetchNotif = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      /* Try single-item endpoint */
      const r = await fetch(`${API}/${id}`, { headers: authH() });
      if (r.status === 401) { navigate(`/auth?redirect=/notifications/${id}`); return; }

      if (r.ok) {
        const d = await r.json();
        const found = d.data ?? d;
        if (found && (found.id || found._id)) {
          setNotif(found);
          if (!found.is_read)
            fetch(`${API}/read/${found.id ?? found._id}`, { method: "POST", headers: authH() }).catch(() => {});
          setLoading(false);
          return;
        }
      }

      /* Fallback: scan list */
      let found = null;
      for (let pg = 0; pg < 5 && !found; pg++) {
        const p = new URLSearchParams({ limit: "50", offset: String(pg * 50) });
        const lr = await fetch(`${API}?${p}`, { headers: authH() });
        if (!lr.ok) break;
        const ld = await lr.json();
        const items = ld.data || [];
        found = items.find((n) => String(n.id) === String(id) || String(n._id) === String(id));
        if ((pg + 1) * 50 >= (ld.total ?? 0)) break;
      }

      if (found) {
        setNotif(found);
        if (!found.is_read)
          fetch(`${API}/read/${found.id ?? found._id}`, { method: "POST", headers: authH() }).catch(() => {});
      } else {
        setError("Notification not found or has been deleted.");
      }
    } catch (e) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchNotif(); }, [fetchNotif]);

  /* ── Delete ── */
  const handleDelete = useCallback(async () => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      const r = await fetch(`${API}/${id}`, { method: "DELETE", headers: authH() });
      if (!r.ok) throw new Error();
      setDeleted(true);
      flash("Notification deleted");
      setTimeout(() => navigate("/notifications", { replace: true }), 1400);
    } catch {
      flash("Could not delete");
    }
  }, [id, navigate, flash]);

  /* ── Loading ── */
  if (loading) return (
    <div className="nd-page">
      <div className="nd-wrap">
        <div className="nd-skel-bar" />
        <div className="nd-skel-hero">
          <div className="nd-skel-circle" />
          <div className="nd-skel-line" style={{ width: "45%" }} />
          <div className="nd-skel-line" style={{ width: "70%" }} />
          <div className="nd-skel-line" style={{ width: "55%" }} />
        </div>
        <div className="nd-skel-row">
          <div className="nd-skel-card" /><div className="nd-skel-card" />
        </div>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="nd-page">
      <div className="nd-wrap">
        <div className="nd-topbar">
          <button className="nd-back" onClick={goBack}>{I.back}<span>Notifications</span></button>
        </div>
        <div className="nd-error">
          <span className="nd-error__icon">{I.alert}</span>
          <p className="nd-error__title">Something went wrong</p>
          <p className="nd-error__text">{error}</p>
          <div className="nd-error__btns">
            <button className="nd-error__retry" onClick={fetchNotif}>
              <span className="nd-error__retry-icon">{I.refresh}</span> Try Again
            </button>
            <button className="nd-error__back" onClick={goBack}>
              <span className="nd-error__retry-icon">{I.back}</span> Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!notif) return null;

  const cfg     = getCfg(notif.type);
  const meta    = notif.metadata || {};
  const ctaLink = resolveLink(notif.type, meta, cfg.link);

  /* ── Full render ── */
  return (
    <div className="nd-page">
      <div className="nd-wrap">

        {/* Toast */}
        <div className={`nd-toast${toast.show ? " show" : ""}`} role="status" aria-live="polite">
          {toast.text}
        </div>

        {/* Top bar */}
        <div className="nd-topbar">
          <button className="nd-back" onClick={goBack}>
            {I.back}<span>Notifications</span>
          </button>
          {!deleted && (
            <button className="nd-del" onClick={handleDelete}>
              {I.trash}<span>Delete</span>
            </button>
          )}
        </div>

        {deleted ? (
          <div className="nd-deleted">
            <span className="nd-deleted__icon">{I.trash}</span>
            <p>Deleted. Redirecting…</p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="nd-hero" style={{ borderColor: cfg.color }}>
              <div className="nd-hero__blob" style={{ background: cfg.bg }} />
              {!notif.is_read && <span className="nd-hero__new">NEW</span>}
              <div className="nd-hero__icon" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.icon}
              </div>
              <span className="nd-hero__badge" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
              <h1 className="nd-hero__title">{notif.title}</h1>
              <p className="nd-hero__message">{notif.message}</p>
              <div className="nd-hero__time">
                <span className="nd-hero__time-icon">{I.clock}</span>
                <span>{timeAgo(notif.created_at)}</span>
                <span className="nd-hero__time-sep">·</span>
                <span className="nd-hero__time-full">{fmtDate(notif.created_at)}</span>
              </div>
            </div>

            {/* Detail cards */}
            <DetailCards type={notif.type} meta={meta} />

            {/* CTA */}
            {ctaLink && cfg.cta && (
              <button
                className="nd-cta"
                style={{ background: cfg.color, boxShadow: `0 6px 24px ${cfg.color}30` }}
                onClick={() => navigate(ctaLink, { replace: true })}
              >
                {cfg.cta}
                <span className="nd-cta__icon">{I.arrow}</span>
              </button>
            )}

            {/* Quick actions */}
            <div className="nd-quick">
              <h3 className="nd-section-label">Quick Actions</h3>
              <div className="nd-quick-grid">
                {[
                  { to: "/",            icon: I.home,     lbl: "Home"     },
                  { to: "/notifications", icon: I.bell,   lbl: "All"     },
                  { to: "/settings",    icon: I.settings, lbl: "Settings" },
                  { to: "/support",     icon: I.help,     lbl: "Help"    },
                ].map((q) => (
                  <button
                    key={q.to}
                    className="nd-quick-card"
                    onClick={() => navigate(q.to, { replace: true })}
                  >
                    <span className="nd-quick-card__icon">{q.icon}</span>
                    <span>{q.lbl}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="nd-footer">© {new Date().getFullYear()} Loemart · All rights reserved</p>
      </div>
    </div>
  );
}