// src/pages/Homepage/LatestPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import Footer      from "../../components/Footer";
import MasonryCard from "../../components/MasonryCard";
import CATEGORIES  from "../../config/categories";
import "../../styles/LatestPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const ALL_CAT  = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

/* ══════════════════════════════════════════════════════════════
   SVG ICON SYSTEM  (replaces all emoji)
══════════════════════════════════════════════════════════════ */
const Icon = {
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <path d="M20 11H7.83l5.59-5.59L12
               4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  Share: () => (
    <svg width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="18" cy="5"  r="3"/>
      <circle cx="6"  cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
    </svg>
  ),
  Clock: () => (
    <svg width="10" height="10" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0114.85-3.36L23
               10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M18 15l-6-6-6 6"/>
    </svg>
  ),
  Flash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Today: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <circle cx="12" cy="16" r="1" fill="currentColor"/>
    </svg>
  ),
  Yesterday: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l-3 3"/>
    </svg>
  ),
  Week: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18M8 14h8M8 18h5"/>
    </svg>
  ),
  Month: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M7 15h10M7 19h6"
            stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Archive: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  Empty: () => (
    <svg width="56" height="56" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round"
         aria-hidden="true">
      <path d="M21 10H3M16 2v4M8 2v4M3 6h18v14a2
               2 0 01-2 2H5a2 2 0 01-2-2V6z"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"
            strokeWidth="2.5"/>
    </svg>
  ),
  Error: () => (
    <svg width="44" height="44" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8"  x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"
            strokeWidth="2.5"/>
    </svg>
  ),
  Done: () => (
    <svg width="28" height="28" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round"
         aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Bell: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3
               9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round"
         aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0
               01-2.83 0L2 12V2h10l8.59 8.59a2
               2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"
            strokeWidth="3"/>
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27
                        17 14.14 18.18 21.02 12 17.77
                        5.82 21.02 7 14.14 2 9.27
                        8.91 8.26 12 2"/>
    </svg>
  ),
  Filter: () => (
    <svg width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round"
         aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19
                        14 21 14 12.46 22 3"/>
    </svg>
  ),
  Check: () => (
    <svg width="11" height="11" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         strokeWidth="3" strokeLinecap="round"
         aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   GROUP CONFIG  — SVG icons replace emoji
══════════════════════════════════════════════════════════════ */
const GROUP_CONFIG = {
  "Just Added" : { Icon: Icon.Flash,     cls: "lt-dg--new"   },
  "Today"      : { Icon: Icon.Today,     cls: "lt-dg--today" },
  "Yesterday"  : { Icon: Icon.Yesterday, cls: "lt-dg--yest"  },
  "This Week"  : { Icon: Icon.Week,      cls: "lt-dg--week"  },
  "This Month" : { Icon: Icon.Month,     cls: "lt-dg--month" },
  "Older"      : { Icon: Icon.Archive,   cls: "lt-dg--old"   },
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price             : Number(p.price             || 0),
    engagement_score  : Number(p.engagement_score  || 0),
    clicks_count      : Number(p.clicks_count      || 0),
    impression_count  : Number(p.impression_count  || 0),
    views             : Number(p.views             || 0),
    favorites_count   : Number(p.favorites_count   || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    is_promoted       : !!p.is_promoted,
    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image || p.thumbnail_url || null,
    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
    created_at    : p.created_at || null,
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const timeAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
};

const isJustAdded = (dateStr) => {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 3_600_000;
};

const getDateGroup = (dateStr) => {
  if (!dateStr) return "Older";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (diff < 3_600_000)  return "Just Added";
  if (diff < 86_400_000) return "Today";
  if (days === 1)        return "Yesterday";
  if (days < 7)          return "This Week";
  if (days < 30)         return "This Month";
  return "Older";
};

const groupByDate = (products) => {
  const ORDER = [
    "Just Added","Today","Yesterday",
    "This Week","This Month","Older",
  ];
  const groups = {};
  products.forEach((p) => {
    const g = getDateGroup(p.created_at);
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });
  return ORDER
    .filter((g) => groups[g]?.length > 0)
    .map((g) => ({ label: g, items: groups[g] }));
};

/* ══════════════════════════════════════════════════════════════
   FETCH
══════════════════════════════════════════════════════════════ */
async function fetchLatestPage({ page = 0, category } = {}) {
  const params = new URLSearchParams({
    section : "latest",
    page,
    limit   : PAGE_SIZE,
    sort    : "created_desc",
  });
  if (category && category !== "all") params.set("category_id", category);
  const res = await fetch(`${API}/homepage?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   HOOK — detect desktop
══════════════════════════════════════════════════════════════ */
function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isDesktop;
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Live clock ── */
function LiveClock({ elite = false }) {
  const fmt = () => new Date().toLocaleTimeString("en-NG", {
    hour: "2-digit", minute: "2-digit",
  });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={elite ? "elite-clock" : "lt-clock"}>
      {time}
    </span>
  );
}

/* ── Latest card wrapper ── */
const LatestCardWrapper = memo(function LatestCardWrapper({
  product, priority, onView, onClick, elite = false,
}) {
  const ago       = timeAgo(product.created_at);
  const justAdded = isJustAdded(product.created_at);
  return (
    <div className={`lt-card-wrap${justAdded
      ? " lt-card-wrap--new" : ""}${elite
      ? " lt-card-wrap--elite" : ""}`}>
      {ago && (
        <div className={elite ? "elite-ago-badge" : "lt-ago-badge"}>
          <Icon.Clock />
          {ago}
        </div>
      )}
      {justAdded && (
        <span className="lt-new-ring" aria-hidden="true" />
      )}
      <MasonryCard
        product={product}
        priority={priority}
        onView={onView}
        onClick={onClick}
      />
    </div>
  );
});

/* ── Date group separator ── */
const LatestDateGroup = memo(function LatestDateGroup({
  label, count, elite = false,
}) {
  const cfg   = GROUP_CONFIG[label] ?? { Icon: Icon.Archive, cls: "" };
  const DIcon = cfg.Icon;
  return (
    <div className={`lt-dg ${cfg.cls}${elite ? " lt-dg--elite" : ""}`}
         role="separator">
      <span className="lt-dg-icon-wrap" aria-hidden="true">
        <DIcon />
      </span>
      <span className="lt-dg-label">{label}</span>
      <span className="lt-dg-count">
        {count} item{count !== 1 ? "s" : ""}
      </span>
      <div className="lt-dg-line" aria-hidden="true" />
    </div>
  );
});

/* ── Toast ── */
function NewArrivalToast({ count, onDismiss, elite = false }) {
  if (!count || count <= 0) return null;
  return (
    <button
      className={elite ? "elite-toast" : "lt-toast"}
      onClick={onDismiss}
      aria-live="polite"
    >
      <span className={elite
        ? "elite-toast-dot" : "lt-toast-dot"}
            aria-hidden="true" />
      <Icon.Bell />
      {count} new listing{count !== 1 ? "s" : ""} — tap to refresh
    </button>
  );
}

/* ── Scroll top ── */
function ScrollTopBtn({ elite = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`${elite
        ? "elite-scroll-top" : "lt-scroll-top"}${
        visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <Icon.ChevronUp />
    </button>
  );
}

/* ── Empty ── */
function EmptyState({
  category, onClearCategory, onBrowseAll, elite = false,
}) {
  return (
    <div className={elite ? "elite-empty" : "lt-empty"} role="status">
      <span className={elite
        ? "elite-empty-icon-wrap" : "lt-empty-icon-wrap"}>
        <Icon.Empty />
      </span>
      <h3 className={elite ? "elite-empty-title" : "lt-empty-title"}>
        {category !== "all"
          ? "No new listings in this category"
          : "No new listings yet"}
      </h3>
      <p className={elite ? "elite-empty-sub" : "lt-empty-sub"}>
        {category !== "all"
          ? "Try a different category or check back soon."
          : "New products are listed every day. Check back soon!"}
      </p>
      {category !== "all" ? (
        <button
          className={elite ? "elite-empty-btn" : "lt-empty-btn"}
          onClick={onClearCategory}
        >
          Show All Categories
        </button>
      ) : (
        <button
          className={elite ? "elite-empty-btn" : "lt-empty-btn"}
          onClick={onBrowseAll}
        >
          Browse All Listings
        </button>
      )}
    </div>
  );
}

/* ── Error ── */
function ErrorBanner({ message, onRetry, elite = false }) {
  return (
    <div className={elite ? "elite-err" : "lt-err"} role="alert">
      <span className={elite
        ? "elite-err-icon-wrap" : "lt-err-icon-wrap"}>
        <Icon.Error />
      </span>
      <p className={elite ? "elite-err-title" : "lt-err-title"}>
        Could not load new arrivals
      </p>
      <p className={elite ? "elite-err-msg" : "lt-err-msg"}>
        {message}
      </p>
      <button
        className={elite ? "elite-err-btn" : "lt-err-btn"}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE-ONLY COMPONENTS
══════════════════════════════════════════════════════════════ */
const LatestHeader = memo(function LatestHeader({ onBack }) {
  return (
    <div className="lt-header">
      <button className="lt-back" onClick={onBack}
              aria-label="Go back">
        <Icon.Back />
      </button>
      <div className="lt-title-wrap">
        <h1 className="lt-title">New Arrivals</h1>
        <span className="lt-chip">
          <span className="lt-chip-dot" aria-hidden="true" />
          Live Feed
        </span>
      </div>
      <div className="lt-header-right">
        <LiveClock />
        <button className="lt-share"
                aria-label="Share new arrivals"
          onClick={() => {
            navigator.share?.({
              title: "Loemart New Arrivals",
              text : "See the latest listings on Loemart!",
              url  : window.location.href,
            }).catch(() => {});
          }}
        >
          <Icon.Share />
        </button>
      </div>
    </div>
  );
});

const LatestTimeBar = memo(function LatestTimeBar({
  total, category, onCategoryChange, lastUpdated, loading,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;
  return (
    <div className="lt-timebar">
      <div className="lt-timebar-top">
        {loading ? (
          <div className="lt-timebar-sk lt-shimmer" />
        ) : (
          <div className="lt-timebar-info">
            <span className="lt-timebar-count">
              <strong>{(total || 0).toLocaleString()}</strong>
              {" "}new listing{total !== 1 ? "s" : ""}
            </span>
            {timeLabel && (
              <span className="lt-timebar-updated">
                Updated {timeLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="lt-cat-scroll" role="tablist">
        {CAT_LIST.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={category === cat.id}
            className={`lt-cat-pill${
              category === cat.id ? " lt-cat-pill--active" : ""
            }`}
            onClick={() => onCategoryChange(cat.id)}
          >
            <span aria-hidden="true">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
});

const SKEL_HEIGHTS = [250, 310, 230, 290, 270, 240, 320, 260, 280, 250];
const LatestSkeleton = memo(function LatestSkeleton() {
  return (
    <>
      <div className="lt-timebar-full-sk lt-shimmer"
           aria-hidden="true" />
      <div className="lt-dg-sk lt-shimmer" aria-hidden="true" />
      <div className="lt-masonry" aria-busy="true">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="lt-sk lt-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   DESKTOP ELITE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Elite Hero ── */
const EliteLatestHero = memo(function EliteLatestHero({
  total, loading, lastUpdated,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="elite-lt-hero">
      <div className="elite-lt-hero-bg" aria-hidden="true">
        <div className="elite-lt-orb elite-lt-orb--1" />
        <div className="elite-lt-orb elite-lt-orb--2" />
        <div className="elite-lt-orb elite-lt-orb--3" />
        <div className="elite-lt-grid" />
      </div>

      <div className="elite-lt-hero-content">
        {/* Live badge */}
        <div className="elite-lt-live-badge">
          <span className="elite-lt-live-dot" />
          <span className="elite-lt-live-text">LIVE FEED</span>
          <LiveClock elite />
        </div>

        {/* Title */}
        <h1 className="elite-lt-title">
          New{" "}
          <span className="elite-lt-title-accent">Arrivals</span>
        </h1>

        <p className="elite-lt-sub">
          The freshest listings — updated every 30 seconds
        </p>

        {/* Stats */}
        {!loading && (
          <div className="elite-lt-stats">
            <div className="elite-lt-stat">
              <span className="elite-lt-stat-num">
                {(total || 0).toLocaleString()}
              </span>
              <span className="elite-lt-stat-label">New Listings</span>
            </div>
            <div className="elite-lt-stat-div" />
            <div className="elite-lt-stat">
              <span className="elite-lt-stat-num">30s</span>
              <span className="elite-lt-stat-label">Refresh Rate</span>
            </div>
            <div className="elite-lt-stat-div" />
            <div className="elite-lt-stat">
              <span className="elite-lt-stat-num">
                {timeLabel ?? "—"}
              </span>
              <span className="elite-lt-stat-label">Last Updated</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Elite Sidebar ── */
const EliteLatestSidebar = memo(function EliteLatestSidebar({
  category, onCategoryChange, total, onBack,
}) {
  return (
    <aside className="elite-lt-sidebar">

      {/* Brand */}
      <div className="eltsb-brand">
        <div className="eltsb-brand-icon">
          <Icon.Layers />
        </div>
        <div>
          <span className="eltsb-brand-name">Loemart</span>
          <span className="eltsb-brand-sub">New Arrivals</span>
        </div>
      </div>

      {/* Live counter */}
      <div className="eltsb-live-counter">
        <div className="eltsb-live-pulse" aria-hidden="true" />
        <div>
          <span className="eltsb-live-num">
            {(total || 0).toLocaleString()}
          </span>
          <span className="eltsb-live-label">listings live</span>
        </div>
      </div>

      {/* Category filter */}
      <div className="eltsb-section">
        <div className="eltsb-section-head">
          <span className="eltsb-section-icon">
            <Icon.Filter />
          </span>
          <span className="eltsb-section-title">Category</span>
        </div>
        <div className="eltsb-cats">
          {CAT_LIST.map((cat) => (
            <button
              key={cat.id}
              className={`eltsb-cat${
                category === cat.id ? " eltsb-cat--active" : ""
              }`}
              onClick={() => onCategoryChange(cat.id)}
              aria-pressed={category === cat.id}
            >
              <span className="eltsb-cat-icon">{cat.icon}</span>
              <span className="eltsb-cat-name">{cat.name}</span>
              {category === cat.id && (
                <span className="eltsb-cat-check">
                  <Icon.Check />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Share */}
      <button className="eltsb-share"
        onClick={() => {
          navigator.share?.({
            title: "Loemart New Arrivals",
            text : "See the latest listings on Loemart!",
            url  : window.location.href,
          }).catch(() => {});
        }}
      >
        <Icon.Share />
        Share Feed
      </button>

      {/* Back */}
      <button className="eltsb-back" onClick={onBack}>
        <Icon.Back />
        All Listings
      </button>
    </aside>
  );
});

/* ── Elite Top Bar ── */
const EliteLatestTopBar = memo(function EliteLatestTopBar({
  total, loading, lastUpdated, onRefresh,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="elite-lt-topbar">
      <div className="elite-lt-topbar-left">
        <nav className="elite-lt-breadcrumb"
             aria-label="Breadcrumb">
          <span className="elite-lt-bc-home">Home</span>
          <span className="elite-lt-bc-sep">›</span>
          <span className="elite-lt-bc-current">New Arrivals</span>
        </nav>
        {!loading && total > 0 && (
          <span className="elite-lt-topbar-count">
            {total.toLocaleString()} listings
          </span>
        )}
        {timeLabel && (
          <span className="elite-lt-topbar-updated">
            <span className="elite-lt-topbar-pulse"
                  aria-hidden="true" />
            Updated {timeLabel}
          </span>
        )}
      </div>

      <div className="elite-lt-topbar-right">
        <button
          className="elite-lt-refresh-btn"
          onClick={onRefresh}
        >
          <Icon.Refresh />
          Refresh
        </button>
      </div>
    </div>
  );
});

/* ── Elite Skeleton ── */
const ELITE_SKEL = [
  260,330,240,300,280,250,340,270,
  290,260,250,310,230,280,260,300,
];

const EliteLatestSkeleton = memo(function EliteLatestSkeleton() {
  return (
    <>
      <div className="elite-lt-dg-sk" aria-hidden="true" />
      <div className="lt-masonry lt-masonry--desktop"
           aria-busy="true">
        {ELITE_SKEL.map((h, i) => (
          <div key={i} className="elite-lt-sk"
               style={{ height: h }} aria-hidden="true">
            <div className="elite-lt-sk-img"
                 style={{ height: Math.round(h * 0.64) }} />
            <div className="elite-lt-sk-body">
              <div className="elite-lt-sk-line elite-lt-sk-line--w" />
              <div className="elite-lt-sk-line elite-lt-sk-line--m" />
              <div className="elite-lt-sk-line elite-lt-sk-line--s" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LatestPage({ user }) {
  const navigate  = useNavigate();
  const isDesktop = useIsDesktop();

  const [category,    setCategory]    = useState("all");
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newCount,    setNewCount]    = useState(0);

  const firstIdRef  = useRef(null);
  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Load ── */
  const load = useCallback(async (pg = 0, append = false, cat) => {
    try {
      const data = await fetchLatestPage({ page: pg, category: cat });
      const raw  = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
      const merged = append
        ? dedup([...productsRef.current, ...normalized])
        : normalized;
      productsRef.current = merged;
      setProducts(merged);
      setTotal(data.meta?.total ?? merged.length);
      setHasMore(
        data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE
      );
      setLastUpdated(Date.now());
    } catch (err) {
      if (!append) setError(err.message || "Could not load new arrivals.");
    }
  }, []);

  /* ── Initial + category change ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    firstIdRef.current  = null;
    productsRef.current = [];
    load(0, false, category).finally(() => setLoading(false));
  }, [category, load]);

  /* ── Auto-refresh 30s ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (!loading && !loadingMore) {
        fetchLatestPage({ page: 0, category })
          .then((data) => {
            const raw = Array.isArray(data.products)
              ? data.products : [];
            const normalized = dedup(raw)
              .map(normalizeProduct).filter(Boolean);
            if (normalized.length > 0 && firstIdRef.current) {
              const topId = normalized[0]?.id;
              if (topId !== firstIdRef.current) {
                const newIdx = normalized.findIndex(
                  (p) => p.id === firstIdRef.current
                );
                setNewCount(newIdx > 0 ? newIdx : 1);
              }
            }
          })
          .catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [loading, loadingMore, category]);

  /* ── Track first id ── */
  useEffect(() => {
    if (products.length > 0 && !firstIdRef.current) {
      firstIdRef.current = products[0]?.id;
    }
  }, [products]);

  const groups = useMemo(() => groupByDate(products), [products]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true, category);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, load]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  /* ── Analytics ── */
  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    productsRef.current = [];
    load(0, false, category).finally(() => setLoading(false));
  }, [load, category]);

  const handleRefresh = useCallback(() => {
    setNewCount(0);
    firstIdRef.current = null;
    setLoading(true);
    productsRef.current = [];
    load(0, false, category).finally(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [category, load]);

  /* ── Shared grouped grid ── */
  const GroupedGrid = ({ elite = false }) => (
    <>
      {groups.map((group) => (
        <section key={group.label}>
          <LatestDateGroup
            label={group.label}
            count={group.items.length}
            elite={elite}
          />
          <div
            className={`lt-masonry${
              elite ? " lt-masonry--desktop" : ""
            }`}
            role="list"
            aria-label={`${group.label} listings`}
          >
            {group.items.map((p, i) => (
              <div key={p.id} role="listitem">
                <LatestCardWrapper
                  product={p}
                  priority={i < (elite ? 8 : 4)}
                  onView={trackView}
                  onClick={handleClick}
                  elite={elite}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <div ref={sentinelRef} aria-hidden="true"
           style={{ height: 1 }} />

      {loadingMore && (
        <div
          className={elite
            ? "elite-lt-loading-more" : "lt-loading-more"}
          aria-live="polite"
        >
          {elite ? (
            <div className="elite-lt-dots">
              <span /><span /><span />
            </div>
          ) : (
            <span className="lt-spinner" aria-hidden="true" />
          )}
          Loading more…
        </div>
      )}

      {!hasMore && products.length > 0 && (
        elite ? (
          <div className="elite-lt-feed-end">
            <div className="elite-lt-feed-end-line" />
            <div className="elite-lt-feed-end-content">
              <span className="elite-lt-feed-end-icon">
                <Icon.Done />
              </span>
              <p className="elite-lt-feed-end-text">
                You're all caught up
              </p>
              <button
                className="elite-lt-feed-end-btn"
                onClick={() => navigate("/")}
              >
                Browse all listings
                <Icon.ArrowRight />
              </button>
            </div>
            <div className="elite-lt-feed-end-line" />
          </div>
        ) : (
          <div className="lt-feed-end-wrap">
            <p className="lt-feed-end">You're all caught up</p>
            <button
              className="lt-feed-end-btn"
              onClick={() => navigate("/")}
            >
              Browse all listings
              <Icon.ArrowRight />
            </button>
          </div>
        )
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════
     DESKTOP RENDER
  ══════════════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="lt-root lt-root--elite">
        <TopNav user={user} />

        <NewArrivalToast
          count={newCount}
          onDismiss={handleRefresh}
          elite
        />

        <EliteLatestHero
          total={total}
          loading={loading}
          lastUpdated={lastUpdated}
        />

        <div className="elite-lt-layout">
          <EliteLatestSidebar
            category={category}
            onCategoryChange={(cat) => {
              setCategory(cat);
              setPage(0);
            }}
            total={total}
            onBack={() => navigate("/")}
          />

          <main className="elite-lt-main" id="lt-main">
            <EliteLatestTopBar
              total={total}
              loading={loading}
              lastUpdated={lastUpdated}
              onRefresh={handleRefresh}
            />

            {error && (
              <ErrorBanner
                message={error}
                onRetry={handleRetry}
                elite
              />
            )}

            {loading && <EliteLatestSkeleton />}

            {!loading && !error && products.length === 0 && (
              <EmptyState
                category={category}
                onClearCategory={() => setCategory("all")}
                onBrowseAll={() => navigate("/")}
                elite
              />
            )}

            {!loading && products.length > 0 && (
              <GroupedGrid elite />
            )}

            {!loading && <Footer />}
          </main>
        </div>

        <ScrollTopBtn elite />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="lt-root">
      <TopNav user={user} />

      <NewArrivalToast count={newCount} onDismiss={handleRefresh} />

      <main className="lt-page" id="lt-main">
        <LatestHeader onBack={() => navigate(-1)} />

        <LatestTimeBar
          total={total}
          category={category}
          onCategoryChange={setCategory}
          lastUpdated={lastUpdated}
          loading={loading}
        />

        {error && (
          <ErrorBanner message={error} onRetry={handleRetry} />
        )}

        {loading && <LatestSkeleton />}

        {!loading && !error && products.length === 0 && (
          <EmptyState
            category={category}
            onClearCategory={() => setCategory("all")}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {!loading && <GroupedGrid />}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}