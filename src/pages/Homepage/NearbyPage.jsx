/**
 * pages/Homepage/NearbyPage.jsx
 * Route: /nearby
 *
 * Tries /api/homepage?section=nearby first.
 * If that fails, silently falls back to /api/homepage (no section).
 * User never sees a repeated error — they always get products.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

const API   = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const GPS_O = { timeout: 6000, enableHighAccuracy: false, maximumAge: 300_000 };

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => !seen.has(p.id) && seen.add(p.id));
};

const SkeletonMasonry = () => (
  <div className="masonry">
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="sk sk-masonry"
        style={{ height: `${160 + (i % 4) * 55}px` }}
      />
    ))}
  </div>
);

/** Try primary URL; if it fails or returns empty, fall back to secondary. */
async function fetchWithFallback(primaryUrl, fallbackUrl) {
  try {
    const res = await fetch(primaryUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length > 0) return data;
    }
  } catch (_) { /* swallow */ }

  /* Fallback */
  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function NearbyPage({ user }) {
  const navigate = useNavigate();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [locLabel,    setLocLabel]    = useState(null);
  const [gpsStatus,   setGpsStatus]   = useState("pending");

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  const applyData = useCallback((data, append) => {
    const incoming = Array.isArray(data.products) ? data.products : [];
    const merged   = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(!!data.hasMore);

    if (!append) {
      const loc = data.meta?.location;
      if (loc) {
        setLocLabel(loc);
      } else if (merged[0]) {
        const p = merged[0];
        const c = p.location?.city  || p.location_city;
        const s = p.location?.state || p.location_state;
        if (c || s) setLocLabel([c, s].filter(Boolean).join(", "));
      }
    }
  }, []);

  const fetchNearby = useCallback(async (pageNum, append = false) => {
    const primary  = `${API}/homepage?section=nearby&page=${pageNum}`;
    const fallback = `${API}/homepage?page=${pageNum}`;
    const data = await fetchWithFallback(primary, fallback);
    applyData(data, append);
  }, [applyData]);

  /* ── Bootstrap ── */
  useEffect(() => {
    fetchNearby(0)
      .catch(() => setError("Could not connect. Check your internet."))
      .finally(() => setLoading(false));

    /* GPS chip only — doesn't block loading */
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsStatus("gps"),
        () => setGpsStatus("denied"),
        GPS_O
      );
    } else {
      setGpsStatus("denied");
    }
  }, [fetchNearby]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await fetchNearby(next, true);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, fetchNearby]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  const trackView  = useCallback((id) => {
    fetch(`${API}/products/${id}/view`,  { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  return (
    <>
      <TopNav />
      <div className="pg">

        {/* ── Page header ── */}
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="page-title-wrap">
            <h1 className="page-title">Near You</h1>
            {gpsStatus === "gps" && <span className="sec-chip gn">GPS</span>}
          </div>
        </div>

        {/* ── Location banner ── */}
        {locLabel && !loading && (
          <div className="nearby-loc-banner">
            Showing listings near <strong>{locLabel}</strong>
          </div>
        )}

        {/* Error only shown if even the fallback completely failed */}
        {error && !loading && products.length === 0 && (
          <div className="err-box">
            <div className="err-title">No connection</div>
            <div className="err-msg">{error}</div>
            <button
              className="err-btn"
              onClick={() => {
                setError(null);
                setLoading(true);
                productsRef.current = [];
                setProducts([]);
                fetchNearby(0)
                  .catch(() => setError("Still no connection. Try again later."))
                  .finally(() => setLoading(false));
              }}
            >
              Try again
            </button>
          </div>
        )}

        {loading && <SkeletonMasonry />}

        {!loading && !error && products.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">📍</div>
            <div className="empty-title">No listings found</div>
            <div className="empty-sub">Browse all available listings across Nigeria.</div>
            <button className="empty-btn" onClick={() => navigate("/")}>
              Browse All
            </button>
          </div>
        )}

        {!loading && products.length > 0 && (
          <>
            <MasonryGrid
              products={products}
              onView={trackView}
              onClick={handleClick}
            />
            <div ref={sentinelRef} style={{ height: 1 }} />
            {loadingMore && <p className="loading-more">Loading more…</p>}
          </>
        )}

      </div>
      <BottomNav />
    </>
  );
}
