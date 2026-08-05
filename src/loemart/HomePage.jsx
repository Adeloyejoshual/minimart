/**
 * src/loemart/HomePage.jsx
 * Route: /loemart
 *
 * Product card click  → /shop/:slug   (MarketDetail — already in App.jsx)
 * Post Ad click       → /minimart/post-ad (PostAds — already in App.jsx)
 * Uses existing Minimart.css (mp-* prefix)
 */

import {
  useState, useMemo, useCallback,
  useEffect, useRef, memo,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiShield, FiZap, FiPackage,
  FiHeart, FiTrendingUp, FiChevronRight,
  FiCamera, FiTag, FiCheckCircle,
  FiBell, FiAlertCircle, FiRefreshCw,
  FiSliders, FiX, FiPlus, FiEye, FiFilter,
} from "react-icons/fi";

import categories from "../config/categories";
import "../styles/Minimart.css";

/* ═══════════════════════════════════════════════════════════════
   ENV
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const DEFAULT_LIMIT  = 24;
const SLIDE_INTERVAL = 5000;

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First"    },
  { value: "price_asc",  label: "Price: Low–High" },
  { value: "price_desc", label: "Price: High–Low" },
  { value: "trending",   label: "Trending"        },
  { value: "views",      label: "Most Viewed"     },
  { value: "saves",      label: "Most Saved"      },
];

const HERO_SLIDES = [
  {
    id    : 1,
    badge : "🔥 Trending Now",
    title : "Buy & Sell Anything Local",
    sub   : "Join thousands of buyers and sellers in your community",
    cta   : "Browse Listings",
    ctaSub: "Start Selling Free",
    bg    : "linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)",
  },
  {
    id    : 2,
    badge : "⚡ Super Easy",
    title : "Post Your Ad in 60 Seconds",
    sub   : "Simple. Fast. Completely free to list your items.",
    cta   : "Browse Listings",
    ctaSub: "Post Ad Now",
    bg    : "linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)",
  },
  {
    id    : 3,
    badge : "🛡️ Verified Safe",
    title : "Safe & Secure Trading",
    sub   : "Every listing is auto-scanned for prohibited content.",
    cta   : "Browse Listings",
    ctaSub: "Learn More",
    bg    : "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
  },
];

const HERO_STATS = [
  { value: "50K+", label: "Listings" },
  { value: "12K+", label: "Sellers"  },
  { value: "100%", label: "Free"     },
  { value: "24/7", label: "Support"  },
];

const HOW_STEPS = [
  {
    step : "01",
    icon : <FiCamera      size={24} />,
    title: "Add Photos",
    desc : "Upload up to 6 compressed images.",
  },
  {
    step : "02",
    icon : <FiTag         size={24} />,
    title: "Add Details",
    desc : "Title, category, features — AI auto-fills.",
  },
  {
    step : "03",
    icon : <FiPackage     size={24} />,
    title: "Set Variants & Price",
    desc : "Sizes, colours, SKUs and discount pricing.",
  },
  {
    step : "04",
    icon : <FiCheckCircle size={24} />,
    title: "Go Live",
    desc : "Review and post — buyers see it instantly.",
  },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const normalize    = (s = "") => String(s).replace(/\s+/g, " ").trim();
const fmtPrice     = (n)      => `₦${Number(n).toLocaleString("en-NG")}`;

const calcDiscount = (product) => {
  const base = Number(product.price);
  const orig = Number(product.original_price ?? 0);
  return !orig || orig <= base
    ? 0
    : Math.round(((orig - base) / orig) * 100);
};

/**
 * Pull primary image URL from FULL_PRODUCT_SELECT images array:
 * [{ id, url, is_primary, sort_order }, …]
 */
const primaryImg = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null;
  return (images.find((i) => i.is_primary) ?? images[0])?.url ?? null;
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD
   onClick  →  /shop/:slug   which matches:
   <Route path="/shop/:slug" element={<MarketDetail user={user} />} />
═══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({
  product,
  wishlisted,
  onWishlist,
  view = "grid",
}) {
  const navigate = useNavigate();
  const discount = calcDiscount(product);
  const imgSrc   = primaryImg(product.images);
  const condition = product.condition ?? "Used";

  /*
   * Prefer slug (SEO-friendly), fall back to UUID.
   * Destination: /shop/:slug  →  MarketDetail
   */
  const destination = `/shop/${product.slug ?? product.id}`;

  const go = useCallback(
    () => navigate(destination),
    [navigate, destination]
  );

  const handleWish = useCallback(
    (e) => { e.stopPropagation(); onWishlist(product.id); },
    [onWishlist, product.id]
  );

  return (
    <article
      className={`mp-card ${view === "list" ? "mp-card--list" : ""}`}
      onClick={go}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onKeyDown={(e) => e.key === "Enter" && go()}
    >
      {/* Image */}
      <div className="mp-card-img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="mp-card-img"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="mp-card-placeholder">
            <FiPackage size={32} className="mp-placeholder-icon" />
          </div>
        )}

        {/* Badges */}
        <div className="mp-card-badges">
          {product.is_featured && (
            <span className="mp-badge mp-badge--featured">⚡ Featured</span>
          )}
          {product.is_trending && (
            <span className="mp-badge mp-badge--trending">🔥 Hot</span>
          )}
          {discount > 0 && (
            <span className="mp-badge mp-badge--sale">-{discount}%</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          className={`mp-wishlist ${wishlisted ? "mp-wishlist--active" : ""}`}
          aria-label={wishlisted ? "Remove from wishlist" : "Save"}
          onClick={handleWish}
        >
          <span className="mp-wishlist-icon">
            <FiHeart size={15} fill={wishlisted ? "currentColor" : "none"} />
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="mp-card-body">
        {/* Seller */}
        {product.seller_name && (
          <div className="mp-card-seller">
            {product.seller_avatar ? (
              <img
                src={product.seller_avatar}
                alt={product.seller_name}
                className="mp-seller-avatar"
              />
            ) : (
              <div className="mp-seller-avatar mp-seller-avatar--fallback">
                {product.seller_name[0]?.toUpperCase()}
              </div>
            )}
            <span className="mp-seller-name">{product.seller_name}</span>
            {product.seller_verified && (
              <span className="mp-verified" aria-label="Verified seller">
                <FiShield size={11} />
              </span>
            )}
          </div>
        )}

        <p className="mp-card-name">{product.name}</p>

        {/* Price row */}
        <div className="mp-price-row">
          <span className="mp-price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="mp-original">
              {fmtPrice(product.original_price)}
            </span>
          )}
        </div>

        {/* Meta pills */}
        <div className="mp-card-meta">
          <span className="mp-meta-pill">{condition}</span>
          {product.location && (
            <span className="mp-meta-pill">📍 {product.location}</span>
          )}
          {Array.isArray(product.variants) && product.variants.length > 1 && (
            <span className="mp-meta-pill mp-meta-pill--variants">
              {product.variants.length} variants
            </span>
          )}
          {product.view_count > 0 && (
            <span className="mp-meta-views">
              <FiEye size={10} /> {product.view_count.toLocaleString()}
            </span>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(product.tags) && product.tags.length > 0 && (
          <div className="mp-card-tags">
            {product.tags.slice(0, 3).map((t) => (
              <span key={t} className="mp-tag">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FEATURED CARD
   Same destination pattern: /shop/:slug
═══════════════════════════════════════════════════════════════ */
const FeaturedCard = memo(function FeaturedCard({ product }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const dest     = `/shop/${product.slug ?? product.id}`;

  return (
    <article
      className="mp-featured-card"
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onClick={() => navigate(dest)}
      onKeyDown={(e) => e.key === "Enter" && navigate(dest)}
    >
      <div className="mp-featured-img-wrap">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" />
        ) : (
          <div className="mp-featured-placeholder">
            <FiPackage size={28} />
          </div>
        )}
        <div className="mp-featured-overlay" />
        {discount > 0 && (
          <span className="mp-featured-badge">-{discount}%</span>
        )}
        <div className="mp-featured-info">
          <p className="mp-featured-name">{product.name}</p>
          <p className="mp-featured-price">{fmtPrice(product.price)}</p>
        </div>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="mp-card mp-card--skeleton" aria-hidden="true">
      <div className="mp-skel mp-skel-img" />
      <div className="mp-card-body" style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div className="mp-skel mp-skel-line" style={{ width:"40%", height:10 }} />
        <div className="mp-skel mp-skel-line" />
        <div className="mp-skel mp-skel-line" style={{ width:"70%" }} />
        <div className="mp-skel mp-skel-line" style={{ width:"50%", height:14 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HomePage({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Hero slide ─────────────────────────────────────── */
  const [slideIndex, setSlideIndex] = useState(0);
  const timerRef                    = useRef(null);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setSlideIndex((i) => (i + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL
    );
  }, []);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [resetTimer]);

  /* ── Filters (synced with URL) ──────────────────────── */
  const [searchQuery,    setSearchQuery]    = useState(searchParams.get("q")        ?? "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");
  const [view,           setView]           = useState("grid");
  const [showSort,       setShowSort]       = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Products ────────────────────────────────────────── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Featured strip ──────────────────────────────────── */
  const [featured, setFeatured] = useState([]);

  /* ── Wishlist ─────────────────────────────────────────── */
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loemart-wishlist") || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("loemart-wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  /* ── Notify ───────────────────────────────────────────── */
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySent,  setNotifySent]  = useState(false);

  /* ── Category tabs ────────────────────────────────────── */
  const categoryTabs = useMemo(() => [
    { id: "all", name: "All", icon: "🏪" },
    ...categories,
  ], []);

  /* ════════════════════════════════════════════════════════
     FETCH  — GET /api/products
     Matches the router in helpers.js / index.js
  ════════════════════════════════════════════════════════ */
  const fetchProducts = useCallback(async ({
    query     = searchQuery,
    category  = activeCategory,
    sort      = activeSort,
    min       = minPrice,
    max       = maxPrice,
    newOffset = 0,
    append    = false,
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setFetchError(null);

    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (normalize(query))       params.search   = normalize(query);
      if (category !== "all")     params.category = category;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      /* Response shape: { success, data: { products, pagination } } */
      const { data } = await axios.get(`${API}/products`, { params });

      const rows = data?.data?.products   ?? [];
      const meta = data?.data?.pagination ?? null;

      setProducts((prev) => append ? [...prev, ...rows] : rows);
      setPagination(meta);
      setOffset(newOffset);
    } catch (err) {
      const msg =
        err.response?.data?.message ??
        (err.code === "ERR_NETWORK"
          ? "Network error — check your connection"
          : "Failed to load products");
      setFetchError(msg);
      if (!append) toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  /* ── Featured strip ────────────────────────────────────── */
  const fetchFeatured = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/products`, {
        params: { featured: "true", limit: 10, sort: "trending" },
      });
      setFeatured(data?.data?.products ?? []);
    } catch { /* non-critical */ }
  }, []);

  /* Initial load */
  useEffect(() => {
    fetchProducts({ newOffset: 0 });
    fetchFeatured();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Re-fetch on category / sort change */
  useEffect(() => {
    fetchProducts({ newOffset: 0, append: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeSort]);

  /* Sync ?q= on mount */
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) { setSearchQuery(q); fetchProducts({ query: q, newOffset: 0 }); }
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

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id);
    setOffset(0);
  }, []);

  const handleSortSelect = useCallback((val) => {
    setActiveSort(val);
    setShowSort(false);
    setOffset(0);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback((e) => {
    e?.preventDefault();
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
      query: "", category: "all", sort: "newest",
      min: "", max: "", newOffset: 0,
    });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const saved = prev.includes(id);
      toast.success(saved ? "Removed from wishlist" : "Saved ❤️");
      return saved ? prev.filter((x) => x !== id) : [...prev, id];
    });
    window.navigator?.vibrate?.(12);
  }, []);

  const handleNotify = useCallback((e) => {
    e.preventDefault();
    if (!notifyEmail.includes("@")) { toast.error("Enter a valid email"); return; }
    setNotifySent(true);
    toast.success("You're on the list! 🎉");
  }, [notifyEmail]);

  const handleSlide = useCallback((i) => {
    setSlideIndex(i);
    resetTimer();
  }, [resetTimer]);

  /*
   * Post Ad navigation:
   * - Logged in  → /minimart/post-ad  (ProtectedRoute → PostAds)
   * - Guest      → /auth              (AuthPage)
   * Both routes already exist in App.jsx — no changes needed there.
   */
  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  /* ── Derived ──────────────────────────────────────────── */
  const slide           = HERO_SLIDES[slideIndex];
  const hasMore         = pagination
    ? (offset + DEFAULT_LIMIT) < pagination.total
    : false;
  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === activeSort)?.label ?? "Sort";
  const hasFilters      = !!(
    searchQuery || activeCategory !== "all" ||
    activeSort  !== "newest" || minPrice || maxPrice
  );

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="mp-page">

      {/* ══════════════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════════════ */}
      <header className="mp-topbar">
        <div className="mp-topbar-row">

          {/* Logo — stays on /loemart */}
          <button
            type="button"
            className="mp-logo"
            onClick={() => navigate("/loemart")}
            aria-label="Loemart home"
          >
            🛍️ Loemart
          </button>

          {/* Search */}
          <form
            className="mp-search-wrap"
            onSubmit={handleSearch}
            role="search"
            aria-label="Search products"
          >
            <span className="mp-search-ico" aria-hidden="true">
              <FiSearch size={16} />
            </span>
            <input
              type="search"
              className="mp-search"
              placeholder="Search phones, laptops, fashion…"
              value={searchQuery}
              aria-label="Search products"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="mp-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  fetchProducts({ query: "", newOffset: 0 });
                }}
              >
                <FiX size={12} />
              </button>
            )}
          </form>

          {/* Actions */}
          <div className="mp-topbar-actions">

            {/* Wishlist counter */}
            <button
              type="button"
              className={`mp-icon-btn ${wishlist.length ? "mp-icon-btn--active" : ""}`}
              aria-label={`Wishlist (${wishlist.length} saved)`}
            >
              <FiHeart size={18} />
              {wishlist.length > 0 && (
                <span className="mp-badge-dot">{wishlist.length}</span>
              )}
            </button>

            {/* Filter toggle */}
            <button
              type="button"
              className={`mp-icon-btn ${showFilters ? "mp-icon-btn--active" : ""}`}
              aria-label="Open filters"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <FiFilter size={18} />
              {hasFilters && (
                <span className="mp-badge-dot" style={{ fontSize: 8 }}>!</span>
              )}
            </button>

            {/*
             * POST AD BUTTON
             * → /minimart/post-ad  if logged in  (PostAds component)
             * → /auth              if guest       (AuthPage)
             */}
            <button
              type="button"
              className="mp-post-btn"
              onClick={goPostAd}
              aria-label={user ? "Post an ad" : "Sign up to sell"}
            >
              <FiPlus size={16} />
              <span className="mp-post-label">
                {user ? "Post Ad" : "Sell Free"}
              </span>
            </button>
          </div>
        </div>

        {/* Category strip */}
        <nav className="mp-cats" aria-label="Browse by category">
          {categoryTabs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`mp-cat-btn ${activeCategory === c.id ? "mp-cat-btn--active" : ""}`}
              aria-pressed={activeCategory === c.id}
              onClick={() => handleCategoryChange(c.id)}
            >
              <span className="mp-cat-icon" aria-hidden="true">{c.icon}</span>
              <span className="mp-cat-label">{c.name}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* ══════════════════════════════════════════════════
          HERO BANNER
      ══════════════════════════════════════════════════ */}
      <section className="mp-hero" aria-label="Hero banner">
        <div
          className="mp-hero-bg"
          style={{ background: slide.bg }}
          aria-hidden="true"
        />
        <div className="mp-hero-overlay" aria-hidden="true" />

        <div className="mp-hero-content">
          <span className="mp-hero-badge">{slide.badge}</span>
          <h1 className="mp-hero-title">{slide.title}</h1>
          <p  className="mp-hero-sub">{slide.sub}</p>

          <div className="mp-hero-actions">
            {/* Scroll to listings */}
            <button
              type="button"
              className="mp-hero-btn-primary"
              onClick={() =>
                document
                  .getElementById("loemart-listings")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {slide.cta}
            </button>

            {/*
             * "Start Selling" / "Post Ad Now"
             *  → /minimart/post-ad  (logged in)
             *  → /auth              (guest)
             */}
            <button
              type="button"
              className="mp-hero-btn-secondary"
              onClick={goPostAd}
            >
              {user ? slide.ctaSub : "Sign Up Free"}
            </button>
          </div>
        </div>

        {/* Stats — top-right overlay */}
        <div
          style={{
            position      : "absolute",
            bottom        : 44,
            right         : 20,
            display       : "flex",
            flexDirection : "column",
            gap           : 6,
            alignItems    : "flex-end",
          }}
          aria-label="Platform statistics"
        >
          {HERO_STATS.map((s) => (
            <div
              key={s.label}
              style={{
                background     : "rgba(255,255,255,0.12)",
                backdropFilter : "blur(8px)",
                border         : "1px solid rgba(255,255,255,0.2)",
                borderRadius   : 10,
                padding        : "4px 12px",
                textAlign      : "right",
              }}
            >
              <div style={{ fontSize:14, fontWeight:900, color:"#ffd700" }}>
                {s.value}
              </div>
              <div style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="mp-hero-dots" role="tablist" aria-label="Hero slides">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === slideIndex}
              aria-label={`Slide ${i + 1}`}
              className={`mp-hero-dot ${i === slideIndex ? "mp-hero-dot--active" : ""}`}
              onClick={() => handleSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FEATURED STRIP
          Each card → /shop/:slug  (MarketDetail)
      ══════════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="mp-featured-section" aria-label="Featured products">
          <div className="mp-section-header">
            <span className="mp-section-title">⚡ Featured</span>
            <span className="mp-section-count">{featured.length} items</span>
          </div>
          <div className="mp-featured-scroll">
            {featured.map((product) => (
              <FeaturedCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════
          SUB-BAR  (sort + view toggle + result count)
      ══════════════════════════════════════════════════ */}
      <div className="mp-subbar" aria-label="Sort and view options">
        <div className="mp-subbar-left">
          {loading ? (
            <span className="mp-count-loading">Loading…</span>
          ) : (
            <p className="mp-count">
              {pagination ? (
                <><strong>{pagination.total.toLocaleString()}</strong> results</>
              ) : (
                <strong>{products.length}</strong>
              )}
              {activeCategory !== "all" && (
                <em> · {categoryTabs.find((c) => c.id === activeCategory)?.name}</em>
              )}
              {searchQuery && <em> · "{searchQuery}"</em>}
            </p>
          )}
        </div>

        <div className="mp-subbar-right">
          {hasFilters && (
            <button
              type="button"
              className="mp-clear-all"
              onClick={clearFilters}
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          )}

          {/* Sort dropdown */}
          <div className="mp-sort-wrap">
            <button
              type="button"
              className="mp-sort-btn"
              aria-haspopup="listbox"
              aria-expanded={showSort}
              onClick={() => setShowSort((v) => !v)}
            >
              {activeSortLabel}
              <span className="mp-sort-chevron">
                <FiChevronRight
                  size={14}
                  style={{
                    transform  : showSort ? "rotate(90deg)" : "rotate(0deg)",
                    transition : "transform .2s",
                  }}
                />
              </span>
            </button>

            {showSort && (
              <>
                {/* Click-away */}
                <div
                  style={{ position:"fixed", inset:0, zIndex:199 }}
                  onClick={() => setShowSort(false)}
                  aria-hidden="true"
                />
                <div
                  className="mp-sort-menu"
                  role="listbox"
                  aria-label="Sort options"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={activeSort === opt.value}
                      className={`mp-sort-item ${activeSort === opt.value ? "mp-sort-item--active" : ""}`}
                      onClick={() => handleSortSelect(opt.value)}
                    >
                      {opt.label}
                      {activeSort === opt.value && (
                        <span className="mp-sort-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="mp-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`mp-view-btn ${view === "grid" ? "mp-view-btn--active" : ""}`}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              {/* 2×2 grid icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="6" height="6" rx="1"/>
                <rect x="8" y="0" width="6" height="6" rx="1"/>
                <rect x="0" y="8" width="6" height="6" rx="1"/>
                <rect x="8" y="8" width="6" height="6" rx="1"/>
              </svg>
            </button>
            <button
              type="button"
              className={`mp-view-btn ${view === "list" ? "mp-view-btn--active" : ""}`}
              aria-pressed={view === "list"}
              aria-label="List view"
              onClick={() => setView("list")}
            >
              {/* 3-lines icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="1"  width="14" height="3" rx="1"/>
                <rect x="0" y="6"  width="14" height="3" rx="1"/>
                <rect x="0" y="11" width="14" height="3" rx="1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div className="mp-active-filters" aria-label="Active filters">
          {searchQuery && (
            <span className="mp-filter-pill">
              🔍 "{searchQuery}"
              <button
                type="button"
                aria-label="Remove search filter"
                onClick={() => {
                  setSearchQuery("");
                  setSearchParams({});
                  fetchProducts({ query: "", newOffset: 0 });
                }}
              >
                <FiX size={11} />
              </button>
            </span>
          )}
          {activeCategory !== "all" && (
            <span className="mp-filter-pill">
              {categoryTabs.find((c) => c.id === activeCategory)?.icon}{" "}
              {categoryTabs.find((c) => c.id === activeCategory)?.name}
              <button
                type="button"
                aria-label="Remove category filter"
                onClick={() => handleCategoryChange("all")}
              >
                <FiX size={11} />
              </button>
            </span>
          )}
          {minPrice && (
            <span className="mp-filter-pill">
              Min ₦{Number(minPrice).toLocaleString()}
              <button
                type="button"
                aria-label="Remove min price"
                onClick={() => {
                  setMinPrice("");
                  fetchProducts({ min: "", newOffset: 0 });
                }}
              >
                <FiX size={11} />
              </button>
            </span>
          )}
          {maxPrice && (
            <span className="mp-filter-pill">
              Max ₦{Number(maxPrice).toLocaleString()}
              <button
                type="button"
                aria-label="Remove max price"
                onClick={() => {
                  setMaxPrice("");
                  fetchProducts({ max: "", newOffset: 0 });
                }}
              >
                <FiX size={11} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PRODUCT GRID
          id="loemart-listings" for hero scroll-to
          Every card → /shop/:slug  (MarketDetail in App.jsx)
      ══════════════════════════════════════════════════ */}
      <main
        id="loemart-listings"
        className={`mp-grid ${view === "list" ? "mp-grid--list" : "mp-grid--grid2"}`}
        aria-label="Product listings"
        aria-live="polite"
        aria-busy={loading}
      >
        {/* Skeletons */}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}

        {/* Error */}
        {!loading && fetchError && (
          <div className="mp-error">
            <span className="mp-error-icon">
              <FiAlertCircle size={32} />
            </span>
            <p>{fetchError}</p>
            <button
              type="button"
              className="mp-retry"
              onClick={() => fetchProducts({ newOffset: 0 })}
            >
              <FiRefreshCw size={14} style={{ marginRight: 6 }} />
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchError && !products.length && (
          <div className="mp-empty">
            <div className="mp-empty-blob">
              <span><FiSearch size={32} /></span>
            </div>
            <p className="mp-empty-title">No listings found</p>
            <p className="mp-empty-sub">
              Try different keywords or browse all categories
            </p>
            <button
              type="button"
              className="mp-empty-clear"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Product cards — each navigates to /shop/:slug */}
        {!loading && !fetchError && products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            wishlisted={wishlist.includes(product.id)}
            onWishlist={toggleWishlist}
            view={view}
          />
        ))}

        {/* Load more spinner */}
        {loadingMore && (
          <div className="mp-load-more-row">
            <div className="mp-spinner" aria-label="Loading more" />
          </div>
        )}

        {/* Load more button */}
        {!loading && !loadingMore && hasMore && (
          <div className="mp-load-more-row">
            <button
              type="button"
              className="mp-retry"
              onClick={handleLoadMore}
            >
              Load More <FiChevronRight size={14} style={{ marginLeft:4 }} />
            </button>
          </div>
        )}

        {/* End of results */}
        {!loading && !hasMore && products.length > 0 && (
          <p className="mp-end-msg">
            — You've seen all {products.length} listings —
          </p>
        )}
      </main>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS  +  POST AD CTA
      ══════════════════════════════════════════════════ */}
      <section className="mp-section" aria-label="How it works">
        <div className="mp-section-header">
          <div className="mp-section-title-wrap">
            <div className="mp-section-icon" aria-hidden="true">🚀</div>
            <div>
              <h2 className="mp-section-title">How It Works</h2>
              <p className="mp-section-sub">Post your ad in 4 steps</p>
            </div>
          </div>
          {/* Secondary CTA — same goPostAd handler */}
          <button
            type="button"
            className="mp-section-see-all"
            onClick={goPostAd}
          >
            {user ? "Post Now →" : "Sign Up →"}
          </button>
        </div>

        <div
          style={{
            display             : "grid",
            gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
            gap                 : 12,
          }}
        >
          {HOW_STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                background   : "#fff",
                borderRadius : 16,
                padding      : "20px 14px",
                textAlign    : "center",
                border       : "1px solid rgba(0,0,0,0.06)",
                boxShadow    : "0 2px 10px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  display        : "inline-flex",
                  alignItems     : "center",
                  justifyContent : "center",
                  width          : 44,
                  height         : 44,
                  borderRadius   : 12,
                  background     : "rgba(255,87,34,0.08)",
                  color          : "#ff5722",
                  marginBottom   : 10,
                }}
                aria-hidden="true"
              >
                {s.icon}
              </div>
              <div
                style={{
                  display      : "inline-block",
                  background   : "#ff5722",
                  color        : "#fff",
                  fontSize     : 9,
                  fontWeight   : 900,
                  padding      : "2px 8px",
                  borderRadius : 20,
                  marginBottom : 6,
                  letterSpacing: "0.5px",
                }}
                aria-hidden="true"
              >
                STEP {s.step}
              </div>
              <h3 style={{ fontSize:13, fontWeight:800, color:"#1a1a1a", margin:"0 0 5px" }}>
                {s.title}
              </h3>
              <p style={{ fontSize:11, color:"rgba(0,0,0,0.5)", lineHeight:1.5, margin:0 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Big CTA button */}
        <div style={{ textAlign:"center", padding:"28px 0 8px" }}>
          <button
            type="button"
            className="mp-post-btn"
            style={{ margin:"0 auto", height:52, fontSize:15, padding:"0 36px" }}
            onClick={goPostAd}
            aria-label={user ? "Post your ad" : "Sign up and sell for free"}
          >
            <FiPlus size={18} />
            {user ? "Post Your Ad — It's Free" : "Sign Up & Sell Free"}
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          NOTIFY BANNER
      ══════════════════════════════════════════════════ */}
      <section
        className="mp-section"
        style={{ paddingBottom: 24 }}
        aria-label="Deal notifications"
      >
        <div
          className="mp-deals-banner"
          style={{
            display    : "flex",
            alignItems : "center",
            flexWrap   : "wrap",
            gap        : 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <p className="mp-deals-title">🔔 Never Miss a Deal</p>
            <p className="mp-deals-sub">
              Get notified when new listings match your interests
            </p>
          </div>

          {notifySent ? (
            <div
              style={{
                display     : "flex",
                alignItems  : "center",
                gap         : 8,
                background  : "rgba(255,255,255,0.12)",
                color       : "#fff",
                padding     : "10px 18px",
                borderRadius: 12,
                fontWeight  : 700,
                fontSize    : 14,
              }}
              role="status"
              aria-live="polite"
            >
              <FiCheckCircle size={18} /> Subscribed!
            </div>
          ) : (
            <form
              onSubmit={handleNotify}
              style={{
                display      : "flex",
                gap          : 0,
                borderRadius : 12,
                overflow     : "hidden",
              }}
            >
              <input
                type="email"
                placeholder="your@email.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                aria-label="Email for deal notifications"
                required
                style={{
                  border    : "none",
                  padding   : "11px 16px",
                  fontSize  : 13,
                  fontWeight: 500,
                  outline   : "none",
                  width     : 200,
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                style={{
                  background : "linear-gradient(135deg,#ff5722,#ff8a00)",
                  color      : "#fff",
                  border     : "none",
                  padding    : "11px 18px",
                  fontSize   : 13,
                  fontWeight : 800,
                  cursor     : "pointer",
                  fontFamily : "inherit",
                  whiteSpace : "nowrap",
                }}
              >
                Notify Me
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FLOATING ACTION BUTTON  — Post Ad
          mp-fab from Minimart.css
          → /minimart/post-ad (logged in) or /auth (guest)
      ══════════════════════════════════════════════════ */}
      <button
        type="button"
        className="mp-fab"
        onClick={goPostAd}
        aria-label={user ? "Post a new ad" : "Sign up to sell"}
      >
        <FiPlus size={20} />
        {user ? "Post Ad" : "Sell Free"}
      </button>

      {/* ══════════════════════════════════════════════════
          FILTER DRAWER  — mp-drawer from Minimart.css
      ══════════════════════════════════════════════════ */}
      {showFilters && (
        <>
          <div
            className="mp-overlay"
            onClick={() => setShowFilters(false)}
            aria-hidden="true"
          />
          <div
            className="mp-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Filter products"
          >
            <div className="mp-drawer-handle" aria-hidden="true" />

            <div className="mp-drawer-header">
              <span className="mp-drawer-title">
                <FiSliders size={18} /> Filters
              </span>
              <button
                type="button"
                className="mp-drawer-close"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Price range */}
            <div className="mp-filter-section">
              <p className="mp-filter-label">Price Range (₦)</p>
              <div className="mp-price-range">
                <div className="mp-price-input-wrap">
                  <span className="mp-price-symbol">₦</span>
                  <input
                    type="number"
                    className="mp-price-input"
                    placeholder="Min"
                    value={minPrice}
                    min={0}
                    aria-label="Minimum price"
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                </div>
                <span className="mp-price-sep">—</span>
                <div className="mp-price-input-wrap">
                  <span className="mp-price-symbol">₦</span>
                  <input
                    type="number"
                    className="mp-price-input"
                    placeholder="Max"
                    value={maxPrice}
                    min={0}
                    aria-label="Maximum price"
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Sort */}
            <div className="mp-filter-section">
              <p className="mp-filter-label">Sort By</p>
              <div className="mp-filter-chips">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mp-chip ${activeSort === opt.value ? "mp-chip--active" : ""}`}
                    onClick={() => setActiveSort(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="mp-filter-section">
              <p className="mp-filter-label">Category</p>
              <div className="mp-filter-chips">
                {categoryTabs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`mp-chip ${activeCategory === c.id ? "mp-chip--active" : ""}`}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mp-drawer-footer">
              <button
                type="button"
                className="mp-btn-clear"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setActiveSort("newest");
                  setActiveCategory("all");
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="mp-btn-apply"
                onClick={handleApplyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}