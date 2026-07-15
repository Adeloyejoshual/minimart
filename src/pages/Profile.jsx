import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  animate,
} from "framer-motion";
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

/* ── Animated counter ── */
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

/* ── Pull to refresh ── */
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

/* ── Drag scroll ── */
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

/* ── Parallax scroll ── */
function useParallax(scrollY, inputRange, outputRange) {
  return useTransform(scrollY, inputRange, outputRange);
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATION PRESETS
═══════════════════════════════════════════════════════════════ */
const spring     = { type: "spring", stiffness: 320, damping: 28 };
const softSpring = { type: "spring", stiffness: 200, damping: 24 };
const popSpring  = { type: "spring", stiffness: 420, damping: 22 };
const viewOnce   = { once: true, amount: 0.12 };

const fadeUp   = { hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0 } };
const fadeDown = { hidden: { opacity: 0, y: -20 }, visible: { opacity: 1, y: 0 } };
const fadeScale= { hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } };
const slideRight={ hidden: { opacity: 0, x: -24 }, visible: { opacity: 1, x: 0 } };

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
const I = {
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
  home:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  user:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  store:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/><path d="M2 9h20"/></svg>,
  search:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  check:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION / THEME MAP
═══════════════════════════════════════════════════════════════ */
const SUB_MAP = {
  premium: {
    label: "Premium",
    cls: "mp-sub-badge--premium",
    gradient: "linear-gradient(135deg,#667eea,#764ba2)",
    glow: "rgba(102,126,234,0.35)",
  },
  pro: {
    label: "Pro",
    cls: "mp-sub-badge--pro",
    gradient: "linear-gradient(135deg,#f093fb,#f5576c)",
    glow: "rgba(240,147,251,0.35)",
  },
  business: {
    label: "Business",
    cls: "mp-sub-badge--business",
    gradient: "linear-gradient(135deg,#4facfe,#00f2fe)",
    glow: "rgba(79,172,254,0.35)",
  },
  elite: {
    label: "Elite",
    cls: "mp-sub-badge--elite",
    gradient: "linear-gradient(135deg,#FFD700,#FFA500)",
    glow: "rgba(255,215,0,0.35)",
  },
  diamond: {
    label: "Diamond",
    cls: "mp-sub-badge--diamond",
    gradient: "linear-gradient(135deg,#a8edea,#fed6e3)",
    glow: "rgba(168,237,234,0.35)",
  },
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
    icon: <I.trending />,
    color: "var(--mp-accent)",
    items: [
      { to: "/dashboard",    Ic: I.dashboard, label: "Seller Dashboard", desc: "Manage your store" },
      { to: "/minimart/add", Ic: I.plus,      label: "Post a Listing",   badge: "NEW",  desc: "Create new listing" },
      {
        to: "/seller/subscription",
        Ic: I.crown,
        label: "Subscription",
        badge: subStatus?.isActive ? subStatus.planBadge || "PRO" : null,
        badgeType: subStatus?.isActive ? "sub" : undefined,
        desc: "Manage your plan",
      },
      { to: "/leaderboard",  Ic: I.trending,  label: "Leaderboard",     desc: "Top sellers" },
    ],
  },
  {
    title: "Buying",
    icon: <I.saved />,
    color: "var(--mp-pink)",
    items: [
      { to: "/saved",         Ic: I.saved,    label: "Saved Items", desc: "Your wishlist" },
      { to: "/conversations", Ic: I.messages, label: "Messages",    desc: "Chat with sellers" },
    ],
  },
  {
    title: "Rewards",
    icon: <I.gift />,
    color: "var(--mp-gold)",
    items: [
      { to: "/spin",       Ic: I.zap,  label: "Spin & Win",      badge: "WIN",  desc: "Try your luck" },
      { to: "/coupons",    Ic: I.gift, label: "Coupons & Promos",              desc: "Available offers" },
      { to: "/invitation", Ic: I.gift, label: "Refer & Earn",    badge: "₦500", desc: "Invite friends" },
    ],
  },
  {
    title: "Account",
    icon: <I.settings />,
    color: "var(--mp-green)",
    items: [
      { to: "/settings",     Ic: I.settings, label: "Settings",      desc: "App preferences" },
      { to: "/verification", Ic: I.shield,   label: "Verification",  desc: "Verify your identity" },
      {
        to: "/notifications",
        Ic: I.notify,
        label: "Notifications",
        badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null,
        badgeType: "notif",
        desc: "Stay updated",
      },
      { to: "/support", Ic: I.support, label: "Help & Support", desc: "Get assistance" },
      { to: "/faq",     Ic: I.help,    label: "FAQ",            desc: "Common questions" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   PULL-TO-REFRESH INDICATOR
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
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="var(--mp-glass-border)"
                  strokeWidth="2"
                />
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  stroke="var(--mp-accent)"
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
const StatPill = memo(function StatPill({ icon, rawValue, label, delay = 0, prefix = "", suffix = "" }) {
  const animated = useAnimatedCounter(rawValue);
  const display  = rawValue >= 1000
    ? fmtNum(animated)
    : typeof rawValue === "number" && !Number.isInteger(rawValue)
      ? animated.toFixed(1)
      : Math.round(animated);

  return (
    <motion.div
      className="mp-stat"
      variants={fadeScale}
      transition={{ ...spring, delay }}
    >
      <span className="mp-stat__icon">{icon}</span>
      <span className="mp-stat__value">{prefix}{display}{suffix}</span>
      <span className="mp-stat__label">{label}</span>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   AVATAR STACK (multiple seller trust icons)
═══════════════════════════════════════════════════════════════ */
const AvatarRing = memo(function AvatarRing({ user, subStatus, onEdit }) {
  const [imgErr, setImgErr] = useState(false);
  const sub = subStatus?.isActive ? SUB_MAP[subStatus.plan] : null;

  return (
    <motion.div
      className="mp-avatar-wrap"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...popSpring, delay: 0.1 }}
    >
      {/* Rotating gradient ring */}
      <div
        className="mp-avatar-ring"
        style={sub ? { background: sub.gradient } : undefined}
      />

      {/* Avatar */}
      <div className="mp-avatar">
        {user?.profile_image && !imgErr ? (
          <img
            src={user.profile_image}
            alt={user.name}
            onError={() => setImgErr(true)}
            className="mp-avatar__img"
          />
        ) : (
          <span className="mp-avatar__letter">
            {(user?.name || "U").charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Online dot */}
      <span className="mp-avatar__online" />

      {/* Edit camera button */}
      <motion.button
        className="mp-avatar__cam"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label="Change photo"
        whileTap={{ scale: 0.82 }}
        whileHover={{ scale: 1.08 }}
      >
        <I.camera />
      </motion.button>

      {/* Sub crown badge */}
      {sub && (
        <motion.div
          className="mp-avatar__crown"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...popSpring, delay: 0.4 }}
          style={{ background: sub.gradient }}
          title={sub.label}
        >
          <I.crown />
        </motion.div>
      )}
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════════ */
const HeroSection = memo(function HeroSection({
  user, joinedLabel, subStatus, onEdit, listingsCount, scrollY,
}) {
  const navigate = useNavigate();
  const sub = subStatus?.isActive ? SUB_MAP[subStatus.plan] : null;

  /* Parallax */
  const orbY1 = useParallax(scrollY, [0, 300], [0, -60]);
  const orbY2 = useParallax(scrollY, [0, 300], [0, -35]);
  const nameY = useParallax(scrollY, [0, 200], [0, -20]);

  return (
    <motion.section
      className="mp-hero"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ ...softSpring, delay: 0.04 }}
    >
      {/* ── Ambient background ── */}
      <div className="mp-hero__bg" aria-hidden="true">
        <motion.div className="mp-orb mp-orb--1" style={{ y: orbY1 }} />
        <motion.div className="mp-orb mp-orb--2" style={{ y: orbY2 }} />
        <div className="mp-orb mp-orb--3" />
        <div className="mp-hero__mesh" />
      </div>

      {/* ── Edit FAB ── */}
      <motion.button
        className="mp-hero__edit"
        onClick={onEdit}
        aria-label="Edit profile"
        whileTap={{ scale: 0.88 }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring, delay: 0.3 }}
      >
        <I.edit />
        <span>Edit</span>
      </motion.button>

      {/* ── Avatar ── */}
      <AvatarRing user={user} subStatus={subStatus} onEdit={onEdit} />

      {/* ── Name block ── */}
      <motion.div className="mp-hero__info" style={{ y: nameY }}>
        <motion.h1
          className="mp-hero__name"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.18 }}
        >
          {user?.name || "User"}
          {user?.verified && (
            <motion.span
              className="mp-hero__verified"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ ...popSpring, delay: 0.38 }}
              title="Verified"
            >
              <I.check />
            </motion.span>
          )}
        </motion.h1>

        <p className="mp-hero__store">{user?.store_name || "Loemart Member"}</p>

        {/* Badges */}
        <motion.div
          className="mp-hero__badges"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {user?.is_seller && (
            <motion.span variants={cardReveal} className="mp-chip mp-chip--seller">
              Seller
            </motion.span>
          )}
          {user?.is_top_seller && (
            <motion.span variants={cardReveal} className="mp-chip mp-chip--top">
              ⭐ Top Seller
            </motion.span>
          )}
          {sub && (
            <motion.span
              variants={cardReveal}
              className={`mp-chip mp-chip--sub ${sub.cls}`}
              style={{ background: sub.gradient }}
            >
              <I.crown /> {sub.label}
            </motion.span>
          )}
        </motion.div>

        {/* Meta */}
        <div className="mp-hero__meta">
          {joinedLabel && <span>📅 {joinedLabel}</span>}
          {user?.location_state && <span>📍 {user.location_state}</span>}
        </div>
      </motion.div>

      {/* ── Stats strip ── */}
      <motion.div
        className="mp-stats-strip"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {user?.rating != null && (
          <StatPill
            icon={<I.star />}
            rawValue={Number(user.rating)}
            label="Rating"
            delay={0.12}
          />
        )}
        <StatPill icon={<I.package />} rawValue={listingsCount} label="Listings" delay={0.17} />
        <StatPill icon={<I.eye />}     rawValue={Number(user?.total_views || 0)} label="Views" delay={0.22} />
        {user?.total_sales != null && (
          <StatPill icon={<I.trending />} rawValue={Number(user.total_sales)} label="Sales" delay={0.27} />
        )}
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div
        className="mp-hero__actions"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.28 }}
      >
        <motion.button
          className="mp-qa mp-qa--primary"
          onClick={() => navigate("/minimart/add")}
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.03 }}
        >
          <I.plus /> <span>Post Listing</span>
        </motion.button>
        <motion.button
          className="mp-qa mp-qa--ghost"
          onClick={() => navigate("/dashboard")}
          whileTap={{ scale: 0.93 }}
        >
          <I.dashboard /> <span>Dashboard</span>
        </motion.button>
        <motion.button
          className="mp-qa mp-qa--ghost"
          onClick={() => navigate("/conversations")}
          whileTap={{ scale: 0.93 }}
        >
          <I.messages /> <span>Messages</span>
        </motion.button>
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION BANNER
═══════════════════════════════════════════════════════════════ */
const SubBanner = memo(function SubBanner({ sub, onClick }) {
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
      transition={{ ...spring, delay: 0.06 }}
      whileTap={{ scale: 0.97 }}
      style={info ? { "--sub-glow": info.glow } : undefined}
    >
      {isActive && <div className="mp-sub-banner__glow" />}

      <div className="mp-sub-banner__icon" style={info ? { background: info.gradient } : undefined}>
        {isActive ? <I.crown /> : <I.diamond />}
      </div>

      <div className="mp-sub-banner__body">
        {isActive && info ? (
          <>
            <span className="mp-sub-banner__name">{info.label} Plan</span>
            <span className="mp-sub-banner__tag">
              <span className="mp-sub-banner__dot" />
              Active subscription
            </span>
          </>
        ) : (
          <>
            <span className="mp-sub-banner__name">Free Plan</span>
            <span className="mp-sub-banner__tag mp-sub-banner__tag--cta">
              <I.sparkle /> Upgrade for more reach
            </span>
          </>
        )}
      </div>

      <span className="mp-sub-banner__arrow"><I.chevron /></span>
    </motion.div>
  );
});

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
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  return (
    <motion.div
      className="mp-referral"
      variants={fadeScale}
      initial="hidden"
      whileInView="visible"
      viewport={viewOnce}
      transition={{ ...spring, delay: 0.08 }}
    >
      <div className="mp-referral__shine" aria-hidden="true" />

      <div className="mp-referral__top">
        <div className="mp-referral__icon"><I.gift /></div>
        <div>
          <p className="mp-referral__title">Refer & Earn ₦500</p>
          <p className="mp-referral__sub">Invite friends · they join · you earn</p>
        </div>
      </div>

      <motion.button
        className={`mp-referral__pill${copied ? " mp-referral__pill--copied" : ""}`}
        onClick={copy}
        aria-label="Copy referral code"
        whileTap={{ scale: 0.94 }}
      >
        <span className="mp-referral__code">{code}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={copied ? "ok" : "cp"}
            className="mp-referral__icon-sm"
            initial={{ opacity: 0, scale: 0.4, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, rotate: 90 }}
            transition={{ duration: 0.18 }}
          >
            {copied ? <I.check /> : <I.copy />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD
═══════════════════════════════════════════════════════════════ */
const ListingCard = memo(function ListingCard({ item, onClick, index = 0 }) {
  const img = resolveImage(item);
  const [imgErr, setImgErr] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <motion.div
      className={`mp-lcard${pressed ? " mp-lcard--pressed" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${item.title}`}
      onKeyDown={onActivate(onClick)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.035 }}
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
          <div className="mp-lcard__placeholder"><I.package /></div>
        )}

        {item.status && !item.status.startsWith("active") && (
          <span className={`mp-lcard__badge mp-lcard__badge--${item.status.split("_")[0]}`}>
            {item.status.replace(/_/g, " ")}
          </span>
        )}
        {item.is_promoted && (
          <span className="mp-lcard__badge mp-lcard__badge--hot">
            <I.zap /> Hot
          </span>
        )}

        {/* Gradient overlay */}
        <div className="mp-lcard__overlay" />
        <p className="mp-lcard__price-float">{naira(item.price)}</p>
      </div>

      <div className="mp-lcard__body">
        <p className="mp-lcard__title">{item.title}</p>
        <div className="mp-lcard__meta">
          <span><I.eye /> {fmtNum(item.views || 0)}</span>
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   LISTINGS SECTION
═══════════════════════════════════════════════════════════════ */
const ListingsSection = memo(function ListingsSection({ listings, onViewAll }) {
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
      transition={{ ...spring, delay: 0.06 }}
    >
      <div className="mp-section-hdr">
        <div className="mp-section-hdr__l">
          <span className="mp-section-hdr__icon"><I.package /></span>
          <div>
            <h2 className="mp-section-hdr__title">My Listings</h2>
            <p className="mp-section-hdr__sub">{listings.length} active items</p>
          </div>
        </div>
        <motion.button
          className="mp-section-hdr__btn"
          onClick={onViewAll}
          whileTap={{ scale: 0.94 }}
        >
          View All <I.chevron />
        </motion.button>
      </div>

      <motion.div
        className="mp-listings__scroll"
        ref={scrollRef}
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={viewOnce}
        role="list"
      >
        {listings.map((item, i) => (
          <ListingCard
            key={item.id}
            item={item}
            index={i}
            onClick={() =>
              navigate(item.slug ? `/product/${item.slug}` : `/product/${item.id}`)
            }
          />
        ))}
      </motion.div>
    </motion.section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MENU ITEM
═══════════════════════════════════════════════════════════════ */
const MenuItem = memo(function MenuItem({
  to, Ic, label, desc, badge, badgeType, isActive, index = 0,
}) {
  const pillCls =
    badgeType === "notif" ? "mp-pill mp-pill--notif"
    : badgeType === "sub" ? "mp-pill mp-pill--sub"
    : badge === "WIN"     ? "mp-pill mp-pill--win"
    : badge === "NEW"     ? "mp-pill mp-pill--new"
    : badge?.startsWith?.("₦") ? "mp-pill mp-pill--money"
    : "mp-pill";

  return (
    <motion.div
      variants={cardReveal}
      transition={{ ...spring, delay: index * 0.025 }}
    >
      <Link
        to={to}
        className={`mp-mitem${isActive ? " mp-mitem--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
      >
        <span className={`mp-mitem__icon${isActive ? " mp-mitem__icon--on" : ""}`}>
          <Ic />
          {badgeType === "notif" && badge && (
            <span className="mp-mitem__dot" aria-hidden="true" />
          )}
        </span>

        <div className="mp-mitem__body">
          <span className="mp-mitem__label">{label}</span>
          {desc && <span className="mp-mitem__desc">{desc}</span>}
        </div>

        {badge && (
          <span className={pillCls} aria-label={
            badgeType === "notif" ? `${badge} unread` : undefined
          }>
            {badge}
          </span>
        )}

        <span className="mp-mitem__arrow"><I.chevron /></span>
      </Link>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ERROR BANNER
═══════════════════════════════════════════════════════════════ */
const ErrorBanner = memo(function ErrorBanner({ message, onRetry, isRetrying }) {
  return (
    <motion.div
      className="mp-error"
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14, scale: 0.94 }}
      transition={spring}
    >
      <div className="mp-error__row">
        <span className="mp-error__icon"><I.wifi /></span>
        <div>
          <p className="mp-error__title">Connection issue</p>
          <p className="mp-error__msg">{message}</p>
        </div>
      </div>
      <motion.button
        className="mp-error__btn"
        onClick={onRetry}
        disabled={isRetrying}
        whileTap={isRetrying ? {} : { scale: 0.95 }}
      >
        {isRetrying
          ? <><span className="mp-spinner-sm" /> Refreshing…</>
          : <><I.refresh /> Tap to retry</>
        }
      </motion.button>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const Skeleton = memo(function Skeleton() {
  return (
    <div className="mp-skeletons" aria-label="Loading listings">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mp-sk-card">
          <div className="mp-sk-img mp-shimmer" />
          <div className="mp-sk-body">
            <div className="mp-sk-line mp-shimmer" style={{ width: "75%" }} />
            <div className="mp-sk-line mp-shimmer" style={{ width: "45%", height: "9px" }} />
          </div>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
const BottomNav = memo(function BottomNav({ currentPath, unreadCount }) {
  const navigate = useNavigate();

  const tabs = useMemo(() => [
    { to: "/",              icon: <I.home />,      label: "Home"     },
    { to: "/minimart",      icon: <I.search />,    label: "Browse"   },
    { to: "/minimart/add",  icon: null,            label: "Post",     isPrimary: true },
    { to: "/conversations", icon: <I.messages />,  label: "Chat",     badge: null },
    { to: "/profile",       icon: <I.user />,      label: "Profile"  },
  ], []);

  return (
    <motion.nav
      className="mp-bottom-nav"
      aria-label="Bottom navigation"
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ ...softSpring, delay: 0.5 }}
    >
      {tabs.map((tab) => {
        const active = currentPath === tab.to ||
          (tab.to === "/profile" && currentPath.startsWith("/profile"));

        if (tab.isPrimary) {
          return (
            <motion.button
              key="post"
              className="mp-bottom-nav__fab"
              onClick={() => navigate(tab.to)}
              aria-label="Post listing"
              whileTap={{ scale: 0.88 }}
              whileHover={{ scale: 1.08 }}
            >
              <I.plus />
            </motion.button>
          );
        }

        return (
          <motion.button
            key={tab.to}
            className={`mp-bottom-nav__tab${active ? " mp-bottom-nav__tab--active" : ""}`}
            onClick={() => navigate(tab.to)}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            whileTap={{ scale: 0.88 }}
          >
            <span className="mp-bottom-nav__icon">
              {tab.icon}
              {tab.to === "/conversations" && unreadCount > 0 && (
                <span className="mp-bottom-nav__badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="mp-bottom-nav__label">{tab.label}</span>
            {active && (
              <motion.div
                className="mp-bottom-nav__indicator"
                layoutId="nav-indicator"
                transition={spring}
              />
            )}
          </motion.button>
        );
      })}
    </motion.nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SCROLL TO TOP FAB
═══════════════════════════════════════════════════════════════ */
const ScrollTopFab = memo(function ScrollTopFab() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fn = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          className="mp-fab-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          initial={{ opacity: 0, scale: 0, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0, y: 20 }}
          transition={popSpring}
          whileTap={{ scale: 0.86 }}
        >
          <I.arrowUp />
        </motion.button>
      )}
    </AnimatePresence>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
const Toast = memo(function Toast({ msg, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="mp-toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.9 }}
          transition={spring}
        >
          <I.check /> {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN — MOBILE PROFILE
═══════════════════════════════════════════════════════════════ */
export default function MobileProfile({ onLogout }) {
  const navigate     = useNavigate();
  const location     = useLocation();
  const currentPath  = location.pathname;
  const queryClient  = useQueryClient();

  const menuRef       = useRef(null);
  const pageRef       = useRef(null);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [isRetrying,  setIsRetrying]  = useState(false);
  const [toast,       setToast]       = useState({ show: false, msg: "" });

  /* ── Scroll tracking for parallax ── */
  const { scrollY } = useScroll({ container: pageRef });

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
    retry: (count, err) => {
      const s = err?.response?.status;
      return s !== 401 && s !== 403 && count < 3;
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
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    enabled: !!getToken(),
    refetchInterval: 60_000,
  });

  const { data: subStatus = null } = useQuery({
    queryKey: ["profile-subscription-status"],
    queryFn: fetchSubscriptionStatus,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
    enabled: !!getToken(),
  });

  const menuSections = useMemo(
    () => buildMenuSections(unreadCount, subStatus),
    [unreadCount, subStatus]
  );

  /* ── Pull to refresh ── */
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile-user"] }),
      queryClient.invalidateQueries({ queryKey: ["profile-listings"] }),
    ]);
    showToast("Feed refreshed");
  }, [queryClient]);

  const { containerRef, pullY, pulling, refreshing } =
    usePullToRefresh(handleRefresh, 80);

  /* ── Toast helper ── */
  const showToast = useCallback((msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: "" }), 2500);
  }, []);

  /* ── Auth redirect ── */
  useEffect(() => {
    if (!getToken()) { navigate("/auth"); return; }
    if (userIsError) {
      const s = userError?.response?.status;
      if (s === 401 || s === 403) {
        ["marketplace_token", "token"].forEach((k) => localStorage.removeItem(k));
        navigate("/auth");
      }
    }
  }, [userIsError, userError, navigate]);

  /* ── Outside click (menu) ── */
  useEffect(() => {
    const fn = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    document.addEventListener("touchstart", fn, { passive: true });
    return () => {
      document.removeEventListener("mousedown", fn);
      document.removeEventListener("touchstart", fn);
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
    try { await Promise.all([refetchUser(), refetchListings()]); }
    finally { setIsRetrying(false); }
  }, [refetchUser, refetchListings]);

  const goEdit    = useCallback(() => navigate("/profile/edit"),  [navigate]);
  const goViewAll = useCallback(() => navigate("/dashboard"),     [navigate]);

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

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="mp-root" role="main">

      {/* ── Sticky top header ── */}
      <motion.div
        className="mp-top-bar"
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={softSpring}
      >
        <ProfileHeader
          title="Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onEdit={goEdit}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
        />
      </motion.div>

      {/* ── Pull-to-refresh indicator ── */}
      <PullIndicator pullY={pullY} refreshing={refreshing} />

      {/* ── Scroll container ── */}
      <div
        className="mp-scroll"
        ref={(node) => {
          pageRef.current = node;
          containerRef.current = node;
        }}
      >
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

        {/* Hero */}
        <HeroSection
          user={user}
          joinedLabel={joinedLabel}
          subStatus={subStatus}
          onEdit={goEdit}
          listingsCount={listings.length}
          scrollY={scrollY}
        />

        {/* Listings */}
        {listingsLoading ? (
          <Skeleton />
        ) : (
          <ListingsSection listings={listings} onViewAll={goViewAll} />
        )}

        {/* Subscription */}
        <SubBanner
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
        <ReferralBanner code={user?.referral_code} />

        {/* Menu sections */}
        <div className="mp-menu-wrap">
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
                >
                  {section.icon}
                </span>
                <h3
                  className="mp-msection__title"
                  id={`sec-${section.title}`}
                >
                  {section.title}
                </h3>
              </div>

              <motion.div
                className="mp-msection__list"
                role="list"
                aria-labelledby={`sec-${section.title}`}
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={viewOnce}
              >
                {section.items.map(({ to, Ic, label, desc, badge, badgeType }, i) => (
                  <MenuItem
                    key={to}
                    to={to}
                    Ic={Ic}
                    label={label}
                    desc={desc}
                    badge={badge}
                    badgeType={badgeType}
                    isActive={currentPath === to}
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
            viewport={viewOnce}
            whileTap={{ scale: 0.96 }}
          >
            <I.logout />
            <span>Log Out</span>
          </motion.button>
        </div>

        {/* Footer */}
        <p className="mp-footer">
          Loemart Technologies Ltd · {new Date().getFullYear()}
        </p>

        {/* Bottom nav spacer */}
        <div style={{ height: "var(--mp-nav-h, 72px)" }} aria-hidden="true" />
      </div>

      {/* ── Overlays ── */}
      <BottomNav currentPath={currentPath} unreadCount={unreadCount} />
      <ScrollTopFab />
      <Toast msg={toast.msg} visible={toast.show} />
    </div>
  );
}
