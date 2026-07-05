// src/pages/Profile.jsx
import {
  useState, useEffect, useRef, useCallback, memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import MasonryCard   from "../components/MasonryCard.jsx";
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

const fmtJoined = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  } catch { return null; }
};

const timeAgo = (d) => {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
};

/* Enter + Space keyboard activation */
const onActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
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
    phone:          raw.phone          || raw.phone_number  || "",
    location_state: raw.location?.state || raw.location_state || raw.state || "",
    location_city:  raw.location?.city  || raw.location_city  || raw.city  || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   ICONS  (static — outside component, never re-created)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  logout:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  plus:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  saved:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  messages:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  trending:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  gift:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  help:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  zap:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  notify:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z"/></svg>,
  copy:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  star:      () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  settings:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  edit:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  refresh:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  wifi:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  package:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG  (static — outside component)
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
      { to: "/profile/saved", Ic: Icon.saved,    label: "Saved Items" },
      { to: "/conversations", Ic: Icon.messages, label: "Messages"    },
    ],
  },
  {
    title: "Rewards",
    items: [
      { to: "/spin",       Ic: Icon.zap,  label: "Spin & Win",    badge: "WIN"  },
      { to: "/coupons",    Ic: Icon.gift, label: "Coupons & Promos"              },
      { to: "/invitation", Ic: Icon.gift, label: "Refer & Earn",  badge: "₦500" },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/settings",      Ic: Icon.settings, label: "Settings"       },
      { to: "/verification",  Ic: Icon.shield,   label: "Verification"   },
      { to: "/notifications", Ic: Icon.notify,   label: "Notifications"  },
      { to: "/support",       Ic: Icon.support,  label: "Help & Support" },
      { to: "/faq",           Ic: Icon.help,     label: "FAQ"            },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   REFERRAL BANNER  (memoized)
═══════════════════════════════════════════════════════════════ */
const ReferralBanner = memo(function ReferralBanner({ code }) {
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
        <p className="pf-referral-sub">
          Share your code and earn when a friend signs up.
        </p>
      </div>
      <button
        className="pf-referral-code"
        onClick={copy}
        aria-label="Copy referral code"
        type="button"
      >
        <span>{code}</span>
        <span className="pf-referral-copy-icon">
          {copied ? "✔" : <Icon.copy />}
        </span>
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER  (memoized)
═══════════════════════════════════════════════════════════════ */
const ErrorBanner = memo(function ErrorBanner({ message, onRetry }) {
  return (
    <div className="pf-error-banner" role="alert">
      <span className="pf-error-icon"><Icon.wifi /></span>
      <div className="pf-error-content">
        <p className="pf-error-title">Something went wrong</p>
        <p className="pf-error-msg">{message}</p>
      </div>
      <button className="pf-error-retry" onClick={onRetry} type="button">
        <Icon.refresh /> Retry
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT LISTINGS
   Mobile  → horizontal scroll row
   Tablet  → 2-column grid
   Desktop → 3–4-column grid
   (memoized)
═══════════════════════════════════════════════════════════════ */
const RecentListings = memo(function RecentListings({ listings, onViewAll }) {
  const navigate = useNavigate();

  if (!listings || listings.length === 0) return null;

  const goToProduct = (id) => navigate(`/product/${id}`);

  return (
    <section className="pf-recent-section" aria-label="Your recent listings">
      <div className="pf-recent-header">
        <h2 className="pf-recent-title">
          <span className="pf-recent-title-icon"><Icon.package /></span>
          My Recent Listings
        </h2>
        <button className="pf-recent-viewall" onClick={onViewAll} type="button">
          View All <Icon.chevron />
        </button>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="pf-recent-scroll pf-mobile-only">
        {listings.map((item) => {
          const id  = item._id || item.id;
          const img = item.images?.[0] || item.image || null;
          return (
            <div
              key={id}
              className="pf-recent-card"
              onClick={() => goToProduct(id)}
              role="button"
              tabIndex={0}
              aria-label={`View ${item.title || item.name}`}
              onKeyDown={onActivate(() => goToProduct(id))}
            >
              <div className="pf-recent-img-wrap">
                {img ? (
                  <img
                    src={img}
                    alt={item.title || item.name}
                    className="pf-recent-img"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling
                        ?.classList.add("pf-recent-img-placeholder--visible");
                    }}
                  />
                ) : null}
                <div className={`pf-recent-img-placeholder${!img ? " pf-recent-img-placeholder--visible" : ""}`}>
                  <Icon.package />
                </div>
                {item.status && item.status !== "active" && (
                  <span className={`pf-recent-status pf-recent-status--${item.status}`}>
                    {item.status}
                  </span>
                )}
              </div>
              <div className="pf-recent-info">
                <p className="pf-recent-name">{item.title || item.name}</p>
                <p className="pf-recent-price">{naira(item.price)}</p>
                <p className="pf-recent-time">{timeAgo(item.created_at || item.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tablet / Desktop: responsive grid using MasonryCard */}
      <div className="pf-recent-grid pf-desktop-only">
        {listings.map((item) => {
          const id  = item._id || item.id;
          const img = item.images?.[0] || item.image || null;
          return (
            <MasonryCard
              key={id}
              id={id}
              title={item.title || item.name}
              price={item.price}
              image={img}
              status={item.status}
              createdAt={item.created_at || item.createdAt}
              onClick={() => goToProduct(id)}
            />
          );
        })}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   NAV MENU LIST  (shared between Sidebar and mobile)
═══════════════════════════════════════════════════════════════ */
const NavMenuList = memo(function NavMenuList({ className = "" }) {
  return (
    <div className={className}>
      {MENU_SECTIONS.map((section) => (
        <section key={section.title} className="pf-menu-section">
          <p className="pf-menu-label">{section.title}</p>
          <div className="pf-menu-list">
            {section.items.map(({ to, Ic, label, badge }) => (
              <Link key={to} to={to} className="pf-menu-item">
                <span className="pf-menu-icon"><Ic /></span>
                <span className="pf-menu-label-text">{label}</span>
                {badge && (
                  <span className={`pf-badge-pill${
                    badge === "WIN"        ? " pf-badge-pill--win"   :
                    badge === "NEW"        ? " pf-badge-pill--new"   :
                    badge.startsWith("₦") ? " pf-badge-pill--money" : ""
                  }`}>
                    {badge}
                  </span>
                )}
                <span className="pf-menu-chevron"><Icon.chevron /></span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR  (desktop only — memoized)
   Receives ReferralBanner as children prop
═══════════════════════════════════════════════════════════════ */
const Sidebar = memo(function Sidebar({
  user, joinedLabel, onEditProfile, onLogout, children,
}) {
  return (
    <aside className="pf-sidebar" aria-label="Profile sidebar">

      {/* ── Identity card ── */}
      <div
        className="pf-sidebar-identity"
        onClick={onEditProfile}
        role="button"
        tabIndex={0}
        aria-label="Edit your profile"
        onKeyDown={onActivate(onEditProfile)}
      >
        <div className="pf-sidebar-avatar-wrap">
          <div className="pf-avatar pf-sidebar-avatar">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt={user?.name}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <span className="pf-avatar-letter">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="pf-avatar-online" title="Online" />
          </div>
        </div>

        <h2 className="pf-sidebar-name">{user?.name || "User"}</h2>
        <p  className="pf-sidebar-store">{user?.store_name || "Loemart Member"}</p>

        <div className="pf-sidebar-meta">
          {joinedLabel && (
            <span className="pf-meta-item">Joined {joinedLabel}</span>
          )}
          {user?.location_state && (
            <span className="pf-meta-item">{user.location_state}</span>
          )}
        </div>

        <div className="pf-badges pf-sidebar-badges">
          {user?.verified     && <span className="pf-badge pf-badge--verified">Verified</span>}
          {user?.is_seller    && <span className="pf-badge pf-badge--seller">Seller</span>}
          {user?.is_top_seller && <span className="pf-badge pf-badge--top">Top Seller</span>}
        </div>

        {user?.rating != null && (
          <div className="pf-sidebar-rating">
            <span className="pf-sidebar-star"><Icon.star /></span>
            <span>{Number(user.rating).toFixed(1)}</span>
            <span className="pf-sidebar-rating-label">Rating</span>
          </div>
        )}

        <span className="pf-sidebar-edit-hint" aria-hidden="true">
          <Icon.edit /> Edit Profile
        </span>
      </div>

      {/* ── Referral banner (passed as children) ── */}
      {children}

      {/* ── Navigation ── */}
      <nav className="pf-sidebar-nav" aria-label="Profile navigation">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="pf-sidebar-section">
            <p className="pf-sidebar-section-title">{section.title}</p>
            {section.items.map(({ to, Ic, label, badge }) => (
              <Link key={to} to={to} className="pf-sidebar-link">
                <span className="pf-sidebar-link-icon"><Ic /></span>
                <span className="pf-sidebar-link-text">{label}</span>
                {badge && (
                  <span className={`pf-badge-pill${
                    badge === "WIN"        ? " pf-badge-pill--win"   :
                    badge === "NEW"        ? " pf-badge-pill--new"   :
                    badge.startsWith("₦") ? " pf-badge-pill--money" : ""
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Logout ── */}
      <button className="pf-sidebar-logout" onClick={onLogout} type="button">
        <Icon.logout /> Log Out
      </button>

    </aside>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Profile({ onLogout }) {
  const navigate = useNavigate();

  const [user,     setUser]     = useState(null);
  const [listings, setListings] = useState([]);
  const [error,    setError]    = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

  /* ── Fetch user ── */
  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    try {
      setError(null);
      const { data } = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(normalizeUser(data));
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
        return;
      }

      setError(
        status >= 500
          ? "Server is temporarily unavailable. Please try again."
          : !err.response
          ? "Network error. Check your connection and try again."
          : "Something went wrong. Please try again."
      );
    }
  }, [navigate]);

  /* ── Fetch recent listings ── */
  const fetchListings = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const { data } = await axios.get(`${API}/products/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 8, sort: "-created_at" },
      });
      const items =
        data?.products || data?.listings || data?.data ||
        (Array.isArray(data) ? data : []);
      setListings(items.slice(0, 8));
    } catch {
      /* silent — listings are supplementary */
    }
  }, []);

  useEffect(() => {
    fetchUser();
    fetchListings();
  }, [fetchUser, fetchListings]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Stable callbacks ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) =>
      localStorage.removeItem(k)
    );
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  const handleRetry    = useCallback(() => { fetchUser(); fetchListings(); }, [fetchUser, fetchListings]);
  const goEditProfile  = useCallback(() => navigate("/profile/edit"), [navigate]);
  const goViewAll      = useCallback(() => navigate("/dashboard"),    [navigate]);

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="pf-page">

      {/* ── Mobile header (hidden on desktop via CSS) ── */}
      <div className="pf-mobile-header">
        <ProfileHeader
          title="My Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
        />
      </div>

      {/* ── Two-column layout: sidebar (left) + content (right) ── */}
      <div className="pf-layout">

        {/* ════════════════════════════════
            SIDEBAR  (desktop only)
            ReferralBanner passed as child
        ════════════════════════════════ */}
        <Sidebar
          user={user}
          joinedLabel={joinedLabel}
          onEditProfile={goEditProfile}
          onLogout={logout}
        >
          <ReferralBanner code={user?.referral_code} />
        </Sidebar>

        {/* ════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════ */}
        <main className="pf-content">

          {/* Error banner */}
          {error && <ErrorBanner message={error} onRetry={handleRetry} />}

          {/* ── Desktop welcome bar ── */}
          <div className="pf-desktop-welcome pf-desktop-only">
            <div className="pf-desktop-welcome-text">
              <h1 className="pf-desktop-welcome-title">
                Welcome back, {user?.name?.split(" ")[0] || "there"}
              </h1>
              <p className="pf-desktop-welcome-sub">
                Manage your listings, messages and account settings.
              </p>
            </div>
            <div className="pf-desktop-welcome-actions">
              <button
                className="pf-qa-btn pf-qa-btn--primary"
                onClick={() => navigate("/minimart/add")}
                type="button"
              >
                <Icon.plus /> Post Listing
              </button>
              <button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/dashboard")}
                type="button"
              >
                <Icon.dashboard /> Dashboard
              </button>
              <button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/conversations")}
                type="button"
              >
                <Icon.messages /> Messages
              </button>
            </div>
          </div>

          {/* ── Mobile identity card ── */}
          <div
            className="pf-identity-card pf-identity-card--clickable pf-mobile-only"
            onClick={goEditProfile}
            role="button"
            tabIndex={0}
            aria-label="Edit your profile"
            onKeyDown={onActivate(goEditProfile)}
          >
            <div className="pf-edit-hint">
              <span className="pf-edit-hint-icon"><Icon.edit /></span>
              <span className="pf-edit-hint-text">Edit Profile</span>
            </div>

            <div className="pf-avatar-row">
              <div className="pf-avatar">
                {user?.profile_image ? (
                  <img
                    src={user.profile_image}
                    alt={user?.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <span className="pf-avatar-letter">
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="pf-avatar-online" title="Online" />
              </div>

              <div className="pf-identity">
                <h1 className="pf-name">{user?.name || "User"}</h1>
                <p  className="pf-store">{user?.store_name || "Loemart Member"}</p>

                <div className="pf-meta">
                  {joinedLabel && (
                    <span className="pf-meta-item">Joined {joinedLabel}</span>
                  )}
                  {user?.location_state && (
                    <span className="pf-meta-item">{user.location_state}</span>
                  )}
                </div>

                <div className="pf-badges">
                  {user?.verified      && <span className="pf-badge pf-badge--verified">Verified</span>}
                  {user?.is_seller     && <span className="pf-badge pf-badge--seller">Seller</span>}
                  {user?.is_top_seller && <span className="pf-badge pf-badge--top">Top Seller</span>}
                </div>
              </div>
            </div>

            {user?.rating != null && (
              <div className="pf-key-stats">
                <div className="pf-kstat">
                  <span className="pf-kstat-val">
                    <span className="pf-kstat-rating">
                      <span className="pf-kstat-star"><Icon.star /></span>
                      {Number(user.rating).toFixed(1)}
                    </span>
                  </span>
                  <span className="pf-kstat-label">Rating</span>
                </div>
              </div>
            )}

            {/* Buttons stop card-click propagation */}
            <div
              className="pf-quick-actions"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                className="pf-qa-btn pf-qa-btn--primary"
                onClick={() => navigate("/minimart/add")}
                type="button"
              >
                <Icon.plus /> Post Listing
              </button>
              <button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/dashboard")}
                type="button"
              >
                <Icon.dashboard /> Dashboard
              </button>
              <button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/conversations")}
                type="button"
              >
                <Icon.messages /> Messages
              </button>
            </div>
          </div>

          {/* ── Recent listings (mobile scroll / desktop grid) ── */}
          <RecentListings listings={listings} onViewAll={goViewAll} />

          {/* ── Referral banner: mobile only
              (desktop version lives inside Sidebar) ── */}
          <div className="pf-mobile-only">
            <ReferralBanner code={user?.referral_code} />
          </div>

          {/* ── Menu sections: mobile only
              (desktop navigation lives inside Sidebar) ── */}
          <div className="pf-mobile-only">
            <NavMenuList />

            <button className="pf-logout" onClick={logout} type="button">
              <Icon.logout /> Log Out
            </button>
          </div>

          <p className="pf-footer">
            Loemart Technologies Ltd · {new Date().getFullYear()}
          </p>

        </main>
      </div>
    </div>
  );
}