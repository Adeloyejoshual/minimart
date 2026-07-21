// src/pages/DealsPage.jsx
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useNavigate }  from "react-router-dom";
import TopNav           from "../components/TopNav";
import BottomNav        from "../components/BottomNav";
import Footer           from "../components/Footer";
import LocationPicker   from "../components/LocationPicker";
import MasonryCard, {
  naira,
  getImageUrl,
  formatCity,
  PinIcon,
}                       from "../components/MasonryCard";
import {
  useLocation      as useStoredLocation,
  formatLocationLabel,
  readCachedGps,
  writeCachedGps,
}                       from "../hooks/useLocation";
import "../styles/DealsPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;
const PH        = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const STALE_MS  = 5 * 60_000;

const GPS_OPTS = {
  timeout           : 5_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
};

const SORT_OPTIONS = [
  { value: "newest",   label: "Newest"  },
  { value: "price_lo", label: "Price ↑" },
  { value: "price_hi", label: "Price ↓" },
  { value: "discount", label: "% Off"   },
];

const CATEGORY_OPTIONS = [
  { value: "all",         label: "All Deals"    },
  { value: "electronics", label: "Electronics"  },
  { value: "fashion",     label: "Fashion"      },
  { value: "home",        label: "Home & Living" },
  { value: "sports",      label: "Sports"       },
  { value: "beauty",      label: "Beauty"       },
  { value: "food",        label: "Food & Drink" },
];

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const BackIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const ShareIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </svg>
);

const TagIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59
      8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const FlashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const FilterIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SortIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 20V4" />
  </svg>
);

const ChevronDownIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

const ChevronUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
    aria-hidden="true">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const ChevronRightIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

const ZapIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const BagIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

const SearchIcon = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.2} strokeLinecap="round" width={size}
    height={size} aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;
  return {
    ...p,
    price             : Number(p.price              || 0),
    engagement_score  : Number(p.engagement_score   || 0),
    clicks_count      : Number(p.clicks_count        || 0),
    impression_count  : Number(p.impression_count    || 0),
    views             : Number(p.views               || 0),
    ctr               : Number(p.ctr                 || 0),
    promotion_priority: Number(p.promotion_priority  || 0),
    favorites_count   : Number(p.favorites_count     || 0),
    is_promoted       : !!p.is_promoted,
    promotion_badge   : p.promotion_badge || null,
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
    seller: {
      id              : p.seller?.id               || p.seller_id   || null,
      name            : p.seller?.name             || p.seller_name || null,
      verified        : !!p.seller?.verified,
      subscriptionPlan: p.seller?.subscriptionPlan || null,
      subscriptionRank: Number(p.seller?.subscriptionRank || 0),
    },
    /* discount helpers */
    original_price: Number(
      p.attributes?.original_price ||
      p.original_price ||
      0
    ),
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const discountPct = (p) => {
  if (!p) return 0;
  const orig = p.original_price || 0;
  const curr = p.price          || 0;
  if (orig > curr && curr > 0)
    return Math.round(((orig - curr) / orig) * 100);
  return 0;
};

const discountLabel = (p) => {
  const pct = discountPct(p);
  return pct > 0 ? `${pct}% off` : null;
};

const fmtCount = (n) => {
  const num = Number(n || 0);
  if (num <= 0)        return "0";
  if (num < 1_000)     return `${num}+`;
  if (num < 10_000)    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (num < 1_000_000) return `${Math.round(num / 1_000)}k+`;
  return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
};

/* Sort deals array client-side */
const sortDeals = (arr, sort) => {
  const out = [...arr];
  if (sort === "price_lo") return out.sort((a, b) => a.price - b.price);
  if (sort === "price_hi") return out.sort((a, b) => b.price - a.price);
  if (sort === "discount") return out.sort((a, b) => discountPct(b) - discountPct(a));
  return out; /* newest — keep server order */
};

/* ══════════════════════════════════════════════════════════════
   SKELETONS
══════════════════════════════════════════════════════════════ */
const MasonrySkeleton = memo(function MasonrySkeleton() {
  return (
    <div className="deals-masonry" aria-busy="true" aria-label="Loading deals">
      {[180, 220, 160, 200, 180, 190, 220, 170, 200, 180].map((h, i) => (
        <div key={i} className="dc-sk deals-shimmer"
          style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   LOCATION BAR
══════════════════════════════════════════════════════════════ */
const LocationBar = memo(function LocationBar({ location, onOpen, onClear }) {
  const label = formatLocationLabel(location) || "";
  return (
    <div className="df-loc-bar">
      <button
        className={`df-loc-btn${label ? " df-loc-btn--active" : ""}`}
        onClick={onOpen}
        aria-label={label ? `Location: ${label}` : "Set your location"}>
        <span className="df-loc-pin" aria-hidden="true">
          <PinIcon size={13} />
        </span>
        {label
          ? <span className="df-loc-label">{label}</span>
          : <span className="df-loc-placeholder">Set your location</span>
        }
        <ChevronDownIcon size={13} />
      </button>
      {label && (
        <button className="df-loc-clear" onClick={onClear}
          aria-label="Clear location">✕</button>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEAL CARD  (masonry item with discount overlay)
══════════════════════════════════════════════════════════════ */
const DealCard = memo(function DealCard({ product, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  if (!product) return null;

  const imgUrl = getImageUrl(product) || PH;
  const disc   = discountLabel(product);
  const loc    = formatCity(product);

  return (
    <article
      className="masonry-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`}>

      {/* Badge */}
      {disc && (
        <span className="bd"
          style={{ background: "#e74c3c", color: "#fff" }}>
          {disc}
        </span>
      )}

      {/* Image */}
      <div style={{
        position  : "relative",
        overflow  : "hidden",
        background: "rgba(0,0,0,0.04)",
      }}>
        {!imgLoaded && (
          <div
            className="deals-shimmer"
            style={{
              position: "absolute", inset: 0,
              minHeight: 140,
            }}
            aria-hidden="true"
          />
        )}
        <img
          className="masonry-img"
          src={imgUrl}
          alt={product.title || "Deal"}
          loading="lazy"
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity .3s ease" }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = PH;
            setImgLoaded(true);
          }}
        />
        {/* Flash sale strip */}
        {disc && (
          <span className="deals-disc-pip" aria-hidden="true">
            <FlashIcon size={10} /> {disc}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="masonry-body">
        <p className="masonry-name">{product.title}</p>
        <p className="masonry-price">{naira(product.price)}</p>
        {product.original_price > 0 && (
          <p className="deals-orig-price">
            {naira(product.original_price)}
          </p>
        )}
        {loc && (
          <p className="masonry-loc">
            <PinIcon size={10} /> {loc}
          </p>
        )}
        {product.seller?.verified && (
          <p className="vfd">✓ Verified Seller</p>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   MOBILE HEADER
══════════════════════════════════════════════════════════════ */
const DealsHeader = memo(function DealsHeader({ total, onBack, onShare }) {
  return (
    <header className="dh-wrap">
      <button className="dh-back" onClick={onBack} aria-label="Go back">
        <BackIcon size={18} />
      </button>

      <div className="dh-title-wrap">
        <h1 className="dh-title">Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <button className="dh-share" onClick={onShare}
        aria-label="Share deals">
        <ShareIcon size={16} />
      </button>
    </header>
  );
});

/* ══════════════════════════════════════════════════════════════
   FILTER BAR
══════════════════════════════════════════════════════════════ */
const FilterBar = memo(function FilterBar({
  total, filtered, sort, category,
  onSort, onCategory,
}) {
  return (
    <div className="df-bar" role="search" aria-label="Filter deals">
      <span className="df-count">
        <FilterIcon size={13} />
        {filtered} of {total}
      </span>

      <div className="df-controls">
        {/* Category */}
        <div className="df-select-wrap">
          <label className="df-label" htmlFor="deals-cat-select">
            <TagIcon size={11} /> Category
          </label>
          <select
            id="deals-cat-select"
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
          <label className="df-label" htmlFor="deals-sort-select">
            <SortIcon size={11} /> Sort
          </label>
          <select
            id="deals-sort-select"
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
      className={`deals-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}>
      <ChevronUpIcon size={16} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO BANNER  (deals-specific)
══════════════════════════════════════════════════════════════ */
const DealsHero = memo(function DealsHero({ total, loading }) {
  return (
    <section className="dh-hero" aria-label="Deals overview">
      <div className="dh-hero-blob dh-hero-blob--1" aria-hidden="true" />
      <div className="dh-hero-blob dh-hero-blob--2" aria-hidden="true" />

      <div className="dh-hero-content">
        <span className="dh-hero-kicker">
          <FlashIcon size={14} /> Limited Time Offers
        </span>
        <h2 className="dh-hero-title">
          Cheap <em className="dh-hero-em">Deals</em>
        </h2>
        <p className="dh-hero-sub">
          Discounted listings from verified sellers across Nigeria.
        </p>

        {/* Stats */}
        <div className="dh-hero-stats">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="dh-hero-stat">
                <div className="dc-sk deals-shimmer"
                  style={{ width: 44, height: 20, borderRadius: 6 }} />
                <div className="dc-sk deals-shimmer"
                  style={{ width: 52, height: 11, borderRadius: 4, marginTop: 4 }} />
              </div>
            ))
          ) : (
            [
              { val: fmtCount(total), label: "Deals"    },
              { val: "Up to 80%",     label: "Off"      },
              { val: "Verified",      label: "Sellers"  },
            ].map((s) => (
              <div key={s.label} className="dh-hero-stat">
                <span className="dh-hero-stat-val">{s.val}</span>
                <span className="dh-hero-stat-label">{s.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEALS PAGE
══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  const {
    location : savedLocation,
    save     : saveLocation,
    clear    : clearLocation,
  } = useStoredLocation();

  const [pickerOpen, setPickerOpen] = useState(false);

  /* GPS */
  const [gpsCoords, setGpsCoords] = useState(() => {
    try { return readCachedGps(); } catch { return null; }
  });
  const gpsAttempted = useRef(false);

  useEffect(() => {
    if (savedLocation?.source === "manual") return;
    if (gpsAttempted.current || gpsCoords)  return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        try { writeCachedGps(result); } catch {}
        setGpsCoords(result);
      },
      () => {},
      GPS_OPTS
    );
  }, [savedLocation, gpsCoords]);

  /* Data state */
  const [allDeals,    setAllDeals]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);

  /* Filter / sort state */
  const [sort,     setSort]     = useState("newest");
  const [category, setCategory] = useState("all");

  const dealsRef    = useRef([]);
  const sentinelRef = useRef(null);
  const hiddenAtRef = useRef(null);

  /* Build API URL — targets /api/deals endpoint */
  const buildUrl = useCallback((pg = 0, catId = "all", sortVal = "newest") => {
    const params = new URLSearchParams({ limit: PAGE_SIZE, page: pg });

    if (catId !== "all")     params.set("category_id", catId);
    if (sortVal !== "newest") params.set("sort", sortVal);

    /* Price filter for "cheap deals" — under ₦50k */
    params.set("max_price", 50000);
    params.set("has_discount", 1);

    const coords = savedLocation?.coords || gpsCoords;
    if (coords?.lat && coords?.lng) {
      params.set("lat", coords.lat);
      params.set("lng", coords.lng);
    }
    if (savedLocation?.state) params.set("state", savedLocation.state);
    if (savedLocation?.city)  params.set("city",  savedLocation.city);

    return `${API}/deals?${params}`;
  }, [savedLocation, gpsCoords]);

  /* Apply normalise + dedup + store */
  const applyData = useCallback((data, append = false) => {
    const raw        = Array.isArray(data.products) ? data.products
                     : Array.isArray(data.deals)    ? data.deals
                     : [];
    const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
    const merged     = append
      ? dedup([...dealsRef.current, ...normalized])
      : normalized;

    dealsRef.current = merged;
    setAllDeals(merged);
    setTotal(data.meta?.total ?? merged.length);
    setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);
  }, []);

  /* Initial / category load */
  const loadFeed = useCallback(async (catId = "all", sortVal = "newest") => {
    setLoading(true);
    setError(null);
    setPage(0);
    dealsRef.current = [];
    try {
      const res = await fetch(buildUrl(0, catId, sortVal));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), false);
    } catch (err) {
      console.error("[DealsPage]", err);
      setError("Could not load deals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [buildUrl, applyData]);

  /* Load next page */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res  = await fetch(buildUrl(next, category, sort));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), true);
      setPage(next);
    } catch (err) {
      console.error("[DealsPage] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, sort, buildUrl, applyData]);

  /* Category switch */
  const switchCategory = useCallback((catId) => {
    if (catId === category) return;
    setCategory(catId);
    loadFeed(catId, sort);
  }, [category, sort, loadFeed]);

  /* Sort change */
  const switchSort = useCallback((sortVal) => {
    if (sortVal === sort) return;
    setSort(sortVal);
    loadFeed(category, sortVal);
  }, [sort, category, loadFeed]);

  /* Mount */
  useEffect(() => { loadFeed("all", "newest"); }, []); // eslint-disable-line

  /* Location change */
  const locationKey = savedLocation
    ? `${savedLocation.city}-${savedLocation.state}` : "none";

  useEffect(() => {
    if (!loading) loadFeed(category, sort);
  }, [locationKey]); // eslint-disable-line

  /* External location event */
  useEffect(() => {
    const h = () => loadFeed(category, sort);
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [category, sort, loadFeed]);

  /* Visibility / stale */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_MS) loadFeed(category, sort);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loading, category, sort, loadFeed]);

  /* Infinite scroll sentinel */
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

  /* Click tracking */
  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/deals/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const handleBack = useCallback(() => window.history.back(), []);

  const handleShare = useCallback(async () => {
    const data = { title: "Check out these deals!", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
    } catch {}
  }, []);

  /* Derived — client-side sort applied on top of server data */
  const visibleDeals = useMemo(
    () => sortDeals(allDeals, sort),
    [allDeals, sort]
  );

  /* Filtered by category (if server doesn't do it, client fallback) */
  const filteredDeals = useMemo(() => {
    if (category === "all") return visibleDeals;
    return visibleDeals.filter(
      (p) => p.category?.toLowerCase() === category
    );
  }, [visibleDeals, category]);

  const heroLoc = useMemo(() => {
    const manual = formatLocationLabel(savedLocation);
    if (manual) return manual;
    return null;
  }, [savedLocation]);

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="deals-root">
      <TopNav user={user} />

      <main className="deals-page" id="deals-main">

        {/* ── MOBILE HEADER ── */}
        <DealsHeader
          total={total}
          onBack={handleBack}
          onShare={handleShare}
        />

        {/* ── HERO ── */}
        <DealsHero total={total} loading={loading} />

        {/* ── SEARCH ── */}
        <div className="hm-search-wrap">
          <button
            className="hm-search-bar"
            onClick={() => navigate("/search")}>
            <span className="hm-search-ic" aria-hidden="true">
              <SearchIcon size={17} />
            </span>
            <span className="hm-search-placeholder">
              Search deals, brands, locations…
            </span>
          </button>
        </div>

        {/* ── LOCATION BAR ── */}
        <LocationBar
          location={savedLocation}
          onOpen={() => setPickerOpen(true)}
          onClear={clearLocation}
        />

        {/* ── FILTER BAR ── */}
        {!loading && !error && (
          <FilterBar
            total={total}
            filtered={filteredDeals.length}
            sort={sort}
            category={category}
            onSort={switchSort}
            onCategory={switchCategory}
          />
        )}

        {/* ── RESULT COUNT ── */}
        {!loading && !error && filteredDeals.length > 0 && (
          <div className="deals-result-count" aria-live="polite" aria-atomic="true">
            Showing{" "}
            <span className="deals-result-count-num">
              {filteredDeals.length}
            </span>
            {" "}deal{filteredDeals.length !== 1 ? "s" : ""}
            {heroLoc && <> near <strong>{heroLoc}</strong></>}
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div className="deals-err" role="alert">
            <span className="deals-err-icon">
              <ZapIcon size={20} />
            </span>
            <p className="deals-err-title">Could not load deals</p>
            <p className="deals-err-msg">{error}</p>
            <button
              className="deals-err-btn"
              onClick={() => loadFeed(category, sort)}>
              Try again
            </button>
          </div>
        )}

        {/* ── LOADING SKELETON ── */}
        {loading && !error && <MasonrySkeleton />}

        {/* ── EMPTY STATE ── */}
        {!loading && !error && filteredDeals.length === 0 && (
          <div className="deals-empty">
            <span className="deals-empty-emoji">
              <BagIcon size={40} />
            </span>
            <h3 className="deals-empty-title">
              {category === "all"
                ? heroLoc
                  ? `No deals near ${heroLoc}`
                  : "No deals right now"
                : `No deals in ${
                    CATEGORY_OPTIONS.find((c) => c.value === category)?.label
                    || category
                  }`
              }
            </h3>
            <p className="deals-empty-sub">
              {category === "all"
                ? "Try changing your location or check back soon."
                : "Try another category or clear filters."}
            </p>
            <button
              className="deals-empty-btn"
              onClick={() =>
                category === "all"
                  ? loadFeed("all", sort)
                  : switchCategory("all")
              }>
              {category === "all" ? "Reload" : "Browse all deals"}
            </button>
          </div>
        )}

        {/* ── MASONRY GRID ── */}
        {!loading && !error && filteredDeals.length > 0 && (
          <section className="hm-section">
            <div className="hm-section-head">
              <h2 className="hm-section-title">
                <TagIcon size={16} />{" "}
                {category === "all"
                  ? heroLoc
                    ? `Deals near ${heroLoc}`
                    : "All Deals"
                  : CATEGORY_OPTIONS.find((c) => c.value === category)?.label
                    || "Deals"
                }
              </h2>
              {category !== "all" && (
                <button
                  className="hm-cat-clear"
                  onClick={() => switchCategory("all")}>
                  ✕ Clear
                </button>
              )}
            </div>

            <div className="deals-masonry" role="list" aria-label="Deals grid">
              {filteredDeals.map((p) => p && (
                <div key={p.id} role="listitem">
                  <DealCard product={p} onClick={handleProductClick} />
                </div>
              ))}
            </div>

            {/* Sentinel */}
            <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

            {/* Loading more */}
            {loadingMore && (
              <p className="deals-loading-more" aria-live="polite">
                <span className="deals-spinner" aria-hidden="true" />
                Loading more deals…
              </p>
            )}

            {/* Feed end */}
            {!hasMore && filteredDeals.length > 0 && !loadingMore && (
              <div className="deals-feed-end-wrap">
                <p className="deals-feed-end">
                  🎉 You've seen all {filteredDeals.length} deals!
                </p>
                <button
                  className="deals-feed-end-btn"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }>
                  Back to top
                  <ChevronUpIcon size={14} />
                </button>
              </div>
            )}
          </section>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />

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