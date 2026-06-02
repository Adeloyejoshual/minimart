// hooks/useSellerDashboard.js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

// ─── API instance ─────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Constants ────────────────────────────────────────────────
export const TIME_RANGES = [
  { value: "7d",  label: "7 Days"   },
  { value: "30d", label: "30 Days"  },
  { value: "90d", label: "90 Days"  },
  { value: "all", label: "All Time" },
];

export const ORDER_TABS = [
  { value: "all",        label: "All",        color: "#6366f1" },
  { value: "pending",    label: "Pending",    color: "#f59e0b" },
  { value: "processing", label: "Processing", color: "#3b82f6" },
  { value: "shipped",    label: "Shipped",    color: "#8b5cf6" },
  { value: "delivered",  label: "Delivered",  color: "#10b981" },
  { value: "cancelled",  label: "Cancelled",  color: "#ef4444" },
];

// ─── Default empty stats ──────────────────────────────────────
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

// ═════════════════════════════════════════════════════════════
// HOOK — named export (this is what was missing)
// ═════════════════════════════════════════════════════════════
export const useSellerDashboard = () => {
  // ── State ──────────────────────────────────────────────────
  const [vendor,        setVendor]        = useState(null);
  const [stats,         setStats]         = useState(DEFAULT_STATS);
  const [recentOrders,  setRecentOrders]  = useState([]);
  const [topProducts,   setTopProducts]   = useState([]);
  const [revenueChart,  setRevenueChart]  = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [timeRange,     setTimeRange]     = useState("30d");
  const [orderTab,      setOrderTab]      = useState("all");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  // ── Fetch all dashboard data ───────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        vendorRes,
        statsRes,
        ordersRes,
        productsRes,
        chartRes,
        notifsRes,
      ] = await Promise.allSettled([
        api.get("/api/seller-onboarding/status"),
        api.get(`/api/seller-dashboard/stats?range=${timeRange}`),
        api.get(`/api/seller-dashboard/orders?status=${orderTab}&limit=10`),
        api.get("/api/seller-dashboard/top-products?limit=5"),
        api.get(`/api/seller-dashboard/revenue-chart?range=${timeRange}`),
        api.get("/api/seller-dashboard/notifications?limit=8"),
      ]);

      // ── Vendor ───────────────────────────────────────────
      if (vendorRes.status === "fulfilled") {
        setVendor(vendorRes.value.data.vendor ?? null);
      }

      // ── Stats ────────────────────────────────────────────
      if (statsRes.status === "fulfilled") {
        setStats({ ...DEFAULT_STATS, ...(statsRes.value.data.stats ?? {}) });
      } else {
        setStats(DEFAULT_STATS);
      }

      // ── Orders ───────────────────────────────────────────
      if (ordersRes.status === "fulfilled") {
        setRecentOrders(ordersRes.value.data.orders ?? []);
      } else {
        setRecentOrders([]);
      }

      // ── Top products ─────────────────────────────────────
      if (productsRes.status === "fulfilled") {
        setTopProducts(productsRes.value.data.products ?? []);
      } else {
        setTopProducts([]);
      }

      // ── Revenue chart ────────────────────────────────────
      if (chartRes.status === "fulfilled") {
        setRevenueChart(chartRes.value.data.chart ?? []);
      } else {
        setRevenueChart([]);
      }

      // ── Notifications ────────────────────────────────────
      if (notifsRes.status === "fulfilled") {
        setNotifications(notifsRes.value.data.notifications ?? []);
      } else {
        setNotifications([]);
      }

    } catch (err) {
      console.error("[useSellerDashboard] fetch error:", err.message);
      setError(err.response?.data?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [timeRange, orderTab]);

  // ── Run on mount + when timeRange / orderTab changes ───────
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Update order status ────────────────────────────────────
  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    try {
      await api.patch(`/api/seller-dashboard/orders/${orderId}/status`, {
        status: newStatus,
      });

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

  // ── Mark notification as read ──────────────────────────────
  const markNotifRead = useCallback(async (notifId) => {
    try {
      await api.patch(`/api/seller-dashboard/notifications/${notifId}/read`);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.warn("[markNotifRead] failed:", err.message);
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Return ────────────────────────────────────────────────
  return {
    // Data
    vendor,
    stats,
    recentOrders,
    topProducts,
    revenueChart,
    notifications,
    unreadCount,

    // UI state
    loading,
    error,
    timeRange,     setTimeRange,
    orderTab,      setOrderTab,
    sidebarOpen,   setSidebarOpen,
    activeSection, setActiveSection,

    // Actions
    updateOrderStatus,
    markNotifRead,
    refetch: fetchDashboard,
  };
};

// ─── Default export as well (belt + suspenders) ───────────────
export default useSellerDashboard;