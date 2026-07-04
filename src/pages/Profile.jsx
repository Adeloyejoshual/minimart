// src/pages/Profile.jsx
import {
  useState, useEffect, useRef, useCallback, memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import "../styles/Profile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1)     + "k";
  return v.toLocaleString();
};

const fmtJoined = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════
   AUTH TOKEN
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE USER
═══════════════════════════════════════════════════════════════ */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    phone: raw.phone || raw.phone_number || "",
    location_state: raw.location?.state || raw.location_state || raw.state || "",
    location_city:  raw.location?.city  || raw.location_city  || raw.city  || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   ICONS (SVG only — no emoji)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  logout:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  plus:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  saved:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  messages:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  trending:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  gift:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  help:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  zap:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  notify:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z"/></svg>,
  copy:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  star:      () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG
═══════════════════════════════════════════════════════════════ */
const MENU_SECTIONS = [
  {
    title: "Selling",
    items: [
      { to: "/dashboard",    Ic: Icon.dashboard, label: "Seller Dashboard"               },
      { to: "/minimart/add", Ic: Icon.plus,      label: "Post a Listing",  badge: "NEW" },
      { to: "/leaderboard",  Ic: Icon.trending,  label: "Leaderboard"                   },
    ],
  },
  {
    title: "Buying",
    items: [
      { to: "/saved", Ic: Icon.saved,    label: "Saved Items" },
      { to: "/conversations",  Ic: Icon.messages, label: "Messages"    },
    ],
  },
  {
    title: "Rewards",
    items: [
      { to: "/spin",       Ic: Icon.zap,  label: "Spin & Win",   badge: "WIN"  },
      { to: "/coupons",    Ic: Icon.gift, label: "Coupons & Promos"             },
      { to: "/invitation", Ic: Icon.gift, label: "Refer & Earn", badge: "₦500" },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/verification",  Ic: Icon.shield,  label: "Verification"   },
      { to: "/notifications", Ic: Icon.notify,  label: "Notifications"  },
      { to: "/support",       Ic: Icon.support, label: "Help & Support" },
      { to: "/faq",           Ic: Icon.help,    label: "FAQ"            },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   REFERRAL BANNER
═══════════════════════════════════════════════════════════════ */
const ReferralBanner = ({ code }) => {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="pf-referral">
      <div className="pf-referral-text">
        <p className="pf-referral-head">Refer & Earn ₦500</p>
        <p className="pf-referral-sub">Share your code and earn when a friend signs up.</p>
      </div>
      <button className="pf-referral-code" onClick={copy} aria-label="Copy referral code" type="button">
        <span>{code}</span>
        <span className="pf-referral-copy-icon">
          {copied ? "✔" : <Icon.copy/>}
        </span>
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Profile({ onLogout }) {
  const navigate = useNavigate();

  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

  /* ── Fetch user ── */
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(normalizeUser(data));
      } catch {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) => localStorage.removeItem(k));
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="pf-full-loader">
        <div className="pf-ring"/>
      </div>
    );
  }

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="pf-page">

      {/* ── Header ── */}
      <ProfileHeader
        title="My Profile"
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onMenuClose={() => setMenuOpen(false)}
        menuRef={menuRef}
        onNotif={() => navigate("/notifications")}
        onLogout={logout}
      />

      <div className="pf-scroll">

        {/* ════════════════════════════════════════
            IDENTITY CARD
        ════════════════════════════════════════ */}
        <div className="pf-identity-card">
          <div className="pf-avatar-row">
            <div className="pf-avatar">
              {user?.profile_image ? (
                <img src={user.profile_image} alt={user.name}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}/>
              ) : (
                <span className="pf-avatar-letter">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="pf-avatar-online" title="You are online"/>
            </div>

            <div className="pf-identity">
              <h1 className="pf-name">{user?.name || "User"}</h1>
              <p className="pf-store">{user?.store_name || "Loemart Member"}</p>

              <div className="pf-meta">
                {joinedLabel && (
                  <span className="pf-meta-item">Joined {joinedLabel}</span>
                )}
                {user?.location_state && (
                  <span className="pf-meta-item">{user.location_state}</span>
                )}
              </div>

              <div className="pf-badges">
                {user?.verified && (
                  <span className="pf-badge pf-badge--verified">Verified</span>
                )}
                {user?.is_seller && (
                  <span className="pf-badge pf-badge--seller">Seller</span>
                )}
                {user?.is_top_seller && (
                  <span className="pf-badge pf-badge--top">Top Seller</span>
                )}
              </div>
            </div>
          </div>

          {/* Key stats */}
          <div className="pf-key-stats">
            <div className="pf-kstat">
              <span className="pf-kstat-val">{fmtNum(user?.total_sales || 0)}</span>
              <span className="pf-kstat-label">Sales</span>
            </div>
            <div className="pf-kstat-divider"/>
            <div className="pf-kstat">
              <span className="pf-kstat-val">
                {user?.rating ? (
                  <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <span style={{ color:"#f59e0b", fontSize:14 }}>
                      <Icon.star/>
                    </span>
                    {Number(user.rating).toFixed(1)}
                  </span>
                ) : "—"}
              </span>
              <span className="pf-kstat-label">Rating</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="pf-quick-actions">
            <button className="pf-qa-btn pf-qa-btn--primary"
              onClick={() => navigate("/minimart/add")} type="button">
              <Icon.plus/> Post Listing
            </button>
            <button className="pf-qa-btn pf-qa-btn--outline"
              onClick={() => navigate("/dashboard")} type="button">
              <Icon.dashboard/> Dashboard
            </button>
            <button className="pf-qa-btn pf-qa-btn--outline"
              onClick={() => navigate("/conversations")} type="button">
              <Icon.messages/> Messages
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════
            REFERRAL BANNER
        ════════════════════════════════════════ */}
        <ReferralBanner code={user?.referral_code}/>

        {/* ════════════════════════════════════════
            MENU SECTIONS
        ════════════════════════════════════════ */}
        {MENU_SECTIONS.map((section) => (
          <section key={section.title} className="pf-menu-section">
            <p className="pf-menu-label">{section.title}</p>
            <div className="pf-menu-list">
              {section.items.map(({ to, Ic, label, badge }) => (
                <Link key={to} to={to} className="pf-menu-item">
                  <span className="pf-menu-icon"><Ic/></span>
                  <span className="pf-menu-label-text">{label}</span>
                  {badge && (
                    <span className={`pf-badge-pill${
                      badge === "WIN"       ? " pf-badge-pill--win"   :
                      badge === "NEW"       ? " pf-badge-pill--new"   :
                      badge.startsWith("₦") ? " pf-badge-pill--money" : ""
                    }`}>{badge}</span>
                  )}
                  <span className="pf-menu-chevron"><Icon.chevron/></span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* ── Log Out ── */}
        <button className="pf-logout" onClick={logout} type="button">
          <Icon.logout/> Log Out
        </button>

        <p className="pf-footer">Loemart Technologies Ltd · {new Date().getFullYear()}</p>

      </div>
    </div>
  );
}