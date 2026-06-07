// hooks/useSellerDashboard.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

// ── Axios instance with timeout ───────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  timeout: 15_000,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Default stats ─────────────────────────────────────────────
const DEFAULT_STATS = {
  total_revenue:   0,
  total_orders:    0,
  total_products:  0,
  pending_orders:  0,
  total_customers: 0,
  avg_order_value: 0,
  revenue_change:  0,
  orders_change:   0,
};

// ── Error codes that mean redirect not error screen ───────────
const REDIRECT_CODES = new Set([
  "NOT_SELLER_ACCOUNT",
  "NO_VENDOR",
  "NO_TOKEN",
  "UNAUTHORIZED",
]);

export const useSellerDashboard = () => {
  const [vendor,        setVendor]        = useState(null);
  const [stats,         setStats]         = useState(DEFAULT_STATS);
  const [recentOrders,  setRecentOrders]  = useState([]);
  const [topProducts,   setTopProducts]   = useState([]);
  const [revenueChart,  setRevenueChart]  = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);
  const [timeRange,     setTimeRange]     = useState("30d");
  const [orderTab,      setOrderTab]      = useState("all");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    // ── No token → not a seller ───────────────────────────
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorCode("NO_TOKEN");
      setError("NO_TOKEN");
      setLoading(false);
      return;
    }

    // ══════════════════════════════════════════════════════
    // STEP 1: Get vendor status
    // Uses requireSellerAccount — confirms market.users
    // ══════════════════════════════════════════════════════
    let vendorData = null;

    try {
      const { data } = await api.get("/api/seller-onboarding/status");

      if (!data?.vendor) {
        setErrorCode("NO_VENDOR");
        setError("NO_VENDOR");
        setLoading(false);
        return;
      }

      vendorData = data.vendor;
      setVendor(vendorData);

    } catch (err) {
      const status = err.response?.status;
      const code   = err.response?.data?.code;

      console.error("[useSellerDashboard] vendor error:", {
        status,
        code,
        message:   err.response?.data?.message,
        isTimeout: err.code === "ECONNABORTED",
      });

      if (err.code === "ECONNABORTED") {
        // Request timed out — server slow (Render cold start)
        setError("Server timeout. Please try again.");
        setErrorCode("SERVER_ERROR");

      } else if (status === 401) {
        // Token invalid/expired
        localStorage.removeItem("token");
        setErrorCode("UNAUTHORIZED");
        setError("UNAUTHORIZED");

      } else if (status === 403 && code === "NOT_SELLER_ACCOUNT") {
        // Gmail/marketplace user trying to access seller dashboard
        setErrorCode("NOT_SELLER_ACCOUNT");
        setError("NOT_SELLER_ACCOUNT");

      } else if (status === 403) {
        // Other 403 (e.g. account suspended)
        setError(err.response?.data?.message ?? "Access denied");
        setErrorCode("FORBIDDEN");

      } else if (status === 404) {
        // No vendor account found → redirect to onboarding
        setErrorCode("NO_VENDOR");
        setError("NO_VENDOR");

      } else if (!err.response) {
        // Network error
        setError("Network error. Check your connection.");
        setErrorCode("NETWORK_ERROR");

      } else {
        // Any other server error
        setError(err.response?.data?.message ?? "Failed to load dashboard");
        setErrorCode("SERVER_ERROR");
      }

      setLoading(false);
      return;
    }

    // ══════════════════════════════════════════════════════
    // STEP 2: Vendor not active → don't load dashboard data
    // SellerDashboard will redirect to /become-seller
    // ══════════════════════════════════════════════════════
    if (!["active", "approved"].includes(vendorData.status)) {
      setLoading(false);
      return;
    }

    // ══════════════════════════════════════════════════════
    // STEP 3: Load all dashboard data in parallel
    // Use .catch() per request so one failure doesn't
    // prevent other data from loading
    // ══════════════════════════════════════════════════════
    const safeGet = (url, fallback) =>
      api.get(url).catch((err) => {
        console.warn(`[dashboard] ${url} failed:`, err.response?.status, err.message);
        return { data: fallback };
      });

    const [
      statsRes,
      ordersRes,
      productsRes,
      chartRes,
      notifsRes,
    ] = await Promise.all([
      safeGet(
        `/api/seller-dashboard/stats?range=${timeRange}`,
        { stats: DEFAULT_STATS }
      ),
      safeGet(
        `/api/seller-dashboard/orders?status=${orderTab}&limit=10`,
        { orders: [] }
      ),
      safeGet(
        "/api/seller-dashboard/top-products?limit=5",
        { products: [] }
      ),
      safeGet(
        `/api/seller-dashboard/revenue-chart?range=${timeRange}`,
        { chart: [] }
      ),
      safeGet(
        "/api/seller-dashboard/notifications?limit=8",
        { notifications: [] }
      ),
    ]);

    // ── Set state from results ────────────────────────────
    setStats({
      ...DEFAULT_STATS,
      ...(statsRes.data?.stats ?? {}),
    });

    setRecentOrders(ordersRes.data?.orders ?? []);
    setTopProducts(productsRes.data?.products ?? []);
    setRevenueChart(chartRes.data?.chart ?? []);
    setNotifications(notifsRes.data?.notifications ?? []);

    setLoading(false);

  }, [timeRange, orderTab]);

  // ── Run on mount + when filters change ───────────────────
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Update order status ───────────────────────────────────
  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    try {
      await api.patch(
        `/api/seller-dashboard/orders/${orderId}/status`,
        { status: newStatus }
      );

      // Refresh orders list
      const { data } = await api.get(
        `/api/seller-dashboard/orders?status=${orderTab}&limit=10`
      );
      setRecentOrders(data.orders ?? []);

      return { success: true };

    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message ?? "Failed to update order",
      };
    }
  }, [orderTab]);

  // ── Mark notification as read ─────────────────────────────
  const markNotifRead = useCallback(async (notifId) => {
    try {
      await api.patch(
        `/api/seller-dashboard/notifications/${notifId}/read`
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("[markNotifRead]", err.message);
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Is this a redirect error? ─────────────────────────────
  const shouldRedirect = errorCode && REDIRECT_CODES.has(errorCode);

  return {
    // Data
    vendor,
    stats,
    recentOrders,
    topProducts,
    revenueChart,
    notifications,
    unreadCount,

    // State
    loading,
    error,
    errorCode,
    shouldRedirect,   // ← convenience flag for SellerDashboard

    // Filters
    timeRange,     setTimeRange,
    orderTab,      setOrderTab,

    // UI
    sidebarOpen,   setSidebarOpen,
    activeSection, setActiveSection,

    // Actions
    updateOrderStatus,
    markNotifRead,
    refetch: fetchDashboard,
  };
};

export default useSellerDashboard;