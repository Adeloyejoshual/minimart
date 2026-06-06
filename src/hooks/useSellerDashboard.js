// hooks/useSellerDashboard.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

api.interceptors.request.use((cfg) => {
  // ✅ Use seller token (market.users)
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

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

export const useSellerDashboard = () => {
  const [vendor,        setVendor]        = useState(null);
  const [stats,         setStats]         = useState(DEFAULT_STATS);
  const [recentOrders,  setRecentOrders]  = useState([]);
  const [topProducts,   setTopProducts]   = useState([]);
  const [revenueChart,  setRevenueChart]  = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);  // ← NEW
  const [timeRange,     setTimeRange]     = useState("30d");
  const [orderTab,      setOrderTab]      = useState("all");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      // ── Step 1: Get vendor status ─────────────────────────
      // This uses requireSellerAccount — confirms market.users
      const vendorRes = await api.get("/api/seller-onboarding/status");

      if (!vendorRes.data?.vendor) {
        setError("No vendor account found");
        setErrorCode("NO_VENDOR");
        setLoading(false);
        return;
      }

      const vendorData = vendorRes.data.vendor;
      setVendor(vendorData);

      // ── Step 2: Only load dashboard data if active ────────
      if (!["active", "approved"].includes(vendorData.status)) {
        setLoading(false);
        return;
      }

      // ── Step 3: Load all dashboard data in parallel ───────
      const [
        statsRes,
        ordersRes,
        productsRes,
        chartRes,
        notifsRes,
      ] = await Promise.allSettled([
        api.get(`/api/seller-dashboard/stats?range=${timeRange}`),
        api.get(`/api/seller-dashboard/orders?status=${orderTab}&limit=10`),
        api.get("/api/seller-dashboard/top-products?limit=5"),
        api.get(`/api/seller-dashboard/revenue-chart?range=${timeRange}`),
        api.get("/api/seller-dashboard/notifications?limit=8"),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats({ ...DEFAULT_STATS, ...(statsRes.value.data.stats ?? {}) });
      }

      if (ordersRes.status === "fulfilled") {
        setRecentOrders(ordersRes.value.data.orders ?? []);
      }

      if (productsRes.status === "fulfilled") {
        setTopProducts(productsRes.value.data.products ?? []);
      }

      if (chartRes.status === "fulfilled") {
        setRevenueChart(chartRes.value.data.chart ?? []);
      }

      if (notifsRes.status === "fulfilled") {
        setNotifications(notifsRes.value.data.notifications ?? []);
      }

    } catch (err) {
      console.error("[useSellerDashboard]", err.message);

      const status = err.response?.status;
      const code   = err.response?.data?.code;

      // ✅ Handle specific error codes
      if (status === 403 && code === "NOT_SELLER_ACCOUNT") {
        setError("This account is not a seller account");
        setErrorCode("NOT_SELLER_ACCOUNT");
      } else if (status === 404 && code === "NO_VENDOR") {
        setError("No vendor account found");
        setErrorCode("NO_VENDOR");
      } else if (status === 401) {
        // Token expired or invalid → clear it
        localStorage.removeItem("token");
        setError("Session expired. Please sign in again.");
        setErrorCode("UNAUTHORIZED");
      } else {
        setError(err.response?.data?.message ?? "Failed to load dashboard");
        setErrorCode("UNKNOWN");
      }
    } finally {
      setLoading(false);
    }
  }, [timeRange, orderTab]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Update order status ────────────────────────────────────
  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    try {
      await api.patch(`/api/seller-dashboard/orders/${orderId}/status`, {
        status: newStatus,
      });
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

  // ── Mark notification read ─────────────────────────────────
  const markNotifRead = useCallback(async (notifId) => {
    try {
      await api.patch(`/api/seller-dashboard/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn("[markNotifRead]", err.message);
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    vendor,
    stats,
    recentOrders,
    topProducts,
    revenueChart,
    notifications,
    unreadCount,
    loading,
    error,
    errorCode,     // ← exposed so SellerDashboard can check it
    timeRange,     setTimeRange,
    orderTab,      setOrderTab,
    sidebarOpen,   setSidebarOpen,
    activeSection, setActiveSection,
    updateOrderStatus,
    markNotifRead,
    refetch: fetchDashboard,
  };
};

export default useSellerDashboard;