// src/pages/Profile.jsx
import {
  useState, useEffect, useRef, useCallback, memo, lazy, Suspense,
} from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import "../styles/Profile.css";

/* Lazy-load MasonryCard — desktop grid only */
const MasonryCard = lazy(() => import("../components/MasonryCard"));

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
    return new Date(d).toLocaleDateString("en-NG", {
      month: "long", year: "numeric",
    });
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
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short", day: "numeric",
  });
};

const onActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
};

/* ═══════════════════════════════════════════════════════════════
   AUTH
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
    phone:          raw.phone          || raw.phone_number   || "",
    location_state: raw.location?.state || raw.location_state || raw.state || "",
    location_city:  raw.location?.city  || raw.location_city  || raw.city  || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   API FETCHERS (React Query)
═══════════════════════════════════════════════════════════════ */
async function fetchUserData() {
  const token = getToken();
  if (!token) throw new Error("NO_TOKEN");
  const { data } = await axios.get(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return normalizeUser(data);
}

async function fetchUserListings() {
  const token = getToken();
  if (!token) return [];
  const { data } = await axios.get(`${API}/seller-dashboard/products`, {
    headers: { Authorization: `Bearer ${token}` },
    params:  { limit: 8, page: 1, tab: "active" },
  });
  return (data?.products || []).slice(0, 8);
}

async function fetchUnreadCount() {
  const token = getToken();
  if (!token) return 0;
  try {
    const { data } = await axios.get(`${API}/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return Number(data?.count ?? data?.unread ?? 0);
  } catch {
    return 0;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
═══════════════════════════════════════════════════════════════ */
const fadeIn = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0  },
};

const slideRight = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0   },
};

const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1    },
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardItem = {
  hidden:  { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0,  scale: 1    },
};

const spring = {
  type: "spring",
  stiffness: 260,
  damping: 24,
};

const viewportOnce = { once: true, amount: 0.2 };

/* ═══════════════════════════════════════════════════════════════
   ICONS
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
  settings:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  edit:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  refresh:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  wifi:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>,
  package:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  spinner:   () => <svg className="pf-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG (static)
═══════════════════════════════════════════════════════════════ */
const buildMenuSections = (unreadCount = 0) => [
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
      { to: "/saved",         Ic: Icon.saved,    label: "Saved Items" },
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
      {
        to: "/notifications",
        Ic: Icon.notify,
        label: "Notifications",
        badge: unreadCount > 0
          ? (unreadCount > 99 ? "99+" : String(unreadCount))
          : null,
        badgeType: "notif",
      },
      { to: "/support",       Ic: Icon.support,  label: "Help & Support" },
      { to: "/faq",           Ic: Icon.help,     label: "FAQ"            },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   REFERRAL BANNER
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
    <motion.div
      className="pf-referral"
      variants={scaleIn}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: 0.1 }}
    >
      <div className="pf-referral-text">
        <p className="pf-referral-head">Refer & Earn ₦500</p>
        <p className="pf-referral-sub">
          Share your code and earn when a friend signs up.
        </p>
      </div>
      <motion.button
        className="pf-referral-code"
        onClick={copy}
        aria-label="Copy referral code"
        type="button"
        whileTap={{ scale: 0.95 }}
      >
        <span>{code}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={copied ? "check" : "copy"}
            className="pf-referral-copy-icon"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          >
            {copied ? "✔" : <Icon.copy />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const ErrorBanner = memo(function ErrorBanner({ message, onRetry, isRetrying }) {
  return (
    <motion.div
      className="pf-error-banner"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      <span className="pf-error-icon"><Icon.wifi /></span>
      <div className="pf-error-content">
        <p className="pf-error-title">Something went wrong</p>
        <p className="pf-error-msg">{message}</p>
      </div>
      <motion.button
        className="pf-error-retry"
        onClick={onRetry}
        type="button"
        disabled={isRetrying}
        aria-disabled={isRetrying}
        whileTap={isRetrying ? {} : { scale: 0.95 }}
        whileHover={isRetrying ? {} : { scale: 1.03 }}
      >
        {isRetrying ? (
          <>
            <Icon.spinner /> Refreshing…
          </>
        ) : (
          <>
            <Icon.refresh /> Retry
          </>
        )}
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD
═══════════════════════════════════════════════════════════════ */
const resolveImage = (item) =>
  item.image || item.main_image || item.thumbnail_url || null;

const ListingCard = memo(function ListingCard({ item, onClick, index = 0 }) {
  const img = resolveImage(item);

  return (
    <motion.div
      className="pf-recent-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${item.title}`}
      onKeyDown={onActivate(onClick)}
      variants={cardItem}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: index * 0.05 }}
      whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="pf-recent-img-wrap">
        {img && (
          <img
            src={img}
            alt={item.title}
            className="pf-recent-img"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling
                ?.classList.add("pf-recent-img-placeholder--visible");
            }}
          />
        )}
        <div
          className={`pf-recent-img-placeholder${
            !img ? " pf-recent-img-placeholder--visible" : ""
          }`}
          aria-hidden="true"
        >
          <Icon.package />
        </div>

        {item.status && item.status !== "active" && (
          <span className={`pf-recent-status pf-recent-status--${item.status}`}>
            {item.status}
          </span>
        )}
        {item.is_promoted && (
          <span className="pf-recent-status pf-recent-status--promoted">
            Boosted
          </span>
        )}
      </div>

      <div className="pf-recent-info">
        <p className="pf-recent-name">{item.title}</p>
        <p className="pf-recent-price">{naira(item.price)}</p>
        <div className="pf-recent-meta">
          <span className="pf-recent-views">
            <Icon.trending />
            {fmtNum(item.views || 0)}
          </span>
          <span className="pf-recent-time">
            {timeAgo(item.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT LISTINGS SECTION
═══════════════════════════════════════════════════════════════ */
const RecentListings = memo(function RecentListings({ listings, onViewAll }) {
  const navigate = useNavigate();

  if (!listings || listings.length === 0) return null;

  const goTo = (item) => {
    const dest = item.slug ? `/product/${item.slug}` : `/product/${item.id}`;
    navigate(dest);
  };

  return (
    <motion.section
      className="pf-recent-section"
      aria-label="Your recent listings"
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: 0.1 }}
    >
      <div className="pf-recent-header">
        <h2 className="pf-recent-title">
          <span className="pf-recent-title-icon"><Icon.package /></span>
          My Recent Listings
        </h2>
        <motion.button
          className="pf-recent-viewall"
          onClick={onViewAll}
          type="button"
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.95 }}
        >
          View All <Icon.chevron />
        </motion.button>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="pf-recent-scroll pf-mobile-only" role="list">
        {listings.map((item, i) => (
          <ListingCard
            key={item.id}
            item={item}
            index={i}
            onClick={() => goTo(item)}
          />
        ))}
      </div>

      {/* Desktop: responsive grid */}
      <motion.div
        className="pf-recent-grid pf-desktop-only"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        role="list"
      >
        <Suspense
          fallback={
            <div className="pf-grid-skeleton" aria-label="Loading listings">
              {listings.map((item) => (
                <div key={item.id} className="pf-grid-skeleton-card" />
              ))}
            </div>
          }
        >
          {listings.map((item, i) => (
            <motion.div
              key={item.id}
              variants={cardItem}
              transition={{ ...spring, delay: i * 0.06 }}
              role="listitem"
            >
              <MasonryCard
                id={item.id}
                title={item.title}
                price={item.price}
                image={resolveImage(item)}
                status={item.status}
                isPromoted={item.is_promoted}
                views={item.views}
                createdAt={item.created_at}
                slug={item.slug}
                onClick={() => goTo(item)}
              />
            </motion.div>
          ))}
        </Suspense>
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM WITH ARIA
═══════════════════════════════════════════════════════════════ */
const MenuItem = memo(function MenuItem({ to, Ic, label, badge, badgeType, currentPath }) {
  const isActive = currentPath === to;

  const badgeClass =
    badgeType === "notif" ? " pf-badge-pill--notif" :
    badge === "WIN"        ? " pf-badge-pill--win"   :
    badge === "NEW"        ? " pf-badge-pill--new"   :
    badge?.startsWith?.("₦") ? " pf-badge-pill--money" : "";

  return (
    <Link
      to={to}
      className={`pf-menu-item${isActive ? " pf-menu-item--active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="pf-menu-icon"><Ic /></span>
      <span className="pf-menu-label-text">{label}</span>
      {badge && (
        <span
          className={`pf-badge-pill${badgeClass}`}
          aria-label={badgeType === "notif" ? `${badge} unread notifications` : undefined}
        >
          {badge}
        </span>
      )}
      <span className="pf-menu-chevron" aria-hidden="true"><Icon.chevron /></span>
    </Link>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR LINK WITH ARIA
═══════════════════════════════════════════════════════════════ */
const SidebarLink = memo(function SidebarLink({ to, Ic, label, badge, badgeType, currentPath }) {
  const isActive = currentPath === to;

  const badgeClass =
    badgeType === "notif" ? " pf-badge-pill--notif" :
    badge === "WIN"        ? " pf-badge-pill--win"   :
    badge === "NEW"        ? " pf-badge-pill--new"   :
    badge?.startsWith?.("₦") ? " pf-badge-pill--money" : "";

  return (
    <Link
      to={to}
      className={`pf-sidebar-link${isActive ? " pf-sidebar-link--active" : ""}`}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="pf-sidebar-link-icon"><Ic /></span>
      <span className="pf-sidebar-link-text">{label}</span>
      {badge && (
        <span
          className={`pf-badge-pill${badgeClass}`}
          aria-label={badgeType === "notif" ? `${badge} unread notifications` : undefined}
        >
          {badge}
        </span>
      )}
    </Link>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR (desktop only)
═══════════════════════════════════════════════════════════════ */
const Sidebar = memo(function Sidebar({
  user, joinedLabel, onEditProfile, onLogout, menuSections, currentPath, children,
}) {
  return (
    <motion.aside
      className="pf-sidebar"
      aria-label="Profile sidebar"
      variants={slideRight}
      initial="hidden"
      animate="visible"
      transition={{ ...spring, delay: 0.1 }}
    >
      {/* Identity card */}
      <div
        className="pf-sidebar-identity"
        onClick={onEditProfile}
        role="button"
        tabIndex={0}
        aria-label="Edit your profile"
        onKeyDown={onActivate(onEditProfile)}
      >
        <div className="pf-sidebar-avatar-wrap">
          <motion.div
            className="pf-avatar pf-sidebar-avatar"
            whileHover={{ scale: 1.05 }}
            transition={spring}
          >
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
          </motion.div>
        </div>

        <h2 className="pf-sidebar-name" title={user?.name || "User"}>
          {user?.name || "User"}
        </h2>
        <p className="pf-sidebar-store">{user?.store_name || "Loemart Member"}</p>

        <div className="pf-sidebar-meta">
          {joinedLabel && <span className="pf-meta-item">Joined {joinedLabel}</span>}
          {user?.location_state && <span className="pf-meta-item">{user.location_state}</span>}
        </div>

        <div className="pf-badges pf-sidebar-badges">
          {user?.verified      && <span className="pf-badge pf-badge--verified">Verified</span>}
          {user?.is_seller     && <span className="pf-badge pf-badge--seller">Seller</span>}
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

      {/* Referral injected as children */}
      {children}

      {/* Navigation */}
      <nav className="pf-sidebar-nav" aria-label="Profile navigation">
        {menuSections.map((section) => (
          <div key={section.title} className="pf-sidebar-section">
            <p className="pf-sidebar-section-title" id={`sidebar-${section.title}`}>
              {section.title}
            </p>
            <div role="list" aria-labelledby={`sidebar-${section.title}`}>
              {section.items.map(({ to, Ic, label, badge, badgeType }) => (
                <SidebarLink
                  key={to}
                  to={to}
                  Ic={Ic}
                  label={label}
                  badge={badge}
                  badgeType={badgeType}
                  currentPath={currentPath}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <motion.button
        className="pf-sidebar-logout"
        onClick={onLogout}
        type="button"
        whileTap={{ scale: 0.97 }}
      >
        <Icon.logout /> Log Out
      </motion.button>
    </motion.aside>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN PROFILE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Profile({ onLogout }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const currentPath = location.pathname;
  const menuRef     = useRef(null);

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [isRetrying,  setIsRetrying]  = useState(false);

  /* ── React Query: User ── */
  const {
    data:     user,
    error:    userError,
    isError:  userIsError,
    refetch:  refetchUser,
    isFetching: userFetching,
  } = useQuery({
    queryKey:  ["profile-user"],
    queryFn:   fetchUserData,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry:     (count, error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return count < 3;
    },
  });

  /* ── React Query: Listings ── */
  const {
    data:    listings = [],
    refetch: refetchListings,
  } = useQuery({
    queryKey:  ["profile-listings"],
    queryFn:   fetchUserListings,
    staleTime: 3 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry:     1,
    enabled:   !!getToken(),
  });

  /* ── React Query: Unread notifications ── */
  const { data: unreadCount = 0 } = useQuery({
    queryKey:  ["profile-unread-count"],
    queryFn:   fetchUnreadCount,
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    retry:     1,
    enabled:   !!getToken(),
    refetchInterval: 60 * 1000,
  });

  /* ── Build menu with live badge ── */
  const menuSections = buildMenuSections(unreadCount);

  /* ── Auth redirect ── */
  useEffect(() => {
    if (!getToken()) { navigate("/auth"); return; }
    if (userIsError) {
      const status = userError?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
      }
    }
  }, [userIsError, userError, navigate]);

  /* ── Outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Callbacks ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach(
      (k) => localStorage.removeItem(k)
    );
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refetchUser(), refetchListings()]);
    } finally {
      setIsRetrying(false);
    }
  }, [refetchUser, refetchListings]);

  const goEditProfile = useCallback(() => navigate("/profile/edit"), [navigate]);
  const goViewAll     = useCallback(() => navigate("/dashboard"),    [navigate]);

  /* ── Derived ── */
  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  const errorMessage =
    userIsError &&
    userError?.response?.status !== 401 &&
    userError?.response?.status !== 403
      ? userError?.response?.status >= 500
        ? "Server is temporarily unavailable. Please try again."
        : !userError?.response
        ? "Network error. Check your connection and try again."
        : "Something went wrong. Please try again."
      : null;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="pf-page" role="main">

      {/* ── Mobile header ── */}
      <div className="pf-mobile-header">
        <ProfileHeader
          title="My Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
          aria-expanded={menuOpen}
          aria-controls="pf-mobile-dropdown"
        />
      </div>

      <div className="pf-layout">

        {/* ── SIDEBAR (desktop) ── */}
        <Sidebar
          user={user}
          joinedLabel={joinedLabel}
          onEditProfile={goEditProfile}
          onLogout={logout}
          menuSections={menuSections}
          currentPath={currentPath}
        >
          <ReferralBanner code={user?.referral_code} />
        </Sidebar>

        {/* ── CONTENT ── */}
        <main className="pf-content" aria-live="polite">

          {/* Error banner */}
          <AnimatePresence>
            {errorMessage && (
              <ErrorBanner
                message={errorMessage}
                onRetry={handleRetry}
                isRetrying={isRetrying}
              />
            )}
          </AnimatePresence>

          {/* ── Quick actions bar (desktop) ── */}
          <motion.div
            className="pf-quick-bar pf-desktop-only"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ ...spring, delay: 0.15 }}
          >
            <motion.button
              className="pf-qa-btn pf-qa-btn--primary"
              onClick={() => navigate("/minimart/add")}
              type="button"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
            >
              <Icon.plus /> Post Listing
            </motion.button>
            <motion.button
              className="pf-qa-btn pf-qa-btn--outline"
              onClick={() => navigate("/dashboard")}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              <Icon.dashboard /> Dashboard
            </motion.button>
            <motion.button
              className="pf-qa-btn pf-qa-btn--outline"
              onClick={() => navigate("/conversations")}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              <Icon.messages /> Messages
            </motion.button>
          </motion.div>

          {/* ── Mobile identity card ── */}
          <motion.div
            className="pf-identity-card pf-identity-card--clickable pf-mobile-only"
            onClick={goEditProfile}
            role="button"
            tabIndex={0}
            aria-label="Edit your profile"
            onKeyDown={onActivate(goEditProfile)}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={spring}
            whileTap={{ scale: 0.98 }}
          >
            <div className="pf-edit-hint">
              <span className="pf-edit-hint-icon"><Icon.edit /></span>
              <span className="pf-edit-hint-text">Edit Profile</span>
            </div>

            <div className="pf-avatar-row">
              <motion.div
                className="pf-avatar"
                whileHover={{ scale: 1.05 }}
                transition={spring}
              >
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
              </motion.div>

              <div className="pf-identity">
                <h1 className="pf-name" title={user?.name || "User"}>
                  {user?.name || "User"}
                </h1>
                <p className="pf-store">
                  {user?.store_name || "Loemart Member"}
                </p>

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

            <div
              className="pf-quick-actions"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <motion.button
                className="pf-qa-btn pf-qa-btn--primary"
                onClick={() => navigate("/minimart/add")}
                type="button"
                whileTap={{ scale: 0.95 }}
              >
                <Icon.plus /> Post Listing
              </motion.button>
              <motion.button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/dashboard")}
                type="button"
                whileTap={{ scale: 0.95 }}
              >
                <Icon.dashboard /> Dashboard
              </motion.button>
              <motion.button
                className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/conversations")}
                type="button"
                whileTap={{ scale: 0.95 }}
              >
                <Icon.messages /> Messages
              </motion.button>
            </div>
          </motion.div>

          {/* ── Recent listings ── */}
          <RecentListings listings={listings} onViewAll={goViewAll} />

          {/* ── Referral: mobile only ── */}
          <div className="pf-mobile-only">
            <ReferralBanner code={user?.referral_code} />
          </div>

          {/* ── Menu sections: mobile only ── */}
          <div className="pf-mobile-only">
            {menuSections.map((section, si) => (
              <motion.section
                key={section.title}
                className="pf-menu-section"
                variants={fadeIn}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
                transition={{ ...spring, delay: si * 0.04 }}
              >
                <p
                  className="pf-menu-label"
                  id={`menu-${section.title}`}
                >
                  {section.title}
                </p>
                <div
                  className="pf-menu-list"
                  role="list"
                  aria-labelledby={`menu-${section.title}`}
                >
                  {section.items.map(({ to, Ic, label, badge, badgeType }) => (
                    <MenuItem
                      key={to}
                      to={to}
                      Ic={Ic}
                      label={label}
                      badge={badge}
                      badgeType={badgeType}
                      currentPath={currentPath}
                    />
                  ))}
                </div>
              </motion.section>
            ))}

            <motion.button
              className="pf-logout"
              onClick={logout}
              type="button"
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              whileTap={{ scale: 0.97 }}
            >
              <Icon.logout /> Log Out
            </motion.button>
          </div>

          <p className="pf-footer">
            Loemart Technologies Ltd · {new Date().getFullYear()}
          </p>

        </main>
      </div>
    </div>
  );
}