/**
 * src/loemart/HomePage.jsx
 * Route: /minimart
 *
 * Loemart marketplace homepage:
 * - Hero section with auto-sliding banner + search
 * - Category filter strip
 * - Featured / filtered product listings (real API)
 * - Trust bar
 * - How it works
 * - Notify CTA banner
 * - Footer
 *
 * API shape expected from GET /api/products:
 * { success: true, data: { products: [], pagination: { total, page, ... } } }
 */

import {
  useState, useMemo, useCallback,
  useEffect, useRef, memo,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios  from "axios";
import toast  from "react-hot-toast";
import {
  FiSearch, FiMapPin, FiShield, FiZap,
  FiPackage, FiHeart, FiTrendingUp,
  FiChevronRight, FiCamera, FiTag, FiUsers,
  FiCheckCircle, FiArrowRight, FiBell,
  FiAlertCircle, FiRefreshCw, FiSliders,
} from "react-icons/fi";

import categories from "../config/categories";
import "./styles/HomePage.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API  — mirrors PostAds.jsx pattern
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const DEFAULT_LIMIT  = 24;
const SLIDE_INTERVAL = 5000;

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest"      },
  { value: "price_asc",  label: "Price ↑"     },
  { value: "price_desc", label: "Price ↓"     },
  { value: "trending",   label: "Trending"    },
  { value: "views",      label: "Most Viewed" },
  { value: "saves",      label: "Most Saved"  },
];

const HERO_SLIDES = [
  {
    id       : 1,
    headline : "Buy & Sell\nAnything Local",
    sub      : "Join thousands of buyers and sellers in your community",
    gradient : "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
    badge    : "🔥 Trending Now",
  },
  {
    id       : 2,
    headline : "Post Your Ad\nin 60 Seconds",
    sub      : "Simple. Fast. Completely free to list.",
    gradient : "linear-gradient(135deg,#f093fb 0%,#f5576c 100%)",
    badge    : "⚡ Super Easy",
  },
  {
    id       : 3,
    headline : "Safe &\nSecure Trading",
    sub      : "Every listing is scanned for prohibited content automatically",
    gradient : "linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)",
    badge    : "🛡️ Verified Safe",
  },
];

const TRUST_ITEMS = [
  { icon: <FiShield     size={22} />, label: "Content Scanning",  desc: "Auto prohibited-content detection"   },
  { icon: <FiZap        size={22} />, label: "Instant Listing",   desc: "Go live in under 60 seconds"         },
  { icon: <FiUsers      size={22} />, label: "Active Community",  desc: "Thousands of local buyers & sellers" },
  { icon: <FiCheckCircle size={22}/>, label: "Verified Sellers",  desc: "Seller verification system"          },
];

const HOW_STEPS = [
  {
    step  : "01",
    icon  : <FiCamera     size={26} />,
    title : "Add Photos",
    desc  : "Upload up to 6 compressed, duplicate-detected images of your item.",
  },
  {
    step  : "02",
    icon  : <FiTag        size={26} />,
    title : "Add Details",
    desc  : "Title, category, features, specs — our AI auto-generates key features.",
  },
  {
    step  : "03",
    icon  : <FiPackage    size={26} />,
    title : "Set Variants & Price",
    desc  : "Add sizes, colours, SKUs and set your price with discount support.",
  },
  {
    step  : "04",
    icon  : <FiCheckCircle size={26} />,
    title : "Go Live",
    desc  : "Review your listing and post — buyers can see it immediately.",
  },
];

const HERO_STATS = [
  { value: "50K+", label: "Active Listings"  },
  { value: "12K+", label: "Verified Sellers" },
  { value: "100%", label: "Free to List"     },
  { value: "24/7", label: "Support"          },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS  — same style as helpers.js / PostAds.jsx
═══════════════════════════════════════════════════════════════ */
const normalize    = (s = "") => String(s).replace(/\s+/g, " ").trim();

/** Format price exactly as the API stores it (numeric) */
const formatPrice  = (n) => `₦${Number(n).toLocaleString("en-NG")}`;

/** Pull the primary image url from the images array returned by FULL_PRODUCT_SELECT */
const primaryImage = (images = []) => {
  if (!Array.isArray(images) || !images.length) return "/placeholder.jpg";
  const primary = images.find((img) => img.is_primary) ?? images[0];
  return primary?.url ?? "/placeholder.jpg";
};

/** Extract discount % from product row (API may send original_price + price) */
const calcDiscount = (product) => {
  const base = Number(product.price);
  const orig = Number(product.original_price ?? 0);
  if (!orig || orig <= base) return 0;
  return Math.round(((orig - base) / orig) * 100);
};

const getAuthToken = () =>
  localStorage.getItem("token")             ||
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("seller_token");

/* ═══════════════════════════════════════════════════════════════
   LISTING CARD  — memoised, matches PostAds field names
═══════════════════════════════════════════════════════════════ */
const ListingCard = memo(function ListingCard({ product, wishlisted, onWishlist }) {
  const navigate   = useNavigate();
  const discount   = calcDiscount(product);
  const imgSrc     = primaryImage(product.images);
  const condition  = product.condition ?? "Used";

  const handleClick = useCallback(() => {
    navigate(`/minimart/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  const handleWishlist = useCallback((e) => {
    e.stopPropagation();
    onWishlist(product.id);
  }, [onWishlist, product.id]);

  return (
    <article
      className="hp-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      {/* ── Image ── */}
      <div className="hp-card-img-wrap">
        <img
          src={imgSrc}
          alt={product.name}
          className="hp-card-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = "/placeholder.jpg"; }}
        />

        {/* Badges */}
        <div className="hp-card-badges">
          {discount > 0 && (
            <span className="hp-badge hp-badge--discount">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="hp-badge hp-badge--featured">⚡ Featured</span>
          )}
          {product.is_sponsored && (
            <span className="hp-badge hp-badge--sponsored">Sponsored</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          className={`hp-card-wish ${wishlisted ? "hp-card-wish--active" : ""}`}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={handleWishlist}
        >
          <FiHeart size={15} />
        </button>

        {/* Verified seller badge */}
        {product.seller_verified && (
          <div className="hp-card-verified" aria-label="Verified seller">
            <FiShield size={12} /> Verified
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="hp-card-body">
        <p className="hp-card-name">{product.name}</p>

        <div className="hp-card-price-row">
          {/* API field: price (maps to basePrice in PostAds) */}
          <span className="hp-card-price">{formatPrice(product.price)}</span>
          {discount > 0 && (
            <span className="hp-card-original">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>

        <div className="hp-card-meta">
          <span className={`hp-card-condition hp-card-condition--${condition.toLowerCase()}`}>
            {condition}
          </span>
          {product.location && (
            <span className="hp-card-location">
              <FiMapPin size={11} /> {product.location}
            </span>
          )}
        </div>

        {/* View count — from view_count column in products table */}
        {product.view_count > 0 && (
          <p className="hp-card-views">{product.view_count.toLocaleString()} views</p>
        )}
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH BAR  — reusable, aria-labelled
═══════════════════════════════════════════════════════════════ */
const SearchBar = memo(function SearchBar({ value, onChange, onSubmit, autoFocus }) {
  return (
    <form
      className="hp-search"
      onSubmit={onSubmit}
      role="search"
      aria-label="Search listings"
    >
      <div className="hp-search-wrap">
        <FiSearch size={18} className="hp-search-icon" aria-hidden="true" />
        <input
          className="hp-search-input"
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search phones, laptops, cars, fashion…"
          aria-label="Search products"
        />
        <button type="submit" className="hp-search-btn" aria-label="Search">
          Search
        </button>
      </div>
    </form>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="hp-card hp-card--skeleton" aria-hidden="true">
      <div className="hp-skel hp-skel-img" />
      <div className="hp-card-body">
        <div className="hp-skel hp-skel-text" />
        <div className="hp-skel hp-skel-text hp-skel-text--short" />
        <div className="hp-skel hp-skel-text hp-skel-text--xs" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HomePage({ user }) {
  const navigate         = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Hero slide ────────────────────────────────────────── */
  const [slideIndex, setSlideIndex] = useState(0);
  const slideTimer = useRef(null);

  const startSlideTimer = useCallback(() => {
    clearInterval(slideTimer.current);
    slideTimer.current = setInterval(
      () => setSlideIndex((i) => (i + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL
    );
  }, []);

  useEffect(() => {
    startSlideTimer();
    return () => clearInterval(slideTimer.current);
  }, [startSlideTimer]);

  /* ── Filters (synced with URL params) ──────────────────── */
  const [searchQuery,    setSearchQuery]    = useState(searchParams.get("q")        ?? "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [showFilters,    setShowFilters]    = useState(false);
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");

  /* ── Products ──────────────────────────────────────────── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Wishlist ──────────────────────────────────────────── */
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loemart-wishlist") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("loemart-wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  /* ── Notify CTA ────────────────────────────────────────── */
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySent,  setNotifySent]  = useState(false);

  /* ── Category tab list ─────────────────────────────────── */
  const categoryTabs = useMemo(() => [
    { id: "all", name: "All", icon: "🏪" },
    ...categories.slice(0, 7),
  ], []);

  /* ════════════════════════════════════════════════════════
     FETCH PRODUCTS  — calls GET /api/products
     mirrors the query params the router accepts
  ════════════════════════════════════════════════════════ */
  const fetchProducts = useCallback(async ({
    query    = searchQuery,
    category = activeCategory,
    sort     = activeSort,
    min      = minPrice,
    max      = maxPrice,
    newOffset = 0,
    append   = false,
  } = {}) => {

    append ? setLoadingMore(true) : setLoading(true);
    setFetchError(null);

    try {
      const params = {
        limit  : DEFAULT_LIMIT,
        offset : newOffset,
        sort,
      };

      if (normalize(query))       params.search   = normalize(query);
      if (category !== "all")     params.category = category;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      const { data } = await axios.get(`${API}/products`, { params });

      /* API shape: { success, data: { products, pagination } } */
      const rows  = data?.data?.products    ?? [];
      const meta  = data?.data?.pagination  ?? null;

      setProducts((prev) => append ? [...prev, ...rows] : rows);
      setPagination(meta);
      setOffset(newOffset);

    } catch (err) {
      const msg =
        err.response?.data?.message ||
        (err.code === "ERR_NETWORK" ? "Network error — check your connection" : "Failed to load products");
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  /* Initial + filter-change fetch */
  useEffect(() => {
    fetchProducts({ newOffset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSort]);

  /* Sync URL search param on mount */
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setSearchQuery(q);
      fetchProducts({ query: q, newOffset: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════ */
  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const q = normalize(searchQuery);
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  }, [searchQuery, fetchProducts, setSearchParams]);

  const handleCategoryChange = useCallback((catId) => {
    setActiveCategory(catId);
    setOffset(0);
    // fetchProducts called by effect above
  }, []);

  const handleSortChange = useCallback((val) => {
    setActiveSort(val);
    setOffset(0);
  }, []);

  const handleLoadMore = useCallback(() => {
    const newOffset = offset + DEFAULT_LIMIT;
    fetchProducts({ newOffset, append: true });
  }, [fetchProducts, offset]);

  const handlePriceFilter = useCallback((e) => {
    e.preventDefault();
    fetchProducts({ min: minPrice, max: maxPrice, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory("all");
    setActiveSort("newest");
    setMinPrice("");
    setMaxPrice("");
    setSearchParams({});
    fetchProducts({
      query: "", category: "all", sort: "newest", min: "", max: "", newOffset: 0,
    });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const alreadySaved = prev.includes(id);
      toast.success(alreadySaved ? "Removed from wishlist" : "Added to wishlist ❤️");
      return alreadySaved ? prev.filter((x) => x !== id) : [...prev, id];
    });
    window.navigator?.vibrate?.(12);
  }, []);

  const handleNotify = useCallback((e) => {
    e.preventDefault();
    if (!notifyEmail.includes("@")) { toast.error("Enter a valid email"); return; }
    setNotifySent(true);
    toast.success("You're on the list! 🎉");
  }, [notifyEmail]);

  const handleSlideChange = useCallback((i) => {
    setSlideIndex(i);
    startSlideTimer(); // reset timer on manual click
  }, [startSlideTimer]);

  /* ── Derived ─────────────────────────────────────────── */
  const slide          = HERO_SLIDES[slideIndex];
  const hasMore        = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const activeCatLabel = categoryTabs.find((c) => c.id === activeCategory)?.name ?? "";
  const hasActiveFilters = searchQuery || activeCategory !== "all" ||
    activeSort !== "newest" || minPrice || maxPrice;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <>
      <a href="#hp-main" className="hp-skip-link">Skip to main content</a>

      <div className="hp-page">

        {/* ══════════════════════════════════════════════════
            NAVBAR
        ══════════════════════════════════════════════════ */}
        <header className="hp-nav hp-glass-bar">
          <button
            className="hp-nav-logo"
            onClick={() => navigate("/minimart")}
            aria-label="Go to Loemart homepage"
          >
            <span className="hp-nav-logo-icon">🛍️</span>
            <span className="hp-nav-logo-text">Loemart</span>
          </button>

          {/* Desktop inline search */}
          <div className="hp-nav-search" role="search">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearch}
            />
          </div>

          <nav className="hp-nav-links" aria-label="Main navigation">
            <button
              type="button"
              className="hp-nav-link"
              onClick={() => navigate("/minimart")}
            >
              Browse
            </button>
            {user ? (
              <>
                <button
                  type="button"
                  className="hp-nav-link"
                  onClick={() => navigate("/dashboard")}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  className="hp-nav-post"
                  onClick={() => navigate("/minimart/post-ad")}
                  aria-label="Post a new ad"
                >
                  + Post Ad
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="hp-nav-link"
                  onClick={() => navigate("/login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className="hp-nav-post"
                  onClick={() => navigate("/register")}
                >
                  Sign Up Free
                </button>
              </>
            )}
          </nav>
        </header>

        <main id="hp-main">

          {/* ════════════════════════════════════════════════
              HERO
          ════════════════════════════════════════════════ */}
          <section
            className="hp-hero"
            style={{ background: slide.gradient }}
            aria-label="Hero banner"
          >
            <div className="hp-hero-blob hp-hero-blob--1" aria-hidden="true" />
            <div className="hp-hero-blob hp-hero-blob--2" aria-hidden="true" />

            <div className="hp-hero-content">
              <span className="hp-hero-badge">{slide.badge}</span>

              <h1 className="hp-hero-headline">
                {slide.headline.split("\n").map((line, i, arr) => (
                  <span key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </span>
                ))}
              </h1>

              <p className="hp-hero-sub">{slide.sub}</p>

              {/* Mobile / hero search */}
              <div className="hp-hero-search">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={handleSearch}
                />
              </div>

              <div className="hp-hero-btns">
                <button
                  type="button"
                  className="hp-hero-btn-primary"
                  onClick={() => {
                    document.getElementById("hp-listings")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Browse Listings <FiChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="hp-hero-btn-secondary"
                  onClick={() => navigate(user ? "/minimart/post-ad" : "/register")}
                >
                  {user ? "Post Your Ad Free" : "Start Selling Free"}
                </button>
              </div>

              {/* Slide dots */}
              <div className="hp-hero-dots" role="tablist" aria-label="Hero slides">
                {HERO_SLIDES.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === slideIndex}
                    aria-label={`Slide ${i + 1}`}
                    className={`hp-hero-dot ${i === slideIndex ? "hp-hero-dot--active" : ""}`}
                    onClick={() => handleSlideChange(i)}
                  />
                ))}
              </div>
            </div>

            {/* Stats strip */}
            <div className="hp-hero-stats" aria-label="Platform statistics">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="hp-hero-stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              TRUST BAR
          ════════════════════════════════════════════════ */}
          <section className="hp-trust" aria-label="Why choose Loemart">
            <div className="hp-trust-inner">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="hp-trust-item">
                  <div className="hp-trust-icon" aria-hidden="true">{item.icon}</div>
                  <div>
                    <p className="hp-trust-label">{item.label}</p>
                    <p className="hp-trust-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              CATEGORY + SORT + FILTER STRIP
          ════════════════════════════════════════════════ */}
          <section className="hp-section" aria-label="Filter products">
            <div className="hp-filter-bar">

              {/* Category chips */}
              <div
                className="hp-cat-strip"
                role="tablist"
                aria-label="Filter by category"
              >
                {categoryTabs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === c.id}
                    className={`hp-cat-chip ${activeCategory === c.id ? "hp-cat-chip--active" : ""}`}
                    onClick={() => handleCategoryChange(c.id)}
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Sort + filter controls */}
              <div className="hp-filter-controls">
                <select
                  className="hp-sort-select"
                  value={activeSort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  aria-label="Sort listings"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`hp-filter-btn ${showFilters ? "hp-filter-btn--active" : ""}`}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  aria-controls="hp-price-filter"
                >
                  <FiSliders size={14} /> Filters
                  {(minPrice || maxPrice) && (
                    <span className="hp-filter-dot" aria-hidden="true" />
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="hp-clear-btn"
                    onClick={clearFilters}
                    aria-label="Clear all filters"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Price filter panel */}
            {showFilters && (
              <form
                id="hp-price-filter"
                className="hp-price-panel"
                onSubmit={handlePriceFilter}
                aria-label="Price range filter"
              >
                <div className="hp-price-row">
                  <div className="hp-price-field">
                    <label className="hp-price-label" htmlFor="hp-min-price">Min ₦</label>
                    <input
                      id="hp-min-price"
                      type="number"
                      className="hp-price-input"
                      placeholder="0"
                      value={minPrice}
                      min={0}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </div>
                  <span className="hp-price-sep" aria-hidden="true">—</span>
                  <div className="hp-price-field">
                    <label className="hp-price-label" htmlFor="hp-max-price">Max ₦</label>
                    <input
                      id="hp-max-price"
                      type="number"
                      className="hp-price-input"
                      placeholder="Any"
                      value={maxPrice}
                      min={0}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="hp-price-apply">Apply</button>
                </div>
              </form>
            )}
          </section>

          {/* ════════════════════════════════════════════════
              LISTINGS
          ════════════════════════════════════════════════ */}
          <section
            id="hp-listings"
            className="hp-section"
            aria-label="Product listings"
            aria-live="polite"
            aria-busy={loading}
          >
            <div className="hp-section-head">
              <h2 className="hp-section-title">
                <FiTrendingUp size={20} aria-hidden="true" />
                {activeCategory === "all" ? " Featured Listings" : ` ${activeCatLabel}`}
                {pagination && (
                  <span className="hp-count-badge">
                    {pagination.total.toLocaleString()}
                  </span>
                )}
              </h2>
            </div>

            {/* ── Loading skeleton ── */}
            {loading && (
              <div className="hp-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* ── Error state ── */}
            {!loading && fetchError && (
              <div className="hp-error-state" role="alert">
                <FiAlertCircle size={32} />
                <p>{fetchError}</p>
                <button
                  type="button"
                  className="hp-retry-btn"
                  onClick={() => fetchProducts({ newOffset: 0 })}
                >
                  <FiRefreshCw size={14} /> Retry
                </button>
              </div>
            )}

            {/* ── Empty state ── */}
            {!loading && !fetchError && !products.length && (
              <div className="hp-empty" role="status">
                <span className="hp-empty-icon">🔍</span>
                <p>No listings found</p>
                <button type="button" className="hp-see-all" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            )}

            {/* ── Product grid ── */}
            {!loading && !fetchError && products.length > 0 && (
              <>
                <div className="hp-grid">
                  {products.map((product) => (
                    <ListingCard
                      key={product.id}
                      product={product}
                      wishlisted={wishlist.includes(product.id)}
                      onWishlist={toggleWishlist}
                    />
                  ))}
                </div>

                {/* Load more */}
                {hasMore && (
                  <div className="hp-load-more-wrap">
                    <button
                      type="button"
                      className="hp-load-more"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      aria-label="Load more listings"
                    >
                      {loadingMore ? (
                        <>
                          <span className="hp-spinner" aria-hidden="true" /> Loading…
                        </>
                      ) : (
                        <>Load More <FiChevronRight size={15} /></>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ════════════════════════════════════════════════
              HOW IT WORKS
          ════════════════════════════════════════════════ */}
          <section className="hp-how hp-section" aria-label="How it works">
            <div className="hp-section-head">
              <h2 className="hp-section-title">How It Works</h2>
              <p className="hp-section-sub">Post your ad in 4 simple steps</p>
            </div>

            <div className="hp-how-grid">
              {HOW_STEPS.map((step, i) => (
                <div key={step.step} className="hp-how-card">
                  <div className="hp-how-step-num" aria-hidden="true">{step.step}</div>
                  <div className="hp-how-icon"      aria-hidden="true">{step.icon}</div>
                  <h3 className="hp-how-title">{step.title}</h3>
                  <p  className="hp-how-desc">{step.desc}</p>
                  {i < HOW_STEPS.length - 1 && (
                    <div className="hp-how-arrow" aria-hidden="true">
                      <FiChevronRight size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hp-how-cta">
              <button
                type="button"
                className="hp-hero-btn-primary"
                onClick={() => navigate(user ? "/minimart/post-ad" : "/register")}
              >
                {user ? "Post Ad Now" : "Sign Up & Post Free"}
                <FiChevronRight size={16} />
              </button>
            </div>
          </section>

          {/* ════════════════════════════════════════════════
              CTA BANNER
          ════════════════════════════════════════════════ */}
          <section className="hp-cta" aria-label="Stay updated">
            <div className="hp-cta-inner">
              <div className="hp-cta-text">
                <span className="hp-cta-icon" aria-hidden="true">
                  <FiBell size={28} />
                </span>
                <div>
                  <h2 className="hp-cta-title">Never Miss a Deal</h2>
                  <p className="hp-cta-sub">
                    Get notified when new listings match your interests
                  </p>
                </div>
              </div>

              {notifySent ? (
                <div className="hp-cta-sent" role="status" aria-live="polite">
                  <FiCheckCircle size={20} /> You're subscribed!
                </div>
              ) : (
                <form className="hp-cta-form" onSubmit={handleNotify}>
                  <input
                    type="email"
                    className="hp-cta-input"
                    placeholder="Enter your email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    aria-label="Email for deal notifications"
                    required
                  />
                  <button type="submit" className="hp-cta-submit">Notify Me</button>
                </form>
              )}
            </div>
          </section>

        </main>

        {/* ════════════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════════════ */}
        <footer className="hp-footer" aria-label="Site footer">
          <div className="hp-footer-inner">
            <div className="hp-footer-brand">
              <span className="hp-nav-logo-icon">🛍️</span>
              <span className="hp-nav-logo-text">Loemart</span>
              <p className="hp-footer-tagline">
                Your local marketplace — buy, sell, discover.
              </p>
            </div>

            <nav className="hp-footer-links" aria-label="Footer navigation">
              {[
                { label: "Browse",    path: "/minimart"         },
                { label: "Post Ad",   path: "/minimart/post-ad" },
                { label: "Dashboard", path: "/dashboard"        },
                { label: "Login",     path: "/login"            },
              ].map((link) => (
                <button
                  key={link.label}
                  type="button"
                  className="hp-footer-link"
                  onClick={() => navigate(link.path)}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="hp-footer-bottom">
            <p>© {new Date().getFullYear()} Loemart. All rights reserved.</p>
            <p className="hp-footer-shield">
              <FiShield size={13} /> Safe &amp; Secure Marketplace
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}