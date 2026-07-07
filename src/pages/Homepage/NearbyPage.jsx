// src/pages/Homepage/NearbyPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import Footer      from "../../components/Footer";
import MasonryCard from "../../components/MasonryCard";
import "../../styles/NearbyPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;

const GPS_KEY = "loemart_gps";
const GPS_TTL = 10 * 60_000;

const GPS_OPTS = {
  timeout           : 6_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
};

/* ══════════════════════════════════════════════════════════════
   GPS CACHE
══════════════════════════════════════════════════════════════ */
function readCachedGps() {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    const { coords, ts } = JSON.parse(raw);
    if (Date.now() - ts < GPS_TTL) return coords;
  } catch {}
  return null;
}

function writeCachedGps(coords) {
  try {
    sessionStorage.setItem(
      GPS_KEY,
      JSON.stringify({ coords, ts: Date.now() })
    );
  } catch {}
}

/* ══════════════════════════════════════════════════════════════
   NORMALIZE + DEDUP
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
    is_promoted       : !!p.is_promoted,
    image:
      p.image ||
      (Array.isArray(p.images) && p.images.length > 0
        ? typeof p.images[0] === "string"
          ? p.images[0]
          : p.images[0]?.url || null
        : null) ||
      p.main_image || p.thumbnail_url || null,
    location_city : p.location?.city  || p.location_city  || null,
    location_state: p.location?.state || p.location_state || null,
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

/* ══════════════════════════════════════════════════════════════
   FETCH — with silent fallback to general feed
══════════════════════════════════════════════════════════════ */
async function fetchNearbyPage({ pageParam = 0, coords } = {}) {
  const makeParams = (section) => {
    const p = new URLSearchParams({ page: pageParam, limit: PAGE_SIZE });
    if (section) p.set("section", section);
    if (coords) {
      p.set("lat", coords.lat);
      p.set("lng", coords.lng);
    }
    return p;
  };

  /* Try nearby section first */
  try {
    const res = await fetch(`${API}/homepage?${makeParams("nearby")}`);
    if (res.ok) {
      const data  = await res.json();
      const items = Array.isArray(data.products) ? data.products : [];
      if (items.length > 0) return data;
    }
  } catch {}

  /* Fallback → general feed */
  const res = await fetch(`${API}/homepage?${makeParams()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   HOOK — detect desktop
══════════════════════════════════════════════════════════════ */
function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isDesktop;
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Live Clock ── */
function LiveClock({ elite = false }) {
  const fmt = () => new Date().toLocaleTimeString("en-NG", {
    hour: "2-digit", minute: "2-digit",
  });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={elite ? "elite-clock" : "nb-clock"}>
      {time}
    </span>
  );
}

/* ── Nearby Card Wrapper ── */
const NearbyCardWrapper = memo(function NearbyCardWrapper({
  product, priority, onView, onClick, elite = false,
}) {
  return (
    <div className={`nb-card-wrap${elite ? " nb-card-wrap--elite" : ""}`}>
      <MasonryCard
        product={product}
        priority={priority}
        onView={onView}
        onClick={onClick}
      />
    </div>
  );
});

/* ── Date Group Separator (mobile) ── */
const GROUP_CONFIG = {
  "Just Added" : { Icon: Icon.Flash,     cls: "nb-dg--new"   },
  "Today"      : { Icon: Icon.Today,     cls: "nb-dg--today" },
  "Yesterday"  : { Icon: Icon.Yesterday, cls: "nb-dg--yest"  },
  "This Week"  : { Icon: Icon.Week,      cls: "nb-dg--week"  },
  "This Month" : { Icon: Icon.Month,     cls: "nb-dg--month" },
  "Older"      : { Icon: Icon.Archive,   cls: "nb-dg--old"   },
};

/* ── Toast ── */
function NewArrivalToast({ count, onDismiss, elite = false }) {
  if (!count || count <= 0) return null;
  return (
    <button
      className={elite ? "elite-toast" : "nb-toast"}
      onClick={onDismiss}
      aria-live="polite"
    >
      <span className={elite ? "elite-toast-dot" : "nb-toast-dot"}
            aria-hidden="true" />
      <Icon.Bell />
      {count} new listing{count !== 1 ? "s" : ""} — tap to refresh
    </button>
  );
}

/* ── Scroll Top ── */
function ScrollTopBtn({ elite = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`${elite ? "elite-scroll-top" : "nb-scroll-top"}${
        visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
    >
      <Icon.ChevronUp />
    </button>
  );
}

/* ── Empty State ── */
function EmptyState({ gpsStatus, onBrowseAll, elite = false }) {
  return (
    <div className={elite ? "elite-empty" : "nb-empty"} role="status">
      <span className={elite ? "elite-empty-icon-wrap" : "nb-empty-icon-wrap"}>
        <Icon.Empty />
      </span>
      <h3 className={elite ? "elite-empty-title" : "nb-empty-title"}>
        {gpsStatus === "denied"
          ? "Location access denied"
          : "No nearby listings found"}
      </h3>
      <p className={elite ? "elite-empty-sub" : "nb-empty-sub"}>
        {gpsStatus === "denied"
          ? "We couldn't detect your location. Showing listings from across Nigeria."
          : "There are no listings in your area yet. More sellers joining daily!"}
      </p>
      {category !== "all" ? (
        <button
          className={elite ? "elite-empty-btn" : "nb-empty-btn"}
          onClick={onClearCategory}
        >
          Show All Categories
        </button>
      ) : (
        <button
          className={elite ? "elite-empty-btn" : "nb-empty-btn"}
          onClick={onBrowseAll}
        >
          Browse All Listings
        </button>
      )}
    </div>
  );
}

/* ── Error ── */
function ErrorBanner({ message, onRetry, elite = false }) {
  return (
    <div className={elite ? "elite-err" : "nb-err"} role="alert">
      <span className={elite ? "elite-err-icon-wrap" : "nb-err-icon-wrap"}>
        <Icon.Error />
      </span>
      <p className={elite ? "elite-err-title" : "nb-err-title"}>
        Could not load listings
      </p>
      <p className={elite ? "elite-err-msg" : "nb-err-msg"}>
        {message}
      </p>
      <button
        className={elite ? "elite-err-btn" : "nb-err-btn"}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE-ONLY COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Header ── */
const NearbyHeader = memo(function NearbyHeader({
  gpsStatus, onBack, onRequestGps,
}) {
  const chipConfig = {
    pending : { text: "Locating…",   cls: "nb-chip--pending" },
    gps     : { text: "📍 GPS Live", cls: "nb-chip--gps"     },
    denied  : { text: "📍 Manual",   cls: "nb-chip--manual"  },
  };
  const chip = chipConfig[gpsStatus] || chipConfig.pending;

  return (
    <div className="nb-header">
      <button className="nb-back" onClick={onBack} aria-label="Go back">
        <Icon.Back />
      </button>
      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={`nb-chip ${chip.cls}`}>
          {gpsStatus === "pending" && (
            <span className="nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="nb-chip-dot" aria-hidden="true" />
          )}
          {chip.text}
        </span>
      </div>
      {gpsStatus === "denied" && (
        <button
          className="nb-gps-btn"
          onClick={onRequestGps}
          aria-label="Enable GPS"
        >
          <Icon.GPS />
          Enable GPS
        </button>
      )}
    </div>
  );
});

/* ── Location Banner ── */
const NearbyLocationBanner = memo(function NearbyLocationBanner({
  label, gpsStatus, count,
}) {
  if (!label) return null;
  return (
    <div className="nb-loc-banner" role="status" aria-live="polite">
      <div className="nb-loc-left">
        <span className="nb-loc-icon" aria-hidden="true">
          {gpsStatus === "gps" ? "📡" : "📍"}
        </span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">Showing listings near</span>
          <strong className="nb-loc-place">{label}</strong>
        </div>
      </div>
      {count > 0 && (
        <span className="nb-loc-count">
          {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
});

/* ── GPS Prompt ── */
const NearbyGpsPrompt = memo(function NearbyGpsPrompt({
  onAllow, onDismiss,
}) {
  return (
    <div className="nb-gps-prompt" role="dialog"
         aria-label="Enable location for better results">
      <div className="nb-gps-prompt-icon" aria-hidden="true">📍</div>
      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">See listings near you</h3>
        <p className="nb-gps-prompt-sub">
          Allow location access to find deals closest to you first.
        </p>
      </div>
      <div className="nb-gps-prompt-actions">
        <button className="nb-gps-prompt-allow" onClick={onAllow}>
          Allow Location
        </button>
        <button className="nb-gps-prompt-skip" onClick={onDismiss}>
          Maybe later
        </button>
      </div>
    </div>
  );
});

/* ── Skeleton ── */
const SKEL_HEIGHTS = [240, 300, 220, 280, 260, 230, 310, 250, 270, 240];
const NearbySkeleton = memo(function NearbySkeleton() {
  return (
    <>
      <div className="nb-sk nb-sk-banner nb-shimmer" aria-hidden="true" />
      <div className="nb-masonry" aria-busy="true">
        {SKEL_HEIGHTS.map((h, i) => (
          <div key={i} className="nb-sk nb-shimmer"
               style={{ height: h }} aria-hidden="true" />
        ))}
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   DESKTOP ELITE COMPONENTS
══════════════════════════════════════════════════════════════ */

/* ── Elite Header ── */
const EliteNearbyHeader = memo(function EliteNearbyHeader({
  gpsStatus, onBack, onRequestGps,
}) {
  const chipConfig = {
    pending : { text: "Locating…",   cls: "nb-chip--pending" },
    gps     : { text: "📍 GPS Live", cls: "nb-chip--gps"     },
    denied  : { text: "📍 Manual",   cls: "nb-chip--manual"  },
  };
  const chip = chipConfig[gpsStatus] || chipConfig.pending;

  return (
    <div className="elite-nb-header">
      <button className="elite-nb-back" onClick={onBack} aria-label="Go back">
        <Icon.Back />
      </button>
      <div className="elite-nb-title-wrap">
        <h1 className="elite-nb-title">Near You</h1>
        <span className={`elite-nb-chip ${chip.cls}`}>
          {gpsStatus === "pending" && (
            <span className="elite-nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="elite-nb-chip-dot" aria-hidden="true" />
          )}
          {chip.text}
        </span>
      </div>
      {gpsStatus === "denied" && (
        <button
          className="elite-nb-gps-btn"
          onClick={onRequestGps}
          aria-label="Enable GPS"
        >
          <Icon.GPS />
          Enable GPS
        </button>
      )}
    </div>
  );
});

/* ── Elite Top Bar ── */
const EliteNearbyTopBar = memo(function EliteNearbyTopBar({
  locationLabel, total, lastUpdated, onRefresh,
}) {
  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="elite-nb-topbar">
      <div className="elite-nb-topbar-left">
        <nav className="elite-nb-breadcrumb" aria-label="Breadcrumb">
          <span className="elite-nb-bc-home">Home</span>
          <span className="elite-nb-bc-sep">›</span>
          <span className="elite-nb-bc-current">Near You</span>
        </nav>
        {locationLabel && (
          <span className="elite-nb-location">
            <Icon.Location />
            {locationLabel}
          </span>
        )}
        {!loading && total > 0 && (
          <span className="elite-nb-count">
            {total.toLocaleString()} listings
          </span>
        )}
        {timeLabel && (
          <span className="elite-nb-updated">
            <span className="elite-nb-pulse" aria-hidden="true" />
            Updated {timeLabel}
          </span>
        )}
      </div>
      <div className="elite-nb-topbar-right">
        <button className="elite-nb-refresh-btn" onClick={onRefresh}>
          <Icon.Refresh />
          Refresh
        </button>
      </div>
    </div>
  );
});

/* ── Elite Sidebar ── */
const EliteNearbySidebar = memo(function EliteNearbySidebar({
  onBack, total, onRefresh,
}) {
  return (
    <aside className="elite-nb-sidebar">
      {/* Brand */}
      <div className="elite-nb-brand">
        <div className="elite-nb-brand-icon">
          <Icon.Layers />
        </div>
        <div>
          <span className="elite-nb-brand-name">Loemart</span>
          <span className="elite-nb-brand-sub">Nearby</span>
        </div>
      </div>

      {/* Live counter */}
      <div className="elite-nb-live-counter">
        <div className="elite-nb-live-pulse" aria-hidden="true" />
        <div>
          <span className="elite-nb-live-num">
            {total?.toLocaleString() ?? "—"}
          </span>
          <span className="elite-nb-live-label">listings near</span>
        </div>
      </div>

      {/* Refresh */}
      <button className="elite-nb-refresh" onClick={onRefresh}>
        <Icon.Refresh />
        Refresh Feed
      </button>

      {/* Back */}
      <button className="elite-nb-back" onClick={onBack}>
        <Icon.Back />
        All Listings
      </button>
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function NearbyPage({ user }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  /* ── GPS State ── */
  const [coords,     setCoords]     = useState(() => readCachedGps());
  const [gpsStatus,  setGpsStatus]  = useState(
    () => readCachedGps() ? "gps" : "pending"
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const gpsAttempted = useRef(false);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("pending");
    setShowPrompt(false);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const result = { lat: c.latitude, lng: c.longitude };
        writeCachedGps(result);
        setCoords(result);
        setGpsStatus("gps");
      },
      () => setGpsStatus("denied"),
      GPS_OPTS
    );
  }, []);

  useEffect(() => {
    if (gpsAttempted.current || coords) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setShowPrompt(true);
    const t = setTimeout(requestGps, 800);
    return () => clearTimeout(t);
  }, [coords, requestGps]);

  /* ── Data State ── */
  const [products,    setProducts]    = useState([]);
  const [meta,        setMeta]        = useState({});
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Load ── */
  const load = useCallback(async (pg = 0, append = false) => {
    try {
      const data = await fetchNearbyPage({ pageParam: pg, coords });
      const raw  = Array.isArray(data.products) ? data.products : [];
      const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
      const merged = append
        ? dedup([...productsRef.current, ...normalized])
        : normalized;
      productsRef.current = merged;
      setProducts(merged);
      setMeta(data.meta || {});
      setHasMore(data.hasMore ?? data.meta?.has_more ?? raw.length >= PAGE_SIZE);
    } catch (err) {
      if (!append) setError(err.message || "Could not load listings.");
    }
  }, [coords]);

  /* ── Initial Load ── */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  /* ── Load More ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await load(next, true);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, load]);

  /* ── Infinite Scroll ── */
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

  /* ── Location Label (from meta or first product) ── */
  const locLabel = useMemo(() => {
    if (meta?.location) return meta.location;
    if (products[0]) {
      const p = products[0];
      const c = p.location_city  || p.location?.city;
      const s = p.location_state || p.location?.state;
      return [c, s].filter(Boolean).join(", ") || null;
    }
    return null;
  }, [meta, products]);

  const total = meta?.total ?? products.length;

  /* ── Analytics ── */
  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    productsRef.current = [];
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = useCallback(() => {
    setShowPrompt(false);
    setGpsStatus("pending");
    setCoords(null);
    setShowPrompt(true);
    setLoading(true);
    productsRef.current = [];
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  /* ── Shared Grid ── */
  const GroupedGrid = ({ elite = false }) => (
    <>
      {/* Date groups would go here if needed */}
      <div className={`nb-masonry${elite ? " nb-masonry--desktop" : ""}`}
           role="list"
           aria-label="Nearby listings">
        {products.map((p, i) => (
          <div key={p.id} role="listitem">
            <NearbyCardWrapper
              product={p}
              priority={i < (elite ? 8 : 6)}
              onView={trackView}
              onClick={handleClick}
              elite={elite}
            />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {loadingMore && (
        <div
          className={elite ? "elite-nb-loading-more" : "nb-loading-more"}
          aria-live="polite"
        >
          {elite ? (
            <div className="elite-nb-dots">
              <span /><span /><span />
            </div>
          ) : (
            <span className="nb-spinner" aria-hidden="true" />
          )}
          Loading more…
        </div>
      )}
      {!hasMore && products.length > 0 && (
        elite ? (
          <div className="elite-nb-feed-end">
            <div className="elite-nb-feed-end-line" />
            <div className="elite-nb-feed-end-content">
              <span className="elite-nb-feed-end-icon">
                <Icon.Done />
              </span>
              <p className="elite-nb-feed-end-text">
                You've seen all nearby listings
              </p>
              <button
                className="elite-nb-feed-end-btn"
                onClick={() => navigate("/")}
              >
                Browse all
                <Icon.ArrowRight />
              </button>
            </div>
            <div className="elite-nb-feed-end-line" />
          </div>
        ) : (
          <div className="nb-feed-end-wrap">
            <p className="nb-feed-end">You've seen all nearby listings</p>
            <button
              className="nb-feed-end-btn"
              onClick={() => navigate("/")}
            >
              Browse all
              <Icon.ArrowRight />
            </button>
          </div>
        )
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════
     DESKTOP RENDER
  ══════════════════════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="nb-root nb-root--elite">
        <TopNav user={user} />

        <NewArrivalToast
          count={0}
          onDismiss={handleRefresh}
          elite
        />

        {/* Hero */}
        {/* (Hero optional for nearby — using top bar instead) */}
        <div className="elite-nb-layout">
          <EliteNearbySidebar
            onBack={() => navigate("/")}
            total={total}
            onRefresh={handleRefresh}
          />

          <main className="elite-nb-main" id="nb-main">
            <EliteNearbyTopBar
              locationLabel={locLabel}
              total={total}
              lastUpdated={Date.now()}
              onRefresh={handleRefresh}
            />

            {error && (
              <ErrorBanner message={error} onRetry={handleRetry} elite />
            )}

            {loading && <NearbySkeleton />}

            {!loading && !error && products.length === 0 && (
              <EmptyState
                gpsStatus={gpsStatus}
                onBrowseAll={() => navigate("/")}
                elite
              />
            )}

            {!loading && products.length > 0 && (
              <GroupedGrid elite />
            )}

            {!loading && <Footer />}
          </main>
        </div>

        <ScrollTopBtn elite />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MOBILE RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="nb-root">
      <TopNav user={user} />

      <NewArrivalToast count={0} onDismiss={handleRefresh} />

      <main className="nb-page" id="nb-main">
        <NearbyHeader
          gpsStatus={gpsStatus}
          onBack={() => navigate(-1)}
          onRequestGps={requestGps}
        />

        {/* GPS Prompt */}
        {showPrompt && gpsStatus === "pending" && (
          <NearbyGpsPrompt
            onAllow={() => { setShowPrompt(false); requestGps(); }}
            onDismiss={() => { setShowPrompt(false); setGpsStatus("denied"); }}
          />
        )}

        {/* Location Banner */}
        {!loading && locLabel && (
          <NearbyLocationBanner
            label={locLabel}
            gpsStatus={gpsStatus}
            count={total}
          />
        )}

        {/* Error */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => {
              setError(null);
              setLoading(true);
              productsRef.current = [];
              load(0, false).finally(() => setLoading(false));
            }}
          />
        )}

        {/* Skeleton */}
        {loading && <NearbySkeleton />}

        {/* Empty */}
        {!loading && !error && products.length === 0 && (
          <EmptyState
            gpsStatus={gpsStatus}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {/* Grid */}
        {!loading && products.length > 0 && (
          <>
            <div className="nb-masonry" role="list"
                 aria-label="Nearby listings">
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <NearbyCardWrapper
                    product={p}
                    priority={i < 6}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true"
                 style={{ height: 1 }} />

            {loadingMore && (
              <p className="nb-loading-more" aria-live="polite">
                <span className="nb-spinner" aria-hidden="true" />
                Loading more…
              </p>
            )}

            {!hasMore && products.length > 0 && (
              <div className="nb-feed-end-wrap">
                <p className="nb-feed-end">You've seen all nearby listings</p>
                <button
                  className="nb-feed-end-btn"
                  onClick={() => navigate("/")}
                >
                  Browse all
                  <Icon.ArrowRight />
                </button>
              </div>
            )}
          </>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}