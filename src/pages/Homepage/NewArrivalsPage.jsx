/**
 * pages/NewArrivalsPage.jsx
 * Route: /latest
 * Shows newest listings sorted by created_at DESC.
 * Uses idx_products_created_at index on DB.
 * API: GET /api/products?sort=newest&limit=40&page=N
 */

import React, { useCallback } from "react";
import PageShell from "../components/PageShell";
import { useProductFeed } from "../hooks/useProductFeed";

const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

export default function NewArrivalsPage() {
  const { products, loading, loadingMore, error, sentinelRef } =
    useProductFeed(`${API}/products?sort=newest&status=active`);

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  return (
    <PageShell
      title="New Arrivals"
      icon="🆕"
      products={products}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      sentinelRef={sentinelRef}
      onTrackView={trackView}
      emptyMsg="No new listings yet. Be the first to sell!"
    />
  );
}
