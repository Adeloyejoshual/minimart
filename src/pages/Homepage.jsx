/**
 * src/pages/Homepage.jsx
 * Route: /
 *
 * Production-grade marketplace UX:
 * - Smart ranking (engagement + promoted weight)
 * - Priority-ordered featured (promotion_priority)
 * - "For You" merged section (trending + recommended + session boost)
 * - Session-based personalization (recentCategories)
 * - Mid-feed promoted injection every 10 items
 * - Distance labels passed through to cards
 * - GPS + location-aware fetching
 * - 30-min + movement-aware refresh
 */

import {
  useEffect, useState, useCallback, useRef, memo, useMemo,
} from "react";
import { useNavigate }     from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav        from "../components/TopNav";
import BottomNav     from "../components/BottomNav";
import Footer        from "../components/Footer";
import MasonryGrid   from "../components/MasonryGrid";
import OverlayCard   from "../components/OverlayCard";
import LocationPicker, { getActiveLocation } from "../components/LocationPicker";
import { PinIcon, naira, getImageUrl } from "../components/MasonryCard";
import CATEGORY_CONFIG from "../config/categories";
import "../styles/Homepage.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
   Uses window.location.origin as fallback so it always matches
   the current domain — no CORS issues on www vs non-www.
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PH               = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const RECENT_KEY       = "recentCategories";
const ALL_PRODUCTS_LIMIT = 40;
const PROMO_INTERVAL   = 10;
const REFRESH_MS       = 1_800_000; // 30 minutes
const MOVE_CHECK_MS    = 300_000;   // 5 minutes
const MOVE_THRESHOLD   = 2;         // km
const GPS_TIMEOUT_MS   = 5_000;
const BRAND_NAME       = "Loemart";

const GPS_OPTIONS = {
  timeout            : 5_000,
  enableHighAccuracy : false,
  maximumAge         : 300_000,
};

const CAT_ALL = { name: "All", icon: "✦" };

const HERO_CATS = [
  "Phones & Tablets", "Vehicles", "Fashion",
  "Electronics", "Property", "Jobs",
];

const SORT_OPTS = [
  { key: "smart",      label: "Recommended" },
  { key: "newest",     label: "Newest"      },
  { key: "price_asc",  label: "Price ↑"    },
  { key: "price_desc", label: "Price ↓"    },
];

/* ═══════════════════════════════════════════════════════════════
   SESSION PERSONALIZATION
═══════════════════════════════════════════════════════════════ */
const getRecentCategories = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

const trackCategory = (categoryId) => {
  if (!categoryId) return;
  const recent  = getRecentCategories();
  const updated = [categoryId, ...recent.filter((c) => c !== categoryId)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE PRODUCT
   API returns numeric fields as strings e.g. price: "230000.00"
   Also returns null for invalid items — filtered out before use.
═══════════════════════════════════════════════════════════════ */
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
    conversion_rate   : Number(p.conversion_rate   || 0),
    is_promoted       : !!p.is_promoted,

    // ── Normalize image ──────────────────────────────────
    image: p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? (typeof p.images[0] === "string"
            ? p.images[0]
            : p.images[0]?.url || null)
        : null) ||
      p.main_image    ||
      p.thumbnail_url ||
      null,

    // ── Normalize location ───────────────────────────────
    location_city  : p.location?.city  || p.location_city  || null,
    location_state : p.location?.state || p.location_state || null,
  };
};

/* ═══════════════════════════════════════════════════════════════
   SCORING — with null safety
═══════════════════════════════════════════════════════════════ */
const personalScore = (p, recentCats) => {
  if (!p) return 0;
  let score = 0;
  score += (p.engagement_score    || 0);
  score += (p.is_promoted ? 50    : 0);
  score += ((p.promotion_priority || 0) * 5);
  score += ((p.ctr                || 0) * 30);
  if (p.category_id && recentCats.includes(p.category_id)) score += 20;
  return score;
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const formatCount = (n) => {
  if (!n || n < 1_000)   return `${n}+`;
  if (n >= 1_000_000)    return `+${Math.floor(n / 1_000_000)}m`;
  const k = n / 1_000;
  return `+${Number.isInteger(k) ? k : k.toFixed(1)}k`;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R    = 6_371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const heroLocation = (meta) => {
  const city  = meta?.location_city  || meta?.city;
  const state = meta?.location_state || meta?.state;
  if (city && state) return `${city}, ${state}`;
  return city || state || meta?.location || null;
};

const applySort = (arr, key) => {
  if (key === "newest")     return [...arr].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (key === "price_asc")  return [...arr].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (key === "price_desc") return [...arr].sort((a, b) => (b.price || 0) - (a.price || 0));
  return arr;
};

const injectPromoted = (products, promoted, interval = PROMO_INTERVAL) => {
  if (!promoted.length) return products;
  const result  = [];
  let promoIdx  = 0;
  const usedIds = new Set(products.map((p) => p?.id).filter(Boolean));

  for (let i = 0; i < products.length; i++) {
    if (products[i]) result.push(products[i]);
    if ((i + 1) % interval === 0) {
      while (promoIdx < promoted.length && usedIds.has(promoted[promoIdx]?.id)) promoIdx++;
      if (promoIdx < promoted.length && promoted[promoIdx]) {
        result.push({ ...promoted[promoIdx], _injected: true });
        usedIds.add(promoted[promoIdx].id);
        promoIdx++;
      }
    }
  }
  return result;
};

/* ═══════════════════════════════════════════════════════════════
   SPLIT PRODUCTS — full null safety
═══════════════════════════════════════════════════════════════ */
const splitProducts = (products, recentCats = []) => {
  // Safety: filter out null/undefined/invalid items
  const safe = (products || []).filter(
    (p) => p && typeof p === "object" && p.id
  );

  if (safe.length === 0) {
    return { featured: [], nearby: [], forYou: [], deals: [], latest: [], all: [] };
  }

  // Score all products
  const scored = safe.map((p) => ({
    ...p,
    _score: personalScore(p, recentCats),
  }));

  // Featured
  const featured = safe
    .filter((p) => p.is_promoted === true)
    .sort((a, b) => (b.promotion_priority || 0) - (a.promotion_priority || 0))
    .slice(0, 3);

  // Near You
  const nearby = safe
    .filter((p) =>
      p.distance_km != null ||
      p.location_city       ||
      p.location?.city
    )
    .slice(0, 10);

  // For You
  const forYou = scored
    .filter((p) =>
      (p._score          || 0) > 0 ||
      (p.engagement_score || 0) > 5 ||
      (p.ctr             || 0) > 0.05
    )
    .sort((a, b) => (b._score || 0) - (a._score || 0))
    .slice(0, 20);

  // Deals
  const deals = shuffle(
    safe.filter((p) => (p.price || 0) <= 50_000)
  ).slice(0, 20);

  // Latest
  const latest = [...safe]
    .sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    )
    .slice(0, 20);

  // All — smart rank
  const all = [...scored]
    .sort((a, b) => (b._score || 0) - (a._score || 0));

  return { featured, nearby, forYou, deals, latest, all };
};

/* ═══════════════════════════════════════════════════════════════
   SKELETONS
═══════════════════════════════════════════════════════════════ */
const SkeletonRow = () => (
  <div className="row">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="sk sk-co" />
    ))}
  </div>
);

const SkeletonMasonry = () => (
  <div className="masonry">
    {[...Array(8)].map((_, i) => (
      <div
        key={i}
        className="sk sk-masonry"
        style={{ height: `${160 + (i % 4) * 55}px` }}
      />
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   SECTION HEADER
═══════════════════════════════════════════════════════════════ */
const SectionHead = memo(function SectionHead({ title, chip, sub, onSeeAll }) {
  return (
    <div className="sec-head">
      <div className="sec-label">
        <span className="sec-title">{title}</span>
        {chip && <span className="sec-chip">{chip}</span>}
        {sub  && <span className="sec-sub">{sub}</span>}
      </div>
      {onSeeAll && (
        <button className="see-all" onClick={onSeeAll}>See all →</button>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION EMPTY
═══════════════════════════════════════════════════════════════ */
const SectionEmpty = ({ emoji, title, sub, cta, onCta }) => (
  <div className="sec-empty">
    {emoji && <span className="sec-empty-emoji">{emoji}</span>}
    <p className="sec-empty-title">{title}</p>
    {sub  && <p className="sec-empty-sub">{sub}</p>}
    {cta  && onCta && (
      <button className="sec-empty-btn" onClick={onCta}>{cta}</button>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   FEATURED CARD
═══════════════════════════════════════════════════════════════ */
const FeaturedCard = memo(function FeaturedCard({ product, onClick }) {
  if (!product) return null;
  const imageUrl = product.image || getImageUrl(product) || PH;
  return (
    <div
      className="feat"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(product); }}
    >
      <img
        className="feat-img"
        src={imageUrl}
        alt={product.title || "Product"}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={(e) => { e.currentTarget.src = PH; }}
      />
      <div className="feat-body">
        <div>
          <div className="feat-tag">Sponsored</div>
          <div className="feat-name">{product.title}</div>
        </div>
        <div>
          <div className="feat-price">{naira(product.price)}</div>
          <div className="feat-loc">
            {product.location_city || product.location?.city || "Nationwide"}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SORT CHIPS
═══════════════════════════════════════════════════════════════ */
const SortChips = memo(function SortChips({ active, onChange }) {
  return (
    <div className="sort-strip">
      {SORT_OPTS.map((o) => (
        <button
          key={o.key}
          className={`sort-chip${active === o.key ? " active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HOMEPAGE
═══════════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const {
    setProducts, setLoaded,
    products: cachedProducts,
    loaded: cacheLoaded,
  } = useProductCache();

  const [allProducts, setAllProducts] = useState([]);
  const [sections,    setSections]    = useState({
    featured : [],
    nearby   : [],
    forYou   : [],
    deals    : [],
    latest   : [],
    all      : [],
  });
  const [meta,    setMeta]    = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Category
  const [activeCategory, setActiveCategory] = useState("All");
  const [catProducts,    setCatProducts]    = useState(null);
  const [catLoading,     setCatLoading]     = useState(false);
  const [catError,       setCatError]       = useState(null);

  // All Products
  const [allSort,    setAllSort]    = useState("smart");
  const [allVisible, setAllVisible] = useState(ALL_PRODUCTS_LIMIT);

  // Location picker
  const [pickerOpen, setPickerOpen] = useState(false);

  const productsRef     = useRef([]);
  const catAbortRef     = useRef(null);
  const lastLocationRef = useRef(
    JSON.parse(localStorage.getItem("lastLocation") || "null")
  );

  // ── Apply fetched data ────────────────────────────────────
  const applyData = useCallback((data) => {
    const raw =
      Array.isArray(data.products) && data.products.length > 0
        ? data.products
        : [
            ...(data.recommended || []),
            ...(data.cheapDeals  || []),
            ...(data.trending    || []),
            ...(data.latest      || []),
          ];

    // Normalize + filter out null/invalid items
    const normalized = dedup(raw)
      .map(normalizeProduct)
      .filter(Boolean);

    const recent = getRecentCategories();

    console.log("[Homepage] products loaded:", normalized.length);

    productsRef.current = normalized;
    setAllProducts(normalized);
    setProducts(normalized);
    setSections(splitProducts(normalized, recent));
    setMeta(data.meta || {});
    setLoaded(true);
  }, [setProducts, setLoaded]);

  // ── Fetch helper ──────────────────────────────────────────
  const doFetch = useCallback(async (qs = "") => {
    const res = await fetch(`${BASE_URL}/api/homepage${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  // ── Load homepage ─────────────────────────────────────────
  const loadHomepage = useCallback(async () => {
    setLoading(true);
    setError(null);
    productsRef.current = [];

    try {
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => { if (done) return; done = true; fn(); };

        const timeout = setTimeout(() => {
          finish(() => doFetch().then(resolve).catch(reject));
        }, GPS_TIMEOUT_MS);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish(() => {
                clearTimeout(timeout);
                const { latitude, longitude } = pos.coords;
                lastLocationRef.current = { latitude, longitude };
                localStorage.setItem("lastLocation", JSON.stringify({ latitude, longitude }));
                doFetch(`?lat=${latitude}&lng=${longitude}`)
                  .then(resolve)
                  .catch(() => doFetch().then(resolve).catch(reject));
              });
            },
            () => {
              finish(() => {
                clearTimeout(timeout);
                doFetch().then(resolve).catch(reject);
              });
            },
            GPS_OPTIONS
          );
        } else {
          finish(() => { clearTimeout(timeout); doFetch().then(resolve).catch(reject); });
        }
      });

      applyData(data);

    } catch (err) {
      console.error("[Homepage] load error:", err);
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [applyData, doFetch]);

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    if (cacheLoaded && cachedProducts?.length > 0) {
      const normalized = cachedProducts
        .map(normalizeProduct)
        .filter(Boolean);
      const recent = getRecentCategories();
      productsRef.current = normalized;
      setAllProducts(normalized);
      setSections(splitProducts(normalized, recent));
      setLoading(false);
    } else {
      loadHomepage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 30-min refresh ────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => loadHomepage(), REFRESH_MS);
    return () => clearInterval(id);
  }, [loadHomepage]);

  // ── Movement-aware refresh ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const check = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          const prev = lastLocationRef.current;
          if (!prev) { lastLocationRef.current = { latitude, longitude }; return; }
          const moved = getDistanceKm(prev.latitude, prev.longitude, latitude, longitude);
          if (moved > MOVE_THRESHOLD) {
            lastLocationRef.current = { latitude, longitude };
            localStorage.setItem("lastLocation", JSON.stringify({ latitude, longitude }));
            loadHomepage();
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 5_000 }
      );
    };
    const id = setInterval(check, MOVE_CHECK_MS);
    return () => clearInterval(id);
  }, [loadHomepage]);

  // ── Location changed event ────────────────────────────────
  useEffect(() => {
    const h = () => loadHomepage();
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [loadHomepage]);

  // ── Category filter ───────────────────────────────────────
  const handleCategorySelect = useCallback(async (catName) => {
    if (catName === activeCategory) return;
    setActiveCategory(catName);
    setCatError(null);
    if (catName === "All") { setCatProducts(null); return; }

    if (catAbortRef.current) catAbortRef.current.abort();
    catAbortRef.current = new AbortController();
    setCatLoading(true);
    setCatProducts([]);

    try {
      const match = CATEGORY_CONFIG.find(
        (c) => c.name === catName || c.name?.toLowerCase() === catName.toLowerCase()
      );
      if (match?.id) trackCategory(match.id);

      const url = match?.id
        ? `${BASE_URL}/api/homepage?category_id=${match.id}&page=0`
        : `${BASE_URL}/api/homepage?page=0`;

      const res  = await fetch(url, { signal: catAbortRef.current.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const prods = (Array.isArray(data.products) ? data.products : [])
        .map(normalizeProduct)
        .filter(Boolean);

      setCatProducts(shuffle(dedup(prods)));
    } catch (err) {
      if (err.name === "AbortError") return;
      const fallback = allProducts.filter(
        (p) =>
          p?.category?.toLowerCase()      === catName.toLowerCase() ||
          p?.category_name?.toLowerCase() === catName.toLowerCase()
      );
      setCatProducts(shuffle(fallback));
      if (fallback.length === 0) setCatError(`No listings found in "${catName}"`);
    } finally {
      setCatLoading(false);
    }
  }, [activeCategory, allProducts]);

  // ── Analytics ─────────────────────────────────────────────
  const trackView = useCallback((id) => {
    fetch(`${BASE_URL}/api/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${BASE_URL}/api/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    if (product.category_id) trackCategory(product.category_id);
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  // ── Derived ───────────────────────────────────────────────
  const activeLoc = getActiveLocation();
  const locLabel  = useMemo(() => {
    if (activeLoc?.label) return activeLoc.label;
    return heroLocation(meta);
  }, [meta, activeLoc]);

  const cityLabel    = locLabel?.split(",")[0] || "Nigeria";
  const allCats      = [CAT_ALL, ...CATEGORY_CONFIG];
  const activeCatObj = CATEGORY_CONFIG.find((c) => c.name === activeCategory);

  const heroListingCount = useMemo(
    () => formatCount((productsRef.current.length || 0) + 1_000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProducts]
  );

  const sortedAll = useMemo(
    () => applySort(sections.all, allSort),
    [sections.all, allSort]
  );

  const allWithInjections = useMemo(
    () => injectPromoted(sortedAll.slice(0, allVisible), sections.featured),
    [sortedAll, allVisible, sections.featured]
  );

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      <TopNav user={user} />

      <div className="pg">

        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-top anim">
            <div>
              <div className="hero-kicker">{BRAND_NAME} Marketplace</div>
              <div className="hero-h1">
                {locLabel
                  ? <>Find anything in <i>{cityLabel}</i></>
                  : <>Buy &amp; sell <i>near you</i></>
                }
              </div>
            </div>
            <button
              className="hero-notify"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              🔔
            </button>
          </div>

          <button
            className="hero-loc anim anim-1"
            onClick={() => setPickerOpen(true)}
            aria-label="Change location"
          >
            <PinIcon size={14} />
            <span>{locLabel || "Set your location"}</span>
            {meta.nearbySource === "gps" && <span className="gps-chip">GPS</span>}
            <span className="hero-loc-change">Change</span>
          </button>

          <div className="hero-stats anim anim-2">
            <div className="hero-stat">
              <div className="hero-stat-n">{loading ? "—" : heroListingCount}</div>
              <div className="hero-stat-l">Listings</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">{loading ? "—" : "24/7"}</div>
              <div className="hero-stat-l">Live market</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">{loading ? "—" : "Free"}</div>
              <div className="hero-stat-l">To list</div>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="search-wrap anim anim-3" onClick={() => navigate("/search")}>
          <div className="search">
            <span className="search-ic">🔍</span>
            <span className="search-txt">Search products, categories…</span>
            <span className="search-tag">⌘ K</span>
          </div>
        </div>

        {/* ── Hero quick-cat chips ── */}
        <div className="hero-cats anim anim-3">
          {HERO_CATS.map((name) => {
            const cat = CATEGORY_CONFIG.find((c) => c.name === name);
            if (!cat) return null;
            return (
              <button
                key={name}
                className="hero-cat-chip"
                onClick={() => handleCategorySelect(name)}
              >
                <span>{cat.icon}</span>
                {name.split(" ")[0]}
              </button>
            );
          })}
        </div>

        {/* ── Full category strip ── */}
        <div className="cat-strip anim anim-4">
          {allCats.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                className={`cat-btn${isActive ? " active" : ""}`}
                onClick={() => handleCategorySelect(cat.name)}
              >
                <span className="cat-icon">{cat.icon}</span>
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="err-box">
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={loadHomepage}>Try again</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            CATEGORY VIEW
        ══════════════════════════════════════════════ */}
        {activeCategory !== "All" && (
          <div className="sec cat-section">
            <SectionHead
              title={`${activeCatObj?.icon ?? ""} ${activeCategory}`}
              sub={locLabel ? `· ${cityLabel}` : undefined}
            />
            {catLoading && <SkeletonMasonry />}
            {!catLoading && (catError || catProducts?.length === 0) && (
              <div className="empty">
                <div className="empty-emoji">📭</div>
                <div className="empty-title">No listings in {activeCategory} yet</div>
                <div className="empty-sub">
                  Be the first seller in <strong>{cityLabel}</strong> for this category!
                </div>
                <button className="empty-btn" onClick={() => navigate("/minimart/add")}>
                  Post your item →
                </button>
              </div>
            )}
            {!catLoading && catProducts?.length > 0 && (
              <MasonryGrid
                products={catProducts}
                onView={trackView}
                onClick={handleProductClick}
              />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            HOMEPAGE SECTIONS (All tab)
        ══════════════════════════════════════════════ */}
        {activeCategory === "All" && (
          <>
            {!loading && !error && sections.all.length === 0 && (
              <div className="empty">
                <div className="empty-emoji">🛍</div>
                <div className="empty-title">Welcome to {BRAND_NAME}</div>
                <div className="empty-sub">
                  Nigeria's neighbourhood marketplace — enable location for nearby deals.
                </div>
                <button className="empty-btn" onClick={loadHomepage}>
                  Load Marketplace
                </button>
              </div>
            )}

            {/* 1. Featured */}
            {(loading || sections.featured.length > 0) && (
              <div className="sec sec--primary anim anim-3">
                <SectionHead title="Featured" />
                {loading ? (
                  <div className="feat-wrap"><div className="sk sk-ft" /></div>
                ) : (
                  <div className="feat-wrap">
                    {sections.featured.map((p) =>
                      p ? <FeaturedCard key={p.id} product={p} onClick={handleProductClick} /> : null
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Near You */}
            {(loading || sections.nearby.length > 0) && (
              <div className="sec sec--primary anim anim-4">
                <SectionHead
                  title={
                    <>
                      <PinIcon size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                      Near You
                    </>
                  }
                  sub={locLabel ? `in ${cityLabel}` : undefined}
                  chip={meta.nearbySource === "gps" ? "GPS" : undefined}
                  onSeeAll={() => navigate("/nearby")}
                />
                {loading ? <SkeletonRow /> : (
                  <div className="row">
                    {sections.nearby.map((p, i) =>
                      p ? (
                        <OverlayCard
                          key={p.id} product={p} priority={i === 0}
                          onView={trackView} onClick={handleProductClick}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. For You */}
            {(loading || sections.forYou.length > 0) && (
              <div className="sec anim anim-5">
                <SectionHead
                  title="For You"
                  sub={locLabel ? `Popular in ${cityLabel}` : "Based on your activity"}
                  onSeeAll={() => navigate("/trending")}
                />
                {loading ? <SkeletonRow /> : sections.forYou.length === 0 ? (
                  <SectionEmpty
                    title="Building your feed…"
                    sub="Browse a few categories and we'll personalise this for you."
                  />
                ) : (
                  <div className="row">
                    {sections.forYou.map((p, i) =>
                      p ? (
                        <OverlayCard
                          key={p.id} product={p} rank={i}
                          onView={trackView} onClick={handleProductClick}
                        />
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Cheap Deals */}
            <div className="sec">
              <SectionHead
                title="Cheap Deals"
                chip="Under ₦50k"
                onSeeAll={() => navigate("/deals")}
              />
              {loading ? <SkeletonMasonry /> : sections.deals.length === 0 ? (
                <SectionEmpty
                  title="No deals right now"
                  sub="New listings under ₦50,000 appear daily — check back soon."
                />
              ) : (
                <MasonryGrid
                  products={sections.deals}
                  onView={trackView}
                  onClick={handleProductClick}
                />
              )}
            </div>

            {/* 5. New Arrivals */}
            <div className="sec">
              <SectionHead
                title="New Arrivals"
                onSeeAll={() => navigate("/latest")}
              />
              {loading ? <SkeletonRow /> : sections.latest.length === 0 ? (
                <SectionEmpty
                  title="No new listings yet"
                  sub={`Be the first to sell in ${cityLabel}!`}
                  cta="Sell Now"
                  onCta={() => navigate("/minimart/add")}
                />
              ) : (
                <div className="row">
                  {sections.latest.map((p, i) =>
                    p ? (
                      <OverlayCard
                        key={p.id} product={p} priority={i === 0}
                        onView={trackView} onClick={handleProductClick}
                      />
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* 6. All Products */}
            <div className="sec">
              <SectionHead
                title="All Products"
                sub={`${sections.all.length} listings`}
                onSeeAll={() => navigate("/products")}
              />
              {!loading && sections.all.length > 0 && (
                <SortChips
                  active={allSort}
                  onChange={(k) => { setAllSort(k); setAllVisible(ALL_PRODUCTS_LIMIT); }}
                />
              )}
              {loading ? <SkeletonMasonry /> : sections.all.length === 0 ? (
                <SectionEmpty title="No products yet" />
              ) : (
                <>
                  <MasonryGrid
                    products={allWithInjections}
                    onView={trackView}
                    onClick={handleProductClick}
                  />
                  {allVisible < sortedAll.length && (
                    <button
                      className="load-more"
                      onClick={() => setAllVisible((v) => v + ALL_PRODUCTS_LIMIT)}
                    >
                      Load more ({sortedAll.length - allVisible} remaining)
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── FAB ── */}
      <button
        className="fab"
        onClick={() => navigate("/minimart/add")}
        aria-label="Sell a product"
      >
        <span className="fab-ic">＋</span>
        Sell Now
      </button>

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={() => { setPickerOpen(false); loadHomepage(); }}
      />

      <Footer />
      <BottomNav />
    </>
  );
}