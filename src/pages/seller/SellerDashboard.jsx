// pages/seller/SellerDashboard.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Overview from "./Overview";
import Orders from "./Orders";
import Products from "./Products";
import Analytics from "./Analytics";
import Payouts from "./Payouts";
import Settings from "./Settings";

// ── Shared API helper (always market.users token) ─────────────
export const sellerApi = {
  get: (url, params) =>
    axios.get(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      params,
      timeout: 15_000,
    }),
  post: (url, data) =>
    axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      timeout: 15_000,
    }),
  patch: (url, data) =>
    axios.patch(url, data, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      timeout: 15_000,
    }),
};

export default function SellerDashboard({ user }) {
  const [vendor,        setVendor]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [activePage,    setActivePage]    = useState("overview");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const token = localStorage.getItem("token");

  // ── Load vendor via onboarding status ────────────────────
  const loadVendor = useCallback(async () => {
    if (!token) { setError("NO_TOKEN"); setLoading(false); return; }
    try {
      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status"
      );
      setVendor(data.vendor);
    } catch (err) {
      const code = err.response?.data?.code;
      setError(code ?? err.response?.data?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Load notifications ────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/notifications",
        { limit: 10 }
      );
      if (data.success) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(
          (data.notifications ?? []).filter((n) => !n.read).length
        );
      }
    } catch { /* silent */ }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await sellerApi.patch(
        `/api/seller-dashboard/notifications/${id}/read`
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadVendor(); },        [loadVendor]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Poll notifications every 60 s
  useEffect(() => {
    const t = setInterval(loadNotifications, 60_000);
    return () => clearInterval(t);
  }, [loadNotifications]);

  // Close sidebar on page change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  // ── Guards ────────────────────────────────────────────────
  if (!token) return <Navigate to="/become-seller" replace />;

  if (loading) {
    return (
      <div style={shell.loadWrap}>
        <div style={shell.logoMark}>🛒</div>
        <div style={shell.spinnerLg} />
        <p style={{ color: "#6b7280", marginTop: "1rem" }}>
          Loading your store...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shell.loadWrap}>
        <div style={shell.errorCard}>
          <span style={{ fontSize: "2.5rem" }}>⚠️</span>
          <h2 style={{ color: "#1f2937", margin: "0.75rem 0 0.4rem",
            fontSize: "1.15rem" }}>
            Dashboard Load Failed
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem",
            fontSize: "0.875rem", textAlign: "center" }}>
            {error}
          </p>
          <button
            onClick={() => { setError(null); setLoading(true);
              loadVendor(); }}
            style={shell.retryBtn}
          >
            🔄 Retry
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/become-seller";
            }}
            style={{ ...shell.retryBtn, marginTop: "0.5rem",
              background: "#fef2f2", color: "#ef4444",
              border: "1px solid #fecaca" }}
          >
            ↩ Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!vendor || !["active", "approved"].includes(vendor?.status)) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Page map ──────────────────────────────────────────────
  const pages = {
    overview:  (
      <Overview
        vendor={vendor}
        onNavigate={setActivePage}
      />
    ),
    orders:    <Orders  vendor={vendor} />,
    products:  <Products vendor={vendor} />,
    analytics: <Analytics vendor={vendor} />,
    payouts:   <Payouts vendor={vendor} />,
    settings:  (
      <Settings
        vendor={vendor}
        onVendorUpdate={setVendor}
      />
    ),
  };

  return (
    <>
      <style>{globalCSS}</style>

      <div style={shell.root}>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={shell.mobileOverlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <Sidebar
          vendor={vendor}
          activePage={activePage}
          onNavigate={setActivePage}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadCount={unreadCount}
        />

        {/* Main */}
        <div style={shell.main}>
          <TopBar
            vendor={vendor}
            activePage={activePage}
            onMenuClick={() => setSidebarOpen(true)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={async () => {
              const unread = notifications.filter((n) => !n.read);
              await Promise.all(
                unread.map((n) =>
                  sellerApi.patch(
                    `/api/seller-dashboard/notifications/${n.id}/read`
                  ).catch(() => {})
                )
              );
              setNotifications((prev) =>
                prev.map((n) => ({ ...n, read: true }))
              );
              setUnreadCount(0);
            }}
          />

          <div style={shell.pageWrap}>
            <div key={activePage} style={{ animation: "sdFadeIn 0.2s ease" }}>
              {pages[activePage] ?? pages.overview}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

const globalCSS = `
  @keyframes sdFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes sdShimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont,
    "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
  }
  button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
`;

const shell = {
  root: {
    display:    "flex",
    minHeight:  "100vh",
    background: "#f1f5f9",
  },
  main: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    minWidth:      0,
    overflow:      "hidden",
  },
  pageWrap: {
    flex:      1,
    overflowY: "auto",
    padding:   "1.5rem",
  },
  loadWrap: {
    minHeight:      "100vh",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    background:     "#f9fafb",
    padding:        "2rem",
  },
  logoMark: {
    fontSize:     "3rem",
    marginBottom: "1.5rem",
    lineHeight:   1,
  },
  spinnerLg: {
    width:        "44px",
    height:       "44px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
  },
  errorCard: {
    background:    "white",
    borderRadius:  "20px",
    padding:       "2.5rem 2rem",
    textAlign:     "center",
    boxShadow:     "0 4px 24px rgba(0,0,0,0.08)",
    maxWidth:      "360px",
    width:         "100%",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
  },
  retryBtn: {
    padding:      "0.8rem 2rem",
    background:   "#6366f1",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.9rem",
    width:        "100%",
  },
  mobileOverlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.5)",
    zIndex:         99,
    backdropFilter: "blur(2px)",
  },
};