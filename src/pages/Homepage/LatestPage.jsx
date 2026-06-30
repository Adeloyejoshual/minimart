// src/pages/Homepage/LatestPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate }       from "react-router-dom";
import TopNav                from "../../components/TopNav";
import BottomNav             from "../../components/BottomNav";
import Footer                from "../../components/Footer";
import LatestHeader          from "../../components/latest/LatestHeader";
import LatestTimeBar         from "../../components/latest/LatestTimeBar";
import LatestDateGroup       from "../../components/latest/LatestDateGroup";
import LatestCard            from "../../components/latest/LatestCard";
import LatestSkeleton        from "../../components/latest/LatestSkeleton";
import {
  useLatestQuery,
  dedup,
  normalizeProduct,
  groupByDate,
}                            from "../../hooks/useLatestQuery";
import "../../styles/LatestPage.css";

/* ── API ─────────────────────────────────────────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || window.location.origin;
const API = `${BASE_URL}/api`;

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
      className={`lt-scroll-top${visible ? " visible" : ""}`}
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

/* ── New arrival toast ───────────────────────────────────────── */
function NewArrivalToast({ count, onDismiss }) {
  if (!count || count <= 0) return null;
  return (
    <button
      className="lt-toast"
      onClick={onDismiss}
      aria-live="polite"
    >
      <span className="lt-toast-dot" aria-hidden="true" />
      {count} new listing{count !== 1 ? "s" : ""} added
      — tap to refresh ↑
    </button>
  );
}

/* ── Empty state ─────────────────────────────────────────────── */
function EmptyState({ category, onClearCategory, onBrowseAll }) {
  return (
    <div className="lt-empty" role="status">
      <span className="lt-empty-emoji" aria-hidden="true">
        🆕
      </span>
      <h3 className="lt-empty-title">
        {category !== "all"
          ? "No new listings in this category"
          : "No new listings yet"}
      </h3>
      <p className="lt-empty-sub">
        {category !== "all"
          ? "Try a different category or check back soon."
          : "New products are listed every day. Check back soon!"}
      </p>
      {category !== "all" ? (
        <button className="lt-empty-btn" onClick={onClearCategory}>
          Show All Categories
        </button>
      ) : (
        <button className="lt-empty-btn" onClick={onBrowseAll}>
          Browse All Listings
        </button>
      )}
    </div>
  );
}

/* ── Error banner ────────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="lt-err" role="alert">
      <span className="lt-err-icon" aria-hidden="true">⚡</span>
      <p className="lt-err-title">Could not load new arrivals</p>
      <p className="lt-err-msg">{message}</p>
      <button className="lt-err-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function LatestPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ─────────────────────────────────────────────── */
  const [category, setCategory] = useState("all");

  /* ── New arrivals counter ────────────────────────────────── */
  const [newCount,  setNewCount]  = useState(0);
  const firstIdRef = useRef(null);

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
    dataUpdatedAt,
  } = useLatestQuery({ category });

  /* ── Flatten + normalize ─────────────────────────────────── */
  const products = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) =>
      Array.isArray(pg.products) ? pg.products : []
    );
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Detect new arrivals on background refetch ───────────── */
  useEffect(() => {
    if (!products.length) return;
    const topId = products[0]?.id;

    if (firstIdRef.current && topId !== firstIdRef.current) {
      /* New items appeared at the top */
      const newIdx = products.findIndex(
        (p) => p.id === firstIdRef.current
      );
      setNewCount(newIdx > 0 ? newIdx : 1);
    }

    if (!firstIdRef.current) {
      firstIdRef.current = topId;
    }
  }, [products]);

  /* ── Group by date ───────────────────────────────────────── */
  const groups = useMemo(
    () => groupByDate(products),
    [products]
  );

  /* ── Totals ──────────────────────────────────────────────── */
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

  /* ── Handle toast dismiss → scroll to top + clear ───────── */
  const handleToastDismiss = useCallback(() => {
    setNewCount(0);
    firstIdRef.current = products[0]?.id ?? null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [products]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="lt-root">

      {/* ══════════════════════════════════════════════
          TOP NAV
      ══════════════════════════════════════════════ */}
      <TopNav user={user} />

      {/* ══════════════════════════════════════════════
          NEW ARRIVALS TOAST
      ══════════════════════════════════════════════ */}
      <NewArrivalToast
        count={newCount}
        onDismiss={handleToastDismiss}
      />

      {/* ══════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════ */}
      <main className="lt-page" id="lt-main">

        {/* Header */}
        <LatestHeader
          onBack={() => navigate(-1)}
          total={total}
        />

        {/* Time bar + category filter */}
        <LatestTimeBar
          total={total}
          category={category}
          onCategoryChange={setCategory}
          lastUpdated={dataUpdatedAt}
          loading={isLoading}
        />

        {/* Error */}
        {isError && (
          <ErrorBanner
            message={error?.message ?? "Something went wrong."}
            onRetry={refetch}
          />
        )}

        {/* Skeleton */}
        {isLoading && <LatestSkeleton />}

        {/* Empty */}
        {!isLoading && !isError && products.length === 0 && (
          <EmptyState
            category={category}
            onClearCategory={() => setCategory("all")}
            onBrowseAll={() => navigate("/")}
          />
        )}

        {/* Grouped grid */}
        {!isLoading && groups.length > 0 && groups.map((group) => (
          <section key={group.label}>

            {/* Date group separator */}
            <LatestDateGroup
              label={group.label}
              count={group.items.length}
            />

            {/* Masonry grid for this group */}
            <div
              className="lt-masonry"
              role="list"
              aria-label={`${group.label} listings`}
            >
              {group.items.map((p, i) => (
                <div key={p.id} role="listitem">
                  <LatestCard
                    product={p}
                    priority={i < 4}
                    onView={trackView}
                    onClick={handleClick}
                  />
                </div>
              ))}
            </div>

          </section>
        ))}

        {/* Infinite scroll sentinel */}
        {!isLoading && (
          <div
            ref={sentinelRef}
            aria-hidden="true"
            style={{ height: 1 }}
          />
        )}

        {/* Loading more */}
        {isFetchingNextPage && (
          <p className="lt-loading-more" aria-live="polite">
            <span className="lt-spinner" aria-hidden="true" />
            Loading more…
          </p>
        )}

        {/* End of feed */}
        {!hasNextPage && products.length > 0 && (
          <div className="lt-feed-end-wrap">
            <p className="lt-feed-end" aria-live="polite">
              You're all caught up 🎉
            </p>
            <button
              className="lt-feed-end-btn"
              onClick={() => navigate("/")}
            >
              Browse all listings →
            </button>
          </div>
        )}

        {/* Footer */}
        {!isLoading && <Footer />}

      </main>

      {/* Fixed elements */}
      <ScrollTopBtn />
      <BottomNav />

    </div>
  );
}