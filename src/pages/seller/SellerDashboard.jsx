// pages/seller/SellerDashboard.jsx
import React, {
  useState, useEffect, useCallback,
  createContext, useContext,
} from "react";
import { Navigate, useParams } from "react-router-dom";
import axios from "axios";

import Overview  from "./Overview";
import Orders    from "./Orders";
import Products  from "./Products";
import Analytics from "./Analytics";
import Payouts   from "./Payouts";
import Settings  from "./Settings";
import Sidebar   from "./components/Sidebar";
import TopBar    from "./components/TopBar";

// ─────────────────────────────────────────────────────────────
// TOKEN
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";
export const getSellerToken   = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// SHARED API — all seller calls go through here
// ─────────────────────────────────────────────────────────────
export const sellerApi = {
  get: (url, params) =>
    axios.get(url, {
      headers: { Authorization: `Bearer ${getSellerToken()}` },
      params,
      timeout: 15_000,
    }),
  post: (url, data) =>
    axios.post(url, data, {
      headers: { Authorization: `Bearer ${getSellerToken()}` },
      timeout: 15_000,
    }),
  patch: (url, data) =>
    axios.patch(url, data, {
      headers: { Authorization: `Bearer ${getSellerToken()}` },
      timeout: 15_000,
    }),
  put: (url, data) =>
    axios.put(url, data, {
      headers: { Authorization: `Bearer ${getSellerToken()}` },
      timeout: 15_000,
    }),
  delete: (url) =>
    axios.delete(url, {
      headers: { Authorization: `Bearer ${getSellerToken()}` },
      timeout: 15_000,
    }),
};

// ─────────────────────────────────────────────────────────────
// CONTEXT
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
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const VALID_TABS = [
  "overview", "orders", "products",
  "analytics", "payouts", "settings",
];

const tabFromParam = (p) =>
  VALID_TABS.includes(p) ? p : "overview";

export const sellerSignOut = () => {
  localStorage.removeItem(SELLER_TOKEN_KEY);
  window.location.href = "/become-seller";
};

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────
const LoadingScreen = ({ timeoutHit }) => (
  <div style={css.loadWrap}>
    <div style={css.loadCard}>
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🛒</div>
      <div style={css.spinner} />
      <p style={{ color: "#6b7280", margin: 0, fontSize: "0.9rem" }}>
        {timeoutHit
          ? "Still loading… server may be waking up"
          : "Loading your dashboard…"}
      </p>
      {timeoutHit && (
        <button
          onClick={sellerSignOut}
          style={{
            background:   "none",
            border:       "none",
            color:        "#9ca3af",
            cursor:       "pointer",
            fontSize:     "0.8rem",
            textDecoration:"underline",
            padding:      0,
            fontFamily:   "inherit",
          }}
        >
          Back to login
        </button>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// ERROR SCREEN
// ─────────────────────────────────────────────────────────────
const ErrorScreen = ({ error, code, onRetry }) => {
  // Show friendly messages for known codes
  const friendly = {
    NOT_SELLER_ACCOUNT:
      "This email is not registered as a seller account.",
    NO_VENDOR:
      "No store found. Please complete seller onboarding.",
    VENDOR_NOT_ACTIVE:
      "Your store is not yet active. Please wait for approval.",
    ACCOUNT_SUSPENDED:
      "Your seller account has been suspended.",
    TOKEN_EXPIRED:
      "Your session has expired. Please log in again.",
    INVALID_TOKEN:
      "Invalid session. Please log in again.",
    NO_TOKEN:
      "No seller account found. Please sign in.",
  };

  const msg = friendly[code] ?? error ?? "Something went wrong.";
  const isAuthError = [
    "TOKEN_EXPIRED", "INVALID_TOKEN", "NO_TOKEN",
    "NOT_SELLER_ACCOUNT",
  ].includes(code);

  return (
    <div style={css.loadWrap}>
      <div style={{ ...css.loadCard, maxWidth: "400px" }}>
        <span style={{ fontSize: "2.5rem" }}>
          {isAuthError ? "🔐" : "⚠️"}
        </span>

        <h2 style={{
          color:     "#1f2937",
          margin:    "0.5rem 0 0.3rem",
          fontSize:  "1.1rem",
          fontWeight:800,
          textAlign: "center",
        }}>
          {isAuthError ? "Sign In Required" : "Dashboard Unavailable"}
        </h2>

        <p style={{
          color:     "#6b7280",
          fontSize:  "0.875rem",
          textAlign: "center",
          margin:    "0 0 1.25rem",
          lineHeight:1.5,
        }}>
          {msg}
        </p>

        {/* Debug info in development */}
        {process.env.NODE_ENV === "development" && code && (
          <p style={{
            background:   "#f3f4f6",
            borderRadius: "8px",
            padding:      "0.5rem 0.75rem",
            fontSize:     "0.72rem",
            color:        "#6b7280",
            fontFamily:   "monospace",
            margin:       "0 0 1rem",
            width:        "100%",
            textAlign:    "center",
          }}>
            code: {code}
          </p>
        )}

        {!isAuthError && (
          <button onClick={onRetry} style={css.retryBtn}>
            🔄 Try Again
          </button>
        )}

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
          ↩ {isAuthError ? "Back to Sign In" : "Sign Out"}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS
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
    background: #d1d5db; border-radius: 10px;
  }
  input, textarea, select { font-family: inherit; }
  input:focus, textarea:focus, select:focus {
    outline: none !important;
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important;
  }
  button:focus-visible {
    outline: 2px solid #6366f1; outline-offset: 2px;
  }
  .sd-root {
    display: flex; min-height: 100vh; background: #f1f5f9;
  }
  .sd-main {
    flex: 1; display: flex; flex-direction: column;
    min-width: 0; overflow: hidden;
  }
  .sd-page-wrap {
    flex: 1; overflow-y: auto; padding: 1.5rem;
  }
  .sd-page-anim { animation: sdFadeIn 0.2s ease; }
  @media (max-width: 768px) {
    .sd-sidebar-desktop { display: none !important; }
    .sd-page-wrap { padding: 1rem !important; }
  }
  @media (min-width: 769px) {
    .sd-menu-btn { display: none !important; }
  }
`;

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { tab: tabParam } = useParams();

  const [activePage,    setActivePage]    = useState(
    tabFromParam(tabParam)
  );
  const [vendor,        setVendor]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);
  const [timeoutHit,    setTimeoutHit]    = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // Inject CSS once
  useEffect(() => {
    const id = "sd-global-css";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }, []);

  // Sync tab from URL
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  // Close sidebar on nav
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  // ── Load vendor ─────────────────────────────────────────
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();

    // Guard: no token
    if (!token) {
      setError("No seller account found. Please sign in.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);
    setTimeoutHit(false);

    // Show "still loading" message after 6s
    const slowTimer = setTimeout(() => setTimeoutHit(true), 6_000);

    try {
      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status"
      );

      // ── Success path ──────────────────────────────
      if (data.vendor) {
        const status = data.vendor.status;

        if (["active", "approved"].includes(status)) {
          setVendor(data.vendor);
          // ✅ All good — render dashboard
        } else {
          // Vendor exists but not yet active
          setError(`Vendor status: ${status}`);
          setErrorCode("VENDOR_NOT_ACTIVE");
        }
      } else {
        setError("No vendor account found.");
        setErrorCode("NO_VENDOR");
      }

    } catch (err) {
      const status  = err.response?.status;
      const code    = err.response?.data?.code;
      const message = err.response?.data?.message;

      console.error("[SellerDashboard] loadVendor error:", {
        status, code, message,
        networkError: err.message,
      });

      // ── Auth errors → clear token ─────────────────
      if (
        status === 401
        || code === "INVALID_TOKEN"
        || code === "TOKEN_EXPIRED"
      ) {
        localStorage.removeItem(SELLER_TOKEN_KEY);
        setError("Session expired. Please sign in again.");
        setErrorCode(code ?? "TOKEN_EXPIRED");
        return;
      }

      // ── Known server codes ────────────────────────
      if (code) {
        setError(message ?? code);
        setErrorCode(code);
        return;
      }

      // ── Network / timeout ─────────────────────────
      if (err.code === "ECONNABORTED" || !err.response) {
        setError(
          "Connection timed out. "
          + "The server may be starting up — please retry."
        );
        setErrorCode("TIMEOUT");
        return;
      }

      // ── Unknown error ─────────────────────────────
      setError(message ?? "Failed to load seller account.");
      setErrorCode("UNKNOWN");

    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
    }
  }, []);

  // ── Load notifications ──────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller-dashboard/notifications", { limit: 15 }
      );
      if (data.success) {
        const notifs = data.notifications ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.read).length);
      }
    } catch { /* silent */ }
  }, []);

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

  // Initial load
  useEffect(() => { loadVendor(); }, [loadVendor]);

  // Poll notifications once vendor loads
  useEffect(() => {
    if (!vendor) return;
    loadNotifications();
    const t = setInterval(loadNotifications, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications]);

  // ── Route guards ────────────────────────────────────────
  const token = getSellerToken();

  // 1. No token at all → redirect immediately (no loading)
  if (!token) {
    return <Navigate to="/become-seller" replace />;
  }

  // 2. Loading
  if (loading) {
    return <LoadingScreen timeoutHit={timeoutHit} />;
  }

  // 3. Vendor not active → redirect to onboarding
  if (errorCode === "VENDOR_NOT_ACTIVE") {
    return <Navigate to="/become-seller" replace />;
  }

  // 4. No vendor → redirect to onboarding
  if (errorCode === "NO_VENDOR") {
    return <Navigate to="/become-seller" replace />;
  }

  // 5. Any other error → show error screen
  if (error || !vendor) {
    return (
      <ErrorScreen
        error={error}
        code={errorCode}
        onRetry={() => {
          setError(null);
          setErrorCode(null);
          loadVendor();
        }}
      />
    );
  }

  // ── Navigation ──────────────────────────────────────────
  const navigate = (page) => {
    if (!VALID_TABS.includes(page)) return;
    setActivePage(page);
    window.history.replaceState(
      null, "", `/seller/dashboard/${page}`
    );
  };

  // ── Context ─────────────────────────────────────────────
  const ctx = {
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

  const PAGE_MAP = {
    overview:  <Overview  />,
    orders:    <Orders    />,
    products:  <Products  />,
    analytics: <Analytics />,
    payouts:   <Payouts   />,
    settings:  <Settings  />,
  };

  return (
    <DashboardContext.Provider value={ctx}>
      <div className="sd-root">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={css.mobileOverlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Desktop sidebar */}
        <div className="sd-sidebar-desktop">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            onClose={() => {}}
          />
        </div>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div style={css.mobileSidebar}>
            <Sidebar
              vendor={vendor}
              activePage={activePage}
              onNavigate={navigate}
              unreadCount={unreadCount}
              onClose={() => setSidebarOpen(false)}
              showClose
            />
          </div>
        )}

        {/* Main content */}
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
            <div key={activePage} className="sd-page-anim">
              {PAGE_MAP[activePage] ?? PAGE_MAP.overview}
            </div>
          </div>
        </div>

      </div>
    </DashboardContext.Provider>
  );
}

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
    background:    "white",
    borderRadius:  "24px",
    padding:       "3rem 2.5rem",
    boxShadow:     "0 4px 32px rgba(0,0,0,0.08)",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "1.25rem",
    width:         "100%",
    maxWidth:      "340px",
    textAlign:     "center",
  },
  spinner: {
    width:        "40px",
    height:       "40px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    flexShrink:   0,
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