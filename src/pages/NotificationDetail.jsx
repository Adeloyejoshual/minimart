// src/pages/NotificationDetail.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "../styles/NotificationDetail.css";

/* ══════════════════════════════════════════════════════════════
   SVG ICONSET
══════════════════════════════════════════════════════════════ */
const Icons = {
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m7 7-7-7 7-7"/></svg>,
  delete: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-6 5v6m4-6v6"/></svg>,
  arrowRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  
  // Categories
  welcome: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0-3-3 3 3 0 0 0-3 3c0 6.5 9 11 9 11s9-4.5 9-11z"/></svg>,
  verify: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  reject: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6m0-6 6 6"/></svg>,
  store: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  security: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  referral: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  reward: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  spin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-14.8-6.8 2.8 2.8m5.6 5.6 2.8 2.8m0-11.2-2.8 2.8M7.2 16.8l-2.8 2.8"/></svg>,
  order: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  message: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  system: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api/notifications`;

const getToken = () => localStorage.getItem("marketplace_token") || localStorage.getItem("token") || null;
const authH = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });

const NOTIF_CFG = {
  welcome              : { icon: Icons.welcome,  color: "#2563eb", bg: "#eff6ff", label: "Welcome",           ctaLabel: "Dashboard",       ctaLink: "/"          },
  email_verified       : { icon: Icons.verify,   color: "#10b981", bg: "#ecfdf5", label: "Email Verified",     ctaLabel: "Settings",        ctaLink: "/settings"  },
  identity_approved    : { icon: Icons.verify,   color: "#10b981", bg: "#ecfdf5", label: "Verified",           ctaLabel: "View Profile",     ctaLink: "/profile"   },
  identity_rejected    : { icon: Icons.reject,   color: "#ef4444", bg: "#fef2f2", label: "Rejected",           ctaLabel: "Verify Now",       ctaLink: "/verify"    },
  store_approved       : { icon: Icons.store,    color: "#10b981", bg: "#ecfdf5", label: "Store Live",         ctaLabel: "Manage Store",     ctaLink: "/store"     },
  store_rejected       : { icon: Icons.reject,   color: "#ef4444", bg: "#fef2f2", label: "Store Rejected",     ctaLabel: "Resubmit",         ctaLink: "/verify"    },
  account_flagged      : { icon: Icons.alert,    color: "#f59e0b", bg: "#fffbeb", label: "Flagged",            ctaLabel: "Support",          ctaLink: "/support"   },
  password_changed     : { icon: Icons.security, color: "#6366f1", bg: "#f5f3ff", label: "Security",           ctaLabel: "Security",         ctaLink: "/settings"  },
  referral_signup      : { icon: Icons.referral, color: "#2563eb", bg: "#eff6ff", label: "Referral",           ctaLabel: "Invite Friends",   ctaLink: "/invite"    },
  referral_rewarded    : { icon: Icons.reward,   color: "#8b5cf6", bg: "#f5f3ff", label: "Reward",             ctaLabel: "My Rewards",       ctaLink: "/invite"    },
  bonus_spin_earned    : { icon: Icons.spin,     color: "#e8630a", bg: "#fff0e6", label: "Bonus Spin",         ctaLabel: "Spin Now",         ctaLink: "/spin"      },
  spin_win             : { icon: Icons.reward,   color: "#16a34a", bg: "#f0fdf4", label: "Winner!",            ctaLabel: "Spin More",        ctaLink: "/spin"      },
  order_placed         : { icon: Icons.order,    color: "#2563eb", bg: "#eff6ff", label: "Order Placed",       ctaLabel: "View Order",       ctaLink: "/orders"    },
  order_shipped        : { icon: Icons.order,    color: "#0891b2", bg: "#f0f9ff", label: "Shipped",            ctaLabel: "Track",            ctaLink: "/orders"    },
  new_message          : { icon: Icons.message,  color: "#2563eb", bg: "#eff6ff", label: "New Message",        ctaLabel: "Reply",            ctaLink: "/messages"  },
  system               : { icon: Icons.system,   color: "#64748b", bg: "#f1f5f9", label: "System",             ctaLabel: null,               ctaLink: null         },
};

const getCfg = (type) => NOTIF_CFG[type] || NOTIF_CFG.system;

export default function NotificationDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, text: "" });

  const showToast = useCallback((text) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2500);
  }, []);

  const fetchNotif = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/${id}`, { headers: authH() });
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setNotif(data.data ?? data);
    } catch {
      setError("Notification not found or has been deleted.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNotif(); }, [fetchNotif]);

  if (loading) return <div className="nd-page"><div className="nd-container">Loading...</div></div>;

  if (error) return (
    <div className="nd-page">
      <div className="nd-container">
        <button className="nd-back-btn" onClick={() => navigate("/notifications")}>{Icons.back} Notifications</button>
        <div className="nd-error-state">{error}</div>
      </div>
    </div>
  );

  const cfg = getCfg(notif.type);
  const meta = notif.metadata || {};

  return (
    <div className="nd-page">
      <div className="nd-container">
        {/* TOP BAR - Fix: Strictly go to /notifications list */}
        <div className="nd-topbar">
          <button className="nd-back-btn" onClick={() => navigate("/notifications")}>
            {Icons.back} Notifications
          </button>
          <button className="nd-delete-btn" onClick={() => {/* delete logic */}}>{Icons.delete}</button>
        </div>

        <div className="nd-hero" style={{ borderColor: cfg.color }}>
          <div className="nd-hero__icon" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon}</div>
          <span className="nd-hero__badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
          <h1 className="nd-hero__title">{notif.title}</h1>
          <p className="nd-hero__message">{notif.message}</p>
        </div>

        {/* CTA BUTTON */}
        {cfg.ctaLink && (
          <Link to={cfg.ctaLink} className="nd-cta" style={{ background: cfg.color }}>
            {cfg.ctaLabel} {Icons.arrowRight}
          </Link>
        )}

        {/* QUICK LINKS */}
        <div className="nd-quick">
          <Link to="/" className="nd-quick-card">
            <div className="nd-quick-icon">{Icons.home}</div>
            <span>Home</span>
          </Link>
          <Link to="/settings" className="nd-quick-card">
            <div className="nd-quick-icon">{Icons.settings}</div>
            <span>Settings</span>
          </Link>
          <Link to="/support" className="nd-quick-card">
            <div className="nd-quick-icon">{Icons.support}</div>
            <span>Help</span>
          </Link>
        </div>
      </div>
    </div>
  );
}