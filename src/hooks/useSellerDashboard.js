// hooks/useSellerDashboard.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

api.interceptors.request.use((cfg) => {
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
  const [errorCode,     setErrorCode]     = useState(null);
  const [timeRange,     setTimeRange]     = useState("30d");
  const [orderTab,      setOrderTab]      = useState("all");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorCode(null);

    const token = localStorage.getItem("token");

    // ── No token → not logged in ──────────────────────────
    if (!token) {
      setError("No seller token. Please sign in.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    try {
      // ── Step 1: Get vendor status ─────────────────────────
      let vendorData = null;

      try {
        const vendorRes = await api.get("/api/seller-onboarding/status");

        if (vendorRes.data?.vendor) {
          vendorData = vendorRes.data.vendor;
          setVendor(vendorData);
        } else {
          setError("No vendor account found");
          setErrorCode("NO_VENDOR");
          setLoading(false);
          return;
        }

      } catch (vendorErr) {
        console.error("[useSellerDashboard] vendor status error:", {
          status:  vendorErr.response?.status,
          code:    vendorErr.response?.data?.code,
          message: vendorErr.response?.data?.message,
        });

        const status = vendorErr.response?.status;
        const code   = vendorErr.response?.data?.code;

        if (status === 403 && code === "NOT_SELLER_ACCOUNT") {
          setErrorCode("NOT_SELLER_ACCOUNT");
          setError("NOT_SELLER_ACCOUNT");
        } else if (status === 404) {
          setErrorCode("NO_VENDOR");
          setError("NO_VENDOR");
        } else if (status === 401) {
          localStorage.removeItem("token");
          setErrorCode("UNAUTHORIZED");
          setError("Session expired. Please sign in.");
        } else {
          // ✅ Real server error — show dashboard error screen
          setError(
            vendorErr.response?.data?.message ??
            "Failed to load vendor status"
          );
          setErrorCode("SERVER_ERROR");
        }

        setLoading(false);
        return;
      }

      // ── Step 2: Not active → don't load dashboard data ───
      if (!["active", "approved"].includes(vendorData.status)) {
        setLoading(false);
        return;
      }

      // ── Step 3: Load dashboard data ───────────────────────
      // Use Promise.allSettled so one failure doesn't kill all
      const [
        statsRes,
        ordersRes,
        productsRes,
        chartRes,
        notifsRes,
      ] = await Promise.allSettled([
        api.get(`/api/seller-dashboard/stats?range=${timeRange}`)
          .catch((e) => {
            console.warn("[dashboard] stats failed:", e.response?.status, e.message);
            return { data: { stats: DEFAULT_STATS } };
          }),
        api.get(`/api/seller-dashboard/orders?status=${orderTab}&limit=10`)
          .catch((e) => {
            console.warn("[dashboard] orders failed:", e.message);
            return { data: { orders: [] } };
          }),
        api.get("/api/seller-dashboard/top-products?limit=5")
          .catch((e) => {
            console.warn("[dashboard] products failed:", e.message);
            return { data: { products: [] } };
          }),
        api.get(`/api/seller-dashboard/revenue-chart?range=${timeRange}`)
          .catch((e) => {
            console.warn("[dashboard] chart failed:", e.message);
            return { data: { chart: [] } };
          }),
        api.get("/api/seller-dashboard/notifications?limit=8")
          .catch(() => ({ data: { notifications: [] } })),
      ]);

      // ── Extract results safely ────────────────────────────
      if (statsRes.status === "fulfilled") {
        setStats({
          ...DEFAULT_STATS,
          ...(statsRes.value?.data?.stats ?? {}),
        });
      }

      if (ordersRes.status === "fulfilled") {
        setRecentOrders(ordersRes.value?.data?.orders ?? []);
      }

      if (productsRes.status === "fulfilled") {
        setTopProducts(productsRes.value?.data?.products ?? []);
      }

      if (chartRes.status === "fulfilled") {
        setRevenueChart(chartRes.value?.data?.chart ?? []);
      }

      if (notifsRes.status === "fulfilled") {
        setNotifications(notifsRes.value?.data?.notifications ?? []);
      }

    } catch (err) {
      console.error("[useSellerDashboard] unexpected error:", {
        message: err.message,
        status:  err.response?.status,
        data:    err.response?.data,
      });

      setError(err.response?.data?.message ?? "Failed to load dashboard");
      setErrorCode("UNKNOWN");
    } finally {
      setLoading(false);
    }
  }, [timeRange, orderTab]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    try {
      await api.patch(
        `/api/seller-dashboard/orders/${orderId}/status`,
        { status: newStatus }
      );
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
    errorCode,
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