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

const GPS_OPTS = {
  timeout           : 5_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
};

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const TrendingIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const DealsIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const NewIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const NearbyIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const DiamondIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12l4 6-10 13L2 9z" />
    <path d="M2 9h20" />
    <path d="M10 3l-4 6 6 13 6-13-4-6" />
  </svg>
);

const FlashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const CartIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
  </svg>
);

const BellIcon = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2} strokeLinecap="round" width={size} height={size}
       aria-hidden="true">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const SearchIcon = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.2} strokeLinecap="round" width={size} height={size}
       aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const ChevronRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

const ChevronDownIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
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

const PlusIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.5} strokeLinecap="round" width={size} height={size}
       aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
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

const ZapIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const TagIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const SponsoredIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   SECTION CARDS CONFIG  (SVG icons, no emoji)
══════════════════════════════════════════════════════════════ */
const SECTION_CARDS = [
  {
    label : "Trending",
    sub   : "Most popular",
    Icon  : TrendingIcon,
    path  : "/trending",
    grad  : "linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)",
    shadow: "rgba(255, 65, 108, 0.4)",
  },
  {
    label : "Deals",
    sub   : "Under ₦50k",
    Icon  : DealsIcon,
    path  : "/deals",
    grad  : "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    shadow: "rgba(17, 153, 142, 0.4)",
  },
  {
    label : "New",
    sub   : "Just listed",
    Icon  : NewIcon,
    path  : "/latest",
    grad  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    shadow: "rgba(102, 126, 234, 0.4)",
  },
  {
    label : "Near You",
    sub   : "Closest first",
    Icon  : NearbyIcon,
    path  : "/nearby",
    grad  : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    shadow: "rgba(240, 147, 251, 0.4)",
  },
];

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
    search_priority   : Number(p.search_priority   || 0),
    favorites_count   : Number(p.favorites_count   || 0),
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
    return `${Math.round(((orig - curr) / orig) * 100)}% off`;
  }
  return null;
};

const fmtCount = (n) => {
  const num = Number(n || 0);
  if (num <= 0)           return "0";
  if (num < 1_000)        return `${num}+`;
  if (num < 10_000)       return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (num < 1_000_000)    return `${Math.round(num / 1_000)}k+`;
  if (num < 10_000_000)   return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  return `${Math.round(num / 1_000_000)}M+`;
};

/* ══════════════════════════════════════════════════════════════
   SKELETONS
══════════════════════════════════════════════════════════════ */
const MasonrySkeleton = memo(function MasonrySkeleton() {
  return (
    <div className="hm-masonry" aria-busy="true">
      {[180,220,160,200,180,190,220,170,200,180].map((h, i) => (
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
   FIX: Falls back to empty string, not "Ife" or any default.
══════════════════════════════════════════════════════════════ */
const LocationBar = memo(function LocationBar({ location, onOpen, onClear }) {
  /* FIX: formatLocationLabel returns null when no location is set.
     We show "Set your location" placeholder instead of any fallback. */
  const label = formatLocationLabel(location) || "";

  return (
    <div className="hm-loc-bar">
      <button
        className={`hm-loc-bar-btn${label ? " hm-loc-bar-btn--active" : ""}`}
        onClick={onOpen}
      >
        <span className="hm-loc-bar-pin" aria-hidden="true">
          <PinIcon size={13} />
        </span>
        {label
          ? <span className="hm-loc-bar-label">{label}</span>
          : <span className="hm-loc-bar-placeholder">Set your location</span>
        }
        <ChevronDownIcon size={13} />
      </button>
      {label && (
        <button className="hm-loc-bar-clear" onClick={onClear}
                aria-label="Clear location">✕</button>
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
   SECTION CARDS  (SVG icons)
══════════════════════════════════════════════════════════════ */
const SectionCards = memo(function SectionCards({ onNavigate }) {
  return (
    <div className="hm-section-cards">
      {SECTION_CARDS.map((card) => (
        <button
          key={card.path}
          className="hm-sc"
          onClick={() => onNavigate(card.path)}
          style={{
            "--sc-grad"  : card.grad,
            "--sc-shadow": card.shadow,
          }}
        >
          <div className="hm-sc-bg" aria-hidden="true" />
          <div className="hm-sc-content">
            <span className="hm-sc-icon">
              <card.Icon size={20} />
            </span>
            <div className="hm-sc-text">
              <span className="hm-sc-label">{card.label}</span>
              <span className="hm-sc-sub">{card.sub}</span>
            </div>
          </div>
          <ChevronRightIcon size={14} />
        </button>
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   FEATURED CARD  (SVG icons)
══════════════════════════════════════════════════════════════ */
const FeaturedCard = memo(function FeaturedCard({ product, onClick }) {
  if (!product) return null;
  const imgUrl = getImageUrl(product);
  const loc    = formatCity(product);
  const disc   = discountLabel(product);

  /* Badge based on promotion_badge from backend or fallback */
  const badge  = product.promotion_badge || "promoted";

  return (
    <article className="hm-feat-card" role="button" tabIndex={0}
             onClick={() => onClick(product)}
             onKeyDown={(e) => e.key === "Enter" && onClick(product)}>
      <div className="hm-feat-img-wrap">
        <img className="hm-feat-img" src={imgUrl}
             alt={product.title || "Featured"} loading="eager"
             onError={(e) => { e.currentTarget.src = PH; }} />
        <div className="hm-feat-overlay" aria-hidden="true" />
      </div>
      <div className="hm-feat-body">
        <div className="hm-feat-top">
          <span className={`hm-feat-tag hm-feat-tag--${badge}`}>
            {badge === "featured" ? (
              <><DiamondIcon size={12} /> Featured</>
            ) : badge === "premium" ? (
              <><SponsoredIcon size={12} /> Premium</>
            ) : (
              <><FlashIcon size={12} /> Promoted</>
            )}
          </span>
          {disc && <span className="hm-feat-disc">{disc}</span>}
        </div>
        <p className="hm-feat-title">{product.title}</p>
        <div className="hm-feat-bottom">
          <span className="hm-feat-price">{naira(product.price)}</span>
          <span className="hm-feat-loc"><PinIcon size={10} /> {loc}</span>
        </div>
        {/* Seller subscription badge */}
        {product.seller?.subscriptionRank > 0 && (
          <span className="hm-feat-seller-badge">
            <SponsoredIcon size={10} />
            {product.seller.subscriptionPlan}
          </span>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEAL CARD  (SVG icons)
══════════════════════════════════════════════════════════════ */
const DealCard = memo(function DealCard({ product, onClick }) {
  if (!product) return null;
  const imgUrl = getImageUrl(product);
  const disc   = discountLabel(product);

  return (
    <article className="hm-deal-card" role="button" tabIndex={0}
             onClick={() => onClick(product)}
             onKeyDown={(e) => e.key === "Enter" && onClick(product)}>
      <div className="hm-deal-img-wrap">
        <img src={imgUrl} alt={product.title || "Deal"}
             className="hm-deal-img" loading="lazy"
             onError={(e) => { e.currentTarget.src = PH; }} />
        {disc && (
          <span className="hm-deal-disc">
            <TagIcon size={11} /> {disc}
          </span>
        )}
      </div>
      <div className="hm-deal-body">
        <p className="hm-deal-title">{product.title}</p>
        <span className="hm-deal-price">{naira(product.price)}</span>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   SCROLL TO TOP  (SVG icon)
══════════════════════════════════════════════════════════════ */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button className={`hm-scroll-top${visible ? " visible" : ""}`}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to top">
      <ChevronUpIcon size={16} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOMEPAGE
══════════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();

  let cacheCtx = { setProducts: () => {}, setLoaded: () => {} };
  try { cacheCtx = useProductCache(); } catch {}
  const { setProducts: setCachedProducts, setLoaded: setCacheLoaded } = cacheCtx;

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
    if (gpsAttempted.current || gpsCoords) return;
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

  /* State */
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

  const buildUrl = useCallback((pg = 0, catId = "all") => {
    const params = new URLSearchParams({ limit: PAGE_SIZE, page: pg });
    if (catId !== "all") params.set("category_id", catId);
    const coords = savedLocation?.coords || gpsCoords;
    if (coords?.lat && coords?.lng) {
      params.set("lat", coords.lat);
      params.set("lng", coords.lng);
    }
    if (savedLocation?.state) params.set("state", savedLocation.state);
    if (savedLocation?.city)  params.set("city",  savedLocation.city);
    return `${API}/homepage?${params}`;
  }, [savedLocation, gpsCoords]);

  const applyData = useCallback((data, append = false) => {
    const raw = Array.isArray(data.products) ? data.products : [];
    const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
    const merged = append
      ? dedup([...productsRef.current, ...normalized])
      : normalized;

    productsRef.current = merged;
    try { setCachedProducts(merged); setCacheLoaded(true); } catch {}

    const incomingFeat = Array.isArray(data.featured) ? data.featured : [];
    const feat = incomingFeat.length > 0
      ? incomingFeat.map(normalizeProduct).filter(Boolean)
      : merged.filter((p) => p.is_promoted).slice(0, 4);

    const cheap = merged
      .filter((p) => {
        const orig = Number(p.attributes?.original_price || 0);
        return !p.is_promoted && orig > p.price && p.price > 0;
      })
      .slice(0, 12);

    setFeatured(feat);
    setDeals(cheap);
    setProducts(merged.filter((p) => !p.is_promoted));
    setMeta(data.meta || {});
    setTotal(data.meta?.total ?? merged.length);
    setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);
  }, [setCachedProducts, setCacheLoaded]);

  const loadFeed = useCallback(async (catId = "all") => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    try {
      const res = await fetch(buildUrl(0, catId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), false);
    } catch (err) {
      console.error("[Homepage]", err);
      setError("Could not load listings.");
    } finally {
      setLoading(false);
    }
  }, [buildUrl, applyData]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res  = await fetch(buildUrl(next, category));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), true);
      setPage(next);
    } catch (err) {
      console.error("[Homepage] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, buildUrl, applyData]);

  const switchCategory = useCallback((catId) => {
    if (catId === category) return;
    setCategory(catId);
    loadFeed(catId);
  }, [category, loadFeed]);

  useEffect(() => { loadFeed("all"); }, []); // eslint-disable-line

  const locationKey = savedLocation
    ? `${savedLocation.city}-${savedLocation.state}` : "none";

  useEffect(() => {
    if (!loading) loadFeed(category);
  }, [locationKey]); // eslint-disable-line

  useEffect(() => {
    const h = () => loadFeed(category);
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [category, loadFeed]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_MS) loadFeed(category);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loading, category, loadFeed]);

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

  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/homepage/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/homepage/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  /*
   * FIX: heroLoc falls back to empty string "" (not "Ife" or any default).
   * Only shows a location label when:
   *   1. User explicitly set a location via LocationPicker
   *   2. GPS detected and backend returned meta.location
   *   3. Backend meta.location is populated from query filters
   *
   * If none of the above → heroLoc is null → location button hidden.
   */
  const heroLoc = useMemo(() => {
    const manual = formatLocationLabel(savedLocation);
    if (manual) return manual;
    if (meta?.nearbySource === "gps" && meta.location) return meta.location;
    if (meta?.location) return meta.location;
    return null;
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
              <span className="hm-hero-kicker">
                <CartIcon size={16} /> Loemart Marketplace
              </span>
              <h1 className="hm-hero-h1">
                Buy &amp; Sell<br />
                <em className="hm-hero-em">Near You</em>
              </h1>
              <p className="hm-hero-sub">
                Thousands of verified listings from sellers across Nigeria.
              </p>
            </div>
            <button className="hm-notif-btn" aria-label="Notifications"
                    onClick={() => navigate("/notifications")}>
              <BellIcon size={22} />
            </button>
          </div>

          {/* Location — only shows when we have one; empty fallback */}
          {heroLoc && (
            <button className="hm-hero-loc" onClick={() => navigate("/nearby")}>
              <span className="hm-loc-pip-lg" aria-hidden="true" />
              <PinIcon size={12} />
              <span>{heroLoc}</span>
              <ChevronRightIcon size={12} />
            </button>
          )}

          {/* Stats */}
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
                { val: fmtCount(total), label: "Listings" },
                { val: "24/7",          label: "Live"     },
                { val: "Free",          label: "To list"  },
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
          <button className="hm-search-bar" onClick={() => navigate("/search")}>
            <span className="hm-search-ic" aria-hidden="true">
              <SearchIcon size={17} />
            </span>
            <span className="hm-search-placeholder">
              Search products, brands, locations…
            </span>
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

        {/* ── SECTION CARDS ── */}
        <SectionCards onNavigate={navigate} />

        {/* ── ERROR ── */}
        {error && (
          <div className="hm-error" role="alert">
            <span className="hm-error-icon">
              <ZapIcon size={20} />
            </span>
            <p className="hm-error-title">Marketplace unavailable</p>
            <p className="hm-error-msg">{error}</p>
            <button className="hm-error-btn" onClick={() => loadFeed(category)}>
              Try again
            </button>
          </div>
        )}

        {/* ── FEATURED ── */}
        {(loading || featured.length > 0) && (
          <section className="hm-section">
            <div className="hm-section-head">
              <h2 className="hm-section-title">
                <DiamondIcon size={16} /> Featured
              </h2>
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
          <section className="hm-section">
            <div className="hm-section-head">
              <h2 className="hm-section-title">
                <DealsIcon size={16} /> Cheap Deals
              </h2>
              <button className="hm-section-link"
                      onClick={() => navigate("/deals")}>See all →</button>
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
        <section className="hm-section">
          <div className="hm-section-head">
            <h2 className="hm-section-title">{feedTitle}</h2>
            {category !== "all" && (
              <button className="hm-cat-clear"
                      onClick={() => switchCategory("all")}>✕ Clear</button>
            )}
          </div>

          {loading ? (
            <MasonrySkeleton />
          ) : error ? null : products.length === 0 ? (
            <div className="hm-empty">
              <span className="hm-empty-icon">
                <BagIcon size={40} />
              </span>
              <h3 className="hm-empty-title">
                {category === "all"
                  ? formatLocationLabel(savedLocation)
                    ? "No listings near you"
                    : "Welcome to Loemart"
                  : `No listings in ${currentCatName}`}
              </h3>
              <p className="hm-empty-sub">
                {category === "all"
                  ? "Try changing your location."
                  : "Try another category."}
              </p>
              <button className="hm-empty-btn"
                      onClick={() => category === "all"
                        ? loadFeed("all") : switchCategory("all")}>
                {category === "all" ? "Reload" : "Browse all"}
              </button>
            </div>
          ) : (
            <>
              <div className="hm-masonry" role="list">
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

              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

              {loadingMore && (
                <p className="hm-loading-more">
                  <span className="hm-spinner" /> Loading more…
                </p>
              )}

              {!hasMore && products.length > 0 && (
                <div className="hm-feed-end-wrap">
                  <p className="hm-feed-end">You've seen it all</p>
                  <button className="hm-feed-end-btn"
                          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    Back to top
                    <ChevronUpIcon size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── SELL BANNER ── */}
        {!loading && (
          <section className="hm-sell-banner">
            <div className="hm-sell-banner-blob" aria-hidden="true" />
            <div className="hm-sell-banner-content">
              <div className="hm-sell-banner-text">
                <h2>Start Selling on Loemart</h2>
                <p>List your products for free and reach thousands of buyers.</p>
              </div>
              <button className="hm-sell-banner-btn"
                      onClick={() => navigate("/minimart/add")}>
                List for Free
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </section>
        )}

        {!loading && <Footer />}
      </main>

      <button className="hm-fab" onClick={() => navigate("/minimart/add")}>
        <PlusIcon size={18} />
        Sell Now
      </button>

      <ScrollTopBtn />
      <BottomNav />

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(loc) => { saveLocation(loc); setPickerOpen(false); }}
      />
    </div>
  );
}