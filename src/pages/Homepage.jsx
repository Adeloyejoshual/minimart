/**
 * Homepage.jsx — Minimart (Production Optimized)
 * Features:
 * - State + City display
 * - Real category filtering from DB
 * - Masonry layout for feed
 * - Infinite scroll
 * - Section pages (Trending, Deals, etc.)
 * - No full refresh on tab switch (uses cached state)
 * - Modern location icon
 * - Categories from config/categories.js
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import categories from "../config/categories";
import "../styles/Homepage.css";

/* ─── Constants ─── */
const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH =
  "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER = 900;
const GPS_O = {
  timeout: 5000,
  enableHighAccuracy: false,
  maximumAge: 300_000,
};

const CATEGORY_ALL = { name: "All", icon: "✦" };

/* ─── Pure Helpers ─── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const fresh = (d) =>
  d && Date.now() - new Date(d).getTime() < 86_400_000;

const getImageUrl = (p) => {
  if (p?.image) return p.image;
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.thumbnail_url || PH;
  }
  return p?.thumbnail_url || p?.main_image || PH;
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const getBadge = (p) => {
  if (p.is_promoted) return { text: "Sponsored", className: "bd-feat" };
  if ((p.ctr || 0) > 0.15) return { text: "Hot 🔥", className: "bd-hot" };
  if ((p.ctr || 0) > 0.08) return { text: "Trending", className: "bd-trnd" };
  if (fresh(p.created_at)) return { text: "New", className: "bd-new" };
  return null;
};

const isJuneDeal = (p) => {
  const now = new Date();
  return now.getMonth() === 5 && p.price <= 80_000;
};

const splitProducts = (products) => ({
  featured: products.filter((p) => p.is_promoted).slice(0, 3),
  nearby: products
    .filter((p) => p.distance_km != null || p.location?.city)
    .slice(0, 10),
  trending: products
    .filter((p) => (p.ctr || 0) > 0.05 || p.views > 100)
    .slice(0, 20),
  deals: products.filter((p) => p.price <= 50_000).slice(0, 20),
  juneDeals: products.filter((p) => isJuneDeal(p)).slice(0, 12),
  recommended: products.slice(0, 40),
  latest: [...products].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  ).slice(0, 40),
});

/* ─── Location Helper ─── */
const formatLocation = (meta) => {
  if (!meta) return null;
  const parts = [];
  if (meta.city) parts.push(meta.city);
  if (meta.state) parts.push(meta.state);
  return parts.length > 0 ? parts.join(", ") : meta.location || null;
};

/* ─── Skeleton Components ─── */
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
        style={{ height: `${180 + (i % 3) * 60}px` }}
      />
    ))}
  </div>
);

/* ─── Masonry Grid (CSS columns approach) ─── */
const MasonryGrid = memo(({ products, onView, onClick }) => {
  return (
    <div className="masonry">
      {products.map((product, i) => (
        <MasonryCard
          key={product.id}
          product={product}
          priority={i < 4}
          onView={onView}
          onClick={onClick}
        />
      ))}
    </div>
  );
});

const MasonryCard = memo(({ product, priority, onView, onClick }) => {
  const timerRef = useRef(null);
  const badge = getBadge(product);
  const imageUrl = getImageUrl(product);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => onView(product.id), HOVER);
  };
  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div
      className="masonry-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {badge && (
        <span className={`bd ${badge.className}`}>{badge.text}</span>
      )}
      <img
        className="masonry-img"
        src={imageUrl}
        alt={product.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={(e) => { e.currentTarget.src = PH; }}
      />
      <div className="masonry-body">
        <div className="masonry-name">{product.title}</div>
        <div className="masonry-price">{naira(product.price)}</div>
        <div className="masonry-loc">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          {product.location?.city || "Nigeria"}
          {product.distance_km != null && (
            <span className="dist"> · {product.distance_km}km</span>
          )}
        </div>
        {product.seller?.verified && (
          <div className="vfd">✓ Verified</div>
        )}
      </div>
    </div>
  );
});

/* ─── Overlay Card (horizontal row scroll) ─── */
const OverlayCard = memo(({ product, rank, priority, onView, onClick }) => {
  const timerRef = useRef(null);
  const badge = getBadge(product);
  const imageUrl = getImageUrl(product);

  return (
    <div
      className="co"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      onMouseEnter={() => {
        timerRef.current = setTimeout(() => onView(product.id), HOVER);
      }}
      onMouseLeave={() => {
        clearTimeout(timerRef.current);
      }}
    >
      {badge && <span className={`bd ${badge.className}`}>{badge.text}</span>}
      {rank != null && <span className="rank">#{rank + 1}</span>}

      <img
        className="co-img"
        src={imageUrl}
        alt={product.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={(e) => { e.currentTarget.src = PH; }}
      />
      <div className="co-grad">
        <div className="co-name">{product.title}</div>
        <div className="co-price">{naira(product.price)}</div>
        <div className="co-foot">
          <span className="co-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:3}}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {product.location?.city || "Nationwide"}
          </span>
          {product.distance_km != null && (
            <span className="dist">{product.distance_km}km</span>
          )}
        </div>
      </div>
    </div>
  );
});

const FeaturedCard = memo(({ product, onClick }) => {
  const imageUrl = getImageUrl(product);
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
        src={imageUrl}
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:4}}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {product.location?.city || "Nationwide"}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Main Component ─── */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded, products: cachedProducts, loaded: cacheLoaded } = useProductCache();

  const [allProducts, setAllProducts] = useState([]);
  const [sections, setSections] = useState({
    featured: [], nearby: [], trending: [],
    deals: [], juneDeals: [], recommended: [], latest: [],
  });
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(!cacheLoaded);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState(null); // null = show homepage sections
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);
  const abortRef = useRef(null);

  /* ── use cache on revisit, no full reload ── */
  useEffect(() => {
    if (cacheLoaded && cachedProducts?.length > 0) {
      productsRef.current = cachedProducts;
      setAllProducts(cachedProducts);
      setSections(splitProducts(cachedProducts));
      setLoading(false);
    } else {
      loadHomepage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback(
    (product) => {
      fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
      navigate(`/product/${product.slug}`);
    },
    [navigate]
  );

  const applyData = useCallback(
    (data, append = false) => {
      const incoming =
        Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : [
              ...(data.recommended || []),
              ...(data.cheapDeals || []),
              ...(data.trending || []),
              ...(data.latest || []),
            ];

      const merged = append
        ? dedup([...productsRef.current, ...incoming])
        : dedup(incoming);

      productsRef.current = merged;
      setAllProducts(merged);
      setProducts(merged);
      setSections(splitProducts(merged));
      setMeta(data.meta || {});
      setHasMore(incoming.length >= 40);
      setLoaded(true);
    },
    [setProducts, setLoaded]
  );

  const loadHomepage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];

    const fetchData = async (queryString = "") => {
      const response = await fetch(`${API}/homepage${queryString}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
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
                fetchData(`?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
                  .then(resolve)
                  .catch(() => fetchData().then(resolve).catch(reject));
              });
            },
            () => {
              finish(() => {
                clearTimeout(timeout);
                fetchData().then(resolve).catch(reject);
              });
            },
            GPS_O
          );
        } else {
          finish(() => {
            clearTimeout(timeout);
            fetchData().then(resolve).catch(reject);
          });
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

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await fetch(`${API}/homepage?page=${nextPage}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      applyData(data, true);
      setPage(nextPage);
    } catch (e) {
      console.error("Failed to load more", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, applyData]);

  /* ── Category Filter ── */
  const handleCategorySelect = useCallback(async (categoryName) => {
    if (categoryName === activeCategory) return;
    setActiveCategory(categoryName);

    if (categoryName === "All") {
      setCategoryProducts(null);
      setIsCategoryLoading(false);
      return;
    }

    setIsCategoryLoading(true);
    setCategoryProducts([]);

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(
        `${API}/products?category=${encodeURIComponent(categoryName)}&limit=40`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const prods = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];
      setCategoryProducts(dedup(prods));
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Category load failed", e);
        // Fallback: filter local products
        const filtered = allProducts.filter(
          (p) => p.category?.toLowerCase() === categoryName.toLowerCase()
        );
        setCategoryProducts(filtered);
      }
    } finally {
      setIsCategoryLoading(false);
    }
  }, [activeCategory, allProducts]);

  /* ── Infinite scroll observer ── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || categoryProducts !== null) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, categoryProducts]);

  const locationLabel = useMemo(() => formatLocation(meta), [meta]);

  const allCats = [CATEGORY_ALL, ...categories];

  /* ── Section navigation helpers ── */
  const goToSection = (section) => navigate(`/${section}`);

  return (
    <>
      <TopNav />

      <div className="pg">
        {/* Hero */}
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

          {locationLabel && (
            <>
              <div
                className="hero-loc anim anim-1"
                onClick={() => navigate("/nearby")}
                style={{ cursor: "pointer" }}
              >
                {/* Modern location pin SVG */}
                <svg
                  className="loc-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                {locationLabel}
                {meta.nearbySource === "gps" && (
                  <span className="gps-chip">GPS</span>
                )}
              </div>

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
            </>
          )}
        </div>

        {/* Search Bar */}
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

        {/* Category Strip */}
        <div className="cat-strip anim anim-4">
          {allCats.map((cat) => {
            const name = cat.name;
            const isActive = activeCategory === name;
            return (
              <button
                key={name}
                className={`cat-btn${isActive ? " active" : ""}`}
                onClick={() => handleCategorySelect(name)}
              >
                <span className="cat-icon">{cat.icon}</span>
                {name}
              </button>
            );
          })}
        </div>

        {/* Error State */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={loadHomepage}>Try again</button>
          </div>
        )}

        {/* ═══════════════════════════════════
            CATEGORY VIEW — when a category is selected
        ═══════════════════════════════════ */}
        {activeCategory !== "All" && (
          <div className="sec">
            <div className="sec-head">
              <div className="sec-label">
                <span className="sec-title">
                  {allCats.find((c) => c.name === activeCategory)?.icon} {activeCategory}
                </span>
              </div>
            </div>

            {isCategoryLoading ? (
              <SkeletonMasonry />
            ) : categoryProducts?.length === 0 ? (
              <div className="empty">
                <div className="empty-emoji">🔍</div>
                <div className="empty-title">No listings found</div>
                <div className="empty-sub">
                  Be the first to list in <strong>{activeCategory}</strong>!
                </div>
                <button
                  className="empty-btn"
                  onClick={() => navigate("/minimart/add")}
                >
                  Sell Now
                </button>
              </div>
            ) : (
              <MasonryGrid
                products={categoryProducts || []}
                onView={trackView}
                onClick={handleProductClick}
              />
            )}
          </div>
        )}

        {/* ═══════════════════════════════════
            HOMEPAGE SECTIONS — only when "All" is selected
        ═══════════════════════════════════ */}
        {activeCategory === "All" && (
          <>
            {/* Global Empty State */}
            {!loading && !error && sections.latest.length === 0 && (
              <div className="empty">
                <div className="empty-emoji">🛍</div>
                <div className="empty-title">Welcome to Minimart</div>
                <div className="empty-sub">
                  Enable location for nearby deals, or browse what's available across Nigeria.
                </div>
                <button className="empty-btn" onClick={loadHomepage}>
                  Load Marketplace
                </button>
              </div>
            )}

            {/* Featured */}
            {(loading || sections.featured.length > 0) && (
              <div className="sec anim anim-3">
                <div className="sec-head">
                  <div className="sec-label">
                    <span className="sec-title">💎 Featured</span>
                  </div>
                </div>
                {loading ? (
                  <div className="feat-wrap"><div className="sk sk-ft" /></div>
                ) : (
                  <div className="feat-wrap">
                    {sections.featured.map((product) => (
                      <FeaturedCard key={product.id} product={product} onClick={handleProductClick} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Nearby Section */}
            {(loading || sections.nearby.length > 0) && (
              <div className="sec anim anim-4">
                <div className="sec-head">
                  <div className="sec-label">
                    <span className="sec-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{marginRight:4,verticalAlign:'middle'}}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      Near You
                    </span>
                    {meta.nearbySource && (
                      <span className={`sec-chip${meta.nearbySource === "gps" ? " gn" : ""}`}>
                        {meta.nearbySource === "gps" ? "GPS" : meta.nearbySource}
                      </span>
                    )}
                  </div>
                  <button className="see-all" onClick={() => navigate("/nearby")}>See all →</button>
                </div>
                {loading ? (
                  <SkeletonRow />
                ) : (
                  <div className="row">
                    {sections.nearby.map((product, i) => (
                      <OverlayCard
                        key={product.id}
                        product={product}
                        priority={i === 0}
                        onView={trackView}
                        onClick={handleProductClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="divider" />

            {/* June Deals – Limited Time 🔥 */}
            {(loading || sections.juneDeals.length > 0) && (
              <div className="sec">
                <div className="sec-head">
                  <div className="sec-label">
                    <span className="sec-title">June Deals – Limited Time 🔥</span>
                    <span className="sec-chip urgent">Ends June 30</span>
                  </div>
                  <button className="see-all" onClick={() => goToSection("deals/june")}>
                    See all →
                  </button>
                </div>
                {loading ? (
                  <SkeletonRow />
                ) : (
                  <div className="row">
                    {sections.juneDeals.map((product, i) => (
                      <OverlayCard
                        key={product.id}
                        product={product}
                        priority={i === 0}
                        onView={trackView}
                        onClick={handleProductClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="divider" />

            {/* Trending Section */}
            <div className="sec anim anim-5">
              <div className="sec-head">
                <div className="sec-label">
                  <span className="sec-title">🔥 Trending</span>
                </div>
                <button
                  className="see-all"
                  onClick={() => navigate("/trending")}
                >
                  See all →
                </button>
              </div>
              {loading ? (
                <SkeletonRow />
              ) : sections.trending.length === 0 ? (
                <p className="inline-empty">Nothing trending yet</p>
              ) : (
                <div className="row">
                  {sections.trending.map((product, i) => (
                    <OverlayCard
                      key={product.id}
                      product={product}
                      rank={i}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Cheap Deals */}
            <div className="sec">
              <div className="sec-head">
                <div className="sec-label">
                  <span className="sec-title">💸 Cheap Deals</span>
                  <span className="sec-chip">Under ₦50k</span>
                </div>
                <button className="see-all" onClick={() => navigate("/deals")}>
                  See all →
                </button>
              </div>
              {loading ? (
                <SkeletonMasonry />
              ) : sections.deals.length === 0 ? (
                <p className="inline-empty">No deals right now</p>
              ) : (
                <MasonryGrid
                  products={sections.deals}
                  onView={trackView}
                  onClick={handleProductClick}
                />
              )}
            </div>

            <div className="divider" />

            {/* New Arrivals */}
            <div className="sec">
              <div className="sec-head">
                <div className="sec-label">
                  <span className="sec-title">🆕 New Arrivals</span>
                </div>
                <button className="see-all" onClick={() => navigate("/latest")}>
                  See all →
                </button>
              </div>
              {loading ? (
                <SkeletonRow />
              ) : sections.latest.length === 0 ? (
                <p className="inline-empty">No listings yet</p>
              ) : (
                <div className="row">
                  {sections.latest.map((product, i) => (
                    <OverlayCard
                      key={product.id}
                      product={product}
                      priority={i === 0}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Recommended For You — Masonry */}
            <div className="sec">
              <div className="sec-head">
                <div className="sec-label">
                  <span className="sec-title">✨ Recommended For You</span>
                </div>
              </div>
              {loading ? (
                <SkeletonMasonry />
              ) : sections.recommended.length === 0 ? (
                <p className="inline-empty">Loading recommendations…</p>
              ) : (
                <>
                  <MasonryGrid
                    products={sections.recommended}
                    onView={trackView}
                    onClick={handleProductClick}
                  />
                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} style={{ height: 1 }} />
                  {loadingMore && (
                    <p className="loading-more">Loading more…</p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* FAB */}
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
