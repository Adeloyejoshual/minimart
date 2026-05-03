/**
 * pages/SectionFeedPage.jsx
 * Reusable feed page for /trending, /deals, /new.
 * Accepts a `config` prop — Trend.jsx / Deals.jsx / New.jsx pass it in.
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import MasonryCard from "../components/MasonryCard";
import { MasonrySkeleton } from "../components/Skeletons";
import { dedup, applySortClient } from "../utils/productHelpers";
import "../styles/SectionFeed.css";

/* ─── Constants ─── */
const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

/* ═══════════════════════════════════════════════════════════
   SectionFeedPage
   ═══════════════════════════════════════════════════════════ */
export default function SectionFeedPage({ config }) {
  const navigate = useNavigate();

  const {
    section,      // "trending" | "deals" | "new"
    title,        // "Trending Now"
    subtitle,     // "Most popular right now"
    icon,         // "🔥"
    accent,       // CSS colour string
    sortOptions,  // [{ label, value }]
    emptyMsg,
  } = config;

  const [products,    setProducts]    = useState([]);
  const [sortedProds, setSortedProds] = useState([]);
  const [sortKey,     setSortKey]     = useState(sortOptions[0]?.value || "");
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ─── Tracking ─── */
  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  /* ─── Fetch ─── */
  const fetchPage = useCallback(async (pg = 0) => {
    const params = new URLSearchParams({ section, page: pg });
    const res = await fetch(`${API}/homepage?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [section]);

  const applyData = useCallback((data, append = false) => {
    const incoming = Array.isArray(data.products) ? data.products : [];
    const merged   = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);
    productsRef.current = merged;
    setProducts(merged);
    setHasMore(incoming.length >= 40);
  }, []);

  /* ─── Initial load ─── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(0);
    productsRef.current = [];
    try {
      const data = await fetchPage(0);
      applyData(data, false);
    } catch (e) {
      console.error(e);
      setError("Could not load products. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, applyData]);

  /* ─── Load more ─── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchPage(next);
      applyData(data, true);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchPage, applyData]);

  /* ─── Re-sort on products / sortKey change ─── */
  useEffect(() => {
    setSortedProds(applySortClient(products, sortKey));
  }, [products, sortKey]);

  /* ─── Mount ─── */
  useEffect(() => { load(); }, [load]);

  /* ─── Infinite scroll ─── */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  /* ─── Render ─── */
  return (
    <>
      <TopNav />

      <div className="sf-pg" style={{ "--section-accent": accent }}>

        {/* Hero */}
        <div className="sf-hero">
          <button className="sf-back" onClick={() => navigate(-1)} aria-label="Go back">
            ←
          </button>

          <div className="sf-hero-inner">
            <div className="sf-icon">{icon}</div>
            <div>
              <div className="sf-kicker">{section} feed</div>
              <h1 className="sf-title">{title}</h1>
              <p className="sf-sub">{subtitle}</p>
            </div>
          </div>

          {!loading && (
            <div className="sf-count">
              {sortedProds.length}{hasMore ? "+" : ""} listings
            </div>
          )}
        </div>

        {/* Sort pills */}
        {sortOptions.length > 1 && (
          <div className="sf-sort-wrap">
            <span className="sf-sort-label">Sort:</span>
            <div className="sf-sort-pills">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`sf-sort-pill${sortKey === opt.value ? " active" : ""}`}
                  onClick={() => setSortKey(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-title">Something went wrong</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={load}>Try again</button>
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <MasonrySkeleton />
        ) : !error && sortedProds.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">{icon}</div>
            <div className="empty-title">Nothing here yet</div>
            <div className="empty-sub">{emptyMsg}</div>
            <button className="empty-btn" onClick={() => navigate("/")}>
              Back to Home
            </button>
          </div>
        ) : (
          <>
            <div className="masonry-grid">
              {sortedProds.map((p, i) => (
                <MasonryCard
                  key={p.id}
                  product={p}
                  priority={i < 4}
                  onView={trackView}
                  onClick={handleClick}
                />
              ))}
            </div>
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && <p className="loading-more">Loading more…</p>}
            {!hasMore && sortedProds.length > 0 && (
              <p className="feed-end">You've seen it all 🎉</p>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}
