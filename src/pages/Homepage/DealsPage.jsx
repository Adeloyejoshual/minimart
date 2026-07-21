// src/pages/DealsPage.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import "../../styles/DealsPage.css";

/* ══════════════════════════════════════════════════════════════
   ICONS  (inline SVG — zero dependencies)
══════════════════════════════════════════════════════════════ */
const Icon = {
  Back: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  ),
  Share: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  ),
  MapPin: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59
        8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Filter: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Sort: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 20V4" />
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
      strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12
        17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  Home: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Flame: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072
        -2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3
        5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/>
    </svg>
  ),
  Grid: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Check: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   MOCK DATA GENERATOR
══════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  "Electronics", "Fashion", "Home & Living", "Sports",
  "Beauty", "Toys", "Books", "Food & Drink",
];
const LOCATIONS = [
  "New York", "Los Angeles", "Chicago", "Miami",
  "Seattle", "Austin", "Boston", "Denver",
];
const BADGES = [
  { label: "HOT",      bg: "#ff3d00", color: "#fff" },
  { label: "NEW",      bg: "#0ea5e9", color: "#fff" },
  { label: "SALE",     bg: "#7c3aed", color: "#fff" },
  { label: "LIMITED",  bg: "#f59e0b", color: "#fff" },
  { label: "TRENDING", bg: "#10b981", color: "#fff" },
];
const NAMES = [
  "AirPods Pro Max Gen3","Vintage Leather Jacket","Smart Coffee Maker",
  "Yoga Mat Premium","Skincare Bundle Kit","LEGO Technic Set",
  "Organic Green Tea","Running Shoes Ultra","4K Monitor 32\"",
  "Silk Pillowcase","Portable Blender","Gaming Chair Pro",
  "Wireless Earbuds","Winter Coat Oversized","Air Purifier HEPA",
  "Resistance Bands Set","Vitamin C Serum","Harry Potter Box Set",
  "Espresso Machine","Trail Running Vest","Mechanical Keyboard",
  "Linen Shirt Summer","Smart Plant Pot","Foam Roller Deep Tissue",
  "Face Mask Pack 30","Puzzle 1000 Pieces","Matcha Starter Kit",
  "Basketball Shoes","Curved Ultrawide Monitor","Cashmere Scarf",
];

function makeDeals(count = 30, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const id       = offset + i + 1;
    const price    = Math.floor(Math.random() * 480 + 19);
    const orig     = Math.floor(price * (1 + Math.random() * 0.8 + 0.2));
    const discount = Math.round((1 - price / orig) * 100);
    const h        = 120 + Math.floor(Math.random() * 220);
    const badge    = Math.random() > 0.45
      ? BADGES[Math.floor(Math.random() * BADGES.length)]
      : null;
    return {
      id,
      name    : NAMES[(id - 1) % NAMES.length],
      price,
      orig,
      discount,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      verified: Math.random() > 0.35,
      badge,
      imgH    : h,
      hue     : (id * 47) % 360,
      seed    : id,
    };
  });
}

const SORT_OPTIONS = [
  { value: "newest",   label: "Newest"   },
  { value: "price_lo", label: "Price ↑"  },
  { value: "price_hi", label: "Price ↓"  },
  { value: "discount", label: "% Off"    },
];

const CATEGORY_OPTIONS = [
  { value: "all",           label: "All Categories" },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];

/* ══════════════════════════════════════════════════════════════
   SORT + FILTER UTILS
══════════════════════════════════════════════════════════════ */
function applyFilters(deals, { category, sort }) {
  let out = category === "all"
    ? [...deals]
    : deals.filter((d) => d.category === category);

  if (sort === "price_lo") out.sort((a, b) => a.price - b.price);
  else if (sort === "price_hi") out.sort((a, b) => b.price - a.price);
  else if (sort === "discount") out.sort((a, b) => b.discount - a.discount);

  return out;
}

/* ══════════════════════════════════════════════════════════════
   DEAL CARD  (masonry item)
══════════════════════════════════════════════════════════════ */
function DealCard({ deal, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  /* Placeholder gradient image */
  const imgSrc = useMemo(() => {
    const colors = [
      ["f8f0ff","c084fc"], ["e0f2fe","38bdf8"], ["d1fae5","34d399"],
      ["fef3c7","fbbf24"], ["ffe4e6","fb7185"], ["f0fdf4","4ade80"],
    ];
    const [bg, fg] = colors[deal.seed % colors.length];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg'
      width='300' height='${deal.imgH}'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='%23${bg}'/>
          <stop offset='100%' stop-color='%23${fg}'/>
        </linearGradient>
      </defs>
      <rect width='300' height='${deal.imgH}' fill='url(%23g)'/>
      <text x='50%25' y='50%25' dominant-baseline='middle'
        text-anchor='middle' font-size='28' opacity='.25'>🛍️</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }, [deal.imgH, deal.seed]);

  return (
    <div className="masonry-card" onClick={() => onClick?.(deal)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(deal)}
      aria-label={`${deal.name} — $${deal.price}`}>

      {/* Badge */}
      {deal.badge && (
        <span className="bd"
          style={{ background: deal.badge.bg, color: deal.badge.color }}>
          {deal.badge.label}
        </span>
      )}

      {/* Image */}
      <div style={{ position: "relative", overflow: "hidden",
        height: deal.imgH, background: "#f0f0f4" }}>
        {!imgLoaded && (
          <div style={{ position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.04)" }}
            className="deals-shimmer" />
        )}
        <img
          src={imgSrc}
          alt={deal.name}
          className="masonry-img"
          style={{ height: deal.imgH, opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.3s ease" }}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
        />
        {/* Discount pill */}
        {deal.discount > 0 && (
          <span style={{
            position: "absolute", bottom: 7, right: 7,
            background: "rgba(231,76,60,0.92)",
            backdropFilter: "blur(6px)",
            color: "#fff", fontSize: "0.62rem", fontWeight: 800,
            padding: "2px 7px", borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.15)",
          }}>
            -{deal.discount}%
          </span>
        )}
      </div>

      {/* Body */}
      <div className="masonry-body">
        <p className="masonry-name">{deal.name}</p>
        <p className="masonry-price">${deal.price.toLocaleString()}</p>
        {deal.orig && (
          <p style={{ fontSize: "0.68rem", color: "var(--deals-text-muted)",
            textDecoration: "line-through", margin: "0 0 3px",
            fontWeight: 400 }}>
            ${deal.orig.toLocaleString()}
          </p>
        )}
        <p className="masonry-loc">
          <Icon.MapPin />
          {deal.location}
        </p>
        {deal.verified && (
          <p className="vfd">✓ Verified Deal</p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SKELETON CARD
══════════════════════════════════════════════════════════════ */
function SkeletonCard({ height = 160, elite = false }) {
  if (elite) {
    return (
      <div className="elite-sk">
        <div className="elite-sk-img" style={{ height }} />
        <div className="elite-sk-body">
          <div className="elite-sk-line elite-sk-line--wide" />
          <div className="elite-sk-line elite-sk-line--mid" />
          <div className="elite-sk-line elite-sk-line--short" />
        </div>
      </div>
    );
  }
  return (
    <div className="dc-sk deals-shimmer" style={{ height: height + 80 }} />
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE HEADER
══════════════════════════════════════════════════════════════ */
function MobileHeader({ totalDeals, onBack, onShare }) {
  return (
    <header className="dh-wrap">
      <button className="dh-back" onClick={onBack}
        aria-label="Go back">
        <Icon.Back />
      </button>

      <div className="dh-title-wrap">
        <h1 className="dh-title">Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" />
          Live
        </span>
      </div>

      <button className="dh-share" onClick={onShare}
        aria-label="Share deals">
        <Icon.Share />
      </button>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE FILTER BAR
══════════════════════════════════════════════════════════════ */
function FilterBar({ total, filtered, sort, category,
  onSort, onCategory }) {
  return (
    <div className="df-bar" role="search" aria-label="Filter deals">
      <span className="df-count">
        {filtered} of {total}
      </span>

      <div className="df-controls">
        {/* Category */}
        <div className="df-select-wrap">
          <label className="df-label" htmlFor="cat-select">
            <Icon.Tag /> Category
          </label>
          <select
            id="cat-select"
            className="df-select"
            value={category}
            onChange={(e) => onCategory(e.target.value)}
            aria-label="Filter by category">
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="df-select-wrap">
          <label className="df-label" htmlFor="sort-select">
            <Icon.Sort /> Sort
          </label>
          <select
            id="sort-select"
            className="df-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label="Sort deals">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ELITE HERO
══════════════════════════════════════════════════════════════ */
function EliteHero({ totalDeals }) {
  return (
    <section className="elite-hero" aria-label="Deals hero banner">
      {/* Animated BG */}
      <div className="elite-hero-bg" aria-hidden="true">
        <div className="elite-hero-grid" />
        <div className="elite-hero-orb elite-hero-orb--1" />
        <div className="elite-hero-orb elite-hero-orb--2" />
        <div className="elite-hero-orb elite-hero-orb--3" />
      </div>

      <div className="elite-hero-content">
        {/* Badge */}
        <div className="elite-hero-badge">
          <span className="elite-hero-badge-dot" aria-hidden="true" />
          Live Marketplace
        </div>

        {/* Title */}
        <h1 className="elite-hero-title">
          Discover{" "}
          <span className="elite-hero-title-accent">
            Exclusive Deals
          </span>
        </h1>
        <p className="elite-hero-sub">
          Curated offers updated in real-time. Save big on top brands.
        </p>

        {/* Stats strip */}
        <div className="elite-hero-stats" role="list">
          {[
            { num: totalDeals.toLocaleString(), label: "Active Deals" },
            { num: "94%",   label: "Verified Sellers" },
            { num: "48h",   label: "Avg. Deal Duration" },
            { num: "$142",  label: "Avg. Savings" },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <div className="elite-hero-stat" role="listitem">
                <span className="elite-hero-stat-num">{s.num}</span>
                <span className="elite-hero-stat-label">{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="elite-hero-stat-divider"
                  aria-hidden="true" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   ELITE SIDEBAR
══════════════════════════════════════════════════════════════ */
function EliteSidebar({ totalDeals, sort, category,
  onSort, onCategory, onBack, onShare }) {

  const cats = [
    { value: "all", label: "All Deals",   icon: <Icon.Grid /> },
    { value: "Electronics", label: "Electronics", icon: <Icon.Zap /> },
    { value: "Fashion",     label: "Fashion",     icon: <Icon.Star /> },
    { value: "Sports",      label: "Sports",      icon: <Icon.Flame /> },
    { value: "Home & Living", label: "Home",      icon: <Icon.Home /> },
  ];

  return (
    <aside className="elite-sidebar" aria-label="Filters sidebar">

      {/* Logo */}
      <div className="esb-logo">
        <div className="esb-logo-icon" aria-hidden="true">
          <Icon.Zap />
        </div>
        <div>
          <span className="esb-logo-text">DealsHub</span>
          <span className="esb-logo-sub">Pro Marketplace</span>
        </div>
      </div>

      {/* Live counter */}
      <div className="esb-counter">
        <div className="esb-counter-pulse" aria-hidden="true" />
        <div className="esb-counter-inner">
          <span className="esb-counter-num"
            aria-label={`${totalDeals} active deals`}>
            {totalDeals.toLocaleString()}
          </span>
          <span className="esb-counter-label">Active Deals Right Now</span>
        </div>
      </div>

      {/* Categories */}
      <div className="esb-section">
        <div className="esb-section-head">
          <span className="esb-section-icon" aria-hidden="true">
            <Icon.Grid />
          </span>
          <span className="esb-section-title">Categories</span>
        </div>
        <div className="esb-options" role="radiogroup"
          aria-label="Category filter">
          {cats.map((c) => (
            <button
              key={c.value}
              className={`esb-opt${category === c.value
                ? " esb-opt--active" : ""}`}
              onClick={() => onCategory(c.value)}
              role="radio"
              aria-checked={category === c.value}
              aria-label={c.label}>
              <span className="esb-opt-icon">{c.icon}</span>
              <span className="esb-opt-label">{c.label}</span>
              {category === c.value && (
                <span className="esb-opt-check" aria-hidden="true">
                  <Icon.Check />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="esb-section">
        <div className="esb-section-head">
          <span className="esb-section-icon" aria-hidden="true">
            <Icon.Sort />
          </span>
          <span className="esb-section-title">Sort By</span>
        </div>
        <div className="esb-options" role="radiogroup"
          aria-label="Sort options">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              className={`esb-opt${sort === s.value
                ? " esb-opt--active" : ""}`}
              onClick={() => onSort(s.value)}
              role="radio"
              aria-checked={sort === s.value}
              aria-label={`Sort by ${s.label}`}>
              <span className="esb-opt-label">{s.label}</span>
              {sort === s.value && (
                <span className="esb-opt-check" aria-hidden="true">
                  <Icon.Check />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <button className="esb-share" onClick={onShare}
        aria-label="Share this page">
        <Icon.Share /> Share Page
      </button>
      <button className="esb-back" onClick={onBack}
        aria-label="Go back">
        <Icon.Back /> Back
      </button>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   ELITE TOP BAR
══════════════════════════════════════════════════════════════ */
function EliteTopBar({ filteredCount, sort, onSort }) {
  return (
    <div className="elite-topbar" role="toolbar"
      aria-label="Deals toolbar">
      <div className="elite-topbar-left">
        {/* Breadcrumb */}
        <nav className="elite-breadcrumb" aria-label="Breadcrumb">
          <span>Home</span>
          <span className="elite-bc-sep" aria-hidden="true"> / </span>
          <span className="elite-bc-current">Deals</span>
        </nav>

        <span className="elite-topbar-count"
          aria-live="polite" aria-atomic="true">
          {filteredCount.toLocaleString()} results
        </span>
      </div>

      {/* Sort pills */}
      <div className="elite-topbar-right" role="group"
        aria-label="Sort options">
        <span className="elite-topbar-sort-label">Sort:</span>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            className={`elite-pill${sort === s.value
              ? " elite-pill--active" : ""}`}
            onClick={() => onSort(s.value)}
            aria-pressed={sort === s.value}
            aria-label={`Sort by ${s.label}`}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ERROR STATE
══════════════════════════════════════════════════════════════ */
function ErrorState({ message, onRetry, elite }) {
  if (elite) {
    return (
      <div className="elite-empty" role="alert">
        <span className="elite-empty-icon">⚠️</span>
        <h2 className="elite-empty-title">Something went wrong</h2>
        <p className="elite-empty-sub">{message}</p>
        <button className="elite-empty-btn" onClick={onRetry}>
          Try Again
        </button>
      </div>
    );
  }
  return (
    <div className="deals-err" role="alert">
      <span className="deals-err-icon">⚠️</span>
      <p className="deals-err-title">Something went wrong</p>
      <p className="deals-err-msg">{message}</p>
      <button className="deals-err-btn" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════════ */
function EmptyState({ onReset, elite }) {
  if (elite) {
    return (
      <div className="elite-empty">
        <span className="elite-empty-icon">🔍</span>
        <h2 className="elite-empty-title">No deals found</h2>
        <p className="elite-empty-sub">
          Try adjusting your filters or check back soon for new offers.
        </p>
        <button className="elite-empty-btn" onClick={onReset}>
          Clear Filters
        </button>
      </div>
    );
  }
  return (
    <div className="deals-empty">
      <span className="deals-empty-emoji">🔍</span>
      <h2 className="deals-empty-title">No deals found</h2>
      <p className="deals-empty-sub">
        Try adjusting your filters or check back soon<br />
        for fresh new deals.
      </p>
      <button className="deals-empty-btn" onClick={onReset}>
        Clear Filters
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE   = 20;
const LOAD_DELAY  = 900; // ms — simulate network

export default function DealsPage() {
  /* ── Responsive ── */
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= 1024
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Data ── */
  const [allDeals]    = useState(() => makeDeals(120, 0));
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);   // initial load
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]   = useState(null);

  /* ── Filters ── */
  const [sort, setSort]         = useState("newest");
  const [category, setCategory] = useState("all");

  /* ── Scroll-to-top ── */
  const [showScrollTop, setShowScrollTop] = useState(false);

  /* ── Refs ── */
  const sentinelRef = useRef(null);
  const pageRef     = useRef(null);

  /* ── Filtered + paginated ── */
  const filteredDeals = useMemo(
    () => applyFilters(allDeals, { category, sort }),
    [allDeals, category, sort]
  );

  const visibleDeals = useMemo(
    () => filteredDeals.slice(0, page * PAGE_SIZE),
    [filteredDeals, page]
  );

  const hasMore = visibleDeals.length < filteredDeals.length;

  /* ── Simulate initial load ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      // Simulate occasional error (1 in 20)
      if (Math.random() < 0.05) {
        setError("Failed to load deals. Please check your connection.");
      }
      setLoading(false);
    }, LOAD_DELAY);
    return () => clearTimeout(t);
  }, []);

  /* ── Reset page on filter change ── */
  useEffect(() => { setPage(1); }, [sort, category]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) {
          setLoadingMore(true);
          setTimeout(() => {
            setPage((p) => p + 1);
            setLoadingMore(false);
          }, 600);
        }
      },
      { threshold: 0.1, rootMargin: "120px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  /* ── Scroll-to-top visibility ── */
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Handlers ── */
  const handleBack  = useCallback(() => window.history.back(), []);
  const handleShare = useCallback(async () => {
    const data = {
      title: "Check out these deals!",
      url  : window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
    } catch {}
  }, []);

  const handleCardClick = useCallback((deal) => {
    console.log("Deal clicked:", deal);
    // Navigate or open modal here
  }, []);

  const handleReset = useCallback(() => {
    setSort("newest");
    setCategory("all");
  }, []);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    setTimeout(() => setLoading(false), LOAD_DELAY);
  }, []);

  const handleScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ── Skeleton heights ── */
  const skeletonHeights = useMemo(
    () => Array.from({ length: 12 }, () => 120 + Math.floor(Math.random() * 180)),
    []
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — MOBILE LAYOUT
  ══════════════════════════════════════════════════════════════ */
  if (!isDesktop) {
    return (
      <div className="deals-root" ref={pageRef}>
        <div className="deals-page">

          {/* Header */}
          <MobileHeader
            totalDeals={filteredDeals.length}
            onBack={handleBack}
            onShare={handleShare}
          />

          {/* Filter bar */}
          {!loading && !error && (
            <FilterBar
              total={allDeals.length}
              filtered={filteredDeals.length}
              sort={sort}
              category={category}
              onSort={setSort}
              onCategory={setCategory}
            />
          )}

          {/* Result count */}
          {!loading && !error && filteredDeals.length > 0 && (
            <div className="deals-result-count" aria-live="polite">
              Showing{" "}
              <span className="deals-result-count-num">
                {visibleDeals.length}
              </span>
              {" "}of{" "}
              <span className="deals-result-count-num">
                {filteredDeals.length}
              </span>
              {" "}deals
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <ErrorState message={error} onRetry={handleRetry} />
          )}

          {/* ── Loading skeleton ── */}
          {loading && !error && (
            <div className="deals-masonry" aria-label="Loading deals"
              aria-busy="true">
              {skeletonHeights.map((h, i) => (
                <SkeletonCard key={i} height={h} />
              ))}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && !error && filteredDeals.length === 0 && (
            <EmptyState onReset={handleReset} />
          )}

          {/* ── Masonry grid ── */}
          {!loading && !error && filteredDeals.length > 0 && (
            <>
              <div className="deals-masonry"
                role="list" aria-label="Deals grid">
                {visibleDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={handleCardClick}
                  />
                ))}
              </div>

              {/* Sentinel */}
              <div ref={sentinelRef} aria-hidden="true"
                style={{ height: 1 }} />

              {/* Loading more */}
              {loadingMore && (
                <div className="deals-loading-more"
                  aria-live="polite" aria-label="Loading more deals">
                  <span className="deals-spinner" aria-hidden="true" />
                  Loading more deals…
                </div>
              )}

              {/* Feed end */}
              {!hasMore && !loadingMore && (
                <div className="deals-feed-end-wrap">
                  <p className="deals-feed-end">
                    🎉 You've seen all {filteredDeals.length} deals!
                  </p>
                  <button className="deals-feed-end-btn"
                    onClick={handleScrollTop}>
                    Back to Top
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Scroll to top */}
        <button
          className={`deals-scroll-top${showScrollTop ? " visible" : ""}`}
          onClick={handleScrollTop}
          aria-label="Scroll to top"
          tabIndex={showScrollTop ? 0 : -1}>
          <Icon.ChevronUp />
        </button>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER — ELITE DESKTOP LAYOUT
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="deals-root deals-root--elite" ref={pageRef}>

      {/* Hero */}
      <EliteHero totalDeals={filteredDeals.length} />

      {/* Layout: sidebar + main */}
      <div className="elite-layout">

        {/* Sidebar */}
        <EliteSidebar
          totalDeals={filteredDeals.length}
          sort={sort}
          category={category}
          onSort={setSort}
          onCategory={setCategory}
          onBack={handleBack}
          onShare={handleShare}
        />

        {/* Main column */}
        <main className="elite-main" aria-label="Deals content">

          {/* Top bar */}
          {!loading && !error && (
            <EliteTopBar
              filteredCount={filteredDeals.length}
              sort={sort}
              onSort={setSort}
            />
          )}

          {/* ── Error ── */}
          {error && (
            <ErrorState message={error} onRetry={handleRetry} elite />
          )}

          {/* ── Loading skeleton ── */}
          {loading && !error && (
            <div className="deals-masonry deals-masonry--desktop"
              aria-label="Loading deals" aria-busy="true">
              {skeletonHeights.map((h, i) => (
                <SkeletonCard key={i} height={h} elite />
              ))}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && !error && filteredDeals.length === 0 && (
            <EmptyState onReset={handleReset} elite />
          )}

          {/* ── Masonry grid ── */}
          {!loading && !error && filteredDeals.length > 0 && (
            <>
              <div className="deals-masonry deals-masonry--desktop"
                role="list" aria-label="Deals grid">
                {visibleDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={handleCardClick}
                  />
                ))}
              </div>

              {/* Sentinel */}
              <div ref={sentinelRef} aria-hidden="true"
                style={{ height: 1 }} />

              {/* Loading more */}
              {loadingMore && (
                <div className="elite-loading-more"
                  aria-live="polite" aria-label="Loading more">
                  <div className="elite-loading-dots" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                  Loading more deals
                </div>
              )}

              {/* Feed end */}
              {!hasMore && !loadingMore && (
                <div className="elite-feed-end">
                  <div className="elite-feed-end-line"
                    aria-hidden="true" />
                  <div className="elite-feed-end-content">
                    <span className="elite-feed-end-emoji">✨</span>
                    <p className="elite-feed-end-text">
                      All {filteredDeals.length} deals loaded
                    </p>
                    <button className="elite-feed-end-btn"
                      onClick={handleScrollTop}>
                      Back to Top
                    </button>
                  </div>
                  <div className="elite-feed-end-line"
                    aria-hidden="true" />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Scroll to top */}
      <button
        className={`deals-scroll-top${showScrollTop ? " visible" : ""}`}
        onClick={handleScrollTop}
        aria-label="Scroll to top"
        tabIndex={showScrollTop ? 0 : -1}>
        <Icon.ChevronUp />
      </button>
    </div>
  );
}