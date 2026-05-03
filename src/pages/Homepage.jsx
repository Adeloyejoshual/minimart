/**
 * Homepage.jsx — Minimart (Production Optimized)
 * Production‑ready Nigerian marketplace homepage
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
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

/* ─── Constants ─── */
const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const HOVER = 900;
const GPS_O = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };

const CATEGORIES = [
  { id: "all", label: "All", icon: "✦" },
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "vehicles", label: "Vehicles", icon: "🚗" },
  { id: "furniture", label: "Furniture", icon: "🛋" },
  { id: "phones", label: "Phones", icon: "📞" },
  { id: "food", label: "Food", icon: "🥘" },
  { id: "services", label: "Services", icon: "🔧" },
];

/* ─── Pure Helpers ─── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const fresh = (d) => d && Date.now() - new Date(d).getTime() < 86_400_000;

const getImageUrl = (p) => {
  // 1. Pre‑processed image field
  if (p?.image) return p.image;

  // 2. images array
  if (Array.isArray(p?.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.thumbnail_url || PH;
  }

  // 3. Legacy fallbacks
  return p?.thumbnail_url || p?.main_image || PH;
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const splitProducts = (products) => ({
  featured: products.filter((p) => p.is_promoted).slice(0, 3),
  nearby: products.filter((p) => p.distance_km != null || p.location?.city).slice(0, 10),
  trending: products.slice(0, 14),
  deals: products.filter((p) => p.price <= 50_000).slice(0, 20),
  latest: products.slice(0, 40),
});

const getBadge = (p) => {
  if (p.is_promoted) return { text: "Sponsored", className: "bd-feat" };
  if ((p.ctr || 0) > 0.15) return { text: "Hot", className: "bd-hot" };
  if ((p.ctr || 0) > 0.08) return { text: "Trending", className: "bd-trnd" };
  if (fresh(p.createdAt)) return { text: "New", className: "bd-new" };
  return null;
};

/* ─── Skeleton Components ─── */
const SkeletonRow = () => (
  <div className="row">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="sk sk-co" />
    ))}
  </div>
);

const SkeletonGrid = () => (
  <div className="grid2">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="sk sk-ct" />
    ))}
  </div>
);

/* ─── Product Cards ─── */
const OverlayCard = memo(({ product, rank, priority, onView, onClick }) => {
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
      className="co"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick(product);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        onError={(e) => {
          e.currentTarget.src = PH;
        }}
      />

      <div className="co-grad">
        <div className="co-name">{product.title}</div>
        <div className="co-price">{naira(product.price)}</div>
        <div className="co-foot">
          <span className="co-loc">
            📍 {product.location?.city || "Nationwide"}
          </span>
          {product.distance_km != null && (
            <span className="dist">{product.distance_km} km</span>
          )}
        </div>
      </div>
    </div>
  );
});

const GridTile = memo(({ product, onView, onClick }) => {
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
      className="ct"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick(product);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {badge && <span className={`bd ${badge.className}`}>{badge.text}</span>}

      <img
        className="ct-img"
        src={imageUrl}
        alt={product.title}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.src = PH;
        }}
      />

      <div className="ct-body">
        <div className="ct-name">{product.title}</div>
        <div className="ct-price">{naira(product.price)}</div>
        <div className="ct-loc">
          📍 {product.location?.city || "Nationwide"}
        </div>
        {product.seller?.verified && (
          <div className="vfd">✓ Verified seller</div>
        )}
        {product.seller?.trust_score != null && (
          <div className="trust">
            <div className="trust-track">
              <div
                className="trust-fill"
                style={{ width: `${product.seller.trust_score}%` }}
              />
            </div>
            <span className="trust-lbl">{product.seller.trust_score}%</span>
          </div>
        )}
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
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick(product);
      }}
    >
      <img
        className="feat-img"
        src={imageUrl}
        alt={product.title}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={(e) => {
          e.currentTarget.src = PH;
        }}
      />
      <div className="feat-body">
        <div>
          <div className="feat-tag">Sponsored</div>
          <div className="feat-name">{product.title}</div>
        </div>
        <div>
          <div className="feat-price">{naira(product.price)}</div>
          <div className="feat-loc">
            📍 {product.location?.city || "Nationwide"}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Main Component ─── */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded } = useProductCache();

  const [sections, setSections] = useState({
    featured: [],
    nearby: [],
    trending: [],
    deals: [],
    latest: [],
  });
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("all");
  const [dealsVisible, setDealsVisible] = useState(6);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const productsRef = useRef([]);

  const sentinelRef = useRef(null);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleProductClick = useCallback(
    (product) => {
      fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(
        () => {}
      );
      navigate(`/product/${product.slug}`);
    },
    [navigate]
  );

  const applyData = useCallback(
    (data, append = false) => {
      const incoming = Array.isArray(data.products) && data.products.length > 0
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
      setProducts(merged);
      setSections(splitProducts(merged));
      setMeta(data.meta || {});
      setHasMore(incoming.length >= 20);
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    };

    try {
      const data = await new Promise((resolve, reject) => {
        let done = false;
        const finish = (fn) => {
          if (done) return;
          done = true;
          fn();
        };

        const timeout = setTimeout(() => {
          finish(() => fetchData().then(resolve).catch(reject));
        }, 5000);

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish(() => {
                clearTimeout(timeout);
                fetchData(
                  `?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
                )
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
      setError(
        "Could not reach the marketplace. Check your connection."
      );
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
      // Silent fail
      console.error("Failed to load more", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, apply(Some, data]);

  useEffect(() => {
    loadHomepage();
  }, [loadHomepage]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !loading) {
        loadHomepage();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loading, loadHomepage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const locationLabel =
    meta.location ||
    (meta.nearbySource === "gps"
      ? "Near you"
      : null);

  // For now, keep “all” as default; enable category filtering only when backend supports it
  const currentSections =
    category === "all"
      ? sections
      : sections; // will add backend‑based filter later

  return (
    <>
      <TopNav />

      <div className="pg">
        {/* Hero Section */}
        <div className="hero">
          <div className="hero-top anim">
            <div>
              <div className="hero-kicker">Minimart Marketplace</div>
              <div className="hero-h1">
                Buy & sell<br /><i>near you</i>
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
            <div
              className="hero-loc anim anim-1"
              onClick={() => navigate("/nearby")}
            >
              <span className="loc-dot" />
              {locationLabel}
              {meta.nearbySource === "gps" && " · GPS"}
            </div>
          )}

          <div className="hero-stats anim anim-2">
            <div className="hero-stat">
              <div className="hero-stat-n">
                {loading
                  ? "—"
                  : `${(productsRef.current.length || 0) + 1000}+`}
              </div>
              <div className="hero-stat-l">Listings</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">
                {loading ? "—" : "24/7"}
              </div>
              <div className="hero-stat-l">Live market</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-n">
                {loading ? "—" : "Free"}
              </div>
              <div className="hero-stat-l">To list</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div
          className="search-wrap anim anim-3"
          onClick={() => navigate("/search")}
        >
          <div className="search">
            <span className="search-ic">🔍</span>
            <span className="search-txt">
              Search products, categories…
            </span>
            <span className="search-tag">⌘ K</span>
          </div>
        </div>

        {/* Category Strip */}
        <div className="cat-strip anim anim-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`cat-btn${
                category === cat.id ? " active" : ""
              }`}
              onClick={() => setCategory(cat.id)}
              disabled={cat.id !== "all"} // backend not filtering yet
            >
              <span className="cat-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button
              className="err-btn"
              onClick={loadHomepage}
            >
              Try again
            </button>
          </div>
        )}

        {/* Global Empty State */}
        {!loading &&
          !error &&
          currentSections.latest.length === 0 && (
            <div className="empty">
              <div className="empty-emoji">🛍</div>
              <div className="empty-title">Welcome to Minimart</div>
              <div className="empty-sub">
                Enable location for nearby deals, or browse what's available across Nigeria.
              </div>
              <button
                className="empty-btn"
                onClick={loadHomepage}
              >
                Load Marketplace
              </button>
            </div>
          )}

                {/* Featured */}
        {(loading || currentSections.featured.length > 0) && (
          <div className="sec anim anim-3">
            <div className="sec-head">
              <div className="sec-label">
                <span className="sec-title">💎 Featured</span>
              </div>
            </div>
            {loading ? (
              <div className="feat-wrap">
                <div className="sk sk-ft" />
              </div>
            ) : (
              <div className="feat-wrap">
                {currentSections.featured.map((product) => (
                  <FeaturedCard
                    key={product.id}
                    product={product}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nearby Section */}
        {(loading || currentSections.nearby.length > 0) && (
          <div className="sec anim anim-4">
            <div className="sec-head">
              <div className="sec-label">
                <span className="sec-title">📍 Near You</span>
                {meta.nearbySource && (
                  <span
                    className={`sec-chip${
                      meta.nearbySource === "gps" ? " gn" : ""
                    }`}
                  >
                    {meta.nearbySource === "gps" ? "GPS" : meta.nearbySource}
                  </span>
                )}
              </div>
              <button
                className="see-all"
                onClick={() => navigate("/nearby")}
              >
                See all →
              </button>
            </div>
            {loading ? (
              <SkeletonRow />
            ) : (
              <div className="row">
                {currentSections.nearby.map((product, i) => (
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
          ) : currentSections.trending.length === 0 ? (
            <p className="inline-empty">Nothing trending yet</p>
          ) : (
            <div className="row">
              {currentSections.trending.map((product, i) => (
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
          </div>
          {loading ? (
            <SkeletonGrid />
          ) : currentSections.deals.length === 0 ? (
            <p className="inline-empty">
              No deals in this category right now
            </p>
          ) : (
            <>
              <div className="grid2">
                {currentSections.deals
                  .slice(0, dealsVisible)
                  .map((product) => (
                    <GridTile
                      key={product.id}
                      product={product}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  ))}
              </div>
              {dealsVisible < currentSections.deals.length && (
                <button
                  className="load-more"
                  onClick={() =>
                    setDealsVisible((v) => v + 6)
                  }
                >
                  Show more deals
                </button>
              )}
            </>
          )}
        </div>

        <div className="divider" />

        {/* Latest Listings */}
        <div className="sec">
          <div className="sec-head">
            <div className="sec-label">
              <span className="sec-title">🆕 Latest</span>
            </div>
            <button
              className="see-all"
              onClick={() => navigate("/latest")}
            >
              See all →
            </button>
          </div>
          {loading ? (
            <SkeletonRow />
          ) : currentSections.latest.length === 0 ? (
            <p className="inline-empty">No listings yet</p>
          ) : (
            <>
              <div className="row">
                {currentSections.latest.map((product, i) => (
                  <OverlayCard
                    key={product.id}
                    product={product}
                    priority={i === 0}
                    onView={trackView}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
              <div ref={sentinelRef} style={{ height: 1 }} />
              {loadingMore && (
                <p className="loading-more">Loading more</p>
              )}
            </>
          )}
        </div>
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