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
import { motion, AnimatePresence, useScroll, useTransform, animate } from "framer-motion";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import BottomNav from "../components/BottomNav"; // ← Imported BottomNav directly
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
    return (data?.products || []).slice(0, 8);
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
   HOOKS
═══════════════════════════════════════════════════════════════ */
function useAnimatedCounter(to, duration = 1.2) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = to;
    if (from === to) return;

    const ctrl = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v * 10) / 10),
    });

    return () => ctrl.stop();
  }, [to, duration]);

  return display;
}

function usePullToRefresh(onRefresh, threshold = 80) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) { startY.current = null; return; }
      const resistance = Math.min(delta * 0.45, threshold * 1.4);
      setPulling(true);
      setPullY(resistance);
    };

    const onTouchEnd = async () => {
      if (!pulling) return;
      if (pullY >= threshold) {
        setRefreshing(true);
        setPullY(threshold * 0.6);
        try { await onRefresh(); } finally {
          setRefreshing(false);
        }
      }
      setPulling(false);
      setPullY(0);
      startY.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pulling, pullY, threshold, onRefresh]);

  return { containerRef, pullY, pulling, refreshing };
}

function useDragScroll() {
  const ref = useRef(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e) => {
      state.current.isDown = true;
      state.current.startX = e.touches[0].pageX - el.offsetLeft;
      state.current.scrollLeft = el.scrollLeft;
    };
    const onTouchEnd = () => { state.current.isDown = false; };
    const onTouchMove = (e) => {
      if (!state.current.isDown) return;
      const x = e.touches[0].pageX - el.offsetLeft;
      el.scrollLeft = state.current.scrollLeft - (x - state.current.startX) * 1.1;
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
   ANIMATION PRESETS
═══════════════════════════════════════════════════════════════ */
const spring     = { type: "spring", stiffness: 320, damping: 28 };
const softSpring = { type: "spring", stiffness: 200, damping: 24 };
const popSpring  = { type: "spring", stiffness: 420, damping: 22 };
const viewOnce   = { once: true, amount: 0.12 };

const fadeUp   = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } };
const fadeScale= { hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } };

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};
const cardReveal = {
  hidden: { opacity: 0, y: 22, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  logout:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
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
  crown:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>,
  diamond:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 6"/><path d="M2 9h20"/></svg>,
  camera:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  arrowUp:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  eye:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  sparkle:   () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41Z"/></svg>,
};

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
   IMAGE RESOLVER
═══════════════════════════════════════════════════════════════ */
const resolveImage = (item) => {
  if (!item) return null;
  if (item.image) return item.image;
  if (item.main_image) return item.main_image;
  if (item.thumbnail_url) return item.thumbnail_url;
  if (Array.isArray(item.images) && item.images.length > 0) {
    const f = item.images[0];
    return typeof f === "string" ? f : f?.url ?? null;
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
    color: "var(--o)",
    items: [
      { to: "/dashboard",    Ic: Icon.dashboard, label: "Seller Dashboard", desc: "Manage your store" },
      { to: "/minimart/add", Ic: Icon.plus,      label: "Post a Listing",   badge: "NEW", desc: "Create new listing" },
      {
        to: "/seller/subscription",
        Ic: Icon.crown,
        label: "Subscription",
        badge: subStatus?.isActive ? subStatus.planBadge || "PRO" : null,
        badgeType: subStatus?.isActive ? "sub" : undefined,
        desc: "Manage your plan",
      },
      { to: "/leaderboard",  Ic: Icon.trending,  label: "Leaderboard",      desc: "Top sellers" },
    ],
  },
  {
    title: "Buying",
    icon: <Icon.saved />,
    color: "var(--dp-pink)",
    items: [
      { to: "/saved",         Ic: Icon.saved,    label: "Saved Items", desc: "Your wishlist" },
      { to: "/conversations", Ic: Icon.messages, label: "Messages",    desc: "Chat with sellers" },
    ],
  },
  {
    title: "Rewards",
    icon: <Icon.gift />,
    color: "#d97706",
    items: [
      { to: "/spin",       Ic: Icon.zap,  label: "Spin & Win",      badge: "WIN", desc: "Try your luck" },
      { to: "/coupons",    Ic: Icon.gift, label: "Coupons & Promos",             desc: "Available offers" },
      { to: "/invitation", Ic: Icon.gift, label: "Refer & Earn",    badge: "₦500", desc: "Invite friends" },
    ],
  },
  {
    title: "Account",
    icon: <Icon.settings />,
    color: "var(--gn)",
    items: [
      { to: "/settings",     Ic: Icon.settings, label: "Settings",      desc: "App preferences" },
      { to: "/verification", Ic: Icon.shield,   label: "Verification",  desc: "Verify your identity" },
      {
        to: "/notifications",
        Ic: Icon.notify,
        label: "Notifications",
        badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null,
        badgeType: "notif",
        desc: "Stay updated",
      },
      { to: "/support", Ic: Icon.support, label: "Help & Support", desc: "Get assistance" },
      { to: "/faq",     Ic: Icon.help,    label: "FAQ",            desc: "Common questions" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   PULL TO REFRESH
═══════════════════════════════════════════════════════════════ */
const PullIndicator = memo(function PullIndicator({ pullY, refreshing, threshold = 80 }) {
  const progress = Math.min(pullY / threshold, 1);
  const circumference = 2 * Math.PI * 10;
  const dash = circumference * progress;

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
          <div className={`mp-ptr__inner${refreshing ? " mp-ptr__inner--spin" : ""}`}>
            {refreshing ? (
              <div className="mp-ptr__spinner" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="var(--bd)" strokeWidth="2" />
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="var(--o)"
                  strokeWidth="2"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeLinecap="round"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
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
   ANIMATED STAT PILL
═══════════════════════════════════════════════════════════════ */
const StatPill = memo(function StatPill({ icon, value, label, delay = 0 }) {
  return (
    <motion.div
      className="mp-stat"
      variants={fadeScale}
      transition={{ ...spring, delay }}
    >
      <span className="mp-stat__icon">{icon}</span>
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
  const sub = subStatus?.isActive ? SUB_MAP[subStatus.plan] : null;

  return (
    <motion.section
      className="mp-hero"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...softSpring, delay: 0.05 }}
    >
      <div className="mp-hero__bg" aria-hidden="true">
        <div className="mp-orb mp-orb--1" />
        <div className="mp-orb mp-orb--2" />
        <div className="mp-orb mp-orb--3" />
        <div className="mp-hero__mesh" />
      </div>

      <motion.button
        className="mp-hero__edit"
        onClick={onEdit}
        aria-label="Edit profile"
        whileTap={{ scale: 0.9 }}
      >
        <Icon.edit />
      </motion.button>

      <div className="mp-avatar-section">
        <motion.div className="mp-avatar-wrap" whileTap={{ scale: 0.95 }}>
          <div className="mp-avatar-ring" style={sub ? { background: sub.gradient } : undefined} />
          <div className="mp-avatar">
            {user?.profile_image ? (
              <img src={user.profile_image} alt={user?.name} className="mp-avatar__img" />
            ) : (
              <span className="mp-avatar__letter">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="mp-avatar__online" />
          <motion.button className="mp-avatar__cam" onClick={onEdit}>
            <Icon.camera />
          </motion.button>
        </motion.div>
      </div>

      <div className="mp-hero__info">
        <h1 className="mp-hero__name">
          {user?.name || "User"}
          {user?.verified && <span className="mp-hero__verified"><Icon.chevron /></span>}
        </h1>
        <p className="mp-hero__store">{user?.store_name || "Loemart Member"}</p>

        <div className="mp-hero__badges">
          {user?.is_seller && <span className="mp-chip mp-chip--seller">Seller</span>}
          {user?.is_top_seller && <span className="mp-chip mp-chip--top">⭐ Top Seller</span>}
          {sub && (
            <span className="mp-chip mp-chip--sub" style={{ background: sub.gradient }}>
              <Icon.crown /> {sub.label}
            </span>
          )}
        </div>

        <div className="mp-hero__meta">
          {joinedLabel && <span>📅 Joined {joinedLabel}</span>}
          {user?.location_state && <span>📍 {user.location_state}</span>}
        </div>
      </div>

      {/* Stats row — Remvoed 0 values automatically */}
      <motion.div className="mp-stats-strip" variants={stagger} initial="hidden" animate="visible">
        {user?.rating != null && Number(user.rating) > 0 && (
          <StatPill icon={<Icon.star />} value={Number(user.rating).toFixed(1)} label="Rating" delay={0.1} />
        )}
        {listingsCount > 0 && (
          <StatPill icon={<Icon.package />} value={fmtNum(listingsCount)} label="Listings" delay={0.15} />
        )}
        {user?.total_views != null && Number(user.total_views) > 0 && (
          <StatPill icon={<Icon.eye />} value={fmtNum(user.total_views)} label="Views" delay={0.2} />
        )}
        {user?.total_sales != null && Number(user.total_sales) > 0 && (
          <StatPill icon={<Icon.trending />} value={fmtNum(user.total_sales)} label="Sales" delay={0.25} />
        )}
      </motion.div>

      <motion.div className="mp-hero__actions">
        <motion.button className="mp-qa mp-qa--primary" onClick={() => navigate("/minimart/add")} whileTap={{ scale: 0.95 }}>
          <Icon.plus /> <span>Post Listing</span>
        </motion.button>
        <motion.button className="mp-qa mp-qa--ghost" onClick={() => navigate("/dashboard")} whileTap={{ scale: 0.95 }}>
          <Icon.dashboard /> <span>Dashboard</span>
        </motion.button>
        <motion.button className="mp-qa mp-qa--ghost" onClick={() => navigate("/conversations")} whileTap={{ scale: 0.95 }}>
          <Icon.messages /> <span>Messages</span>
        </motion.button>
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION BANNER
═══════════════════════════════════════════════════════════════ */
const MobileSubscriptionCard = memo(function MobileSubscriptionCard({ sub, onClick }) {
  if (!sub) return null;
  const isActive = sub.isActive;
  const info = isActive ? SUB_MAP[sub.plan] : null;

  return (
    <motion.div
      className={`mp-sub-banner${isActive ? " mp-sub-banner--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(onClick)}
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="mp-sub-banner__glow" aria-hidden="true" />
      <div className="mp-sub-banner__icon" style={info ? { background: info.gradient } : undefined}>
        {isActive ? <Icon.crown /> : <Icon.diamond />}
      </div>
      <div className="mp-sub-banner__body">
        {isActive && info ? (
          <>
            <span className="mp-sub-banner__name">{info.label} Plan</span>
            <span className="mp-sub-banner__tag">
              <span className="mp-sub-banner__dot" /> Active subscription
            </span>
          </>
        ) : (
          <>
            <span className="mp-sub-banner__name">Free Plan</span>
            <span className="mp-sub-banner__tag mp-sub-banner__tag--cta">
              <Icon.sparkle /> Upgrade now
            </span>
          </>
        )}
      </div>
      <span className="mp-sub-banner__arrow"><Icon.chevron /></span>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REFERRAL CARD
═══════════════════════════════════════════════════════════════ */
const MobileReferralCard = memo(function MobileReferralCard({ code }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  return (
    <motion.div className="mp-referral" variants={fadeScale} initial="hidden" whileInView="visible" viewport={viewOnce} transition={{ ...spring, delay: 0.1 }}>
      <div className="mp-referral__shine" aria-hidden="true" />
      <div className="mp-referral__top">
        <div className="mp-referral__icon"><Icon.gift /></div>
        <div>
          <h3 className="mp-referral__title">Refer & Earn ₦500</h3>
          <p className="mp-referral__sub">Invite friends · they join · you earn</p>
        </div>
      </div>
      <motion.button className={`mp-referral__pill${copied ? " mp-referral__pill--copied" : ""}`} onClick={copy} whileTap={{ scale: 0.95 }}>
        <span className="mp-referral__code">{code}</span>
        <AnimatePresence mode="wait">
          <motion.span key={copied ? "ok" : "cp"} className="mp-referral__icon-sm">
            {copied ? "✓" : <Icon.copy />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD
═══════════════════════════════════════════════════════════════ */
const MobileListingCard = memo(function MobileListingCard({ item, onClick, index = 0 }) {
  const img = resolveImage(item);
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div className="mp-lcard" onClick={onClick} role="button" tabIndex={0} variants={cardReveal} transition={{ ...spring, delay: index * 0.04 }} whileTap={{ scale: 0.96 }}>
      <div className="mp-lcard__img">
        {img && !imgError ? (
          <img src={img} alt={item.title} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div className="mp-lcard__placeholder"><Icon.package /></div>
        )}
        {item.status && !item.status.startsWith("active") && (
          <span className={`mp-lcard__badge mp-lcard__badge--${item.status.split("_")[0]}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}
        {item.is_promoted && (
          <span className="mp-lcard__badge mp-lcard__badge--hot"><Icon.zap /> Boosted</span>
        )}
        <div className="mp-lcard__overlay" />
        <p className="mp-lcard__price-float">{naira(item.price)}</p>
      </div>
      <div className="mp-lcard__body">
        <p className="mp-lcard__title">{item.title}</p>
        <div className="mp-lcard__meta">
          <span><Icon.eye /> {fmtNum(item.views || 0)}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   RECENT LISTINGS
═══════════════════════════════════════════════════════════════ */
const MobileRecentListings = memo(function MobileRecentListings({ listings, onViewAll }) {
  const navigate = useNavigate();
  const scrollRef = useDragScroll();

  if (!listings || listings.length === 0) return null;

  return (
    <motion.section className="mp-listings" aria-label="Recent listings" variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewOnce} transition={{ ...spring, delay: 0.08 }}>
      <div className="mp-section-hdr">
        <div className="mp-section-hdr__l">
          <span className="mp-section-hdr__icon"><Icon.package /></span>
          <div>
            <h2 className="mp-section-hdr__title">My Listings</h2>
            <p className="mp-section-hdr__sub">{listings.length} active items</p>
          </div>
        </div>
        <motion.button className="mp-section-hdr__btn" onClick={onViewAll} whileTap={{ scale: 0.95 }}>
          View All <Icon.chevron />
        </motion.button>
      </div>
      <div className="mp-listings__scroll" ref={scrollRef} role="list">
        {listings.map((item, i) => (
          <MobileListingCard key={item.id} item={item} index={i} onClick={() => navigate(item.slug ? `/product/${item.slug}` : `/product/${item.id}`)} />
        ))}
      </div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM
═══════════════════════════════════════════════════════════════ */
const MobileMenuItem = memo(function MobileMenuItem({ to, Ic, label, desc, badge, badgeType, currentPath, index = 0 }) {
  const isActive = currentPath === to;
  const pillCls =
    badgeType === "notif" ? "mp-pill mp-pill--notif"
    : badgeType === "sub" ? "mp-pill mp-pill--sub"
    : badge === "WIN" ? "mp-pill mp-pill--win"
    : badge === "NEW" ? "mp-pill mp-pill--new"
    : badge?.startsWith?.("₦") ? "mp-pill mp-pill--money"
    : "mp-pill";

  return (
    <motion.div variants={cardReveal} transition={{ ...spring, delay: index * 0.03 }}>
      <Link to={to} className={`mp-mitem${isActive ? " mp-mitem--active" : ""}`}>
        <span className={`mp-mitem__icon${isActive ? " mp-mitem__icon--on" : ""}`}>
          <Ic />
          {badgeType === "notif" && badge && <span className="mp-mitem__dot" />}
        </span>
        <div className="mp-mitem__body">
          <span className="mp-mitem__label">{label}</span>
          {desc && <span className="mp-mitem__desc">{desc}</span>}
        </div>
        {badge && <span className={pillCls}>{badge}</span>}
        <span className="mp-mitem__arrow"><Icon.chevron /></span>
      </Link>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const MobileErrorBanner = memo(function MobileErrorBanner({ message, onRetry, isRetrying }) {
  return (
    <motion.div className="mp-error" role="alert" initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.95 }} transition={spring}>
      <div className="mp-error__row">
        <span className="mp-error__icon"><Icon.wifi /></span>
        <div>
          <p className="mp-error__title">Connection Issue</p>
          <p className="mp-error__msg">{message}</p>
        </div>
      </div>
      <motion.button className="mp-error__btn" onClick={onRetry} disabled={isRetrying} whileTap={{ scale: 0.95 }}>
        {isRetrying ? <><span className="mp-spinner-sm" /> Refreshing…</> : <><Icon.refresh /> Tap to Retry</>}
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MobileProfile({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const queryClient = useQueryClient();

  const menuRef = useRef(null);
  const pageRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

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
    retry: (count, err) => err?.response?.status !== 401 && err?.response?.status !== 403 && count < 3,
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

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile-user"] }),
      queryClient.invalidateQueries({ queryKey: ["profile-listings"] }),
    ]);
  }, [queryClient]);

  const { containerRef, pullY, pulling, refreshing } = usePullToRefresh(handleRefresh, 80);

  useEffect(() => {
    if (!getToken()) { navigate("/auth"); return; }
    if (userIsError) {
      const s = userError?.response?.status;
      if (s === 401 || s === 403) {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
      }
    }
  }, [userIsError, userError, navigate]);

  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) => localStorage.removeItem(k));
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try { await Promise.all([refetchUser(), refetchListings()]); } finally { setIsRetrying(false); }
  }, [refetchUser, refetchListings]);

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  const errorMessage = userIsError && userError?.response?.status !== 401 && userError?.response?.status !== 403
    ? userError?.response?.status >= 500 ? "Server is temporarily unavailable." : "Connection error."
    : null;

  return (
    <div className="mp-root" role="main">
      <div className="mp-top-bar">
        <ProfileHeader
          title="Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onEdit={() => navigate("/profile/edit")}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
        />
      </div>

      <PullIndicator pullY={pullY} refreshing={refreshing} />

      <div className="mp-scroll" ref={(node) => { pageRef.current = node; containerRef.current = node; }}>
        <AnimatePresence>
          {errorMessage && <MobileErrorBanner message={errorMessage} onRetry={handleRetry} isRefreshing={isRefreshing} />}
        </AnimatePresence>

        <HeroProfileCard user={user} joinedLabel={joinedLabel} subStatus={subStatus} onEdit={() => navigate("/profile/edit")} listingsCount={listings.length} />

        {listingsLoading ? (
          <div className="mp-skeletons"><div className="mp-sk-card"><div className="mp-sk-img mp-shimmer" /></div></div>
        ) : (
          <MobileRecentListings listings={listings} onViewAll={() => navigate("/dashboard")} />
        )}

        <MobileSubscriptionCard sub={subStatus} onClick={() => navigate(subStatus?.isActive ? "/seller/subscription" : "/seller/subscription/plans")} />
        <MobileReferralCard code={user?.referral_code} />

        <div className="mp-menu-wrap">
          {menuSections.map((section, si) => (
            <motion.section key={section.title} className="mp-msection" variants={fadeUp} initial="hidden" whileInView="visible" viewport={viewOnce} transition={{ ...spring, delay: si * 0.035 }}>
              <div className="mp-msection__hdr">
                <span className="mp-msection__icon" style={{ color: section.color }}>{section.icon}</span>
                <h3 className="mp-msection__title">{section.title}</h3>
              </div>
              <motion.div className="mp-msection__list" variants={stagger} initial="hidden" whileInView="visible" viewport={viewOnce}>
                {section.items.map((item, i) => (
                  <MobileMenuItem key={item.to} to={item.to} Ic={item.Ic} label={item.label} desc={item.desc} badge={item.badge} badgeType={item.badgeType} currentPath={currentPath} index={i} />
                ))}
              </motion.div>
            </motion.section>
          ))}

          <motion.button className="mp-logout" onClick={logout} whileTap={{ scale: 0.96 }}>
            <Icon.logout /> <span>Log Out</span>
          </motion.button>
        </div>

        <p className="mp-footer">Loemart Technologies Ltd · {new Date().getFullYear()}</p>
      </div>

      <BottomNav /> {/* ← Rendered shared BottomNav cleanly here */}
    </div>
  );
}