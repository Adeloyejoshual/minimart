import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  lazy,
  Suspense,
  useMemo,
} from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import "../styles/MobileProfile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "k";
  return v.toLocaleString();
};

const fmtJoined = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

const timeAgo = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
};

const onActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE USER
═══════════════════════════════════════════════════════════════ */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    phone: raw.phone || raw.phone_number || "",
    location_state:
      raw.location?.state || raw.location_state || raw.state || "",
    location_city:
      raw.location?.city || raw.location_city || raw.city || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   API FETCHERS
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
  try {
    const { data } = await axios.get(`${API}/seller-dashboard/products`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 8, page: 1, tab: "all" },
    });
    const list = data?.products || [];
    return list.slice(0, 8);
  } catch {
    return [];
  }
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

async function fetchSubscriptionStatus() {
  const token = getToken();
  if (!token) return null;
  try {
    const { data } = await axios.get(`${API}/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DRAG SCROLL HOOK
═══════════════════════════════════════════════════════════════ */
function useDragScroll() {
  const ref = useRef(null);
  const state = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasDragged: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const DRAG_THRESHOLD = 5;

    const onTouchStart = (e) => {
      state.current.isDown = true;
      state.current.hasDragged = false;
      state.current.startX = e.touches[0].pageX - el.offsetLeft;
      state.current.scrollLeft = el.scrollLeft;
    };

    const onTouchEnd = () => {
      state.current.isDown = false;
    };

    const onTouchMove = (e) => {
      if (!state.current.isDown) return;
      const x = e.touches[0].pageX - el.offsetLeft;
      const walk = x - state.current.startX;
      if (Math.abs(walk) > DRAG_THRESHOLD) {
        state.current.hasDragged = true;
      }
      el.scrollLeft = state.current.scrollLeft - walk * 1.2;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return ref;
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATION CONFIG
═══════════════════════════════════════════════════════════════ */
const spring = { type: "spring", stiffness: 300, damping: 28 };
const gentleSpring = { type: "spring", stiffness: 200, damping: 22 };
const viewportOnce = { once: true, amount: 0.15 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const fadeScale = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const cardReveal = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/* ═══════════════════════════════════════════════════════════════
   ICONS (Mobile-optimized SVGs with larger touch targets)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  chevron: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  saved: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  messages: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  trending: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  gift: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  help: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  zap: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  notify: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  support: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z" />
    </svg>
  ),
  copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  wifi: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  package: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  spinner: () => (
    <svg className="mp-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  crown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  ),
  diamond: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M11 3l1 6" />
      <path d="M2 9h20" />
    </svg>
  ),
  camera: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  arrowUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  sparkle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41Z" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION BADGE MAP
═══════════════════════════════════════════════════════════════ */
const SUB_BADGE_MAP = {
  premium: { label: "Premium", className: "mp-sub-badge--premium", gradient: "linear-gradient(135deg, #667eea, #764ba2)" },
  pro: { label: "Pro", className: "mp-sub-badge--pro", gradient: "linear-gradient(135deg, #f093fb, #f5576c)" },
  business: { label: "Business", className: "mp-sub-badge--business", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)" },
  elite: { label: "Elite", className: "mp-sub-badge--elite", gradient: "linear-gradient(135deg, #FFD700, #FFA500)" },
  diamond: { label: "Diamond", className: "mp-sub-badge--diamond", gradient: "linear-gradient(135deg, #a8edea, #fed6e3)" },
};

/* ═══════════════════════════════════════════════════════════════
   IMAGE RESOLVER
═══════════════════════════════════════════════════════════════ */
const resolveImage = (item) => {
  if (!item) return null;
  if (item.image) return item.image;
  if (item.main_image) return item.main_image;
  if (item.thumbnail_url) return item.thumbnail_url;
  if (Array.isArray(item.images) && item.images.length > 0) {
    const first = item.images[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG
═══════════════════════════════════════════════════════════════ */
const buildMenuSections = (unreadCount = 0, subStatus = null) => [
  {
    title: "Selling",
    icon: <Icon.trending />,
    items: [
      { to: "/dashboard", Ic: Icon.dashboard, label: "Seller Dashboard", desc: "Manage your store" },
      { to: "/minimart/add", Ic: Icon.plus, label: "Post a Listing", badge: "NEW", desc: "Create new listing" },
      {
        to: "/seller/subscription",
        Ic: Icon.crown,
        label: "Subscription",
        badge: subStatus?.isActive ? subStatus.planBadge || "PRO" : null,
        badgeType: subStatus?.isActive ? "sub" : undefined,
        desc: "Manage your plan",
      },
      { to: "/leaderboard", Ic: Icon.trending, label: "Leaderboard", desc: "Top sellers" },
    ],
  },
  {
    title: "Buying",
    icon: <Icon.saved />,
    items: [
      { to: "/saved", Ic: Icon.saved, label: "Saved Items", desc: "Your wishlist" },
      { to: "/conversations", Ic: Icon.messages, label: "Messages", desc: "Chat with sellers" },
    ],
  },
  {
    title: "Rewards",
    icon: <Icon.gift />,
    items: [
      { to: "/spin", Ic: Icon.zap, label: "Spin & Win", badge: "WIN", desc: "Try your luck" },
      { to: "/coupons", Ic: Icon.gift, label: "Coupons & Promos", desc: "Available offers" },
      { to: "/invitation", Ic: Icon.gift, label: "Refer & Earn", badge: "₦500", desc: "Invite friends" },
    ],
  },
  {
    title: "Account",
    icon: <Icon.settings />,
    items: [
      { to: "/settings", Ic: Icon.settings, label: "Settings", desc: "App preferences" },
      { to: "/verification", Ic: Icon.shield, label: "Verification", desc: "Verify your identity" },
      {
        to: "/notifications",
        Ic: Icon.notify,
        label: "Notifications",
        badge:
          unreadCount > 0
            ? unreadCount > 99
              ? "99+"
              : String(unreadCount)
            : null,
        badgeType: "notif",
        desc: "Stay updated",
      },
      { to: "/support", Ic: Icon.support, label: "Help & Support", desc: "Get assistance" },
      { to: "/faq", Ic: Icon.help, label: "FAQ", desc: "Common questions" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   GLASSMORPHISM STAT PILL
═══════════════════════════════════════════════════════════════ */
const StatPill = memo(function StatPill({ icon, value, label, delay = 0 }) {
  return (
    <motion.div
      className="mp-stat-pill"
      variants={fadeScale}
      transition={{ ...spring, delay }}
    >
      <span className="mp-stat-pill__icon">{icon}</span>
      <div className="mp-stat-pill__content">
        <span className="mp-stat-pill__value">{value}</span>
        <span className="mp-stat-pill__label">{label}</span>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HERO PROFILE CARD (Glassmorphism + parallax)
═══════════════════════════════════════════════════════════════ */
const HeroProfileCard = memo(function HeroProfileCard({
  user,
  joinedLabel,
  subStatus,
  onEdit,
  listingsCount,
}) {
  const navigate = useNavigate();

  return (
    <motion.section
      className="mp-hero"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...gentleSpring, delay: 0.05 }}
    >
      {/* Ambient background orbs */}
      <div className="mp-hero__orbs" aria-hidden="true">
        <div className="mp-hero__orb mp-hero__orb--1" />
        <div className="mp-hero__orb mp-hero__orb--2" />
        <div className="mp-hero__orb mp-hero__orb--3" />
      </div>

      {/* Edit button floating */}
      <motion.button
        className="mp-hero__edit-fab"
        onClick={onEdit}
        aria-label="Edit profile"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.1 }}
      >
        <Icon.edit />
      </motion.button>

      {/* Avatar section */}
      <div className="mp-hero__avatar-section">
        <motion.div
          className="mp-hero__avatar"
          whileTap={{ scale: 0.95 }}
          transition={spring}
        >
          <div className="mp-hero__avatar-ring" />
          {user?.profile_image ? (
            <img
              src={user.profile_image}
              alt={user?.name}
              className="mp-hero__avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <span
            className="mp-hero__avatar-fallback"
            style={{ display: user?.profile_image ? "none" : "flex" }}
          >
            {(user?.name || "U").charAt(0).toUpperCase()}
          </span>
          <span className="mp-hero__online-dot" title="Online" />

          {/* Camera overlay */}
          <motion.button
            className="mp-hero__camera"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Change photo"
            whileTap={{ scale: 0.85 }}
          >
            <Icon.camera />
          </motion.button>
        </motion.div>
      </div>

      {/* Name & info */}
      <div className="mp-hero__info">
        <h1 className="mp-hero__name">{user?.name || "User"}</h1>
        <p className="mp-hero__store">{user?.store_name || "Loemart Member"}</p>

        {/* Badges row */}
        <div className="mp-hero__badges">
          {user?.verified && (
            <motion.span
              className="mp-badge mp-badge--verified"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.2 }}
            >
              ✓ Verified
            </motion.span>
          )}
          {user?.is_seller && (
            <motion.span
              className="mp-badge mp-badge--seller"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.25 }}
            >
              Seller
            </motion.span>
          )}
          {user?.is_top_seller && (
            <motion.span
              className="mp-badge mp-badge--top"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.3 }}
            >
              ⭐ Top Seller
            </motion.span>
          )}
          {subStatus?.isActive && SUB_BADGE_MAP[subStatus.plan] && (
            <motion.span
              className={`mp-badge mp-sub-badge ${SUB_BADGE_MAP[subStatus.plan].className}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...spring, delay: 0.35 }}
            >
              <Icon.crown />
              {SUB_BADGE_MAP[subStatus.plan].label}
            </motion.span>
          )}
        </div>

        {/* Meta info */}
        <div className="mp-hero__meta">
          {joinedLabel && (
            <span className="mp-hero__meta-item">📅 Joined {joinedLabel}</span>
          )}
          {user?.location_state && (
            <span className="mp-hero__meta-item">📍 {user.location_state}</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <motion.div
        className="mp-hero__stats"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {user?.rating != null && (
          <StatPill
            icon={<Icon.star />}
            value={Number(user.rating).toFixed(1)}
            label="Rating"
            delay={0.1}
          />
        )}
        <StatPill
          icon={<Icon.package />}
          value={fmtNum(listingsCount)}
          label="Listings"
          delay={0.15}
        />
        <StatPill
          icon={<Icon.eye />}
          value={fmtNum(user?.total_views || 0)}
          label="Views"
          delay={0.2}
        />
      </motion.div>

      {/* Quick actions */}
      <motion.div
        className="mp-hero__actions"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ ...spring, delay: 0.25 }}
      >
        <motion.button
          className="mp-action-btn mp-action-btn--primary"
          onClick={() => navigate("/minimart/add")}
          whileTap={{ scale: 0.95 }}
        >
          <Icon.plus />
          <span>Post Listing</span>
        </motion.button>
        <motion.button
          className="mp-action-btn mp-action-btn--glass"
          onClick={() => navigate("/dashboard")}
          whileTap={{ scale: 0.95 }}
        >
          <Icon.dashboard />
          <span>Dashboard</span>
        </motion.button>
        <motion.button
          className="mp-action-btn mp-action-btn--glass"
          onClick={() => navigate("/conversations")}
          whileTap={{ scale: 0.95 }}
        >
          <Icon.messages />
          <span>Messages</span>
        </motion.button>
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION CARD (Elite glassmorphism)
═══════════════════════════════════════════════════════════════ */
const MobileSubscriptionCard = memo(function MobileSubscriptionCard({ sub, onClick }) {
  if (!sub) return null;

  const isActive = sub.isActive;
  const badge = SUB_BADGE_MAP[sub.plan];

  return (
    <motion.div
      className={`mp-sub-card ${isActive ? "mp-sub-card--active" : "mp-sub-card--free"}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Manage subscription"
      onKeyDown={onActivate(onClick)}
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: 0.08 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="mp-sub-card__glow" aria-hidden="true" />

      <div className="mp-sub-card__left">
        <div className={`mp-sub-card__icon ${isActive ? "mp-sub-card__icon--active" : ""}`}>
          {isActive ? <Icon.crown /> : <Icon.diamond />}
        </div>
        <div className="mp-sub-card__info">
          {isActive && badge ? (
            <>
              <span className="mp-sub-card__plan">{badge.label} Plan</span>
              <span className="mp-sub-card__status">
                <span className="mp-sub-card__dot" /> Active
              </span>
            </>
          ) : (
            <>
              <span className="mp-sub-card__plan">Free Plan</span>
              <span className="mp-sub-card__cta">
                <Icon.sparkle />
                Upgrade now
              </span>
            </>
          )}
        </div>
      </div>

      <span className="mp-sub-card__arrow">
        <Icon.chevron />
      </span>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REFERRAL CARD (Elite style)
═══════════════════════════════════════════════════════════════ */
const MobileReferralCard = memo(function MobileReferralCard({ code }) {
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
      className="mp-referral"
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: 0.1 }}
    >
      <div className="mp-referral__shimmer" aria-hidden="true" />

      <div className="mp-referral__content">
        <div className="mp-referral__icon-wrap">
          <Icon.gift />
        </div>
        <div className="mp-referral__text">
          <h3 className="mp-referral__title">Refer & Earn ₦500</h3>
          <p className="mp-referral__desc">
            Share your code · friends sign up · you earn!
          </p>
        </div>
      </div>

      <motion.button
        className="mp-referral__code-btn"
        onClick={copy}
        aria-label="Copy referral code"
        whileTap={{ scale: 0.95 }}
      >
        <span className="mp-referral__code">{code}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={copied ? "check" : "copy"}
            className="mp-referral__copy-icon"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            {copied ? "✓" : <Icon.copy />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD (Mobile-optimized)
═══════════════════════════════════════════════════════════════ */
const MobileListingCard = memo(function MobileListingCard({ item, onClick, index = 0 }) {
  const img = resolveImage(item);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      className="mp-listing-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${item.title}`}
      onKeyDown={onActivate(onClick)}
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.04 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="mp-listing-card__img-wrap">
        {img && !imgError ? (
          <img
            src={img}
            alt={item.title}
            className="mp-listing-card__img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="mp-listing-card__placeholder">
            <Icon.package />
          </div>
        )}

        {item.status && !item.status.startsWith("active") && (
          <span className={`mp-listing-card__status mp-listing-card__status--${item.status.split("_")[0]}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}
        {item.is_promoted && (
          <span className="mp-listing-card__status mp-listing-card__status--promoted">
            <Icon.zap /> Boosted
          </span>
        )}
      </div>

      <div className="mp-listing-card__body">
        <p className="mp-listing-card__title">{item.title}</p>
        <p className="mp-listing-card__price">{naira(item.price)}</p>
        <div className="mp-listing-card__meta">
          <span className="mp-listing-card__views">
            <Icon.eye /> {fmtNum(item.views || 0)}
          </span>
          <span className="mp-listing-card__time">{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT LISTINGS SECTION
═══════════════════════════════════════════════════════════════ */
const MobileRecentListings = memo(function MobileRecentListings({ listings, onViewAll }) {
  const navigate = useNavigate();
  const scrollRef = useDragScroll();

  if (!listings || listings.length === 0) return null;

  const goTo = (item) => {
    navigate(item.slug ? `/product/${item.slug}` : `/product/${item.id}`);
  };

  return (
    <motion.section
      className="mp-listings-section"
      aria-label="Your recent listings"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={{ ...spring, delay: 0.08 }}
    >
      <div className="mp-section-header">
        <div className="mp-section-header__left">
          <span className="mp-section-header__icon">
            <Icon.package />
          </span>
          <div>
            <h2 className="mp-section-header__title">My Listings</h2>
            <p className="mp-section-header__count">{listings.length} items</p>
          </div>
        </div>
        <motion.button
          className="mp-section-header__action"
          onClick={onViewAll}
          whileTap={{ scale: 0.95 }}
        >
          View All <Icon.chevron />
        </motion.button>
      </div>

      <motion.div
        className="mp-listings-scroll"
        ref={scrollRef}
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        role="list"
        aria-label="Recent listings"
      >
        {listings.map((item, i) => (
          <MobileListingCard
            key={item.id}
            item={item}
            index={i}
            onClick={() => goTo(item)}
          />
        ))}
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM (Elite glassmorphism)
═══════════════════════════════════════════════════════════════ */
const MobileMenuItem = memo(function MobileMenuItem({
  to, Ic, label, desc, badge, badgeType, currentPath, index = 0,
}) {
  const isActive = currentPath === to;
  const badgeClass =
    badgeType === "notif" ? " mp-pill--notif"
    : badgeType === "sub" ? " mp-pill--sub"
    : badge === "WIN" ? " mp-pill--win"
    : badge === "NEW" ? " mp-pill--new"
    : badge?.startsWith?.("₦") ? " mp-pill--money"
    : "";

  return (
    <motion.div variants={cardReveal} transition={{ ...spring, delay: index * 0.03 }}>
      <Link
        to={to}
        className={`mp-menu-item${isActive ? " mp-menu-item--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={`mp-menu-item__icon${isActive ? " mp-menu-item__icon--active" : ""}`}>
          <Ic />
        </span>
        <div className="mp-menu-item__content">
          <span className="mp-menu-item__label">{label}</span>
          {desc && <span className="mp-menu-item__desc">{desc}</span>}
        </div>
        {badge && (
          <span className={`mp-pill${badgeClass}`} aria-label={
            badgeType === "notif" ? `${badge} unread notifications` : undefined
          }>
            {badge}
          </span>
        )}
        <span className="mp-menu-item__chevron" aria-hidden="true">
          <Icon.chevron />
        </span>
      </Link>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const MobileErrorBanner = memo(function MobileErrorBanner({ message, onRetry, isRetrying }) {
  return (
    <motion.div
      className="mp-error"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={spring}
    >
      <div className="mp-error__top">
        <span className="mp-error__icon"><Icon.wifi /></span>
        <div className="mp-error__text">
          <p className="mp-error__title">Connection Issue</p>
          <p className="mp-error__msg">{message}</p>
        </div>
      </div>
      <motion.button
        className="mp-error__retry"
        onClick={onRetry}
        disabled={isRetrying}
        whileTap={isRetrying ? {} : { scale: 0.95 }}
      >
        {isRetrying ? (
          <><Icon.spinner /> Refreshing…</>
        ) : (
          <><Icon.refresh /> Tap to Retry</>
        )}
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════════════════════════ */
const ListingSkeleton = memo(function ListingSkeleton() {
  return (
    <div className="mp-skeleton-row" aria-label="Loading listings">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="mp-skeleton-card">
          <div className="mp-skeleton-card__img mp-shimmer" />
          <div className="mp-skeleton-card__body">
            <div className="mp-skeleton-card__line mp-skeleton-card__line--title mp-shimmer" />
            <div className="mp-skeleton-card__line mp-skeleton-card__line--price mp-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SCROLL-TO-TOP FAB
═══════════════════════════════════════════════════════════════ */
const ScrollToTop = memo(function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          className="mp-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0, y: 20 }}
          transition={spring}
          whileTap={{ scale: 0.85 }}
        >
          <Icon.arrowUp />
        </motion.button>
      )}
    </AnimatePresence>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN: MOBILE PROFILE
═══════════════════════════════════════════════════════════════ */
export default function MobileProfile({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const menuRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  /* ── Queries ── */
  const {
    data: user,
    error: userError,
    isError: userIsError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["profile-user"],
    queryFn: fetchUserData,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (count, error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return count < 3;
    },
  });

  const {
    data: listings = [],
    isLoading: listingsLoading,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ["profile-listings"],
    queryFn: fetchUserListings,
    staleTime: 3 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: !!getToken(),
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["profile-unread-count"],
    queryFn: fetchUnreadCount,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!getToken(),
    refetchInterval: 60 * 1000,
  });

  const { data: subStatus = null } = useQuery({
    queryKey: ["profile-subscription-status"],
    queryFn: fetchSubscriptionStatus,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!getToken(),
  });

  const menuSections = useMemo(
    () => buildMenuSections(unreadCount, subStatus),
    [unreadCount, subStatus]
  );

  /* ── Auth redirect ── */
  useEffect(() => {
    if (!getToken()) {
      navigate("/auth");
      return;
    }
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
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  /* ── Callbacks ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) =>
      localStorage.removeItem(k)
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
  const goViewAll = useCallback(() => navigate("/dashboard"), [navigate]);

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  const errorMessage =
    userIsError &&
    userError?.response?.status !== 401 &&
    userError?.response?.status !== 403
      ? userError?.response?.status >= 500
        ? "Server is temporarily unavailable."
        : !userError?.response
        ? "Network error. Check your connection."
        : "Something went wrong."
      : null;

  /* ═════════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════════ */
  return (
    <div className="mp-page" role="main">
      {/* ── Sticky header ── */}
      <div className="mp-header-wrap">
        <ProfileHeader
          title="My Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onEdit={goEditProfile}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
        />
      </div>

      {/* ── Scrollable content ── */}
      <div className="mp-scroll-container">
        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <MobileErrorBanner
              message={errorMessage}
              onRetry={handleRetry}
              isRetrying={isRetrying}
            />
          )}
        </AnimatePresence>

        {/* Hero profile card */}
        <HeroProfileCard
          user={user}
          joinedLabel={joinedLabel}
          subStatus={subStatus}
          onEdit={goEditProfile}
          listingsCount={listings.length}
        />

        {/* Listings */}
        {listingsLoading ? (
          <ListingSkeleton />
        ) : (
          <MobileRecentListings
            listings={listings}
            onViewAll={goViewAll}
          />
        )}

        {/* Subscription */}
        <MobileSubscriptionCard
          sub={subStatus}
          onClick={() =>
            navigate(
              subStatus?.isActive
                ? "/seller/subscription"
                : "/seller/subscription/plans"
            )
          }
        />

        {/* Referral */}
        <MobileReferralCard code={user?.referral_code} />

        {/* ── Menu sections ── */}
        <div className="mp-menu-container">
          {menuSections.map((section, si) => (
            <motion.section
              key={section.title}
              className="mp-menu-section"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              transition={{ ...spring, delay: si * 0.04 }}
            >
              <div className="mp-menu-section__header">
                <span className="mp-menu-section__icon">{section.icon}</span>
                <h3 className="mp-menu-section__title" id={`mp-menu-${section.title}`}>
                  {section.title}
                </h3>
              </div>

              <motion.div
                className="mp-menu-section__list"
                role="list"
                aria-labelledby={`mp-menu-${section.title}`}
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={viewportOnce}
              >
                {section.items.map(({ to, Ic, label, desc, badge, badgeType }, i) => (
                  <MobileMenuItem
                    key={to}
                    to={to}
                    Ic={Ic}
                    label={label}
                    desc={desc}
                    badge={badge}
                    badgeType={badgeType}
                    currentPath={currentPath}
                    index={i}
                  />
                ))}
              </motion.div>
            </motion.section>
          ))}

          {/* Logout */}
          <motion.button
            className="mp-logout"
            onClick={logout}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            whileTap={{ scale: 0.97 }}
          >
            <Icon.logout />
            <span>Log Out</span>
          </motion.button>
        </div>

        {/* Footer */}
        <p className="mp-footer">
          Loemart Technologies Ltd · {new Date().getFullYear()}
        </p>
      </div>

      {/* Scroll to top FAB */}
      <ScrollToTop />
    </div>
  );
}
