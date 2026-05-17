/**
 * Homepage.jsx — Minimart
 * Production-grade marketplace UX:
 * - Smart ranking (engagement + promoted weight)
 * - Priority-ordered featured (promotion_priority)
 * - "For You" merged section (trending + recommended + session boost)
 * - Session-based personalization (recentCategories)
 * - Mid-feed promoted injection every 10 items
 * - Distance labels passed through to cards
 */

import React, {
  useEffect, useState, useCallback, useRef, memo, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
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

/* ─── Constants ─────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH  = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";

const GPS_O = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };

const CAT_ALL            = { name: "All", icon: "✦" };
const ALL_PRODUCTS_LIMIT = 40;

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

/* ─── Session personalization ────────────────────────────── */
const RECENT_KEY = "recentCategories";

const getRecentCategories = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

const trackCategory = (categoryId) => {
  if (!categoryId) return;
  const recent = getRecentCategories();
  const updated = [categoryId, ...recent.filter((c) => c !== categoryId)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
};

/** Score a product for personalised ranking */
const personalScore = (p, recentCats) => {
  let score = 0;
  score += (p.engagement_score || 0);
  score += (p.is_promoted ? 50 : 0);
  score += ((p.promotion_priority || 0) * 5);
  score += (p.ctr || 0) * 30;
  if (recentCats.includes(p.category_id)) score += 20;
  return score;
};

/* ─── Helpers ────────────────────────────────────────────── */
const fresh = (d) => d && Date.now() - new Date(d).getTime() < 86_400_000;

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const formatCount = (n) => {
  if (!n || n < 1000) return `${n}+`;
  if (n >= 1_000_000) return `+${Math.floor(n / 1_000_000)}m`;
  const k = n / 1000;
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
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180,
    dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

/**
 * Mid-feed promoted injection.
 * Inserts a promoted product every `interval` items.
 * Never duplicates an already-visible promoted product.
 */
const injectPromoted = (products, promoted, interval = 10) => {
  if (!promoted.length) return products;
  const result = [];
  let promoIdx = 0;
  const usedIds = new Set(products.map((p) => p.id));

  for (let i = 0; i < products.length; i++) {
    result.push(products[i]);
    if ((i + 1) % interval === 0) {
      /* Find next promo not already shown */
      while (promoIdx < promoted.length && usedIds.has(promoted[promoIdx].id)) {
        promoIdx++;
      }
      if (promoIdx < promoted.length) {
        result.push({ ...promoted[promoIdx], _injected: true });
        usedIds.add(promoted[promoIdx].id);
        promoIdx++;
      }
    }
  }
  return result;
};

const splitProducts = (products, recentCats = []) => {
  /* ── Featured: respect promotion_priority ── */
  const featured = products
    .filter((p) => p.is_promoted)
    .sort((a, b) => (b.promotion_priority || 0) - (a.promotion_priority || 0))
    .slice(0, 3);

  /* ── Near You: products with location data ── */
  const nearby = products
    .filter((p) => p.distance_km != null || p.location?.city || p.location_city)
    .slice(0, 10);

  /* ── For You: merged trending + recommended with session boost ── */
  const forYou = products
    .map((p) => ({ ...p, _score: personalScore(p, recentCats) }))
    .filter((p) => p._score > 0 || (p.engagement_score || 0) > 5 || (p.ctr || 0) > 0.05)
    .sort((a, b) => b._score - a._score)
    .slice(0, 20);

  /* ── Deals ── */
  const deals = shuffle(products.filter((p) => Number(p.price) <= 50_000)).slice(0, 20);

  /* ── New Arrivals ── */
  const latest = [...products]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);

  /* ── All Products: smart ranking (engagement + promo weight) ── */
  const all = [...products].sort((a, b) =>
    ((b.engagement_score || 0) + (b.is_promoted ? 50 : 0) + ((b.promotion_priority || 0) * 5)) -
    ((a.engagement_score || 0) + (a.is_promoted ? 50 : 0) + ((a.promotion_priority || 0) * 5))
  );

  return { featured, nearby, forYou, deals, latest, all };
};

const heroLocation = (meta) => {
  const city  = meta?.location_city || meta?.city;
  const state = meta?.location_state || meta?.state;
  if (city && state) return `${city}, ${state}`;
  return city || state || meta?.location || null;
};

const applySort = (arr, key) => {
  if (key === "newest")     return [...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (key === "price_asc")  return [...arr].sort((a, b) => Number(a.price) - Number(b.price));
  if (key === "price_desc") return [...arr].sort((a, b) => Number(b.price) - Number(a.price));
  return arr; // smart (already sorted)
};

/* ─── Skeletons ──────────────────────────────────────────── */
const SkeletonRow = () => (
  <div className="row">
    {[...Array(5)].map((_, i) => <div key={i} className="sk sk-co" />)}
  </div>
);

const SkeletonMasonry = () => (
  <div className="masonry">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="sk sk-masonry" style={{ height: `${160 + (i % 4) * 55}px` }} />
    ))}
  </div>
);

/* ─── Section Header ─────────────────────────────────────── */
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

/* ─── Section Empty ──────────────────────────────────────── */
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

const InlineEmpty = ({ message }) => <p className="inline-empty">{message}</p>;

/* ─── FeaturedCard ───────────────────────────────────────── */
const FeaturedCard = memo(({ product, onClick }) => {
  const imageUrl = getImageUrl(product);
  return (
    <div
      className="feat" role="button" tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(product); }}
    >
      <img
        className="feat-img" src={imageUrl} alt={product.title}
        loading="eager" decoding="async" fetchPriority="high"
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
            {product.location?.city || product.location_city || "Nationwide"}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Sort chips ─────────────────────────────────────────── */
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

/* ═══════════════════════════════════════════════════════════
   HOMEPAGE
═══════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded, products: cachedProducts, loaded: cacheLoaded } = useProductCache();

  const [allProducts, setAllProducts] = useState([]);
  const [sections,    setSections]    = useState({
    featured: [], nearby: [], forYou: [], deals: [], latest: [], all: [],
  });
  const [meta,    setMeta]    = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* Category */
  const [activeCategory, setActiveCategory] = useState("All");
  const [catProducts,    setCatProducts]    = useState(null);
  const [catLoading,     setCatLoading]     = useState(false);
  const [catError,       setCatError]       = useState(null);

  /* All Products */
  const [allSort,    setAllSort]    = useState("smart");
  const [allVisible, setAllVisible] = useState(ALL_PRODUCTS_LIMIT);

  /* Location picker */
  const [pickerOpen, setPickerOpen] = useState(false);

  const productsRef     = useRef([]);
  const catAbortRef     = useRef(null);
  const lastLocationRef = useRef(
    JSON.parse(localStorage.getItem("lastLocation") || "null")
  );

  /* ── Apply data ── */
  const applyData = useCallback((data) => {
    const incoming =
      Array.isArray(data.products) && data.products.length > 0
        ? data.products
        : [...(data.recommended || []), ...(data.cheapDeals || []),
           ...(data.trending || []), ...(data.latest || [])];

    const merged = dedup(incoming);
    const recent = getRecentCategories();
    productsRef.current = merged;
    setAllProducts(merged);
    setProducts(merged);
    setSections(splitProducts(merged, recent));
    setMeta(data.meta || {});
    setLoaded(true);
  }, [setProducts, setLoaded]);

  /* ── Load homepage ── */
  const loadHomepage = useCallback(async () => {
    setLoading(true);
    setError(null);
    productsRef.current = [];

    const fetchData = async (qs = "") => {
      const res = await fetch(`${API}/homepage${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    try {
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => { if (done) return; done = true; fn(); };
        const timeout = setTimeout(() => {
          finish(() => fetchData().then(resolve).catch(reject));
        }, 5000);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish(() => {
                clearTimeout(timeout);
                const { latitude, longitude } = pos.coords;
                lastLocationRef.current = { latitude, longitude };
                localStorage.setItem("lastLocation", JSON.stringify({ latitude, longitude }));
                fetchData(`?lat=${latitude}&lng=${longitude}`)
                  .then(resolve)
                  .catch(() => fetchData().then(resolve).catch(reject));
              });
            },
            () => { finish(() => { clearTimeout(timeout); fetchData().then(resolve).catch(reject); }); },
            GPS_O
          );
        } else {
          finish(() => { clearTimeout(timeout); fetchData().then(resolve).catch(reject); });
        }
      });
      applyData(data);
    } catch (e) {
      console.error(e);
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  /* ── Bootstrap ── */
  useEffect(() => {
    if (cacheLoaded && cachedProducts?.length > 0 && localStorage.getItem("lastLocation")) {
      const recent = getRecentCategories();
      productsRef.current = cachedProducts;
      setAllProducts(cachedProducts);
      setSections(splitProducts(cachedProducts, recent));
      setLoading(false);
    } else {
      loadHomepage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 30-min refresh ── */
  useEffect(() => {
    const id = setInterval(() => loadHomepage(), 1_800_000);
    return () => clearInterval(id);
  }, [loadHomepage]);

  /* ── Movement-aware refresh ── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const check = () => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude } }) => {
          const prev = lastLocationRef.current;
          if (!prev) { lastLocationRef.current = { latitude, longitude }; return; }
          const moved = getDistanceKm(prev.latitude, prev.longitude, latitude, longitude);
          if (moved > 2) {
            const newLoc = { latitude, longitude };
            lastLocationRef.current = newLoc;
            localStorage.setItem("lastLocation", JSON.stringify(newLoc));
            loadHomepage();
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 5000 }
      );
    };
    const id = setInterval(check, 300_000);
    return () => clearInterval(id);
  }, [loadHomepage]);

  /* ── Location changed event ── */
  useEffect(() => {
    const h = () => loadHomepage();
    window.addEventListener("locationChanged", h);
    return () => window.removeEventListener("locationChanged", h);
  }, [loadHomepage]);

  /* ── Category filter ── */
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
      /* Track for personalization */
      if (match?.id) trackCategory(match.id);

      const url = match?.id
        ? `${API}/homepage?category_id=${match.id}&page=0`
        : `${API}/homepage?page=0`;

      const res  = await fetch(url, { signal: catAbortRef.current.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const prods = Array.isArray(data.products) ? data.products : [];
      setCatProducts(shuffle(dedup(prods)));
    } catch (e) {
      if (e.name === "AbortError") return;
      const fallback = allProducts.filter(
        (p) => p.category?.toLowerCase() === catName.toLowerCase() ||
               p.category_name?.toLowerCase() === catName.toLowerCase()
      );
      setCatProducts(shuffle(fallback));
      if (fallback.length === 0) setCatError(`No listings found in "${catName}"`);
    } finally {
      setCatLoading(false);
    }
  }, [activeCategory, allProducts]);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    /* Track category for session personalisation */
    if (product.category_id) trackCategory(product.category_id);
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Derived ── */
  const activeLoc = getActiveLocation();
  const locLabel  = useMemo(() => {
    if (activeLoc?.label) return activeLoc.label;
    return heroLocation(meta);
  }, [meta, activeLoc]);

  const cityLabel = locLabel?.split(",")[0] || "Nigeria";

  const allCats      = [CAT_ALL, ...CATEGORY_CONFIG];
  const activeCatObj = CATEGORY_CONFIG.find((c) => c.name === activeCategory);

  const heroListingCount = useMemo(
    () => formatCount((productsRef.current.length || 0) + 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allProducts]
  );

  /* All Products: sorted + mid-feed promo injection */
  const sortedAll = useMemo(
    () => applySort(sections.all, allSort),
    [sections.all, allSort]
  );

  const allWithInjections = useMemo(
    () => injectPromoted(sortedAll.slice(0, allVisible), sections.featured),
    [sortedAll, allVisible, sections.featured]
  );

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <>
      <TopNav />

      <div className="pg">

        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-top anim">
            <div>
              <div className="hero-kicker">Minimart Marketplace</div>
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

        {/* ════════════════════════════════════
            CATEGORY VIEW
        ════════════════════════════════════ */}
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
              <MasonryGrid products={catProducts} onView={trackView} onClick={handleProductClick} />
            )}
          </div>
        )}

        {/* ════════════════════════════════════
            HOMEPAGE SECTIONS (All tab)
        ════════════════════════════════════ */}
        {activeCategory === "All" && (
          <>
            {!loading && !error && sections.latest.length === 0 && (
              <div className="empty">
                <div className="empty-emoji">🛍</div>
                <div className="empty-title">Welcome to Minimart</div>
                <div className="empty-sub">
                  Nigeria's neighbourhood marketplace — enable location for nearby deals.
                </div>
                <button className="empty-btn" onClick={loadHomepage}>Load Marketplace</button>
              </div>
            )}

            {/* ── 1. Featured — priority-sorted ── */}
            {(loading || sections.featured.length > 0) && (
              <div className="sec sec--primary anim anim-3">
                <SectionHead title="Featured" />
                {loading ? (
                  <div className="feat-wrap"><div className="sk sk-ft" /></div>
                ) : (
                  <div className="feat-wrap">
                    {sections.featured.map((p) => (
                      <FeaturedCard key={p.id} product={p} onClick={handleProductClick} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 2. Near You — local relevance ── */}
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
                    {sections.nearby.map((p, i) => (
                      <OverlayCard
                        key={p.id} product={p} priority={i === 0}
                        onView={trackView} onClick={handleProductClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 3. For You — merged trending + recommended + session boost ── */}
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
                    {sections.forYou.map((p, i) => (
                      <OverlayCard
                        key={p.id} product={p} rank={i}
                        onView={trackView} onClick={handleProductClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 4. Cheap Deals ── */}
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
                <MasonryGrid products={sections.deals} onView={trackView} onClick={handleProductClick} />
              )}
            </div>

            {/* ── 5. New Arrivals ── */}
            <div className="sec">
              <SectionHead title="New Arrivals" onSeeAll={() => navigate("/latest")} />
              {loading ? <SkeletonRow /> : sections.latest.length === 0 ? (
                <SectionEmpty
                  title="No new listings yet"
                  sub={`Be the first to sell in ${cityLabel}!`}
                  cta="Sell Now"
                  onCta={() => navigate("/minimart/add")}
                />
              ) : (
                <div className="row">
                  {sections.latest.map((p, i) => (
                    <OverlayCard
                      key={p.id} product={p} priority={i === 0}
                      onView={trackView} onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── 6. All Products — smart sort + mid-feed promo injection ── */}
            <div className="sec">
              <SectionHead
                title="All Products"
                sub={`${sections.all.length} listings`}
                onSeeAll={() => navigate("/products")}
              />
              {!loading && sections.all.length > 0 && (
                <SortChips active={allSort} onChange={(k) => {
                  setAllSort(k);
                  setAllVisible(ALL_PRODUCTS_LIMIT);
                }} />
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
      <button className="fab" onClick={() => navigate("/minimart/add")} aria-label="Sell a product">
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
