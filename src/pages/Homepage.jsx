// src/pages/Homepage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate }         from "react-router-dom";
import { useProductCache }     from "../context/ProductCacheContext";
import CATEGORIES              from "../config/categories";
import TopNav                  from "../components/TopNav";
import BottomNav               from "../components/BottomNav";
import Footer                  from "../components/Footer";
import HeroSection             from "../components/homepage/HeroSection";
import MasonryCard             from "../components/homepage/MasonryCard";
import FeaturedCard            from "../components/homepage/FeaturedCard";
import DealCard                from "../components/homepage/DealCard";
import SellBanner              from "../components/homepage/SellBanner";
import {
  useHomepageQuery,
  normalizeProduct,
  dedup,
  readCachedGps,
  writeCachedGps,
}                              from "../hooks/useHomepageQuery";
import "../styles/Homepage.css";

/* ── Constants ───────────────────────────────────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API      = `${BASE_URL}/api`;

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

/* ── Skeletons ───────────────────────────────────────────────── */
const MasonrySkeleton = memo(() => (
  <div className="hm-masonry">
    {[200,260,180,240,200,220,260,190,210,240].map((h,i) => (
      <div key={i} className="hm-sk hm-shimmer" style={{ height: h }} />
    ))}
  </div>
));

const FeaturedSkeleton = memo(() => (
  <div className="hm-feat-row">
    {[1,2,3].map((i) => (
      <div key={i} className="hm-sk hm-sk-feat hm-shimmer" />
    ))}
  </div>
));

/* ── Category strip ──────────────────────────────────────────── */
const CategoryStrip = memo(function CategoryStrip({
  current, onChange,
}) {
  return (
    <nav className="hm-cat-strip" aria-label="Browse by category">
      {CAT_LIST.map((cat) => (
        <button
          key={cat.id}
          className={`hm-cat-btn${
            current === cat.id ? " hm-cat-btn--active" : ""
          }`}
          onClick={() => onChange(cat.id)}
          aria-pressed={current === cat.id}
        >
          <span className="hm-cat-icon" aria-hidden="true">
            {cat.icon}
          </span>
          <span className="hm-cat-name">{cat.name}</span>
        </button>
      ))}
    </nav>
  );
});

/* ── Scroll to top ───────────────────────────────────────────── */
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
           strokeWidth="2.5" strokeLinecap="round"
           aria-hidden="true">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ── Error banner ────────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="hm-error" role="alert">
      <span className="hm-error-icon" aria-hidden="true">⚡</span>
      <p className="hm-error-title">Marketplace unavailable</p>
      <p className="hm-error-msg">{message}</p>
      <button className="hm-error-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded } = useProductCache();

  /* ── GPS ─────────────────────────────────────────────────── */
  const [coords, setCoords] = useState(() => readCachedGps());
  const gpsAttempted = useRef(false);

  useEffect(() => {
    if (gpsAttempted.current || coords) return;
    gpsAttempted.current = true;

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        writeCachedGps(result);
        setCoords(result);
      },
      () => {},
      GPS_OPTS
    );
  }, [coords]);

  /* ── Filters ─────────────────────────────────────────────── */
  const [category, setCategory] = useState("all");

  /* ── Data ────────────────────────────────────────────────── */
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useHomepageQuery({ category, coords });

  /* ── Flatten all pages → products ───────────────────────── */
  const allProducts = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) => {
      const items =
        Array.isArray(pg.products)    ? pg.products    :
        Array.isArray(pg.data?.items) ? pg.data.items  :
        Array.isArray(pg.data)        ? pg.data        : [];
      return items;
    });
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Sync to product cache (feeds TopNav search) ─────────── */
  useEffect(() => {
    if (allProducts.length > 0) {
      setProducts(allProducts);
      setLoaded(true);
    }
  }, [allProducts, setProducts, setLoaded]);

  /* ── Derived sections ────────────────────────────────────── */
  const { featured, deals, products } = useMemo(() => {
    const incomingFeat = data?.pages?.[0]?.featured ?? [];

    const feat = incomingFeat.length > 0
      ? incomingFeat.map(normalizeProduct).filter(Boolean)
      : allProducts.filter((p) => p.is_promoted).slice(0, 4);

    const cheap = allProducts
      .filter((p) => {
        const orig = Number(p.attributes?.original_price || 0);
        return !p.is_promoted && orig > p.price;
      })
      .slice(0, 12);

    const rest = allProducts.filter((p) => !p.is_promoted);

    return { featured: feat, deals: cheap, products: rest };
  }, [allProducts, data]);

  /* ── Meta ────────────────────────────────────────────────── */
  const meta  = data?.pages?.[0]?.meta ?? {};
  const total = meta.total ?? allProducts.length;

  const heroLoc = useMemo(() => {
    if (meta.nearbySource === "gps")
      return `Near you · GPS${meta.location ? ` · ${meta.location}` : ""}`;
    return meta.location || null;
  }, [meta]);

  const currentCatName =
    CAT_LIST.find((c) => c.id === category)?.name || "Products";

  /* ── Infinite scroll ─────────────────────────────────────── */
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage)
          fetchNextPage();
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /* ── Analytics ───────────────────────────────────────────── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, {
      method   : "POST",
      keepalive: true,
    }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method   : "POST",
      keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Category switch ─────────────────────────────────────── */
  const switchCategory = useCallback((catId) => {
    setCategory(catId);
  }, []);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="hm-root">

      {/* ══════════════════════════════════════════════
          TOP NAV — has live search built-in
      ══════════════════════════════════════════════ */}
      <TopNav user={user} />

      <main className="hm-page" id="hm-main">

        {/* ══════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════ */}
        <HeroSection
          loading={isLoading}
          total={total}
          heroLoc={heroLoc}
        />

        {/* ══════════════════════════════════════════════
            SEARCH BAR (decorative — opens /search)
            TopNav already has live search above
        ══════════════════════════════════════════════ */}
        <div className="hm-search-wrap">
          <button
            className="hm-search-bar"
            onClick={() => navigate("/search")}
            aria-label="Search Loemart"
          >
            <span className="hm-search-ic" aria-hidden="true">
              <svg
                viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.2}
                strokeLinecap="round" width={17} height={17}
              >
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

        {/* ══════════════════════════════════════════════
            CATEGORIES
        ══════════════════════════════════════════════ */}
        <CategoryStrip
          current={category}
          onChange={switchCategory}
        />

        {/* ══════════════════════════════════════════════
            SECTION PILLS
        ══════════════════════════════════════════════ */}
        <div
          className="hm-pills"
          role="navigation"
          aria-label="Quick sections"
        >
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

        {/* ══════════════════════════════════════════════
            ERROR
        ══════════════════════════════════════════════ */}
        {isError && (
          <ErrorBanner
            message={error?.message ?? "Could not reach the marketplace."}
            onRetry={refetch}
          />
        )}

        {/* ══════════════════════════════════════════════
            FEATURED
        ══════════════════════════════════════════════ */}
        {(isLoading || featured.length > 0) && (
          <section
            className="hm-section"
            aria-label="Featured listings"
          >
            <div className="hm-section-head">
              <h2 className="hm-section-title">💎 Featured</h2>
            </div>
            {isLoading ? (
              <FeaturedSkeleton />
            ) : (
              <div className="hm-feat-row">
                {featured.map((p) => p && (
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

        {/* ══════════════════════════════════════════════
            DEALS STRIP
        ══════════════════════════════════════════════ */}
        {!isLoading && deals.length > 0 && (
          <section
            className="hm-section"
            aria-label="Cheap deals"
          >
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
                {deals.map((p) => p && (
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

        {/* ══════════════════════════════════════════════
            MAIN FEED
        ══════════════════════════════════════════════ */}
        <section
          className="hm-section"
          aria-label={
            category === "all"
              ? "Recommended for you"
              : currentCatName
          }
        >
          <div className="hm-section-head">
            <h2 className="hm-section-title">
              {category === "all"
                ? "Recommended for You"
                : currentCatName}
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

          {isLoading ? (
            <MasonrySkeleton />
          ) : isError ? null
            : products.length === 0 ? (
            <div className="hm-empty" role="status">
              <span className="hm-empty-emoji" aria-hidden="true">
                🛍️
              </span>
              <h3 className="hm-empty-title">
                {category === "all"
                  ? "Welcome to Loemart"
                  : `No listings in ${currentCatName}`}
              </h3>
              <p className="hm-empty-sub">
                {category === "all"
                  ? "Enable location for nearby deals, or browse what's available."
                  : "Be the first to list here, or try another category."}
              </p>
              <button
                className="hm-empty-btn"
                onClick={() =>
                  category === "all"
                    ? refetch()
                    : switchCategory("all")
                }
              >
                {category === "all"
                  ? "Reload marketplace"
                  : "Browse all listings"}
              </button>
            </div>
          ) : (
            <>
              <div
                className="hm-masonry"
                role="list"
                aria-label="Product listings"
              >
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

              {/* Infinite scroll sentinel */}
              <div
                ref={sentinelRef}
                aria-hidden="true"
                style={{ height: 1 }}
              />

              {isFetchingNextPage && (
                <p className="hm-loading-more" aria-live="polite">
                  <span className="hm-spinner" aria-hidden="true" />
                  Loading more…
                </p>
              )}

              {!hasNextPage && products.length > 0 && (
                <div className="hm-feed-end-wrap">
                  <p className="hm-feed-end" aria-live="polite">
                    You've seen it all 🎉
                  </p>
                  <button
                    className="hm-feed-end-btn"
                    onClick={() => window.scrollTo({
                      top: 0, behavior: "smooth"
                    })}
                  >
                    Back to top ↑
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ══════════════════════════════════════════════
            SELL CTA BANNER
        ══════════════════════════════════════════════ */}
        {!isLoading && <SellBanner />}

        {/* ══════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════ */}
        {!isLoading && <Footer />}

      </main>

      {/* ── FAB ── */}
      <button
        className="hm-fab"
        onClick={() => navigate("/minimart/add")}
        aria-label="Sell a product"
      >
        <svg
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.5}
          strokeLinecap="round" width={18} height={18}
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Sell Now
      </button>

      <ScrollTopBtn />
      <BottomNav />

    </div>
  );
}