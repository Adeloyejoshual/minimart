// hooks/useSellerDashboard.js
// ── Only fix needed — status URL ─────────────────────────────

const fetchDashboard = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const [vendorRes, statsRes, ordersRes, productsRes, chartRes, notifsRes] =
      await Promise.allSettled([

        // ✅ CORRECT URL
        api.get("/api/seller-onboarding/status"),

        api.get(`/api/seller-dashboard/stats?range=${timeRange}`),
        api.get(`/api/seller-dashboard/orders?status=${orderTab}&limit=10`),
        api.get("/api/seller-dashboard/top-products?limit=5"),
        api.get(`/api/seller-dashboard/revenue-chart?range=${timeRange}`),
        api.get("/api/seller-dashboard/notifications?limit=8"),
      ]);

    // ... rest unchanged

  } catch (err) {
    setError(err.response?.data?.message ?? "Failed to load dashboard");
  } finally {
    setLoading(false);
  }
}, [timeRange, orderTab]);