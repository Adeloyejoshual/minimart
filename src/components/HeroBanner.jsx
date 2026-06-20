/**
 * Homepage.jsx — Loemart.com
 * Built against the exact products + product_images schema
 * Routes: /product/:slug, /search, /nearby, /trending, /deals, /new
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import CATEGORIES from "../config/categories";
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

/* ─── Config ──────────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const SITE = "https://www.loemart.com";

const PH          = "https://placehold.co/600x500/f0ede8/b0a89e?text=Loemart";
const HOVER_DELAY = 900;
const STALE_AFTER = 5 * 60 * 1000;   // 5 min before refetch on tab return
const PAGE_SIZE   = 40;
const GPS_OPTS    = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };

const ALL_CAT  = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

/* ─── Helpers ─────────────────────────────────────────────── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const freshListing = (d) =>
  d && Date.now() - new Date(d).getTime() < 86_400_000; // < 24 h

/**
 * Resolve best image from a product row.
 * Priority: product_images array (from JOIN) → main_image → thumbnail_url
 */
const resolveImage = (p) => {
  // When API joins product_images, it might return them as p.images[]
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    if (typeof first === "string") return first;
    // object shape from product_images table
    return first.image_url || first.thumbnail_url || first.url || PH;
  }
  // Columns from products table directly
  return p.main_image || p.thumbnail_url || PH;
};

/** Build city + state label from DB columns */
const locationLabel = (p) => {
  const city  = p.location_city?.trim();
  const state = p.location_state?.trim();
  if (city && state)  return `${city}, ${state}`;
  if (state)          return state;
  if (city)           return city;
  // Fallback: nested object (some API shapes)
  if (p.location?.city || p.location?.state)
    return [p.location.city, p.location.state].filter(Boolean).join(", ");
  return "Nationwide";
};

/** Discount label from attributes.original_price or promotion_type */
const discountLabel = (p) => {
  const orig = Number(p.attributes?.original_price || 0);
  const curr = Number(p.price || 0);
  if (orig > curr && curr > 0) {
    const pct = Math.round(((orig - curr) / orig) * 100);
    return pct > 0 ? `${pct}% off` : null;
  }
  return null;
};

/** Badge derived from DB fields */
const getBadge = (p) => {
  if (p.is_promoted)               return { text: "Sponsored",  cls: "bd-feat" };
  if (p.promotion_type === "flash") return { text: "Flash Deal", cls: "bd-flash" };
  if ((p.engagement_score || 0) > 80) return { text: "Hot 🔥",   cls: "bd-hot"  };
  if ((p.views || 0) > 500)         return { text: "Popular",   cls: "bd-trnd" };
  if (freshListing(p.created_at))   return { text: "New",       cls: "bd-new"  };
  return null;
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

/* ─── Skeleton ────────────────────────────────────────────── */
const MasonrySkeleton = memo(() => (
  <div className="hm-masonry">
    {[200, 260, 180, 240, 200, 220, 260, 190, 210, 240].map((h, i) => (
      <div key={i} className="hm-sk hm-shimmer" style={{ height: h }} />
    ))}
  </div>
));

const FeaturedSkeleton = memo(() => (
  <div className="hm-feat-row">
    {[1, 2].map((i) => (
      <div key={i} className="hm-sk hm-sk-feat hm-shimmer" />
    ))}
  </div>
));

const StatsSkeleton = memo(() => (
  <div className="hm-hero-stats">
    {[1, 2, 3].map((i) => (
      <div key={i} className="hm-hero-stat">
        <div className="hm-sk hm-shimmer" style={{ width: 48, height: 22, borderRadius: 6 }} />
        <div className="hm-sk hm-shimmer" style={{ width: 56, height: 13, borderRadius: 4, marginTop: 4 }} />
      </div>
    ))}
  </div>
));

/* ─── Masonry Card ────────────────────────────────────────── */
const MasonryCard = memo(function MasonryCard({ product, priority, onView, onClick }) {
  const timerRef  = useRef(null);
  const badge     = getBadge(product);
  const imgUrl    = resolveImage(product);
  const loc       = locationLabel(product);
  const disc      = discountLabel(product);

  const startView = () => {
    timerRef.current = setTimeout(() => onView(product.id), HOVER_DELAY);
  };
  const cancelView = () => {
    clearTimeout(timerRef.current);
  };

  return (
    <article
      className="hm-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={startView}
      onMouseLeave={cancelView}
      aria-label={product.title}
    >
      {/* Badge */}
      {badge && (
        <span className={`hm-badge ${badge.cls}`} aria-label={badge.text}>
          {badge.text}
        </span>
      )}

      {/* Discount ribbon */}
      {disc && !badge && (
        <span className="hm-badge bd-disc">{disc}</span>
      )}

      {/* Image */}
      <div className="hm-card-img-wrap">
        <img
          className="hm-card-img"
          src={imgUrl}
          alt={product.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => { e.currentTarget.src = PH; }}
        />
      </div>

      {/* Body */}
      <div className="hm-card-body">
        <p className="hm-card-title">{product.title}</p>

        <div className="hm-card-price-row">
          <span className="hm-card-price">{naira(product.price)}</span>
          {product.attributes?.original_price > product.price && (
            <span className="hm-card-orig">
              {naira(product.attributes.original_price)}
            </span>
          )}
        </div>

        <div className="hm-card-meta">
          {/* Location — dot + text, matches your existing loc-pip style */}
          <span className="hm-loc">
            <span className="hm-loc-pip" aria-hidden="true" />
            <span>{loc}</span>
          </span>

          {/* Distance from GPS (if API returns it) */}
          {product.distance_km != null && (
            <span className="hm-dist">{product.distance_km} km</span>
          )}
        </div>

        {/* Seller verified check */}
        {product.seller?.verified && (
          <span className="hm-verified" aria-label="Verified seller">
            ✓ Verified
          </span>
        )}

        {/* Engagement bar */}
        {(product.views || 0) > 0 && (
          <div className="hm-eng">
            <span className="hm-eng-views">
              {product.views > 999
                ? `${(product.views / 1000).toFixed(1)}k`
                : product.views}{" "}
              views
            </span>
            {product.favorites_count > 0 && (
              <span className="hm-eng-fav">
                ♥ {product.favorites_count}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

/* ─── Featured / Sponsored Card ──────────────────────────── */
const FeaturedCard = memo(function FeaturedCard({ product, onClick }) {
  const imgUrl = resolveImage(product);
  const loc    = locationLabel(product);
  const disc   = discountLabel(product);

  return (
    <article
      className="hm-feat-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`Sponsored: ${product.title}`}
    >
      <div className="hm-feat-img-wrap">
        <img
          className="hm-feat-img"
          src={imgUrl}
          alt={product.title}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        <div className="hm-feat-overlay" aria-hidden="true" />
      </div>

      <div className="hm-feat-body">
        <div className="hm-feat-top">
          <span className="hm-feat-tag">
            {product.promotion_type === "flash" ? "⚡ Flash" : "💎 Sponsored"}
          </span>
          {disc && <span className="hm-feat-disc">{disc}</span>}
        </div>
        <p className="hm-feat-title">{product.title}</p>
        <div className="hm-feat-bottom">
          <span className="hm-feat-price">{naira(product.price)}</span>
          <span className="hm-feat-loc">
            <span className="hm-loc-pip" aria-hidden="true" />
            {loc}
          </span>
        </div>
      </div>
    </article>
  );
});

/* ─── Deal Card (horizontal strip) ───────────────────────── */
const DealCard = memo(function DealCard({ product, onClick }) {
  const imgUrl = resolveImage(product);
  const disc   = discountLabel(product);

  return (
    <article
      className="hm-deal-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={product.title}
    >
      <div className="hm-deal-img-wrap">
        <img
          src={imgUrl}
          alt={product.title}
          className="hm-deal-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {disc && <span className="hm-deal-disc">{disc}</span>}
      </div>
      <div className="hm-deal-body">
        <p className="hm-deal-title">{product.title}</p>
        <span className="hm-deal-price">{naira(product.price)}</span>
      </div>
    </article>
  );
});

/* ─── Main Homepage ───────────────────────────────────────── */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const {
    products: cachedProducts,
    loaded,
    setProducts,
    setLoaded,
  } = useProductCache();

  /* State */
  const [products,    setLocalProducts] = useState([]);
  const [featured,    setFeatured]      = useState([]);
  const [deals,       setDeals]         = useState([]);
  const [meta,        setMeta]          = useState({});
  const [loading,     setLoading]       = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error,       setError]         = useState(null);
  const [category,    setCategory]      = useState("all");
  const [hasMore,     setHasMore]       = useState(false);
  const [page,        setPage]          = useState(0);
  const [totalCount,  setTotalCount]    = useState(0);

  /* Refs */
  const productsRef = useRef([]);
  const sentinelRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const coordsRef   = useRef(null);

  /* ── Track view / click ─────────────────────────────────── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Process API response ───────────────────────────────── */
  const applyData = useCallback((data, append = false) => {
    // Support multiple API response shapes
    const incoming =
      Array.isArray(data.products)   ? data.products   :
      Array.isArray(data.data?.items) ? data.data.items :
      Array.isArray(data.data)        ? data.data       :
      [];

    const merged = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setLoaded(true);

    // Separate promoted (featured) from regular feed
    const feat  = merged.filter((p) => p.is_promoted);
    const cheap = merged
      .filter((p) => !p.is_promoted && p.attributes?.original_price > p.price)
      .slice(0, 10);
    const rest  = merged.filter((p) => !p.is_promoted);

    setFeatured(feat.slice(0, 4));
    setDeals(cheap);
    setLocalProducts(rest);
    setMeta(data.meta || data.data?.meta || {});
    setTotalCount(
      data.total ?? data.meta?.total ?? data.data?.total ?? merged.length
    );
    setHasMore(incoming.length >= PAGE_SIZE);
  }, [setProducts, setLoaded]);

  /* ── Core fetch ─────────────────────────────────────────── */
  const fetchProducts = useCallback(async ({
    catId  = "all",
    pg     = 0,
    coords = null,
  } = {}) => {
    const params = new URLSearchParams({ limit: PAGE_SIZE });
    if (pg > 0)          params.set("page", pg);
    if (catId !== "all") params.set("category_id", catId);
    if (coords) {
      params.set("lat", coords.lat);
      params.set("lng", coords.lng);
    }
    const res = await fetch(`${API}/homepage?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  /* ── GPS helper ─────────────────────────────────────────── */
  const withGPS = useCallback((catId, pg) =>
    new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => { if (done) return; done = true; fn(); };

      const fallback = () =>
        fetchProducts({ catId, pg, coords: coordsRef.current })
          .then(resolve).catch(reject);

      const gpsTimeout = setTimeout(() => finish(fallback), 5000);

      if (!navigator.geolocation) { clearTimeout(gpsTimeout); finish(fallback); return; }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(gpsTimeout);
          finish(() => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            coordsRef.current = c;
            fetchProducts({ catId, pg, coords: c })
              .then(resolve)
              .catch(fallback);
          });
        },
        () => { clearTimeout(gpsTimeout); finish(fallback); },
        GPS_OPTS
      );
    }),
  [fetchProducts]);

  /* ── Load feed ──────────────────────────────────────────── */
  const loadFeed = useCallback(async (catId = "all", forceRefresh = false) => {
    // Return cached data when navigating back (not a fresh category)
    if (
      !forceRefresh &&
      catId === "all"   &&
      loaded            &&
      cachedProducts.length > 0
    ) {
      productsRef.current = cachedProducts;
      const feat  = cachedProducts.filter((p) => p.is_promoted).slice(0, 4);
      const cheap = cachedProducts
        .filter((p) => !p.is_promoted && p.attributes?.original_price > p.price)
        .slice(0, 10);
      const rest  = cachedProducts.filter((p) => !p.is_promoted);
      setFeatured(feat);
      setDeals(cheap);
      setLocalProducts(rest);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];

    try {
      const data = await withGPS(catId, 0);
      applyData(data, false);
    } catch (e) {
      console.error("loadFeed", e);
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [loaded, cachedProducts, withGPS, applyData]);

  /* ── Load more (infinite scroll) ───────────────────────── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchProducts({
        catId:  category,
        pg:     next,
        coords: coordsRef.current,
      });
      applyData(data, true);
      setPage(next);
    } catch (e) {
      console.error("loadMore", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, fetchProducts, applyData]);

  /* ── Category switch ────────────────────────────────────── */
  const switchCategory = useCallback((catId) => {
    if (catId === category) return;
    setCategory(catId);
    loadFeed(catId, true);
  }, [category, loadFeed]);

  /* ── Lifecycle ──────────────────────────────────────────── */
  // Initial load
  useEffect(() => { loadFeed("all", false); }, []); // eslint-disable-line

  // Stale-tab refresh
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_AFTER) loadFeed(category, true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loading, category, loadFeed]);

  // Infinite scroll observer
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

  /* ── Derived ────────────────────────────────────────────── */
  const heroLoc =
    meta.nearbySource === "gps"
      ? `Near you · GPS${meta.location ? ` · ${meta.location}` : ""}`
      : meta.location || null;

  const currentCatName =
    CAT_LIST.find((c) => c.id === category)?.name || "Products";

  const SECTION_PILLS = [
    { label: "🔥 Trending",    path: "/trending" },
    { label: "💸 Cheap Deals", path: "/deals"    },
    { label: "🆕 New Arrivals",path: "/new"      },
    { label: "📍 Near You",    path: "/nearby"   },
  ];

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
      <TopNav user={user} />

      <div className="hm-page">

        {/* ════════════ HERO ════════════ */}
        <section className="hm-hero" aria-label="Welcome to Loemart">
          <div className="hm-hero-blob hm-hero-blob--1" aria-hidden="true" />
          <div className="hm-hero-blob hm-hero-blob--2" aria-hidden="true" />

          <div className="hm-hero-top">
            <div className="hm-hero-copy">
              <span className="hm-hero-kicker">
                🛒 Loemart Marketplace
              </span>
              <h1 className="hm-hero-h1">
                Buy &amp; Sell<br />
                <em className="hm-hero-em">Near You</em>
              </h1>
              <p className="hm-hero-sub">
                Thousands of verified listings from sellers across Nigeria.
              </p>
            </div>

            <button
              className="hm-notif-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={2} strokeLinecap="round" width={22} height={22}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
          </div>

          {/* GPS location chip */}
          {heroLoc && (
            <button
              className="hm-hero-loc"
              onClick={() => navigate("/nearby")}
              aria-label="View nearby listings"
            >
              <span className="hm-loc-pip-lg" aria-hidden="true" />
              <span>{heroLoc}</span>
            </button>
          )}

          {/* Stats */}
          {loading ? <StatsSkeleton /> : (
            <div className="hm-hero-stats">
              {[
                { val: `${Math.max(totalCount, productsRef.current.length) + 1000}+`, label: "Listings"    },
                { val: "24/7",                                                        label: "Live market" },
                { val: "Free",                                                        label: "To list"     },
              ].map((s) => (
                <div key={s.label} className="hm-hero-stat">
                  <span className="hm-hero-stat-val">{s.val}</span>
                  <span className="hm-hero-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ════════════ SEARCH BAR ════════════ */}
        <div className="hm-search-wrap">
          <button
            className="hm-search-bar"
            onClick={() => navigate("/search")}
            aria-label="Search Loemart"
          >
            <span className="hm-search-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={2.2} strokeLinecap="round" width={17} height={17}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <span className="hm-search-placeholder">
              Search products, brands, locations…
            </span>
            <kbd className="hm-search-kbd">⌘ K</kbd>
          </button>
        </div>

        {/* ════════════ CATEGORY STRIP ════════════ */}
        <nav className="hm-cat-strip" aria-label="Browse by category">
          {CAT_LIST.map((cat) => (
            <button
              key={cat.id}
              className={`hm-cat-btn${category === cat.id ? " hm-cat-btn--active" : ""}`}
              onClick={() => switchCategory(cat.id)}
              aria-pressed={category === cat.id}
            >
              <span className="hm-cat-icon" aria-hidden="true">{cat.icon}</span>
              <span className="hm-cat-name">{cat.name}</span>
            </button>
          ))}
        </nav>

        {/* ════════════ SECTION PILLS ════════════ */}
        <div className="hm-pills" role="navigation" aria-label="Quick sections">
          {SECTION_PILLS.map((pill) => (
            <button
              key={pill.path}
              className="hm-pill"
              onClick={() => navigate(pill.path)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* ════════════ ERROR ════════════ */}
        {error && (
          <div className="hm-error" role="alert">
            <span className="hm-error-icon" aria-hidden="true">⚡</span>
            <p className="hm-error-title">Marketplace unavailable</p>
            <p className="hm-error-msg">{error}</p>
            <button
              className="hm-error-btn"
              onClick={() => loadFeed(category, true)}
            >
              Try again
            </button>
          </div>
        )}

        {/* ════════════ FEATURED / SPONSORED ════════════ */}
        {(loading || featured.length > 0) && (
          <section className="hm-section" aria-label="Featured listings">
            <div className="hm-section-head">
              <h2 className="hm-section-title">💎 Featured</h2>
            </div>
            {loading
              ? <FeaturedSkeleton />
              : (
                <div className="hm-feat-row">
                  {featured.map((p) => (
                    <FeaturedCard
                      key={p.id}
                      product={p}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
          </section>
        )}

        {/* ════════════ DEALS STRIP ════════════ */}
        {!loading && deals.length > 0 && (
          <section className="hm-section" aria-label="Cheap deals">
            <div className="hm-section-head">
              <h2 className="hm-section-title">💸 Cheap Deals</h2>
              <button
                className="hm-section-link"
                onClick={() => navigate("/deals")}
              >
                See all →
              </button>
            </div>
            <div className="hm-deals-scroll">
              <div className="hm-deals-track">
                {deals.map((p) => (
                  <DealCard
                    key={p.id}
                    product={p}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ════════════ MAIN MASONRY FEED ════════════ */}
        <section
          className="hm-section"
          aria-label={category === "all" ? "Recommended for you" : currentCatName}
        >
          <div className="hm-section-head">
            <h2 className="hm-section-title">
              {category === "all" ? "Recommended for You" : currentCatName}
            </h2>
            {category !== "all" && (
              <button
                className="hm-cat-clear"
                onClick={() => switchCategory("all")}
                aria-label="Clear category filter"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {loading ? (
            <MasonrySkeleton />
          ) : error ? null : products.length === 0 ? (
            /* Empty state */
            <div className="hm-empty" role="status">
              <span className="hm-empty-emoji" aria-hidden="true">🛍️</span>
              <h3 className="hm-empty-title">
                {category === "all"
                  ? "Welcome to Loemart"
                  : `No listings in ${currentCatName}`}
              </h3>
              <p className="hm-empty-sub">
                {category === "all"
                  ? "Enable location for nearby deals, or browse what's available across Nigeria."
                  : "Be the first to list here, or try another category."}
              </p>
              {category === "all" ? (
                <button
                  className="hm-empty-btn"
                  onClick={() => loadFeed("all", true)}
                >
                  Reload marketplace
                </button>
              ) : (
                <button
                  className="hm-empty-btn"
                  onClick={() => switchCategory("all")}
                >
                  Browse all listings
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Masonry grid */}
              <div className="hm-masonry" role="list" aria-label="Product listings">
                {products.map((p, i) => (
                  <div key={p.id} role="listitem">
                    <MasonryCard
                      product={p}
                      priority={i < 6}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  </div>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

              {loadingMore && (
                <p className="hm-loading-more" aria-live="polite">
                  <span className="hm-spinner" /> Loading more…
                </p>
              )}

              {!hasMore && products.length > 0 && (
                <p className="hm-feed-end" aria-live="polite">
                  You've seen it all 🎉
                </p>
              )}
            </>
          )}
        </section>

        {/* ════════════ SELL CTA BANNER ════════════ */}
        {!loading && (
          <section className="hm-sell-banner" aria-label="Start selling">
            <div className="hm-sell-banner-content">
              <div className="hm-sell-banner-text">
                <h2>Start Selling on Loemart</h2>
                <p>
                  List your products for free and reach thousands
                  of buyers across Nigeria.
                </p>
              </div>
              <button
                className="hm-sell-banner-btn"
                onClick={() => navigate("/minimart/add")}
              >
                List for Free →
              </button>
            </div>
            <div className="hm-sell-banner-blob" aria-hidden="true" />
          </section>
        )}

      </div>

      {/* ── FAB ── */}
      <button
        className="hm-fab"
        onClick={() => navigate("/minimart/add")}
        aria-label="Sell a product"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={2.5} strokeLinecap="round" width={18} height={18}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Sell Now
      </button>

      <BottomNav />
    </>
  );
}