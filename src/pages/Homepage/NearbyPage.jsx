/**
 * pages/Homepage/NearbyPage.jsx
 * Route: /nearby
 *
 * Backend: GET /api/homepage?section=nearby&lat=X&lng=Y&page=N
 * page is 0-based (offset = page * 40)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

const API   = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const GPS_O = { timeout: 6000, enableHighAccuracy: true, maximumAge: 60_000 };

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

export default function NearbyPage({ user }) {
  const navigate = useNavigate();

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0); // 0-based
  const [coords,      setCoords]      = useState(null);
  const [locLabel,    setLocLabel]    = useState(null);
  const [gpsStatus,   setGpsStatus]   = useState("pending");

  const productsRef = useRef([]);
  const sentinelRef = useRef(null);

  /* ── Correct endpoint: /api/homepage?section=nearby ── */
  const buildUrl = useCallback((lat, lng, pageNum) => {
    const params = new URLSearchParams({ section: "nearby", page: pageNum });
    if (lat != null) params.set("lat", lat);
    if (lng != null) params.set("lng", lng);
    return `${API}/homepage?${params.toString()}`;
  }, []);

  const fetchNearby = useCallback(async (lat, lng, pageNum, append = false) => {
    const res = await fetch(buildUrl(lat, lng, pageNum));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const incoming = Array.isArray(data.products) ? data.products : [];

    const merged = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(!!data.hasMore);

    /* Location label from meta */
    if (!append && data.meta) {
      const loc = data.meta.location;
      if (loc) setLocLabel(loc);
    }
  }, [buildUrl]);

  /* ── Bootstrap: ask GPS, fall back gracefully ── */
  useEffect(() => {
    let resolved = false;

    const run = (lat, lng, status) => {
      if (resolved) return;
      resolved = true;
      setGpsStatus(status);
      fetchNearby(lat, lng, 0)
        .catch(() => setError("Could not load nearby listings."))
        .finally(() => setLoading(false));
    };

    if (!navigator.geolocation) { run(null, null, "denied"); return; }

    const timer = setTimeout(() => run(null, null, "ip"), 6000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        run(lat, lng, "gps");
      },
      () => { clearTimeout(timer); run(null, null, "denied"); },
      GPS_O
    );

    return () => clearTimeout(timer);
  }, [fetchNearby]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      await fetchNearby(coords?.lat, coords?.lng, next, true);
      setPage(next);
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, coords, fetchNearby]);

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

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  const handleClick = useCallback((product) => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    navigate(`/product/${product.slug}`);
  }, [navigate]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    productsRef.current = [];
    setProducts([]);
    setPage(0);
    fetchNearby(coords?.lat, coords?.lng, 0)
      .catch(() => setError("Still failing. Check your connection."))
      .finally(() => setLoading(false));
  }, [coords, fetchNearby]);

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
            {gpsStatus === "ip"  && <span className="sec-chip">Approximate</span>}
          </div>
        </div>

        {/* ── Location banner ── */}
        {locLabel && !loading && (
          <div className="nearby-loc-banner">
            Showing listings near <strong>{locLabel}</strong>
          </div>
        )}

        {error && (
          <div className="err-box">
            <div className="err-title">Could not load listings</div>
            <div className="err-msg">{error}</div>
            <button className="err-btn" onClick={retry}>Try again</button>
          </div>
        )}

        {loading && <SkeletonMasonry />}

        {!loading && !error && products.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">📍</div>
            <div className="empty-title">No listings nearby</div>
            <div className="empty-sub">
              Enable GPS for more accurate results, or browse all of Nigeria.
            </div>
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
