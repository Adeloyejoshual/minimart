// src/pages/Homepage/DealsPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import DealsHeader     from "../../components/deals/DealsHeader";
import DealsFilterBar  from "../../components/deals/DealsFilterBar";
import DealsSkeleton   from "../../components/deals/DealsSkeleton";
import DealCard        from "../../components/deals/DealCard";
import { useDealsQuery, dedup, normalizeProduct } from "../../hooks/useDealsQuery";
import "../../styles/DealsPage.css";

/* ─── API ─────────────────────────────────────────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ─── Scroll to Top Button ────────────────────────────────────── */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      className={`deals-scroll-top${visible ? " visible" : ""}`}
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

/* ─── Empty State ─────────────────────────────────────────────── */
function EmptyState({ onBack }) {
  return (
    <div className="deals-empty" role="status">
      <span className="deals-empty-emoji" aria-hidden="true">🏷️</span>
      <h3 className="deals-empty-title">No deals right now</h3>
      <p className="deals-empty-sub">
        New listings under ₦50,000 appear daily.
        <br />Check back soon!
      </p>
      <button className="deals-empty-btn" onClick={onBack}>
        Browse All Listings
      </button>
    </div>
  );
}

/* ─── Error Banner ────────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="deals-err" role="alert">
      <span className="deals-err-icon" aria-hidden="true">⚡</span>
      <p className="deals-err-title">Could not load deals</p>
      <p className="deals-err-msg">{message}</p>
      <button className="deals-err-btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* ─── Result Count Badge ──────────────────────────────────────── */
function ResultCount({ total, loading }) {
  if (loading || !total) return null;
  return (
    <div className="deals-result-count" aria-live="polite">
      <span className="deals-result-count-num">
        {total.toLocaleString()}
      </span>
      {" "}deal{total !== 1 ? "s" : ""} found
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  /* ── Filters ─────────────────────────────────────────────── */
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy,   setSortBy]   = useState("price_asc");
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
  } = useDealsQuery({ maxPrice, sortBy, category });

  /* ── Flatten pages → products ────────────────────────────── */
  const products = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) =>
      Array.isArray(pg.products) ? pg.products : []
    );
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  /* ── Totals ──────────────────────────────────────────────── */
  const total = data?.pages?.[0]?.meta?.total ?? products.length;

  /* ── Infinite scroll ─────────────────────────────────────── */
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
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
    <div className="deals-root">

      {/* ══════════════════════════════════════════════
          TOP NAV — sticky glass bar
      ══════════════════════════════════════════════ */}
      <TopNav user={user} />

      {/* ══════════════════════════════════════════════
          PAGE BODY
      ══════════════════════════════════════════════ */}
      <main className="deals-page" id="main-content">

        {/* Page Header */}
        <DealsHeader onBack={() => navigate(-1)} />

        {/* Filter Bar */}
        <DealsFilterBar
          maxPrice={maxPrice}
          sortBy={sortBy}
          total={total}
          onMaxPriceChange={setMaxPrice}
          onSortChange={setSortBy}
        />

        {/* Result count */}
        <ResultCount total={total} loading={isLoading} />

        {/* Error */}
        {isError && (
          <ErrorBanner
            message={error?.message ?? "Something went wrong."}
            onRetry={refetch}
          />
        )}

        {/* Skeleton */}
        {isLoading && <DealsSkeleton />}

        {/* Empty */}
        {!isLoading && !isError && products.length === 0 && (
          <EmptyState onBack={() => navigate("/")} />
        )}

        {/* Grid */}
        {!isLoading && products.length > 0 && (
          <>
            <div
              className="deals-masonry"
              role="list"
              aria-label="Deal listings"
            >
              {products.map((p, i) => (
                <div key={p.id} role="listitem">
                  <DealCard
                    product={p}
                    priority={i < 6}
                    onView={trackView}
                    onClick={handleClick}
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

            {/* Loading more */}
            {isFetchingNextPage && (
              <p className="deals-loading-more" aria-live="polite">
                <span className="deals-spinner" aria-hidden="true" />
                Loading more deals…
              </p>
            )}

            {/* End of feed */}
            {!hasNextPage && products.length > 0 && (
              <div className="deals-feed-end-wrap">
                <p className="deals-feed-end" aria-live="polite">
                  You've seen all the deals 🎉
                </p>
                <button
                  className="deals-feed-end-btn"
                  onClick={() => navigate("/")}
                >
                  Browse all listings →
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            FOOTER — inside main so it scrolls naturally
        ══════════════════════════════════════════════ */}
        {!isLoading && (
          <Footer />
        )}

      </main>

      {/* ══════════════════════════════════════════════
          FIXED ELEMENTS
      ══════════════════════════════════════════════ */}
      <ScrollTopBtn />
      <BottomNav />

    </div>
  );
}