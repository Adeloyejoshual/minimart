// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile.jsx
// ════════════════════════════════════════════════════════════

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  useMemo,
} from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, animate } from "framer-motion";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import BottomNav     from "../components/BottomNav";
import "../styles/Profile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const REFERRAL_BASE    = "https://loemart.com/invite";
const MAX_LISTINGS     = 8;
const PTR_THRESHOLD    = 80;
const UNREAD_INTERVAL  = 60_000;

const STATUS = {
  LOADING: "loading",
  ERROR:   "error",
  SUCCESS: "success",
};

/* ═══════════════════════════════════════════════════════════════
   QUERY KEYS — centralised so invalidation is exact
═══════════════════════════════════════════════════════════════ */
const QK = {
  user:         ["profile-user"],
  listings:     ["profile-listings"],
  unread:       ["profile-unread-count"],
  subscription: ["profile-subscription-status"],
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + "k";
  return v.toLocaleString();
};

const fmtJoined = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", {
      month: "long",
      year:  "numeric",
    });
  } catch {
    return null;
  }
};

const timeAgo = (d) => {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    day:   "numeric",
  });
};

const onActivate = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

const resolveImage = (item) => {
  if (!item) return null;
  if (item.image)         return item.image;
  if (item.main_image)    return item.main_image;
  if (item.thumbnail_url) return item.thumbnail_url;
  if (Array.isArray(item.images) && item.images.length > 0) {
    const f = item.images[0];
    return typeof f === "string" ? f : f?.url ?? null;
  }
  return null;
};

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const clearTokens = () => {
  localStorage.removeItem("marketplace_token");
  localStorage.removeItem("token");
};

const isAuthError = (status) => status === 401 || status === 403;

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE USER
═══════════════════════════════════════════════════════════════ */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    phone:          raw.phone || raw.phone_number || "",
    location_state: raw.location?.state || raw.location_state || raw.state || "",
    location_city:  raw.location?.city  || raw.location_city  || raw.city  || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   API FETCHERS
═══════════════════════════════════════════════════════════════ */
const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

async function fetchUserData() {
  const token = getToken();
  if (!token) throw new Error("NO_TOKEN");
  const { data } = await axios.get(`${API}/users/me`, {
    headers: authHeaders(),
  });
  return normalizeUser(data);
}

async function fetchUserListings() {
  if (!getToken()) return [];
  try {
    const { data } = await axios.get(`${API}/seller-dashboard/products`, {
      headers: authHeaders(),
      params:  { limit: MAX_LISTINGS, page: 1, tab: "all" },
    });
    return (data?.products ?? []).slice(0, MAX_LISTINGS);
  } catch {
    return [];
  }
}

async function fetchUnreadCount() {
  if (!getToken()) return 0;
  try {
    const { data } = await axios.get(`${API}/notifications/unread-count`, {
      headers: authHeaders(),
    });
    return Number(data?.count ?? data?.unread ?? 0);
  } catch {
    return 0;
  }
}

async function fetchSubscriptionStatus() {
  if (!getToken()) return null;
  try {
    const { data } = await axios.get(`${API}/subscription/status`, {
      headers: authHeaders(),
    });
    return data;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION MAP
═══════════════════════════════════════════════════════════════ */
const SUB_MAP = {
  premium:  { label: "Premium",  gradient: "linear-gradient(135deg,#667eea,#764ba2)" },
  pro:      { label: "Pro",      gradient: "linear-gradient(135deg,#f093fb,#f5576c)" },
  business: { label: "Business", gradient: "linear-gradient(135deg,#4facfe,#00f2fe)" },
  elite:    { label: "Elite",    gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
  diamond:  { label: "Diamond",  gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG
═══════════════════════════════════════════════════════════════ */
const buildMenuSections = (unreadCount = 0, subStatus = null) => [
  {
    title: "Selling",
    icon:  "trending",
    color: "var(--o)",
    items: [
      {
        to:    "/dashboard",
        icon:  "dashboard",
        label: "Seller Dashboard",
        desc:  "Manage your store",
      },
      {
        to:    "/minimart/add",
        icon:  "plus",
        label: "Post a Listing",
        badge: "NEW",
        desc:  "Create new listing",
      },
      {
        to:        "/seller/subscription",
        icon:      "crown",
        label:     "Subscription",
        badge:     subStatus?.isActive ? (subStatus.planBadge || "PRO") : null,
        badgeType: subStatus?.isActive ? "sub" : undefined,
        desc:      "Manage your plan",
      },
      {
        to:    "/leaderboard",
        icon:  "trophy",
        label: "Leaderboard",
        desc:  "Top sellers",
      },
    ],
  },
  {
    title: "Buying",
    icon:  "saved",
    color: "var(--dp-pink)",
    items: [
      {
        to:    "/saved",
        icon:  "saved",
        label: "Saved Items",
        desc:  "Your wishlist",
      },
      {
        to:    "/conversations",
        icon:  "messages",
        label: "Messages",
        desc:  "Chat with sellers",
      },
    ],
  },
  {
    title: "Rewards",
    icon:  "gift",
    color: "#d97706",
    items: [
      {
        to:    "/spin",
        icon:  "zap",
        label: "Spin & Win",
        badge: "WIN",
        desc:  "Try your luck",
      },
      {
        to:    "/coupons",
        icon:  "gift",
        label: "Coupons & Promos",
        desc:  "Available offers",
      },
      {
        to:    "/invitation",
        icon:  "trophy",
        label: "Refer & Earn",
        badge: "₦15k",
        desc:  "Invite friends, win leaderboard",
      },
    ],
  },
  {
    title: "Account",
    icon:  "settings",
    color: "var(--gn)",
    items: [
      {
        to:    "/settings",
        icon:  "settings",
        label: "Settings",
        desc:  "App preferences",
      },
      {
        to:    "/verification",
        icon:  "shield",
        label: "Verification",
        desc:  "Verify your identity",
      },
      {
        to:        "/notifications",
        icon:      "notify",
        label:     "Notifications",
        badge:     unreadCount > 0
          ? (unreadCount > 99 ? "99+" : String(unreadCount))
          : null,
        badgeType: "notif",
        desc:      "Stay updated",
      },
      {
        to:    "/help",
        icon:  "help",
        label: "Help Center",
        desc:  "Browse FAQs and articles",
      },
      {
        to:    "/support",
        icon:  "support",
        label: "Help & Support",
        desc:  "Tickets, disputes, appeals",
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   ANIMATION PRESETS
═══════════════════════════════════════════════════════════════ */
const spring     = { type: "spring", stiffness: 320, damping: 28 };
const softSpring = { type: "spring", stiffness: 200, damping: 24 };
const popSpring  = { type: "spring", stiffness: 420, damping: 22 };
const viewOnce   = { once: true, amount: 0.12 };

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0  },
};

const fadeScale = {
  hidden:  { opacity: 0, scale: 0.88 },
  visible: { opacity: 1, scale: 1    },
};

const stagger = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

const cardReveal = {
  hidden:  { opacity: 0, y: 22, scale: 0.94 },
  visible: { opacity: 1, y: 0,  scale: 1    },
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const ICONS = {
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5"  x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),
  saved: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5
               0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
               1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  trending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  notify: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0
               1-8.63-3.07A19.5 19.5 0 0 1 4.69 12
               19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2
               1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45
               2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45
               c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5"  r="3" />
      <circle cx="6"  cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14
                       18.18 21.02 12 17.77 5.82 21.02
                       7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0
               1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
               1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09
               A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33
               l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06
               A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3
               a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9
               a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1
               2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68
               a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09
               a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0
               1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06
               A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0
               1.51 1H21a2 2 0 0 1 0 4h-.09
               a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36
               A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  wifi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7
               4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0
               2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M11 3l1 6" />
      <path d="M2 9h20" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8
               a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22
               L9.41 13.59L1 11L9.41 8.41Z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21
               C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21
               C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07
               l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07
               l1.71-1.71" />
    </svg>
  ),
};

/* Convenience wrapper — renders icon by string key */
const Ico = ({ name, className, style }) => (
  <span className={className} style={style} aria-hidden="true">
    {ICONS[name] ?? null}
  </span>
);

/* ═══════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════ */

/* Animated counter */
function useAnimatedCounter(to, duration = 1.2) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from   = prev.current;
    prev.current = to;
    if (from === to) return;
    const ctrl = animate(from, to, {
      duration,
      ease:     [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });
    return () => ctrl.stop();
  }, [to, duration]);

  return display;
}

/* Pull-to-refresh */
function usePullToRefresh(onRefresh, threshold = PTR_THRESHOLD) {
  const [pulling,    setPulling]    = useState(false);
  const [pullY,      setPullY]      = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY       = useRef(null);
  const isPulling    = useRef(false);
  const pullYRef     = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop > 0) {
        startY.current    = null;
        isPulling.current = false;
        return;
      }
      startY.current    = e.touches[0].clientY;
      isPulling.current = false;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        startY.current    = null;
        isPulling.current = false;
        return;
      }
      isPulling.current = true;
      const resistance  = Math.min(delta * 0.45, threshold * 1.4);
      pullYRef.current  = resistance;
      setPulling(true);
      setPullY(resistance);
    };

    const onTouchEnd = async () => {
      const currentY = pullYRef.current;

      if (!isPulling.current) {
        setPulling(false);
        setPullY(0);
        pullYRef.current  = 0;
        startY.current    = null;
        return;
      }

      if (currentY >= threshold) {
        setRefreshing(true);
        setPullY(threshold * 0.6);
        pullYRef.current = threshold * 0.6;
        try   { await onRefresh(); }
        finally { setRefreshing(false); }
      }

      setPulling(false);
      setPullY(0);
      pullYRef.current  = 0;
      startY.current    = null;
      isPulling.current = false;
    };

    el.addEventListener("touchstart",  onTouchStart,  { passive: true });
    el.addEventListener("touchmove",   onTouchMove,   { passive: true });
    el.addEventListener("touchend",    onTouchEnd,    { passive: true });
    el.addEventListener("touchcancel", onTouchEnd,    { passive: true });

    return () => {
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, threshold]);

  return { containerRef, pullY, pulling, refreshing };
}

/* Drag-to-scroll horizontal list */
function useDragScroll() {
  const ref   = useRef(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e) => {
      state.current = {
        isDown:     true,
        startX:     e.touches[0].pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
    };

    const onTouchEnd = () => {
      state.current.isDown = false;
    };

    const onTouchMove = (e) => {
      if (!state.current.isDown) return;
      const x       = e.touches[0].pageX - el.offsetLeft;
      el.scrollLeft = state.current.scrollLeft -
                      (x - state.current.startX) * 1.1;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend",   onTouchEnd);
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend",   onTouchEnd);
      el.removeEventListener("touchmove",  onTouchMove);
    };
  }, []);

  return ref;
}

/* ═══════════════════════════════════════════════════════════════
   PULL INDICATOR
═══════════════════════════════════════════════════════════════ */
const PullIndicator = memo(function PullIndicator({
  pullY,
  refreshing,
  threshold = PTR_THRESHOLD,
}) {
  const progress      = Math.min(pullY / threshold, 1);
  const circumference = 2 * Math.PI * 10;
  const dash          = circumference * progress;

  return (
    <AnimatePresence>
      {(pullY > 8 || refreshing) && (
        <motion.div
          className="mp-ptr"
          style={{ height: pullY }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="mp-ptr__inner">
            {refreshing ? (
              <div className="mp-ptr__spinner" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24"
                aria-hidden="true">
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="var(--bd)"
                  strokeWidth="2"
                />
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="var(--o)"
                  strokeWidth="2"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeLinecap="round"
                  style={{
                    transform:       "rotate(-90deg)",
                    transformOrigin: "center",
                  }}
                />
              </svg>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ═══════════════════════════════════════════════════════════════
   STAT PILL
═══════════════════════════════════════════════════════════════ */
const StatPill = memo(function StatPill({ iconName, value, label, delay = 0 }) {
  return (
    <motion.div
      className="mp-stat"
      variants={fadeScale}
      transition={{ ...spring, delay }}
    >
      <Ico name={iconName} className="mp-stat__icon" />
      <div className="mp-stat__content">
        <span className="mp-stat__value">{value}</span>
        <span className="mp-stat__label">{label}</span>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HERO CARD
═══════════════════════════════════════════════════════════════ */
const HeroProfileCard = memo(function HeroProfileCard({
  user,
  joinedLabel,
  subStatus,
  onEdit,
  listingsCount,
}) {
  const navigate = useNavigate();
  const sub      = subStatus?.isActive ? SUB_MAP[subStatus.plan] : null;

  return (
    <motion.section
      className="mp-hero"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...softSpring, delay: 0.05 }}
      aria-label="Profile overview"
    >
      {/* Background decorations */}
      <div className="mp-hero__bg" aria-hidden="true">
        <div className="mp-orb mp-orb--1" />
        <div className="mp-orb mp-orb--2" />
        <div className="mp-orb mp-orb--3" />
        <div className="mp-hero__mesh" />
      </div>

      {/* Edit button */}
      <motion.button
        className="mp-hero__edit"
        onClick={onEdit}
        aria-label="Edit profile"
        whileTap={{ scale: 0.9 }}
      >
        {ICONS.edit}
        <span>Edit</span>
      </motion.button>

      {/* Avatar */}
      <div className="mp-avatar-section">
        <motion.div
          className="mp-avatar-wrap"
          whileTap={{ scale: 0.95 }}
        >
          <div
            className="mp-avatar-ring"
            style={sub ? { background: sub.gradient } : undefined}
            aria-hidden="true"
          />
          <div className="mp-avatar">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt={user?.name ?? "Profile photo"}
                className="mp-avatar__img"
              />
            ) : (
              <span className="mp-avatar__letter" aria-hidden="true">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="mp-avatar__online"
            aria-label="Online"
            role="status"
          />
          <motion.button
            className="mp-avatar__cam"
            onClick={onEdit}
            aria-label="Change profile photo"
            whileTap={{ scale: 0.9 }}
          >
            {ICONS.camera}
          </motion.button>
        </motion.div>
      </div>

      {/* Info */}
      <div className="mp-hero__info">
        <h1 className="mp-hero__name">
          {user?.name || "User"}
          {user?.verified && (
            <span
              className="mp-hero__verified"
              aria-label="Verified account"
              title="Verified"
            >
              {ICONS.chevron}
            </span>
          )}
        </h1>

        <p className="mp-hero__store">
          {user?.store_name || "Loemart Member"}
        </p>

        {/* Badges */}
        <div className="mp-hero__badges" aria-label="Account badges">
          {user?.is_seller     && (
            <span className="mp-chip mp-chip--seller">Seller</span>
          )}
          {user?.is_top_seller && (
            <span className="mp-chip mp-chip--top">⭐ Top Seller</span>
          )}
          {sub && (
            <span
              className="mp-chip mp-chip--sub"
              style={{ background: sub.gradient }}
            >
              {ICONS.crown} {sub.label}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="mp-hero__meta">
          {joinedLabel && (
            <span className="mp-hero__meta-item">
              <Ico name="calendar" className="mp-hero__meta-icon" />
              Joined {joinedLabel}
            </span>
          )}
          {user?.location_state && (
            <span className="mp-hero__meta-item">
              <Ico name="mapPin" className="mp-hero__meta-icon" />
              {user.location_state}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <motion.div
        className="mp-stats-strip"
        variants={stagger}
        initial="hidden"
        animate="visible"
        aria-label="Profile statistics"
      >
        {user?.rating != null && Number(user.rating) > 0 && (
          <StatPill
            iconName="star"
            value={Number(user.rating).toFixed(1)}
            label="Rating"
            delay={0.10}
          />
        )}
        {listingsCount > 0 && (
          <StatPill
            iconName="package"
            value={fmtNum(listingsCount)}
            label="Listings"
            delay={0.15}
          />
        )}
        {user?.total_views != null && Number(user.total_views) > 0 && (
          <StatPill
            iconName="eye"
            value={fmtNum(user.total_views)}
            label="Views"
            delay={0.20}
          />
        )}
        {user?.total_sales != null && Number(user.total_sales) > 0 && (
          <StatPill
            iconName="trending"
            value={fmtNum(user.total_sales)}
            label="Sales"
            delay={0.25}
          />
        )}
      </motion.div>

      {/* Quick actions */}
      <div className="mp-hero__actions">
        <motion.button
          className="mp-qa mp-qa--primary"
          onClick={() => navigate("/minimart/add")}
          whileTap={{ scale: 0.95 }}
          aria-label="Post a new listing"
        >
          {ICONS.plus} <span>Post Listing</span>
        </motion.button>

        <motion.button
          className="mp-qa mp-qa--ghost"
          onClick={() => navigate("/dashboard")}
          whileTap={{ scale: 0.95 }}
          aria-label="Go to seller dashboard"
        >
          {ICONS.dashboard} <span>Dashboard</span>
        </motion.button>

        <motion.button
          className="mp-qa mp-qa--ghost"
          onClick={() => navigate("/conversations")}
          whileTap={{ scale: 0.95 }}
          aria-label="Open messages"
        >
          {ICONS.messages} <span>Messages</span>
        </motion.button>
      </div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION BANNER
═══════════════════════════════════════════════════════════════ */
const SubscriptionBanner = memo(function SubscriptionBanner({
  sub,
  onClick,
}) {
  if (!sub) return null;

  const isActive = sub.isActive;
  const info     = isActive ? SUB_MAP[sub.plan] : null;

  return (
    <motion.div
      className={`mp-sub-banner${isActive ? " mp-sub-banner--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(onClick)}
      aria-label={isActive
        ? `${info?.label ?? ""} Plan — active subscription`
        : "Upgrade your plan"
      }
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="mp-sub-banner__glow" aria-hidden="true" />

      <div
        className="mp-sub-banner__icon"
        style={info ? { background: info.gradient } : undefined}
        aria-hidden="true"
      >
        {isActive ? ICONS.crown : ICONS.diamond}
      </div>

      <div className="mp-sub-banner__body">
        {isActive && info ? (
          <>
            <span className="mp-sub-banner__name">{info.label} Plan</span>
            <span className="mp-sub-banner__tag">
              <span className="mp-sub-banner__dot" aria-hidden="true" />
              Active subscription
            </span>
          </>
        ) : (
          <>
            <span className="mp-sub-banner__name">Free Plan</span>
            <span className="mp-sub-banner__tag mp-sub-banner__tag--cta">
              {ICONS.sparkle} Upgrade now
            </span>
          </>
        )}
      </div>

      <span className="mp-sub-banner__arrow" aria-hidden="true">
        {ICONS.chevron}
      </span>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REFERRAL CARD
═══════════════════════════════════════════════════════════════ */
const ReferralCard = memo(function ReferralCard({ code }) {
  const [copied, setCopied] = useState(false);
  const timerRef            = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!code) return null;

  const inviteLink = `${REFERRAL_BASE}/${code}`;
  const shareText  =
    `🎁 Invite Friends & Earn Up to ₦15,000 on the Leaderboard!\n\n` +
    `Join Loemart using my invite link:\n${inviteLink}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2400);
    } catch { /* clipboard unavailable — silent */ }
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Loemart & Earn!",
          text:  shareText,
          url:   inviteLink,
        });
        return;
      } catch { /* user cancelled or browser unsupported */ }
    }
    handleCopy();
  }, [inviteLink, shareText, handleCopy]);

  return (
    <motion.div
      className="mp-referral"
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.1 }}
      aria-label="Referral programme"
    >
      <div className="mp-referral__shine" aria-hidden="true" />

      {/* Header */}
      <div className="mp-referral__top">
        <div className="mp-referral__icon" aria-hidden="true">
          {ICONS.gift}
        </div>
        <div className="mp-referral__header-text">
          <h3 className="mp-referral__title">
            Invite Friends &amp; Earn Up to ₦15,000
          </h3>
          <p className="mp-referral__sub">
            Top inviters win big on the Leaderboard 🏆
          </p>
        </div>
      </div>

      {/* Invite link */}
      <div
        className="mp-referral__link-row"
        aria-label={`Your invite link: ${inviteLink}`}
      >
        <span className="mp-referral__link-icon" aria-hidden="true">
          {ICONS.link}
        </span>
        <span className="mp-referral__link-text">{inviteLink}</span>
      </div>

      {/* Actions */}
      <div className="mp-referral__actions">
        <motion.button
          className="mp-referral__action-btn mp-referral__action-btn--share"
          onClick={handleShare}
          whileTap={{ scale: 0.95 }}
          aria-label="Share invite link"
        >
          {ICONS.share}
          <span>Share</span>
        </motion.button>

        <motion.button
          className={`mp-referral__action-btn mp-referral__action-btn--copy${
            copied ? " mp-referral__action-btn--copied" : ""
          }`}
          onClick={handleCopy}
          whileTap={{ scale: 0.95 }}
          aria-label={copied ? "Link copied!" : "Copy invite link"}
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="tick"
                className="mp-referral__copy-inner"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0,   scale: 0.75 }}
                transition={{ duration: 0.16 }}
              >
                ✓ Copied!
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                className="mp-referral__copy-inner"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0,   scale: 0.75 }}
                transition={{ duration: 0.16 }}
              >
                {ICONS.copy} Copy Link
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD
═══════════════════════════════════════════════════════════════ */
const ListingCard = memo(function ListingCard({ item, onClick, index = 0 }) {
  const img                   = resolveImage(item);
  const [imgErr, setImgErr]   = useState(false);

  const statusKey   = item.status?.split("_")[0];
  const showBadge   = item.status && !item.status.startsWith("active");

  return (
    <motion.article
      className="mp-lcard"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(onClick)}
      aria-label={`${item.title} — ${naira(item.price)}`}
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.04 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="mp-lcard__img">
        {img && !imgErr ? (
          <img
            src={img}
            alt={item.title}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="mp-lcard__placeholder" aria-hidden="true">
            {ICONS.package}
          </div>
        )}

        {showBadge && (
          <span className={`mp-lcard__badge mp-lcard__badge--${statusKey}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}

        {item.is_promoted && (
          <span className="mp-lcard__badge mp-lcard__badge--hot">
            {ICONS.zap} Boosted
          </span>
        )}

        <div className="mp-lcard__overlay" aria-hidden="true" />
        <p className="mp-lcard__price-float">{naira(item.price)}</p>
      </div>

      <div className="mp-lcard__body">
        <p className="mp-lcard__title">{item.title}</p>
        <div className="mp-lcard__meta">
          <span aria-label={`${fmtNum(item.views || 0)} views`}>
            {ICONS.eye} {fmtNum(item.views || 0)}
          </span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </motion.article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT LISTINGS SECTION
═══════════════════════════════════════════════════════════════ */
const RecentListings = memo(function RecentListings({
  listings,
  onViewAll,
}) {
  const navigate  = useNavigate();
  const scrollRef = useDragScroll();

  if (!listings?.length) return null;

  return (
    <motion.section
      className="mp-listings"
      aria-label="Recent listings"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
    >
      <div className="mp-section-hdr">
        <div className="mp-section-hdr__l">
          <span className="mp-section-hdr__icon" aria-hidden="true">
            {ICONS.package}
          </span>
          <div>
            <h2 className="mp-section-hdr__title">My Listings</h2>
            <p className="mp-section-hdr__sub">
              {listings.length} active {listings.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        <motion.button
          className="mp-section-hdr__btn"
          onClick={onViewAll}
          whileTap={{ scale: 0.95 }}
          aria-label="View all listings"
        >
          View All {ICONS.chevron}
        </motion.button>
      </div>

      <div
        className="mp-listings__scroll"
        ref={scrollRef}
        role="list"
        aria-label="Listings carousel"
      >
        {listings.map((item, i) => (
          <ListingCard
            key={item.id}
            item={item}
            index={i}
            onClick={() =>
              navigate(
                item.slug
                  ? `/product/${item.slug}`
                  : `/product/${item.id}`
              )
            }
          />
        ))}
      </div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM
═══════════════════════════════════════════════════════════════ */
const MenuItem = memo(function MenuItem({
  to,
  icon,
  label,
  desc,
  badge,
  badgeType,
  currentPath,
  index = 0,
}) {
  const isActive = currentPath === to;

  const pillCls = useMemo(() => {
    if (badgeType === "notif")       return "mp-pill mp-pill--notif";
    if (badgeType === "sub")         return "mp-pill mp-pill--sub";
    if (badge === "WIN")             return "mp-pill mp-pill--win";
    if (badge === "NEW")             return "mp-pill mp-pill--new";
    if (badge?.startsWith?.("₦"))   return "mp-pill mp-pill--money";
    return "mp-pill";
  }, [badge, badgeType]);

  return (
    <motion.div
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.03 }}
    >
      <Link
        to={to}
        className={`mp-mitem${isActive ? " mp-mitem--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={`mp-mitem__icon${isActive ? " mp-mitem__icon--on" : ""}`}
          aria-hidden="true"
        >
          {ICONS[icon] ?? null}
          {badgeType === "notif" && badge && (
            <span className="mp-mitem__dot" aria-hidden="true" />
          )}
        </span>

        <div className="mp-mitem__body">
          <span className="mp-mitem__label">{label}</span>
          {desc && <span className="mp-mitem__desc">{desc}</span>}
        </div>

        {badge && (
          <span className={pillCls} aria-label={badge}>
            {badge}
          </span>
        )}

        <span className="mp-mitem__arrow" aria-hidden="true">
          {ICONS.chevron}
        </span>
      </Link>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const ErrorBanner = memo(function ErrorBanner({
  message,
  onRetry,
  isRetrying,
}) {
  return (
    <motion.div
      className="mp-error"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,   scale: 1    }}
      exit={{ opacity: 0,   y: -16,  scale: 0.95 }}
      transition={spring}
    >
      <div className="mp-error__row">
        <span className="mp-error__icon" aria-hidden="true">
          {ICONS.wifi}
        </span>
        <div>
          <p className="mp-error__title">Connection Issue</p>
          <p className="mp-error__msg">{message}</p>
        </div>
      </div>

      <motion.button
        className="mp-error__btn"
        onClick={onRetry}
        disabled={isRetrying}
        whileTap={{ scale: 0.95 }}
        aria-disabled={isRetrying}
      >
        {isRetrying ? (
          <><span className="mp-spinner-sm" aria-hidden="true" /> Refreshing…</>
        ) : (
          <>{ICONS.refresh} Tap to Retry</>
        )}
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LOGOUT BUTTON + CONFIRMATION SHEET
═══════════════════════════════════════════════════════════════ */
const LogoutButton = memo(function LogoutButton({ onLogout }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);

  const openConfirm  = useCallback(() => setShowConfirm(true),  []);
  const closeConfirm = useCallback(() => {
    if (!loggingOut) setShowConfirm(false);
  }, [loggingOut]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try   { await onLogout(); }
    catch { /* parent handles navigation even on error */ }
    finally {
      setLoggingOut(false);
      setShowConfirm(false);
    }
  }, [onLogout]);

  return (
    <>
      <motion.div
        className="mp-logout-wrap"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewOnce}
        transition={{ ...spring, delay: 0.06 }}
      >
        <motion.button
          className="mp-logout-btn"
          onClick={openConfirm}
          whileTap={{ scale: 0.97 }}
          aria-label="Log out of your account"
        >
          <span className="mp-logout-btn__icon" aria-hidden="true">
            {ICONS.logout}
          </span>
          <span className="mp-logout-btn__label">Log Out</span>
          <span className="mp-logout-btn__arrow" aria-hidden="true">
            {ICONS.chevron}
          </span>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              className="mp-logout-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={closeConfirm}
              aria-hidden="true"
            />

            {/* Sheet */}
            <motion.div
              className="mp-logout-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm log out"
              initial={{ opacity: 0, y: 80,  scale: 0.96 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              exit={{ opacity: 0,   y: 80,   scale: 0.96 }}
              transition={popSpring}
            >
              <div
                className="mp-logout-sheet__handle"
                aria-hidden="true"
              />

              <div
                className="mp-logout-sheet__icon-wrap"
                aria-hidden="true"
              >
                {ICONS.logout}
              </div>

              <h2 className="mp-logout-sheet__title">Log out?</h2>
              <p className="mp-logout-sheet__sub">
                You'll need to sign in again to access your account.
              </p>

              <div className="mp-logout-sheet__actions">
                <motion.button
                  className="mp-logout-sheet__confirm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  whileTap={{ scale: 0.96 }}
                  aria-disabled={loggingOut}
                >
                  {loggingOut ? (
                    <>
                      <span className="mp-spinner-sm" aria-hidden="true" />
                      Logging out…
                    </>
                  ) : (
                    <>{ICONS.logout} Yes, Log Out</>
                  )}
                </motion.button>

                <motion.button
                  className="mp-logout-sheet__cancel"
                  onClick={closeConfirm}
                  disabled={loggingOut}
                  whileTap={{ scale: 0.96 }}
                  aria-disabled={loggingOut}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════════════════════════ */
const ProfileSkeleton = memo(function ProfileSkeleton() {
  return (
    <div
      className="mp-skeleton-wrap"
      aria-busy="true"
      aria-label="Loading profile"
      role="status"
    >
      {/* Hero */}
      <div className="mp-sk-hero">
        <div className="mp-sk-avatar mp-shimmer" />
        <div className="mp-sk-line mp-sk-line--lg mp-shimmer" />
        <div className="mp-sk-line mp-sk-line--md mp-shimmer" />
        <div className="mp-sk-stats">
          <div className="mp-sk-stat mp-shimmer" />
          <div className="mp-sk-stat mp-shimmer" />
          <div className="mp-sk-stat mp-shimmer" />
        </div>
      </div>

      {/* Listings */}
      <div className="mp-sk-section">
        <div className="mp-sk-line mp-sk-line--sm mp-shimmer" />
        <div className="mp-sk-cards-row">
          {[1, 2, 3].map((n) => (
            <div key={n} className="mp-sk-card">
              <div className="mp-sk-img mp-shimmer" />
              <div className="mp-sk-body">
                <div className="mp-sk-line mp-shimmer" />
                <div className="mp-sk-line mp-shimmer" style={{ width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu rows */}
      <div className="mp-sk-section">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="mp-sk-row mp-shimmer" />
        ))}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTINGS SKELETON (partial — while listings load separately)
═══════════════════════════════════════════════════════════════ */
const ListingsSkeleton = memo(function ListingsSkeleton() {
  return (
    <div className="mp-skeletons" aria-busy="true" role="status">
      {[1, 2].map((n) => (
        <div key={n} className="mp-sk-card">
          <div className="mp-sk-img mp-shimmer" />
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MobileProfile({ onLogout }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const queryClient = useQueryClient();

  const [isRetrying, setIsRetrying] = useState(false);

  /* ── Invalidate all profile queries on every navigation visit ── */
  useEffect(() => {
    if (!getToken()) return;
    Object.values(QK).forEach((key) =>
      queryClient.invalidateQueries({ queryKey: key }),
    );
  }, [location.key, queryClient]);

  /* ── User ── */
  const {
    data:      user,
    error:     userError,
    isError:   userIsError,
    isLoading: userLoading,
    refetch:   refetchUser,
  } = useQuery({
    queryKey:             QK.user,
    queryFn:              fetchUserData,
    staleTime:            2 * 60_000,
    gcTime:               30 * 60_000,
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
    retry: (count, err) =>
      !isAuthError(err?.response?.status) && count < 3,
  });

  /* ── Listings ── */
  const {
    data:      listings = [],
    isLoading: listingsLoading,
    refetch:   refetchListings,
  } = useQuery({
    queryKey:             QK.listings,
    queryFn:              fetchUserListings,
    staleTime:            3 * 60_000,
    gcTime:               30 * 60_000,
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
    retry:                1,
    enabled:              !!getToken(),
  });

  /* ── Unread count ── */
  const { data: unreadCount = 0 } = useQuery({
    queryKey:             QK.unread,
    queryFn:              fetchUnreadCount,
    staleTime:            60_000,
    gcTime:               5 * 60_000,
    retry:                1,
    enabled:              !!getToken(),
    refetchInterval:      UNREAD_INTERVAL,
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
  });

  /* ── Subscription ── */
  const { data: subStatus = null } = useQuery({
    queryKey:             QK.subscription,
    queryFn:              fetchSubscriptionStatus,
    staleTime:            2 * 60_000,
    gcTime:               10 * 60_000,
    retry:                1,
    enabled:              !!getToken(),
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
  });

  /* ── Derived ── */
  const menuSections = useMemo(
    () => buildMenuSections(unreadCount, subStatus),
    [unreadCount, subStatus],
  );

  const joinedLabel = useMemo(
    () => fmtJoined(user?.created_at || user?.joined_at),
    [user],
  );

  const errorMessage = useMemo(() => {
    if (!userIsError) return null;
    const status = userError?.response?.status;
    if (isAuthError(status)) return null;
    return status >= 500
      ? "Server is temporarily unavailable."
      : "Connection error. Please check your network.";
  }, [userIsError, userError]);

  const showSkeleton = userLoading && !user;

  /* ── Pull to refresh ── */
  const handleRefresh = useCallback(async () => {
    await Promise.all(
      Object.values(QK).map((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      ),
    );
  }, [queryClient]);

  const { containerRef, pullY, refreshing } =
    usePullToRefresh(handleRefresh, PTR_THRESHOLD);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) {
      navigate("/auth");
      return;
    }
    if (userIsError && isAuthError(userError?.response?.status)) {
      clearTokens();
      navigate("/auth");
    }
  }, [userIsError, userError, navigate]);

  /* ── Retry ── */
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try   { await Promise.all([refetchUser(), refetchListings()]); }
    finally { setIsRetrying(false); }
  }, [refetchUser, refetchListings]);

  /* ── Logout ── */
  const handleLogout = useCallback(async () => {
    clearTokens();
    queryClient.clear();

    if (typeof onLogout === "function") {
      try { await onLogout(); } catch { /* ignore */ }
    }

    navigate("/auth", { replace: true });
  }, [navigate, onLogout, queryClient]);

  /* ── Render ── */
  return (
    <div className="mp-root" role="main">

      {/* Sticky top bar */}
      <div className="mp-top-bar">
        <ProfileHeader
          title="Profile"
          onEdit={() => navigate("/profile/edit")}
          onNotif={() => navigate("/notifications")}
        />
      </div>

      {/* Pull indicator (outside scroll container) */}
      <PullIndicator
        pullY={pullY}
        refreshing={refreshing}
        threshold={PTR_THRESHOLD}
      />

      {/* ── Scrollable body ── */}
      <div className="mp-scroll" ref={containerRef}>

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

        {/* First-load skeleton */}
        {showSkeleton ? (
          <ProfileSkeleton />
        ) : (
          <>
            {/* Hero */}
            <HeroProfileCard
              user={user}
              joinedLabel={joinedLabel}
              subStatus={subStatus}
              onEdit={() => navigate("/profile/edit")}
              listingsCount={listings.length}
            />

            {/* Listings */}
            {listingsLoading ? (
              <ListingsSkeleton />
            ) : (
              <RecentListings
                listings={listings}
                onViewAll={() => navigate("/dashboard")}
              />
            )}

            {/* Subscription */}
            <SubscriptionBanner
              sub={subStatus}
              onClick={() =>
                navigate(
                  subStatus?.isActive
                    ? "/seller/subscription"
                    : "/seller/subscription/plans",
                )
              }
            />

            {/* Referral */}
            <ReferralCard code={user?.referral_code} />

            {/* Menu */}
            <nav className="mp-menu-wrap" aria-label="Profile navigation">
              {menuSections.map((section, si) => (
                <motion.section
                  key={section.title}
                  className="mp-msection"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewOnce}
                  transition={{ ...spring, delay: si * 0.035 }}
                >
                  <div className="mp-msection__hdr">
                    <span
                      className="mp-msection__icon"
                      style={{ color: section.color }}
                      aria-hidden="true"
                    >
                      {ICONS[section.icon] ?? null}
                    </span>
                    <h3 className="mp-msection__title">{section.title}</h3>
                  </div>

                  <motion.div
                    className="mp-msection__list"
                    role="list"
                    variants={stagger}
                    initial="hidden"
                    whileInView="visible"
                    viewport={viewOnce}
                  >
                    {section.items.map((item, i) => (
                      <MenuItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        desc={item.desc}
                        badge={item.badge}
                        badgeType={item.badgeType}
                        currentPath={location.pathname}
                        index={i}
                      />
                    ))}
                  </motion.div>
                </motion.section>
              ))}
            </nav>

            {/* Logout */}
            <LogoutButton onLogout={handleLogout} />

            {/* Footer */}
            <footer className="mp-footer">
              <p>Loemart Technologies Ltd · {new Date().getFullYear()}</p>
            </footer>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}