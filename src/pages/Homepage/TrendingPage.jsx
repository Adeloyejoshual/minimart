// src/pages/Homepage/TrendingPage.jsx
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
import TrendingHeader        from "../../components/trending/TrendingHeader";
import TrendingStatsBar      from "../../components/trending/TrendingStatsBar";
import TrendingCard          from "../../components/trending/TrendingCard";
import TrendingSkeleton      from "../../components/trending/TrendingSkeleton";
import {
  useTrendingQuery,
  dedup,
  normalizeProduct,
}                            from "../../hooks/useTrendingQuery";
import "../../styles/TrendingPage.css";

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
      className={`tr-scroll-top${visible ? " visible" : ""}`}
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

/* ── Empty state ─────────────────────────────────────────────── */
function EmptyState({ onBrowseAll }) {
  return (
    <div className="tr-empty" role="status">
      <span className="tr-empty-emoji" aria-hidden="true">
        📈
      </span>
      <h3 className="tr-empty-title">
        Nothing trending yet
      </h3>
      <p className="tr-empty-sub">
        Products earn trending status as they gather
        views, clicks, and saves. Check back soon!
      </p>
      <button className="tr-empty-btn" onClick={onBrowseAll}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ── Error banner ────────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="tr-err" role="alert">
      <span className="tr-err-icon" aria-hidden="true">⚡</span>
      <p className="tr-err-title">Could not load trending</p>
      <p className="tr-err-msg">{message}</p>
      <button className="tr-err-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function TrendingPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ─────────────────────────────────────────────── */
  const [sort,     setSort]     = useState("default");
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
  } = useTrendingQuery({ sort, category });

  /* ── Flatten + normalize ─────────────────────────────────── */
  const products = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) =>
      Array.isArray(pg.products) ? pg.products : []
    );
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Aggregate stats for StatsBar ───────────────────────── */
  const { total, totalViews, totalClicks } = useMemo(() => {
    const t = data?.pages?.[0]?.meta?.total ?? products.length;
    const v = products.reduce(
      (acc, p) => acc + Number(p.views || 0), 0
    );
    const c = products.reduce(
      (acc, p) => acc + Number(p.clicks_count || 0), 0
    );
    return { total: t, totalViews: v, totalClicks: c };
  }, [data, products]);

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
    <div className="tr-root">

      {/* ══════════════════════════════════════════════
          TOP NAV
      ══════════════════════════════════════════════ */}
      <TopNav user={user} />

      {/* ══════════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════════ */}
      <main className="tr-page" id="tr-main">

        {/* Header */}
        <TrendingHeader
          onBack={() => navigate(-1)}
          total={total}
        />

        {/* Stats + Sort bar */}
        <TrendingStatsBar
          total={total}
          totalViews={totalViews}
          totalClicks={totalClicks}
          sort={sort}
          onSortChange={setSort}
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
        {isLoading && <TrendingSkeleton />}

        {/* Empty */}
        {!isLoading && !isError && products.length === 0 && (
          <EmptyState onBrowseAll={() => navigate("/")} />
        )}

        {/* Grid */}
        {!isLoading && products.length > 0 && (
          <>
            <div
              className="tr-masonry"
              role="list"
              aria-label="Trending listings"
            >
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <TrendingCard
                    product={p}
                    rank={i + 1}
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
              <p className="tr-loading-more" aria-live="polite">
                <span className="tr-spinner" aria-hidden="true" />
                Loading more…
              </p>
            )}

            {/* End of feed */}
            {!hasNextPage && products.length > 0 && (
              <div className="tr-feed-end-wrap">
                <p className="tr-feed-end" aria-live="polite">
                  You've seen all trending listings 🎉
                </p>
                <button
                  className="tr-feed-end-btn"
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