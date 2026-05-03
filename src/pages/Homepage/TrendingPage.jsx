/**
 * pages/TrendingPage.jsx
 * Route: /trending
 * Shows products ranked by engagement_score + clicks_count from DB.
 * API: GET /api/products?sort=trending&limit=40&page=N
 */

import React, { useCallback } from "react";
import PageShell from "../../components/PageShell";
import { useProductFeed } from "../../hooks/useProductFeed";

const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

export default function TrendingPage() {
  const { products, loading, loadingMore, error, sentinelRef } =
    useProductFeed(`${API}/products?sort=trending&status=active`);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  return (
    <PageShell
      title="Trending"
      icon="🔥"
      chip="Most Popular"
      products={products}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      sentinelRef={sentinelRef}
      onTrackView={trackView}
      emptyMsg="No trending products right now. Check back soon!"
    />
  );
}
