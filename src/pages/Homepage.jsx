/**
 * Homepage.jsx — Minimart (Updated)
 * - Pinterest masonry feed
 * - Real category filtering (no page refresh)
 * - Cache-aware (no reload when navigating back)
 * - City + State location display
 * - Modern location indicator (no emoji pin)
 * - Section pills navigate to dedicated pages
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
import CATEGORIES from "../config/categories";          // ← real categories
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

/* ─── Constants ─── */
const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER = 900;
const GPS_O = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };

// How long (ms) a tab can be hidden before we re-fetch on return
const STALE_AFTER = 5 * 60 * 1000; // 5 minutes

// "All" prepended to the real category list
const ALL_CATEGORY = { id: "all", name: "All", icon: "✦" };
const CAT_LIST     = [ALL_CATEGORY, ...CATEGORIES];

/* ─── Pure Helpers ─── */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
const fresh  = (d) => d && Date.now() - new Date(d).getTime() < 86_400_000;

const getImageUrl = (p) => {
  if (p?.image) return p.image;
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string" ? first : first?.url || first?.thumbnail_url || PH;
  }
  return p?.thumbnail_url || p?.main_image || PH;
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const getBadge = (p) => {
  if (p.is_promoted)     return { text: "Sponsored", cls: "bd-feat" };
  if ((p.ctr || 0) > 0.15) return { text: "Hot 🔥",    cls: "bd-hot" };
  if ((p.ctr || 0) > 0.08) return { text: "Trending",  cls: "bd-trnd" };
  if (fresh(p.created_at)) return { text: "New",       cls: "bd-new" };
  return null;
};

/** City + State label, e.g. "Lagos, Lagos State" or just "Lagos" */
const locationLabel = (loc) => {
  if (!loc) return "Nationwide";
  if (loc.label) return loc.label;
  return [loc.city, loc.state].filter(Boolean).join(", ") || "Nationwide";
};

/* ─── Skeleton ─── */
const MasonrySkeleton = () => (
  <div className="masonry-grid">
    {[180, 240, 200, 160, 220, 190, 250, 170].map((h, i) => (
      <div key={i} className="sk masonry-sk" style={{ height: h }} />
    ))}
  </div>
);

const SkeletonFeatured = () => (
  <div className="feat-wrap">
    {[1, 2].map((i) => (
      <div key={i} className="sk sk-ft" />
    ))}
  </div>
);

/* ─── Masonry Card ─── */
const MasonryCard = memo(({ product, priority, onView, onClick }) => {
  const timerRef = useRef(null);
  const badge    = getBadge(product);
  const imgUrl   = getImageUrl(product);
  const locLabel = locationLabel(product.location);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => onView(product.id), HOVER);
  };
  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  return (
    <div
      className="m-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {badge && <span className={`bd ${badge.cls}`}>{badge.text}</span>}

      <div className="m-img-wrap">
        <img
          className="m-img"
          src={imgUrl}
          alt={product.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(e) => { e.currentTarget.src = PH; }}
        />
      </div>

      <div className="m-body">
        <div className="m-name">{product.title}</div>
        <div className="m-price">{naira(product.price)}</div>
        <div className="m-meta">
          {/* Modern location — dot + text, no emoji */}
          <span className="m-loc">
            <span className="loc-pip" />
            {locLabel}
          </span>
          {product.distance_km != null && (
            <span className="m-dist">{product.distance_km} km</span>
          )}
        </div>
        {product.seller?.verified && (
          <span className="m-vfd">✓ Verified</span>
        )}
      </div>
    </div>
  );
});

/* ─── Featured Card ─── */
const FeaturedCard = memo(({ product, onClick }) => {
  const imgUrl   = getImageUrl(product);
  const locLabel = locationLabel(product.location);

  return (
    <div
      className="feat"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <img
        className="feat-img"
        src={imgUrl}
        alt={product.title}
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
            <span className="loc-pip" /> {locLabel}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Main Component ─── */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { products: cachedProducts, loaded, setProducts, setLoaded } =
    useProductCache();

  const [products,     setLocalProducts] = useState([]);
  const [featured,     setFeatured]      = useState([]);
  const [meta,         setMeta]          = useState({});
  const [loading,      setLoading]       = useState(true);
  const [loadingMore,  setLoadingMore]   = useState(false);
  const [error,        setError]         = useState(null);
  const [category,     setCategory]      = useState("all");
  const [hasMore,      setHasMore]       = useState(false);
  const [page,         setPage]          = useState(0);

  const productsRef  = useRef([]);
  const sentinelRef  = useRef(null);
  const hiddenAtRef  = useRef(null);      // timestamp when tab was hidden
  const coordsRef    = useRef(null);      // cached GPS coords

  /* ─── Track/Click helpers ─── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ─── Apply API data ─── */
  const applyData = useCallback((data, append = false) => {
    const incoming = Array.isArray(data.products) ? data.products : [];
    const merged   = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setLoaded(true);

    const feat = merged.filter((p) => p.is_promoted).slice(0, 3);
    const rest = merged.filter((p) => !p.is_promoted);

    setFeatured(feat);
    setLocalProducts(rest);
    setMeta(data.meta || {});
    setHasMore(incoming.length >= 40);
  }, [setProducts, setLoaded]);

  /* ─── Core fetch ─── */
  const fetchProducts = useCallback(async ({
    catId   = "all",
    pg      = 0,
    append  = false,
    coords  = null,
  } = {}) => {
    const params = new URLSearchParams();
    if (pg > 0)           params.set("page", pg);
    if (catId !== "all")  params.set("category_id", catId);
    if (coords) {
      params.set("lat", coords.lat);
      params.set("lng", coords.lng);
    }
    const url = `${API}/homepage?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  /* ─── Initial load + category change ─── */
  const loadFeed = useCallback(async (catId = "all", forceRefresh = false) => {
    // If cache is warm and we're just showing "all" (not a category switch),
    // reuse cached data — avoids reload when navigating back.
    if (
      !forceRefresh &&
      catId === "all" &&
      loaded &&
      cachedProducts.length > 0
    ) {
      productsRef.current = cachedProducts;
      const feat = cachedProducts.filter((p) => p.is_promoted).slice(0, 3);
      const rest = cachedProducts.filter((p) => !p.is_promoted);
      setFeatured(feat);
      setLocalProducts(rest);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPage(0);
    if (!append) productsRef.current = [];

    try {
      // Try GPS, fall back without
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => { if (done) return; done = true; fn(); };

        const timeout = setTimeout(() => {
          finish(() =>
            fetchProducts({ catId, pg: 0 }).then(resolve).catch(reject)
          );
        }, 5000);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish(() => {
                clearTimeout(timeout);
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                coordsRef.current = coords;
                fetchProducts({ catId, pg: 0, coords })
                  .then(resolve)
                  .catch(() => fetchProducts({ catId, pg: 0 }).then(resolve).catch(reject));
              });
            },
            () => {
              finish(() => {
                clearTimeout(timeout);
                fetchProducts({ catId, pg: 0, coords: coordsRef.current })
                  .then(resolve).catch(reject);
              });
            },
            GPS_O
          );
        } else {
          finish(() => {
            clearTimeout(timeout);
            fetchProducts({ catId, pg: 0, coords: coordsRef.current })
              .then(resolve).catch(reject);
          });
        }
      });

      applyData(data, false);
    } catch (e) {
      console.error(e);
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [loaded, cachedProducts, fetchProducts, applyData]);

  /* ─── Infinite scroll – load more ─── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchProducts({
        catId:  category,
        pg:     nextPage,
        coords: coordsRef.current,
      });
      applyData(data, true);
      setPage(nextPage);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, fetchProducts, applyData]);

  /* ─── Category switch ─── */
  const handleCategoryChange = useCallback((catId) => {
    if (catId === category) return;
    setCategory(catId);
    setPage(0);
    loadFeed(catId, true);          // always fetch fresh for a category switch
  }, [category, loadFeed]);

  /* ─── Mount: initial load ─── */
  useEffect(() => {
    loadFeed("all", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Tab visibility: reload only if stale ─── */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_AFTER) {
          loadFeed(category, true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loading, category, loadFeed]);

  /* ─── Intersection observer for infinite scroll ─── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  /* ─── GPS location label for hero ─── */
  const heroLocation =
    meta.nearbySource === "gps"
      ? `Near you · GPS${meta.location ? ` · ${meta.location}` : ""}`
      : meta.location || null;

  /* ─── Section quick-links ─── */
  const SECTION_PILLS = [
    { label: "🔥 Trending",    path: "/trending" },
    { label: "💸 Cheap Deals", path: "/deals" },
    { label: "🆕 New Arrivals",path: "/new" },
  ];

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
                Buy &amp; sell<br /><i>near you</i>
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

          {heroLocation && (
            <div
              className="hero-loc anim anim-1"
              onClick={() => navigate("/nearby")}
            >
              {/* Modern location chip – no emoji */}
              <span className="loc-pip-hero" />
              <span>{heroLocation}</span>
            </div>
          )}

          <div className="hero-stats anim anim-2">
            <div className="hero-stat">
              <div className="hero-stat-n">
                {loading ? "—" : `${(productsRef.current.length || 0) + 1000}+`}
              </div>
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

        {/* ── Search Bar ── */}
        <div
          className="search-wrap anim anim-3"
          onClick={() => navigate("/search")}
        >
          <div className="search">
            <span className="search-ic">🔍</span>
            <span className="search-txt">Search products, categories…</span>
            <span className="search-tag">⌘ K</span>
          </div>
        </div>

        {/* ── Category Strip (from config) ── */}
        <div className="cat-strip anim anim-4">
          {CAT_LIST.map((cat) => (
            <button
              key={cat.id}
              className={`cat-btn${category === cat.id ? " active" : ""}`}
              onClick={() => handleCategoryChange(cat.id)}
            >
              <span className="cat-icon">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* ── Section pills: navigate to dedicated pages ── */}
        <div className="section-pills anim anim-4">
          {SECTION_PILLS.map((pill) => (
            <button
              key={pill.path}
              className="section-pill"
              onClick={() => navigate(pill.path)}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={() => loadFeed(category, true)}>
              Try again
            </button>
          </div>
        )}

        {/* ── Featured / Sponsored ── */}
        {(loading || featured.length > 0) && (
          <div className="sec anim anim-3">
            <div className="sec-head">
              <span className="sec-title">💎 Featured</span>
            </div>
            {loading ? <SkeletonFeatured /> : (
              <div className="feat-wrap">
                {featured.map((p) => (
                  <FeaturedCard key={p.id} product={p} onClick={handleProductClick} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Main masonry feed ── */}
        <div className="sec">
          <div className="sec-head">
            <span className="sec-title">
              {category === "all"
                ? "Recommended for You"
                : CAT_LIST.find((c) => c.id === category)?.name || "Products"}
            </span>
            {category !== "all" && (
              <button
                className="cat-clear"
                onClick={() => handleCategoryChange("all")}
              >
                ✕ Clear
              </button>
            )}
          </div>

          {loading ? (
            <MasonrySkeleton />
          ) : !error && products.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">🛍</div>
              <div className="empty-title">
                {category === "all"
                  ? "Welcome to Minimart"
                  : "No listings in this category"}
              </div>
              <div className="empty-sub">
                {category === "all"
                  ? "Enable location for nearby deals, or browse what's available across Nigeria."
                  : "Be the first to list here, or try another category."}
              </div>
              {category === "all" ? (
                <button className="empty-btn" onClick={() => loadFeed("all", true)}>
                  Load Marketplace
                </button>
              ) : (
                <button className="empty-btn" onClick={() => handleCategoryChange("all")}>
                  Browse All
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="masonry-grid">
                {products.map((p, i) => (
                  <MasonryCard
                    key={p.id}
                    product={p}
                    priority={i < 4}
                    onView={trackView}
                    onClick={handleProductClick}
                  />
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {loadingMore && <p className="loading-more">Loading more…</p>}
              {!hasMore && products.length > 0 && (
                <p className="feed-end">You've seen it all 🎉</p>
              )}
            </>
          )}
        </div>
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

      <BottomNav />
    </>
  );
}
