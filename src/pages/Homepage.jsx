// src/pages/Homepage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate }        from "react-router-dom";
import { useProductCache }    from "../context/ProductCacheContext";
import CATEGORIES             from "../config/categories";
import TopNav                 from "../components/TopNav";
import BottomNav              from "../components/BottomNav";
import Footer                 from "../components/Footer";
import LocationPicker         from "../components/LocationPicker";
import HeroSection            from "../components/homepage/HeroSection";
import MasonryCard            from "../components/homepage/MasonryCard";
import FeaturedCard           from "../components/homepage/FeaturedCard";
import DealCard               from "../components/homepage/DealCard";
import SellBanner             from "../components/homepage/SellBanner";
import {
  useHomepageQuery,
  normalizeProduct,
  dedup,
  readCachedGps,
  writeCachedGps,
}                             from "../hooks/useHomepageQuery";
import {
  useLocation,
  formatLocationLabel,
}                             from "../hooks/useLocation";
import "../styles/Homepage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API = `${BASE_URL}/api`;

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
   SKELETONS
   ══════════════════════════════════════════════════════════════ */
const MasonrySkeleton = memo(function MasonrySkeleton() {
  return (
    <div className="hm-masonry" aria-busy="true">
      {[200,260,180,240,200,220,260,190,210,240].map((h, i) => (
        <div
          key={i}
          className="hm-sk hm-shimmer"
          style={{ height: h }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

const FeaturedSkeleton = memo(function FeaturedSkeleton() {
  return (
    <div className="hm-feat-row" aria-busy="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="hm-sk hm-sk-feat hm-shimmer"
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   LOCATION BAR
   ══════════════════════════════════════════════════════════════ */
const LocationBar = memo(function LocationBar({
  location,
  onOpen,
  onClear,
}) {
  const label = formatLocationLabel(location);

  return (
    <div className="hm-loc-bar">
      <button
        className={`hm-loc-bar-btn${label ? " hm-loc-bar-btn--active" : ""}`}
        onClick={onOpen}
        aria-label={
          label
            ? `Showing results in ${label}. Tap to change location`
            : "Tap to set your location"
        }
      >
        {/* Pin icon */}
        <span className="hm-loc-bar-pin" aria-hidden="true">
          <svg
            width="13" height="13" viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7
                     13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0
                     9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5
                     2.5-2.5 2.5 1.12 2.5 2.5-1.12
                     2.5-2.5 2.5z" />
          </svg>
        </span>

        {/* Label / placeholder */}
        {label ? (
          <span className="hm-loc-bar-label">{label}</span>
        ) : (
          <span className="hm-loc-bar-placeholder">
            Set your location
          </span>
        )}

        {/* Chevron */}
        <svg
          className="hm-loc-bar-chevron"
          width="13" height="13" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true"
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18
                   10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>

      {/* Clear pill — only when location is saved */}
      {label && (
        <button
          className="hm-loc-bar-clear"
          onClick={onClear}
          aria-label="Clear location filter"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24"
            fill="currentColor" aria-hidden="true"
          >
            <path d="M19 6.41L17.59 5 12 10.59 6.41
                     5 5 6.41 10.59 12 5 17.59 6.41
                     19 12 13.41 17.59 19 19 17.59
                     13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   CATEGORY STRIP
   ══════════════════════════════════════════════════════════════ */
const CategoryStrip = memo(function CategoryStrip({
  current,
  onChange,
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

/* ══════════════════════════════════════════════════════════════
   SECTION PILLS
   ══════════════════════════════════════════════════════════════ */
const SectionPills = memo(function SectionPills({ onNavigate }) {
  return (
    <div
      className="hm-pills"
      role="navigation"
      aria-label="Quick sections"
    >
      {SECTION_PILLS.map((pill) => (
        <button
          key={pill.path}
          className="hm-pill"
          onClick={() => onNavigate(pill.path)}
        >
          {pill.label}
        </button>
      ))}
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
      className={`hm-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   ERROR BANNER
   ══════════════════════════════════════════════════════════════ */
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
   EMPTY STATE
   ══════════════════════════════════════════════════════════════ */
function EmptyState({ category, catName, location, onReload, onClearCat }) {
  const hasLocation = !!formatLocationLabel(location);

  return (
    <div className="hm-empty" role="status">
      <span className="hm-empty-emoji" aria-hidden="true">🛍️</span>

      <h3 className="hm-empty-title">
        {category !== "all"
          ? `No listings in ${catName}`
          : hasLocation
            ? `No listings found near you`
            : "Welcome to Loemart"}
      </h3>

      <p className="hm-empty-sub">
        {category !== "all"
          ? "Be the first to list here, or try another category."
          : hasLocation
            ? "Try expanding your search or clearing the location filter."
            : "Enable location for nearby deals, or browse what's available."}
      </p>

      <div className="hm-empty-actions">
        {category !== "all" ? (
          <button className="hm-empty-btn" onClick={onClearCat}>
            Browse all listings
          </button>
        ) : (
          <button className="hm-empty-btn" onClick={onReload}>
            Reload marketplace
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOMEPAGE — MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded } = useProductCache();

  /* ── Location (localStorage + event bus) ─────────────────── */
  const {
    location,
    save  : saveLocation,
    clear : clearLocation,
  } = useLocation();

  const [pickerOpen, setPickerOpen] = useState(false);

  /* ── GPS (silent — only for feed coords, not for picker) ─── */
  const [gpsCoords,   setGpsCoords]  = useState(() => readCachedGps());
  const gpsAttempted = useRef(false);

  useEffect(() => {
    /* If user already chose a manual location, skip GPS */
    if (location?.source === "manual") return;
    if (gpsAttempted.current || gpsCoords) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        writeCachedGps(result);
        setGpsCoords(result);
      },
      () => {}, // ← silent fail
      GPS_OPTS
    );
  }, [location, gpsCoords]);

  /* ── Resolve coords to send to API ──────────────────────── */
  const apiCoords = useMemo(() => {
    /* Manual location takes priority */
    if (location?.coords) return location.coords;
    /* Fallback to GPS */
    return gpsCoords ?? null;
  }, [location, gpsCoords]);

  /* ── Resolve location params for API ────────────────────── */
  const locationParams = useMemo(() => {
    if (!location) return {};
    return {
      ...(location.city  ? { city  : location.city  } : {}),
      ...(location.state ? { state : location.state } : {}),
    };
  }, [location]);

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
  } = useHomepageQuery({
    category,
    coords         : apiCoords,
    locationParams,          // pass city/state to backend
  });

  /* ── Flatten pages ───────────────────────────────────────── */
  const allProducts = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) => {
      const items =
        Array.isArray(pg.products)    ? pg.products   :
        Array.isArray(pg.data?.items) ? pg.data.items :
        Array.isArray(pg.data)        ? pg.data        : [];
      return items;
    });
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Sync to product cache (feeds TopNav live search) ────── */
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

  /* ── Hero location label ─────────────────────────────────── */
  const heroLoc = useMemo(() => {
    /* Manual location takes priority */
    const manualLabel = formatLocationLabel(location);
    if (manualLabel) return `📍 ${manualLabel}`;

    /* GPS from API response */
    if (meta.nearbySource === "gps")
      return `Near you · GPS${meta.location ? ` · ${meta.location}` : ""}`;

    return meta.location || null;
  }, [location, meta]);

  const currentCatName =
    CAT_LIST.find((c) => c.id === category)?.name || "Products";

  /* ── Refetch when location changes ──────────────────────── */
  useEffect(() => {
    refetch();
  }, [location, refetch]);

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

  /* ── Location handlers ───────────────────────────────────── */
  const handleLocationSelect = useCallback((loc) => {
    saveLocation(loc);
    /* refetch triggered by the useEffect above */
  }, [saveLocation]);

  const handleLocationClear = useCallback(() => {
    clearLocation();
    /* refetch triggered by the useEffect above */
  }, [clearLocation]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="hm-root">

      {/* ══════════════════════════════════════════════
          TOP NAV — live search wired to product cache
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
            LOCATION BAR
        ══════════════════════════════════════════════ */}
        <LocationBar
          location={location}
          onOpen={() => setPickerOpen(true)}
          onClear={handleLocationClear}
        />

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
        <SectionPills onNavigate={navigate} />

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
          <section className="hm-section" aria-label="Featured listings">
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
          <section className="hm-section" aria-label="Cheap deals">
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
                ? formatLocationLabel(location)
                  ? `Near ${formatLocationLabel(location)}`
                  : "Recommended for You"
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
            <EmptyState
              category={category}
              catName={currentCatName}
              location={location}
              onReload={refetch}
              onClearCat={() => switchCategory("all")}
            />
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
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
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

      {/* ══════════════════════════════════════════════
          LOCATION PICKER SHEET
      ══════════════════════════════════════════════ */}
      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleLocationSelect}
      />

    </div>
  );
}