/**
 * pages/NearbyPage.jsx
 * Route: /nearby
 * Fetches user GPS then loads products by proximity.
 * Falls back to state-level filtering if GPS denied.
 * API: GET /api/products?lat=X&lng=Y&sort=distance&limit=40&page=N
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import MasonryGrid from "../components/MasonryGrid";

const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
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

export default function NearbyPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [coords, setCoords] = useState(null);
  const [locLabel, setLocLabel] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("pending"); // pending | gps | ip | denied

  const productsRef = React.useRef([]);
  const sentinelRef = React.useRef(null);

  const fetchNearby = useCallback(async (lat, lng, pageNum, append = false) => {
    const sep = lat ? `?lat=${lat}&lng=${lng}&` : "?";
    const url = `${API}/products${sep}sort=distance&status=active&limit=40&page=${pageNum}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const incoming = Array.isArray(data.products)
      ? data.products
      : Array.isArray(data) ? data : [];

    const merged = append
      ? dedup([...productsRef.current, ...incoming])
      : dedup(incoming);

    productsRef.current = merged;
    setProducts(merged);
    setHasMore(incoming.length >= 40);

    // Extract location label from first product or meta
    if (!append && data.meta?.city) {
      const { city, state } = data.meta;
      setLocLabel(city && state ? `${city}, ${state}` : city || state);
    } else if (!append && merged[0]) {
      const p = merged[0];
      const city = p.location_city || p.location?.city;
      const state = p.location_state || p.location?.state;
      if (city || state) setLocLabel([city, state].filter(Boolean).join(", "));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setGpsStatus("denied");
      fetchNearby(null, null, 1)
        .catch(() => setError("Could not load nearby listings."))
        .finally(() => setLoading(false));
      return;
    }

    const timer = setTimeout(() => {
      setGpsStatus("ip");
      fetchNearby(null, null, 1)
        .catch(() => setError("Could not load nearby listings."))
        .finally(() => setLoading(false));
    }, 6000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setGpsStatus("gps");
        fetchNearby(lat, lng, 1)
          .catch(() => setError("Could not load nearby listings."))
          .finally(() => setLoading(false));
      },
      () => {
        clearTimeout(timer);
        setGpsStatus("denied");
        fetchNearby(null, null, 1)
          .catch(() => setError("Could not load nearby listings."))
          .finally(() => setLoading(false));
      },
      GPS_O
    );
  }, [fetchNearby]);

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

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  return (
    <>
      <TopNav />
      <div className="pg">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="page-title-wrap">
            <span className="page-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </span>
            <h1 className="page-title">Near You</h1>
            {gpsStatus === "gps" && (
              <span className="sec-chip gn">GPS</span>
            )}
            {gpsStatus === "ip" && (
              <span className="sec-chip">Approximate</span>
            )}
          </div>
        </div>

        {locLabel && (
          <div className="nearby-loc-banner">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            Showing listings near <strong>{locLabel}</strong>
          </div>
        )}

        {error && (
          <div className="err-box">
            <div className="err-icon">⚡</div>
            <div className="err-msg">{error}</div>
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
              onClick={(product) => navigate(`/product/${product.slug}`)}
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
