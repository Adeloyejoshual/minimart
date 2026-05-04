/**
 * pages/Homepage.jsx — Minimart
 *
 * Sections: Near You · Trending · Cheap Deals · New Arrivals
 * "See all →" on each routes to its dedicated page.
 * Categories fetched from API for real UUIDs.
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
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import MasonryGrid  from "../components/MasonryGrid";
import OverlayCard  from "../components/OverlayCard";
import { PinIcon, naira, getImageUrl, formatCity } from "../components/MasonryCard";
import CATEGORY_CONFIG from "../config/categories";
import "../styles/Homepage.css";

/* ─── Constants ──────────────────────────────────────────── */
const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH      = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const GPS_O   = { timeout: 5000, enableHighAccuracy: false, maximumAge: 300_000 };
const CAT_ALL = { name: "All", icon: "✦" };

/* ─── Helpers ────────────────────────────────────────────── */
const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const splitProducts = (products) => ({
  nearby: products
    .filter((p) => p.distance_km != null || p.location_city)
    .slice(0, 10),
  trending: products
    .filter(
      (p) => (p.engagement_score || 0) > 20 || (p.clicks_count || 0) > 10
    )
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 20),
  deals: products.filter((p) => Number(p.price) <= 50_000).slice(0, 20),
  latest: [...products]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20),
});

/** City, State label — e.g. "Ile-Ife, Osun" */
const heroLocation = (meta) => {
  const city  = meta?.location_city || meta?.city;
  const state = meta?.location_state || meta?.state;
  if (city && state) return `${city}, ${state}`;
  if (city)  return city;
  if (state) return state;
  return meta?.location || null;
};

/* ─── Skeletons ──────────────────────────────────────────── */
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

/* ─── Section Header ─────────────────────────────────────── */
const SectionHead = memo(function SectionHead({ title, chip, onSeeAll }) {
  return (
    <div className="sec-head">
      <div className="sec-label">
        <span className="sec-title">{title}</span>
        {chip && <span className="sec-chip">{chip}</span>}
      </div>
      {onSeeAll && (
        <button className="see-all" onClick={onSeeAll}>
          See all →
        </button>
      )}
    </div>
  );
});

/* ─── Inline Empty State ─────────────────────────────────── */
const InlineEmpty = ({ message }) => (
  <p className="inline-empty">{message}</p>
);

/* ═══════════════════════════════════════════════════════════
   HOMEPAGE
═══════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const {
    setProducts,
    setLoaded,
    products: cachedProducts,
    loaded: cacheLoaded,
  } = useProductCache();

  /* ── State ── */
  const [allProducts, setAllProducts] = useState([]);
  const [sections, setSections] = useState({
    nearby: [], trending: [], deals: [], latest: [],
  });
  const [meta, setMeta]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  /* ── Category state ── */
  const [apiCategories, setApiCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [catProducts, setCatProducts]       = useState(null); // null = show sections
  const [catLoading, setCatLoading]         = useState(false);
  const [catError, setCatError]             = useState(null);

  const productsRef = useRef([]);
  const catAbortRef = useRef(null);

  /* ── 1. Bootstrap ── */
  useEffect(() => {
    if (cacheLoaded && cachedProducts?.length > 0) {
      productsRef.current = cachedProducts;
      setAllProducts(cachedProducts);
      setSections(splitProducts(cachedProducts));
      setLoading(false);
    } else {
      loadHomepage();
    }
    fetchApiCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 2. Fetch real categories from API ── */
  const fetchApiCategories = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/categories`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.categories)
        ? data.categories
        : Array.isArray(data) ? data : [];
      setApiCategories(list);
    } catch (e) {
      console.warn("Could not fetch categories", e);
    }
  }, []);

  /* ── 3. Apply fetched data ── */
  const applyData = useCallback(
    (data) => {
      const incoming =
        Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : [
              ...(data.recommended || []),
              ...(data.cheapDeals  || []),
              ...(data.trending    || []),
              ...(data.latest      || []),
            ];

      const merged = dedup(incoming);
      productsRef.current = merged;
      setAllProducts(merged);
      setProducts(merged);
      setSections(splitProducts(merged));
      setMeta(data.meta || {});
      setLoaded(true);
    },
    [setProducts, setLoaded]
  );

  /* ── 4. Load homepage feed ── */
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
      setError("Could not reach the marketplace. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  /* ── 5. Category filter — uses real category_id from API ── */
  const handleCategorySelect = useCallback(
    async (catName) => {
      if (catName === activeCategory) return;
      setActiveCategory(catName);
      setCatError(null);

      if (catName === "All") {
        setCatProducts(null);
        return;
      }

      if (catAbortRef.current) catAbortRef.current.abort();
      catAbortRef.current = new AbortController();
      setCatLoading(true);
      setCatProducts([]);

      try {
        const match = apiCategories.find(
          (c) =>
            c.name?.toLowerCase() === catName.toLowerCase() ||
            c.slug?.toLowerCase() ===
              catName.toLowerCase().replace(/\s+/g, "-") ||
            c.id === catName
        );

        const url = match?.id
          ? `${API}/products?category_id=${match.id}&status=active&limit=40`
          : `${API}/products?category=${encodeURIComponent(catName)}&status=active&limit=40`;

        const res = await fetch(url, {
          signal: catAbortRef.current.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const prods = Array.isArray(data.products)
          ? data.products
          : Array.isArray(data) ? data : [];
        setCatProducts(dedup(prods));
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error("Category fetch failed", e);
        const fallback = allProducts.filter(
          (p) =>
            p.category?.toLowerCase() === catName.toLowerCase() ||
            p.category_name?.toLowerCase() === catName.toLowerCase()
        );
        setCatProducts(fallback);
        if (fallback.length === 0) {
          setCatError(`No listings found in "${catName}"`);
        }
      } finally {
        setCatLoading(false);
      }
    },
    [activeCategory, apiCategories, allProducts]
  );

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

  /* ── Derived ── */
  const locLabel     = useMemo(() => heroLocation(meta), [meta]);
  const allCats      = [CAT_ALL, ...CATEGORY_CONFIG];
  const activeCatObj = CATEGORY_CONFIG.find((c) => c.name === activeCategory);

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

          {locLabel && (
            <>
              <div
                className="hero-loc anim anim-1"
                onClick={() => navigate("/nearby")}
              >
                <PinIcon size={14} />
                <span>{locLabel}</span>
                {meta.nearbySource === "gps" && (
                  <span className="gps-chip">GPS</span>
                )}
              </div>

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
            </>
          )}
        </div>

        {/* ── Search Bar ── */}
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

        {/* ── Category Strip ── */}
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

        {/* ── Error banner ── */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Marketplace unavailable</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={loadHomepage}>
              Try again
            </button>
          </div>
        )}

        {/* ════════════════════════════════════
            CATEGORY VIEW
        ════════════════════════════════════ */}
        {activeCategory !== "All" && (
          <div className="sec cat-section">
            <SectionHead
              title={`${activeCatObj?.icon ?? ""} ${activeCategory}`}
              chip={
                catProducts !== null && !catLoading
                  ? `${catProducts.length} listing${
                      catProducts.length !== 1 ? "s" : ""
                    }`
                  : undefined
              }
            />

            {catLoading && <SkeletonMasonry />}

            {!catLoading && (catError || catProducts?.length === 0) && (
              <div className="empty">
                <div className="empty-emoji">🛒</div>
                <div className="empty-title">No listings yet</div>
                <div className="empty-sub">
                  Be the first to post in{" "}
                  <strong>{activeCategory}</strong>!
                </div>
                <button
                  className="empty-btn"
                  onClick={() => navigate("/minimart/add")}
                >
                  + Sell Now
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

        {/* ════════════════════════════════════
            HOMEPAGE SECTIONS (All tab)
        ════════════════════════════════════ */}
        {activeCategory === "All" && (
          <>
            {/* Global empty state */}
            {!loading && !error && sections.latest.length === 0 && (
              <div className="empty">
                <div className="empty-emoji">🛍</div>
                <div className="empty-title">Welcome to Minimart</div>
                <div className="empty-sub">
                  Enable location for nearby deals, or browse what's
                  available across Nigeria.
                </div>
                <button className="empty-btn" onClick={loadHomepage}>
                  Load Marketplace
                </button>
              </div>
            )}

            {/* ── Near You ── */}
            {(loading || sections.nearby.length > 0) && (
              <div className="sec anim anim-4">
                <SectionHead
                  title={
                    <>
                      <PinIcon
                        size={13}
                        style={{ verticalAlign: "middle", marginRight: 4 }}
                      />
                      Near You
                    </>
                  }
                  chip={
                    meta.nearbySource
                      ? meta.nearbySource === "gps"
                        ? "GPS"
                        : meta.nearbySource
                      : undefined
                  }
                  onSeeAll={() => navigate("/nearby")}
                />
                {loading ? (
                  <SkeletonRow />
                ) : (
                  <div className="row">
                    {sections.nearby.map((p, i) => (
                      <OverlayCard
                        key={p.id}
                        product={p}
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

            {/* ── Trending ── */}
            <div className="sec anim anim-5">
              <SectionHead
                title="🔥 Trending"
                onSeeAll={() => navigate("/trending")}
              />
              {loading ? (
                <SkeletonRow />
              ) : sections.trending.length === 0 ? (
                <InlineEmpty message="Nothing trending yet" />
              ) : (
                <div className="row">
                  {sections.trending.map((p, i) => (
                    <OverlayCard
                      key={p.id}
                      product={p}
                      rank={i}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* ── Cheap Deals ── */}
            <div className="sec">
              <SectionHead
                title="💸 Cheap Deals"
                chip="Under ₦50k"
                onSeeAll={() => navigate("/deals")}
              />
              {loading ? (
                <SkeletonMasonry />
              ) : sections.deals.length === 0 ? (
                <InlineEmpty message="No deals right now" />
              ) : (
                <MasonryGrid
                  products={sections.deals}
                  onView={trackView}
                  onClick={handleProductClick}
                />
              )}
            </div>

            <div className="divider" />

            {/* ── New Arrivals ── */}
            <div className="sec">
              <SectionHead
                title="🆕 New Arrivals"
                onSeeAll={() => navigate("/latest")}
              />
              {loading ? (
                <SkeletonRow />
              ) : sections.latest.length === 0 ? (
                <InlineEmpty message="No listings yet" />
              ) : (
                <div className="row">
                  {sections.latest.map((p, i) => (
                    <OverlayCard
                      key={p.id}
                      product={p}
                      priority={i === 0}
                      onView={trackView}
                      onClick={handleProductClick}
                    />
                  ))}
                </div>
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
