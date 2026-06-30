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
import DealsHeader     from "../../components/deals/DealsHeader";
import DealsFilterBar  from "../../components/deals/DealsFilterBar";
import DealsSkeleton   from "../../components/deals/DealsSkeleton";
import DealCard        from "../../components/deals/DealCard";
import { useDealsQuery, dedup, normalizeProduct } from "../../hooks/useDealsQuery";
import "../../styles/DealsPage.css";

/* ─── Analytics queue (reuse from Homepage) ──────────────────── */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

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

/* ─── Main Component ──────────────────────────────────────────── */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  // ── Filters ───────────────────────────────────────────────
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy,   setSortBy]   = useState("price_asc");
  const [category, setCategory] = useState("all");

  // ── Data ──────────────────────────────────────────────────
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

  // ── Flatten pages → products ──────────────────────────────
  const products = useMemo(() => {
    if (!data?.pages) return [];
    const raw = data.pages.flatMap((pg) =>
      Array.isArray(pg.products) ? pg.products : []
    );
    return dedup(raw).map(normalizeProduct).filter(Boolean);
  }, [data]);

  // ── Total count ───────────────────────────────────────────
  const total = data?.pages?.[0]?.meta?.total ?? products.length;

  // ── Infinite scroll sentinel ──────────────────────────────
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Analytics ─────────────────────────────────────────────
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, {
      method    : "POST",
      keepalive : true,
    }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/products/${product.id}/click`, {
      method    : "POST",
      keepalive : true,
    }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <TopNav user={user} />

      <div className="deals-page">

        {/* Header */}
        <DealsHeader onBack={() => navigate(-1)} />

        {/* Filter Bar */}
        <DealsFilterBar
          maxPrice={maxPrice}
          sortBy={sortBy}
          total={total}
          onMaxPriceChange={setMaxPrice}
          onSortChange={setSortBy}
        />

        {/* Error */}
        {isError && (
          <ErrorBanner
            message={error?.message ?? "Something went wrong."}
            onRetry={refetch}
          />
        )}

        {/* Loading skeleton */}
        {isLoading && <DealsSkeleton />}

        {/* Empty state */}
        {!isLoading && !isError && products.length === 0 && (
          <EmptyState onBack={() => navigate("/")} />
        )}

        {/* Product grid */}
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

            {/* Infinite scroll trigger */}
            <div
              ref={sentinelRef}
              aria-hidden="true"
              style={{ height: 1 }}
            />

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <p className="deals-loading-more" aria-live="polite">
                <span className="deals-spinner" aria-hidden="true" />
                Loading more deals…
              </p>
            )}

            {/* End of feed */}
            {!hasNextPage && products.length > 0 && (
              <p className="deals-feed-end" aria-live="polite">
                You've seen all the deals 🎉
              </p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}