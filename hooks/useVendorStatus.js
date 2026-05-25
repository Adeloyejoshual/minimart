// hooks/useVendorStatus.js
import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const useVendorStatus = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get("/seller/status");
      setData(res);
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Reapply action ────────────────────────────────────────
  const reapply = useCallback(async () => {
    await api.post("/seller/reapply");
    await fetch();
  }, [fetch]);

  // ── Derived state ─────────────────────────────────────────
  const derived = useMemo(() => {
    if (!data) return {};
    const { vendor, permissions, limits, ui } = data;
    return {
      vendor,
      permissions,
      limits,
      ui,
      status:      vendor?.status,
      isActive:    vendor?.status === "active",
      isApproved:  vendor?.status === "approved",
      isSuspended: vendor?.status === "suspended",
      isRejected:  vendor?.status === "rejected",
      isPending:   ["pending", "under_review"].includes(vendor?.status),
      // permission helpers
      can: (action) => permissions?.[action] === true,
      withinLimit: (type) => {
        if (type === "products") {
          const max = limits?.max_products;
          return max === null || (vendor?.products_count ?? 0) < max;
        }
        return true;
      },
    };
  }, [data]);

  return { ...derived, loading, error, refetch: fetch, reapply };
};