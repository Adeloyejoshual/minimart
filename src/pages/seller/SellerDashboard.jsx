// pages/seller/SellerDashboard.jsx
import React, {
  useState, useEffect, useCallback, createContext, useContext,
} from "react";
import { Navigate, useParams } from "react-router-dom";
import axios from "axios";

// ── Child pages ───────────────────────────────────────────────
import Overview  from "./Overview";
import Orders    from "./Orders";
import Products  from "./Products";
import Analytics from "./Analytics";
import Payouts   from "./Payouts";
import Settings  from "./Settings";

// ── Child components ──────────────────────────────────────────
import Sidebar from "./components/Sidebar";
import TopBar  from "./components/TopBar";

// ─────────────────────────────────────────────────────────────
// TOKEN KEY — seller_token (market.users)
// NEVER reads marketplace_token
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";

export const getSellerToken = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// SHARED SELLER API — all dashboard calls use this
// ─────────────────────────────────────────────────────────────
export const sellerApi = {
  get: (url, params) =>
    axios.get(url, {
      headers: {
        Authorization: `Bearer ${getSellerToken()}`,
      },
      params,
      timeout: 15_000,
    }),

  post: (url, data) =>
    axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${getSellerToken()}`,
      },
      timeout: 15_000,
    }),

  patch: (url, data) =>
    axios.patch(url, data, {
      headers: {
        Authorization: `Bearer ${getSellerToken()}`,
      },
      timeout: 15_000,
    }),

  put: (url, data) =>
    axios.put(url, data, {
      headers: {
        Authorization: `Bearer ${getSellerToken()}`,
      },
      timeout: 15_000,
    }),

  delete: (url) =>
    axios.delete(url, {
      headers: {
        Authorization: `Bearer ${getSellerToken()}`,
      },
      timeout: 15_000,
    }),
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD CONTEXT
// Provides vendor + helpers to all child pages/components
// ─────────────────────────────────────────────────────────────
const DashboardContext = createContext(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error(
    "useDashboard must be used inside SellerDashboard"
  );
  return ctx;
};

// ─────────────────────────────────────────────────────────────
// VALID PAGES + URL TAB MAP
// ─────────────────────────────────────────────────────────────
const VALID_TABS = [
  "overview", "orders", "products",
  "analytics", "payouts", "settings",
];

const tabFromParam = (param) =>
  VALID_TABS.includes(param) ? param : "overview";

// ─────────────────────────────────────────────────────────────
// SIGN OUT
// ─────────────────────────────────────────────────────────────
export const sellerSignOut = () => {
  localStorage.removeItem(SELLER_TOKEN_KEY);
  window.location.href = "/become-seller";
};

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={css.loadWrap}>
    <div style={css.loadCard}>
      <div style={css.loadLogo}>🛒</div>
      <div style={css.spinner} />
      <p style={{ color: "#6b7280", margin: 0, fontSize: "0.9rem" }}>
        Loading your dashboard…
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// ERROR SCREEN
// ─────────────────────────────────────────────────────────────
const ErrorScreen = ({ error, onRetry }) => (
  <div style={css.loadWrap}>
    <div style={{ ...css.loadCard, maxWidth: "380px" }}>
      <span style={{ fontSize: "2.5rem" }}>⚠️</span>
      <h2 style={{
        color:     "#1f2937",
        margin:    "0.75rem 0 0.4rem",
        fontSize:  "1.15rem",
        fontWeight:800,
      }}>
        Dashboard Unavailable
      </h2>
      <p style={{
        color:     "#6b7280",
        fontSize:  "0.875rem",
        textAlign: "center",
        margin:    "0 0 1.5rem",
      }}>
        {error}
      </p>
      <button onClick={onRetry} style={css.retryBtn}>
        🔄 Try Again
      </button>
      <button
        onClick={sellerSignOut}
        style={{
          ...css.retryBtn,
          marginTop:  "0.5rem",
          background: "#fef2f2",
          color:      "#ef4444",
          border:     "1px solid #fecaca",
        }}
      >
        ↩ Back to Login
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS (injected once)
// ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes sdFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes sdShimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes sdPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont,
      "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }
  input, textarea, select {
    font-family: inherit;
  }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
  }
  button:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }
  /* Seller dashboard root — prevents body scroll bleed */
  .sd-root {
    display: flex;
    min-height: 100vh;
    background: #f1f5f9;
    position: relative;
  }
  .sd-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .sd-page-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }
  .sd-page-anim {
    animation: sdFadeIn 0.2s ease;
  }
  /* Mobile: sidebar hidden off-screen by default */
  @media (max-width: 768px) {
    .sd-sidebar-desktop {
      display: none !important;
    }
  }
  @media (min-width: 769px) {
    .sd-sidebar-mobile {
      display: none !important;
    }
    .sd-mobile-overlay {
      display: none !important;
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  // ── URL-driven active tab ─────────────────────────────────
  const { tab: tabParam } = useParams();
  const [activePage,    setActivePage]    = useState(
    tabFromParam(tabParam)
  );
  const [vendor,        setVendor]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // ── Inject global CSS once ────────────────────────────────
  useEffect(() => {
    const id  = "sd-global-css";
    if (!document.getElementById(id)) {
      const el  = document.createElement("style");
      el.id     = id;
      el.textContent = GLOBAL_CSS;
      document.head.appendChild(el);
    }
    return () => {
      // Don't remove on unmount — keeps styles for re-mounts
    };
  }, []);

  // ── Sync tab from URL param ───────────────────────────────
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  // ── Close sidebar on page change ──────────────────────────
  useEffect(() => {
    setSidebarOpen(false);
  }, [activePage]);

  // ── Load vendor via onboarding status ─────────────────────
  // Uses: GET /api/seller-onboarding/status
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();

    if (!token) {
      setError("No seller account found. Please sign in.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status"
      );

      if (!data.vendor) {
        setError("Vendor account not found.");
        return;
      }

      if (!["active", "approved"].includes(data.vendor.status)) {
        // Not yet active — send back to onboarding
        setError(`REDIRECT_ONBOARDING:${data.vendor.status}`);
        return;
      }

      setVendor(data.vendor);

    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message;
      const st   = err.response?.status;

      if (st === 401 || code === "INVALID_TOKEN"
        || code === "TOKEN_EXPIRED") {
        localStorage.removeItem(SELLER_TOKEN_KEY);
        setError("Session expired. Please sign in again.");
        return;
      }

      setError(msg ?? "Failed to load seller account.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load notifications ─────────────────────────────────────
  // Uses: GET /api/seller-dashboard/notifications
  const loadNotifications = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/notifications",
        { limit: 15 }
      );
      if (data.success) {
        const notifs = data.notifications ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.read).length);
      }
    } catch { /* silent — non-critical */ }
  }, []);

  // ── Mark single notification read ─────────────────────────
  // Uses: PATCH /api/seller-dashboard/notifications/:id/read
  const markNotifRead = useCallback(async (id) => {
    try {
      await sellerApi.patch(
        `/api/seller-dashboard/notifications/${id}/read`
      );
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, []);

  // ── Mark all notifications read ───────────────────────────
  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    await Promise.allSettled(
      unread.map((n) =>
        sellerApi.patch(
          `/api/seller-dashboard/notifications/${n.id}/read`
        )
      )
    );
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  }, [notifications]);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  // ── Load notifications after vendor loads ─────────────────
  useEffect(() => {
    if (vendor) {
      loadNotifications();
      // Poll every 60 s
      const t = setInterval(loadNotifications, 60_000);
      return () => clearInterval(t);
    }
  }, [vendor, loadNotifications]);

  // ── Guards ────────────────────────────────────────────────
  const token = getSellerToken();

  if (!token) {
    return <Navigate to="/become-seller" replace />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  // Redirect back to onboarding if vendor not active
  if (error?.startsWith("REDIRECT_ONBOARDING:")) {
    return <Navigate to="/become-seller" replace />;
  }

  if (error) {
    return (
      <ErrorScreen
        error={error}
        onRetry={() => {
          setError(null);
          setLoading(true);
          loadVendor();
        }}
      />
    );
  }

  if (!vendor) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Navigation helper (updates state + URL) ───────────────
  const navigate = (page) => {
    if (!VALID_TABS.includes(page)) return;
    setActivePage(page);
    // Update URL without full reload
    window.history.replaceState(
      null, "", `/seller/dashboard/${page}`
    );
  };

  // ── Context value ─────────────────────────────────────────
  const contextValue = {
    vendor,
    setVendor,
    activePage,
    navigate,
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadVendor: loadVendor,
  };

  // ── Page map ──────────────────────────────────────────────
  const PAGE_MAP = {
    overview:  <Overview  />,
    orders:    <Orders    />,
    products:  <Products  />,
    analytics: <Analytics />,
    payouts:   <Payouts   />,
    settings:  <Settings  />,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="sd-root">

        {/* ── Mobile backdrop ─────────────────────────── */}
        {sidebarOpen && (
          <div
            className="sd-mobile-overlay"
            style={css.mobileOverlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Desktop sidebar (always visible ≥769px) ── */}
        <div className="sd-sidebar-desktop">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            isOpen
            onClose={() => {}}
          />
        </div>

        {/* ── Mobile sidebar (slide-in) ────────────────── */}
        {sidebarOpen && (
          <div
            className="sd-sidebar-mobile"
            style={css.mobileSidebar}
          >
            <Sidebar
              vendor={vendor}
              activePage={activePage}
              onNavigate={navigate}
              unreadCount={unreadCount}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              showClose
            />
          </div>
        )}

        {/* ── Main area ────────────────────────────────── */}
        <div className="sd-main">

          <TopBar
            vendor={vendor}
            activePage={activePage}
            onMenuClick={() => setSidebarOpen((v) => !v)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markNotifRead}
            onMarkAllRead={markAllRead}
          />

          <div className="sd-page-wrap">
            <div
              key={activePage}
              className="sd-page-anim"
            >
              {PAGE_MAP[activePage] ?? PAGE_MAP.overview}
            </div>
          </div>

        </div>
      </div>
    </DashboardContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES (non-className pieces)
// ─────────────────────────────────────────────────────────────
const css = {
  loadWrap: {
    minHeight:      "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "#f1f5f9",
    padding:        "2rem",
  },
  loadCard: {
    background:     "white",
    borderRadius:   "24px",
    padding:        "3rem 2.5rem",
    boxShadow:      "0 4px 32px rgba(0,0,0,0.08)",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            "1.25rem",
    width:          "100%",
    maxWidth:       "340px",
    textAlign:      "center",
  },
  loadLogo: {
    fontSize:       "3rem",
    lineHeight:     1,
  },
  spinner: {
    width:        "40px",
    height:       "40px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
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
    fontFamily:   "inherit",
  },
  mobileOverlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.5)",
    zIndex:         98,
    backdropFilter: "blur(2px)",
  },
  mobileSidebar: {
    position:  "fixed",
    top:       0,
    left:      0,
    height:    "100vh",
    zIndex:    99,
    animation: "sdFadeIn 0.2s ease",
  },
};