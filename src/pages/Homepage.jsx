// src/pages/Homepage.jsx
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useNavigate }     from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import CATEGORIES          from "../config/categories";
import TopNav              from "../components/TopNav";
import BottomNav           from "../components/BottomNav";
import Footer              from "../components/Footer";
import LocationPicker      from "../components/LocationPicker";
import MasonryCard, {
  naira,
  getImageUrl,
  formatCity,
  PinIcon,
}                          from "../components/MasonryCard";

/* Alias to avoid clash with react-router useLocation */
import {
  useLocation      as useStoredLocation,
  formatLocationLabel,
  readCachedGps,
  writeCachedGps,
}                          from "../hooks/useLocation";

import "../styles/Homepage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;
const PH        = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const STALE_MS  = 5 * 60_000;

const ALL_CAT  = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

const SECTION_PILLS = [
  { label: "🔥 Trending", path: "/trending" },
  { label: "💸 Deals",    path: "/deals"    },
  { label: "🆕 New",      path: "/latest"   },
  { label: "📍 Near You", path: "/nearby"   },
];

const GPS_OPTS = {
  timeout           : 5_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
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
    ctr               : Number(p.ctr               || 0),
    promotion_priority: Number(p.promotion_priority || 0),
    favorites_count   : Number(p.favorites_count   || 0),
    is_promoted       : !!p.is_promoted,
    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image ||
      p.thumbnail_url ||
      null,
    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const discountLabel = (p) => {
  if (!p) return null;
  const orig = Number(p.attributes?.original_price || 0);
  const curr = Number(p.price || 0);
  if (orig > curr && curr > 0) {
    const pct = Math.round(((orig - curr) / orig) * 100);
    return pct > 0 ? `${pct}% off` : null;
  }
  return null;
};

/* ══════════════════════════════════════════════════════════════
   SKELETONS
   ══════════════════════════════════════════════════════════════ */
const MasonrySkeleton = memo(function MasonrySkeleton() {
  return (
    <div className="hm-masonry" aria-busy="true">
      {[200,260,180,240,200,220,260,190,210,240].map((h, i) => (
        <div key={i} className="hm-sk hm-shimmer"
             style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
});

const FeaturedSkeleton = memo(function FeaturedSkeleton() {
  return (
    <div className="hm-feat-row" aria-busy="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="hm-sk hm-sk-feat hm-shimmer"
             aria-hidden="true" />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   LOCATION BAR
   ══════════════════════════════════════════════════════════════ */
const LocationBar = memo(function LocationBar({ location, onOpen, onClear }) {
  const label = formatLocationLabel(location);

  return (
    <div className="hm-loc-bar">
      <button
        className={`hm-loc-bar-btn${label ? " hm-loc-bar-btn--active" : ""}`}
        onClick={onOpen}
        aria-label={label ? `Showing in ${label}. Tap to change` : "Set location"}
      >
        <span className="hm-loc-bar-pin" aria-hidden="true">
          <PinIcon size={13} />
        </span>
        {label
          ? <span className="hm-loc-bar-label">{label}</span>
          : <span className="hm-loc-bar-placeholder">Set your location</span>
        }
        <svg className="hm-loc-bar-chevron" width="13" height="13"
             viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>
      {label && (
        <button className="hm-loc-bar-clear" onClick={onClear}
                aria-label="Clear location">
          <svg width="10" height="10" viewBox="0 0 24 24"
               fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41
                     10.59 12 5 17.59 6.41 19 12 13.41 17.59
                     19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   CATEGORY STRIP
   ══════════════════════════════════════════════════════════════ */
const CategoryStrip = memo(function CategoryStrip({ current, onChange }) {
  return (
    <nav className="hm-cat-strip" aria-label="Categories">
      {CAT_LIST.map((cat) => (
        <button
          key={cat.id}
          className={`hm-cat-btn${current === cat.id ? " hm-cat-btn--active" : ""}`}
          onClick={() => onChange(cat.id)}
          aria-pressed={current === cat.id}
        >
          <span className="hm-cat-icon" aria-hidden="true">{cat.icon}</span>
          <span className="hm-cat-name">{cat.name}</span>
        </button>
      ))}
    </nav>
  );
});

/* ══════════════════════════════════════════════════════════════
   FEATURED CARD
   ══════════════════════════════════════════════════════════════ */
const FeaturedCard = memo(function FeaturedCard({ product, onClick }) {
  if (!product) return null;

  const imgUrl = getImageUrl(product);
  const loc    = formatCity(product);
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
          alt={product.title || "Featured"}
          loading="eager"
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
            <PinIcon size={10} />
            {loc}
          </span>
        </div>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEAL CARD (horizontal strip)
   ══════════════════════════════════════════════════════════════ */
const DealCard = memo(function DealCard({ product, onClick }) {
  if (!product) return null;

  const imgUrl = getImageUrl(product);
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
          alt={product.title || "Deal"}
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

/* ══════════════════════════════════════════════════════════════
   SCROLL TO TOP
   ══════════════════════════════════════════════════════════════ */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`hm-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <svg width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor"
           strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOMEPAGE
   ══════════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();

  /* ── Product cache context ── */
  let cacheCtx = { setProducts: () => {}, setLoaded: () => {} };
  try { cacheCtx = useProductCache(); } catch {}
  const { setProducts: setCachedProducts, setLoaded: setCacheLoaded } = cacheCtx;

  /* ── Location ── */
  const {
    location      : savedLocation,
    save          : saveLocation,
    clear         : clearLocation,
  } = useStoredLocation();

  const [pickerOpen, setPickerOpen] = useState(false);

  /* ── GPS (silent) ── */
  const [gpsCoords, setGpsCoords] = useState(() => {
    try { return readCachedGps(); } catch { return null; }
  });
  const gpsAttempted = useRef(false);

  useEffect(() => {
    if (savedLocation?.source === "manual") return;
    if (gpsAttempted.current || gpsCoords) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        try { writeCachedGps(result); } catch {}
        setGpsCoords(result);
      },
      () => {}, // silent fail
      GPS_OPTS
    );
  }, [savedLocation, gpsCoords]);

  /* ── State ── */
  const [products,    setProducts]    = useState([]);
  const [featured,    setFeatured]    = useState([]);
  const [deals,       setDeals]       = useState([]);
  const [meta,        setMeta]        = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [category,    setCategory]    = useState("all");
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);
  const hiddenAtRef = useRef(null);

  /* ── Build fetch URL ── */
  const buildUrl = useCallback((pg = 0, catId = "all") => {
    const params = new URLSearchParams({ limit: PAGE_SIZE, page: pg });

    if (catId !== "all") params.set("category_id", catId);

    /* GPS coords */
    const coords = savedLocation?.coords || gpsCoords;
    if (coords?.lat && coords?.lng) {
      params.set("lat", coords.lat);
      params.set("lng", coords.lng);
    }

    /* Manual location from picker */
    if (savedLocation?.state) params.set("state", savedLocation.state);
    if (savedLocation?.city)  params.set("city",  savedLocation.city);

    return `${API}/homepage?${params}`;
  }, [savedLocation, gpsCoords]);

  /* ── Apply API data ── */
  const applyData = useCallback((data, append = false) => {
    const raw = Array.isArray(data.products) ? data.products : [];
    const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);

    const merged = append
      ? dedup([...productsRef.current, ...normalized])
      : normalized;

    productsRef.current = merged;

    /* Sync to cache context for TopNav search */
    try {
      setCachedProducts(merged);
      setCacheLoaded(true);
    } catch {}

    /* Featured */
    const incomingFeat = Array.isArray(data.featured) ? data.featured : [];
    const feat = incomingFeat.length > 0
      ? incomingFeat.map(normalizeProduct).filter(Boolean)
      : merged.filter((p) => p.is_promoted).slice(0, 4);

    /* Deals */
    const cheap = merged
      .filter((p) => {
        const orig = Number(p.attributes?.original_price || 0);
        return !p.is_promoted && orig > p.price && p.price > 0;
      })
      .slice(0, 12);

    const rest = merged.filter((p) => !p.is_promoted);

    setFeatured(feat);
    setDeals(cheap);
    setProducts(rest);
    setMeta(data.meta || {});
    setTotal(data.meta?.total ?? merged.length);
    setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);
  }, [setCachedProducts, setCacheLoaded]);

  /* ── Load feed ── */
  const loadFeed = useCallback(async (catId = "all", force = false) => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];

    try {
      const res = await fetch(buildUrl(0, catId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyData(data, false);
    } catch (err) {
      console.error("[Homepage] loadFeed:", err);
      setError("Could not load listings. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [buildUrl, applyData]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const next = page + 1;
      const res  = await fetch(buildUrl(next, category));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyData(data, true);
      setPage(next);
    } catch (err) {
      console.error("[Homepage] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, buildUrl, applyData]);

  /* ── Category switch ── */
  const switchCategory = useCallback((catId) => {
    if (catId === category) return;
    setCategory(catId);
    loadFeed(catId, true);
  }, [category, loadFeed]);

  /* ── Initial load ── */
  useEffect(() => {
    loadFeed("all", false);
  }, []); // eslint-disable-line

  /* ── Reload when location changes ── */
  const locationKey = savedLocation
    ? `${savedLocation.city}-${savedLocation.state}`
    : "none";

  useEffect(() => {
    if (!loading) loadFeed(category, true);
  }, [locationKey]); // eslint-disable-line

  /* ── Listen for locationChanged event ── */
  useEffect(() => {
    const handler = () => loadFeed(category, true);
    window.addEventListener("locationChanged", handler);
    return () => window.removeEventListener("locationChanged", handler);
  }, [category, loadFeed]);

  /* ── Stale-tab refresh ── */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_MS) loadFeed(category, true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loading, category, loadFeed]);

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

  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  /* ── Derived ── */
  const heroLoc = useMemo(() => {
    const manual = formatLocationLabel(savedLocation);
    if (manual) return `📍 ${manual}`;
    if (meta?.nearbySource === "gps")
      return `Near you · GPS${meta.location ? ` · ${meta.location}` : ""}`;
    return meta?.location || null;
  }, [savedLocation, meta]);

  const currentCatName =
    CAT_LIST.find((c) => c.id === category)?.name || "Products";

  const feedTitle = useMemo(() => {
    if (category !== "all") return currentCatName;
    const loc = formatLocationLabel(savedLocation);
    return loc ? `Near ${loc}` : "Recommended for You";
  }, [category, currentCatName, savedLocation]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="hm-root">
      <TopNav user={user} />

      <main className="hm-page" id="hm-main">

        {/* ── HERO ── */}
        <section className="hm-hero" aria-label="Welcome">
          <div className="hm-hero-blob hm-hero-blob--1" aria-hidden="true" />
          <div className="hm-hero-blob hm-hero-blob--2" aria-hidden="true" />

          <div className="hm-hero-top">
            <div className="hm-hero-copy">
              <span className="hm-hero-kicker">🛒 Loemart Marketplace</span>
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

          {heroLoc && (
            <button className="hm-hero-loc" onClick={() => navigate("/nearby")}>
              <span className="hm-loc-pip-lg" aria-hidden="true" />
              <span>{heroLoc}</span>
            </button>
          )}

          <div className="hm-hero-stats">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="hm-hero-stat">
                  <div className="hm-sk hm-shimmer"
                       style={{ width: 48, height: 22, borderRadius: 6 }} />
                  <div className="hm-sk hm-shimmer"
                       style={{ width: 56, height: 12, borderRadius: 4, marginTop: 4 }} />
                </div>
              ))
            ) : (
              [
                { val: `${(total + 1_000).toLocaleString()}+`, label: "Listings"    },
                { val: "24/7",  label: "Live market" },
                { val: "Free",  label: "To list"     },
              ].map((s) => (
                <div key={s.label} className="hm-hero-stat">
                  <span className="hm-hero-stat-val">{s.val}</span>
                  <span className="hm-hero-stat-label">{s.label}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── SEARCH ── */}
        <div className="hm-search-wrap">
          <button className="hm-search-bar" onClick={() => navigate("/search")}
                  aria-label="Search Loemart">
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

        {/* ── LOCATION BAR ── */}
        <LocationBar
          location={savedLocation}
          onOpen={() => setPickerOpen(true)}
          onClear={clearLocation}
        />

        {/* ── CATEGORIES ── */}
        <CategoryStrip current={category} onChange={switchCategory} />

        {/* ── SECTION PILLS ── */}
        <div className="hm-pills" role="navigation" aria-label="Quick sections">
          {SECTION_PILLS.map((pill) => (
            <button key={pill.path} className="hm-pill"
                    onClick={() => navigate(pill.path)}>
              {pill.label}
            </button>
          ))}
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="hm-error" role="alert">
            <span className="hm-error-icon" aria-hidden="true">⚡</span>
            <p className="hm-error-title">Marketplace unavailable</p>
            <p className="hm-error-msg">{error}</p>
            <button className="hm-error-btn"
                    onClick={() => loadFeed(category, true)}>
              Try again
            </button>
          </div>
        )}

        {/* ── FEATURED ── */}
        {(loading || featured.length > 0) && (
          <section className="hm-section" aria-label="Featured">
            <div className="hm-section-head">
              <h2 className="hm-section-title">💎 Featured</h2>
            </div>
            {loading ? <FeaturedSkeleton /> : (
              <div className="hm-feat-row">
                {featured.map((p) => p && (
                  <FeaturedCard key={p.id} product={p}
                                onClick={handleProductClick} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── DEALS ── */}
        {!loading && deals.length > 0 && (
          <section className="hm-section" aria-label="Deals">
            <div className="hm-section-head">
              <h2 className="hm-section-title">💸 Cheap Deals</h2>
              <button className="hm-section-link"
                      onClick={() => navigate("/deals")}>
                See all →
              </button>
            </div>
            <div className="hm-deals-scroll">
              <div className="hm-deals-track">
                {deals.map((p) => p && (
                  <DealCard key={p.id} product={p}
                            onClick={handleProductClick} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── MAIN FEED ── */}
        <section className="hm-section"
                 aria-label={feedTitle}>
          <div className="hm-section-head">
            <h2 className="hm-section-title">{feedTitle}</h2>
            {category !== "all" && (
              <button className="hm-cat-clear"
                      onClick={() => switchCategory("all")}
                      aria-label="Clear filter">
                ✕ Clear
              </button>
            )}
          </div>

          {loading ? (
            <MasonrySkeleton />
          ) : error ? null : products.length === 0 ? (
            <div className="hm-empty" role="status">
              <span className="hm-empty-emoji" aria-hidden="true">🛍️</span>
              <h3 className="hm-empty-title">
                {category === "all"
                  ? formatLocationLabel(savedLocation)
                    ? "No listings found near you"
                    : "Welcome to Loemart"
                  : `No listings in ${currentCatName}`}
              </h3>
              <p className="hm-empty-sub">
                {category === "all"
                  ? "Enable location or browse all listings."
                  : "Try another category."}
              </p>
              <button className="hm-empty-btn"
                      onClick={() => category === "all"
                        ? loadFeed("all", true)
                        : switchCategory("all")
                      }>
                {category === "all" ? "Reload" : "Browse all"}
              </button>
            </div>
          ) : (
            <>
              <div className="hm-masonry" role="list"
                   aria-label="Product listings">
                {products.map((p, i) => p && (
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

              <div ref={sentinelRef} aria-hidden="true"
                   style={{ height: 1 }} />

              {loadingMore && (
                <p className="hm-loading-more" aria-live="polite">
                  <span className="hm-spinner" aria-hidden="true" />
                  Loading more…
                </p>
              )}

              {!hasMore && products.length > 0 && (
                <div className="hm-feed-end-wrap">
                  <p className="hm-feed-end">You've seen it all 🎉</p>
                  <button className="hm-feed-end-btn"
                          onClick={() => window.scrollTo({
                            top: 0, behavior: "smooth"
                          })}>
                    Back to top ↑
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── SELL BANNER ── */}
        {!loading && (
          <section className="hm-sell-banner" aria-label="Start selling">
            <div className="hm-sell-banner-blob" aria-hidden="true" />
            <div className="hm-sell-banner-content">
              <div className="hm-sell-banner-text">
                <h2>Start Selling on Loemart</h2>
                <p>List your products for free and reach thousands of buyers.</p>
              </div>
              <button className="hm-sell-banner-btn"
                      onClick={() => navigate("/minimart/add")}>
                List for Free →
              </button>
            </div>
          </section>
        )}

        {/* ── FOOTER ── */}
        {!loading && <Footer />}

      </main>

      {/* ── FAB ── */}
      <button className="hm-fab" onClick={() => navigate("/minimart/add")}
              aria-label="Sell a product">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={2.5} strokeLinecap="round" width={18} height={18}
             aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Sell Now
      </button>

      <ScrollTopBtn />
      <BottomNav />

      {/* ── LOCATION PICKER ── */}
      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(loc) => {
          saveLocation(loc);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}