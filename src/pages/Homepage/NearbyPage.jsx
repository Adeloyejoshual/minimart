// src/pages/Homepage/NearbyPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate }          from "react-router-dom";
import TopNav                   from "../../components/TopNav";
import BottomNav                from "../../components/BottomNav";
import Footer                   from "../../components/Footer";
import NearbyHeader             from "../../components/nearby/NearbyHeader";
import NearbyLocationBanner     from "../../components/nearby/NearbyLocationBanner";
import NearbyGpsPrompt          from "../../components/nearby/NearbyGpsPrompt";
import NearbySkeleton           from "../../components/nearby/NearbySkeleton";
import NearbyCard               from "../../components/nearby/NearbyCard";
import {
  useNearbyQuery,
  dedup,
  normalizeProduct,
}                               from "../../hooks/useNearbyQuery";
import "../../styles/NearbyPage.css";

/* ── API ─────────────────────────────────────────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API = `${BASE_URL}/api`;

/* ── GPS options ─────────────────────────────────────────────── */
const GPS_OPTS = {
  timeout           : 6_000,
  enableHighAccuracy: false,
  maximumAge        : 300_000,
};

/* ── GPS cache ───────────────────────────────────────────────── */
const GPS_KEY = "loemart_gps";
const GPS_TTL = 10 * 60_000;

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

/* ── Scroll-to-top ───────────────────────────────────────────── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`nb-scroll-top${visible ? " visible" : ""}`}
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

/* ── Empty state ─────────────────────────────────────────────── */
function EmptyState({ gpsStatus, onBrowseAll }) {
  return (
    <div className="nb-empty" role="status">
      <span className="nb-empty-emoji" aria-hidden="true">
        {gpsStatus === "denied" ? "🗺️" : "📍"}
      </span>
      <h3 className="nb-empty-title">
        {gpsStatus === "denied"
          ? "Location access denied"
          : "No nearby listings found"}
      </h3>
      <p className="nb-empty-sub">
        {gpsStatus === "denied"
          ? "We couldn't detect your location. Showing listings from across Nigeria."
          : "There are no listings in your immediate area yet. More sellers are joining daily!"}
      </p>
      <button className="nb-empty-btn" onClick={onBrowseAll}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ── Error banner ────────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="nb-err" role="alert">
      <span className="nb-err-icon" aria-hidden="true">⚡</span>
      <p className="nb-err-title">Could not load listings</p>
      <p className="nb-err-msg">{message}</p>
      <button className="nb-err-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function NearbyPage({ user }) {
  const navigate = useNavigate();

  /* ── GPS state ───────────────────────────────────────────── */
  const [coords,    setCoords]    = useState(() => readCachedGps());
  const [gpsStatus, setGpsStatus] = useState(
    () => readCachedGps() ? "gps" : "pending"
  );
  const [showPrompt, setShowPrompt] = useState(false);
  const gpsAttempted = useRef(false);

  /* ── Request GPS ─────────────────────────────────────────── */
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

  /* ── Auto GPS on mount ───────────────────────────────────── */
  useEffect(() => {
    if (gpsAttempted.current || coords) return;
    gpsAttempted.current = true;

    if (!navigator.geolocation) {
      setGpsStatus("denied");
      setShowPrompt(false);
      return;
    }

    /* Show prompt briefly, then auto-request */
    setShowPrompt(true);
    const t = setTimeout(() => {
      requestGps();
    }, 800);

    return () => clearTimeout(t);
  }, [coords, requestGps]);

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
  } = useNearbyQuery(coords);

  /* ── Flatten products ────────────────────────────────────── */
  const products = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) =>
      Array.isArray(pg.products) ? pg.products : []
    );
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Location label ──────────────────────────────────────── */
  const locLabel = useMemo(() => {
    const meta = data?.pages?.[0]?.meta;
    if (meta?.location) return meta.location;
    if (products[0]) {
      const p = products[0];
      const c = p.location_city  || p.location?.city;
      const s = p.location_state || p.location?.state;
      return [c, s].filter(Boolean).join(", ") || null;
    }
    return null;
  }, [data, products]);

  const total = data?.pages?.[0]?.meta?.total ?? products.length;

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

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method   : "POST",
      keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="nb-root">

      {/* ══════════════════════════════════════════════
          TOP NAV
      ══════════════════════════════════════════════ */}
      <TopNav user={user} />

      {/* ══════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════ */}
      <main className="nb-page" id="nb-main">

        {/* Header */}
        <NearbyHeader
          gpsStatus={gpsStatus}
          onBack={() => navigate(-1)}
          onRequestGps={requestGps}
        />

        {/* GPS prompt */}
        {showPrompt && gpsStatus === "pending" && (
          <NearbyGpsPrompt
            onAllow={() => { setShowPrompt(false); requestGps(); }}
            onDismiss={() => {
              setShowPrompt(false);
              setGpsStatus("denied");
            }}
          />
        )}

        {/* Location banner */}
        {!isLoading && locLabel && (
          <NearbyLocationBanner
            label={locLabel}
            gpsStatus={gpsStatus}
            count={total}
          />
        )}

        {/* Error */}
        {isError && (
          <ErrorBanner
            message={error?.message ?? "Something went wrong."}
            onRetry={refetch}
          />
        )}

        {/* Skeleton */}
        {isLoading && <NearbySkeleton />}

        {/* Empty */}
        {!isLoading && !isError && products.length === 0 && (
          <EmptyState
            gpsStatus={gpsStatus}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {/* Grid */}
        {!isLoading && products.length > 0 && (
          <>
            <div
              className="nb-masonry"
              role="list"
              aria-label="Nearby listings"
            >
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <NearbyCard
                    product={p}
                    priority={i < 6}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

            {/* Sentinel */}
            <div
              ref={sentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />

            {/* Loading more */}
            {isFetchingNextPage && (
              <p className="nb-loading-more" aria-live="polite">
                <span className="nb-spinner" aria-hidden="true" />
                Loading more…
              </p>
            )}

            {/* End of feed */}
            {!hasNextPage && products.length > 0 && (
              <div className="nb-feed-end-wrap">
                <p className="nb-feed-end" aria-live="polite">
                  You've seen all nearby listings 🎉
                </p>
                <button
                  className="nb-feed-end-btn"
                  onClick={() => navigate("/")}
                >
                  Browse all listings →
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        {!isLoading && <Footer />}

      </main>

      {/* Fixed */}
      <ScrollTopBtn />
      <BottomNav />

    </div>
  );
}