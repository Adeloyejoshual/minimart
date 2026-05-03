/**
 * pages/DealsPage.jsx
 * Route: /deals
 * Shows products with price <= 50000, sorted by price ASC.
 * API: GET /api/products?max_price=50000&sort=price_asc&limit=40&page=N
 */

import React, { useCallback } from "react";
import PageShell from "../../components/PageShell";
import { useProductFeed } from "../../hooks/useProductFeed";

const API =
  import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

export default function DealsPage() {
  const { products, loading, loadingMore, error, sentinelRef } =
    useProductFeed(
      `${API}/products?max_price=50000&sort=price_asc&status=active`
    );

  const trackView = useCallback((id) => {
    fetch(`${API}/products/${id}/view`, { method: "POST" }).catch(() => {});
  }, []);

  return (
    <PageShell
      title="Cheap Deals"
      icon="💸"
      chip="Under ₦50k"
      products={products}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      sentinelRef={sentinelRef}
      onTrackView={trackView}
      emptyMsg="No deals available right now. Check back soon!"
    />
  );
}
