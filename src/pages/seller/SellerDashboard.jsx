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
// TOKEN KEY
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";
export const getSellerToken   = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// SHARED API
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
    display: flex;
    min-height: 100vh;
    background: #f1f5f9;
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
// TOKEN DIAGNOSTIC — runs once on mount in development
// Checks every possible key the token could be stored under
// ─────────────────────────────────────────────────────────────
const runTokenDiagnostic = () => {
  if (process.env.NODE_ENV !== "development") return;

  const keys = [
    "seller_token", "token", "seller_token",
    "auth_token", "jwt", "access_token", "sellerToken",
  ];

  console.group("🔍 [SellerDashboard] Token Diagnostic");
  keys.forEach((k) => {
    const val = localStorage.getItem(k);
    if (val) {
      console.log(`  ✅ Found "${k}":`, val.slice(0, 40) + "...");
    } else {
      console.log(`  ❌ "${k}": not found`);
    }
  });

  const sellerToken = localStorage.getItem("seller_token");
  if (!sellerToken) {
    console.warn(
      "  ⚠️  seller_token is MISSING.\n"
      + "  Make sure BecomeSeller saves as:\n"
      + '  localStorage.setItem("seller_token", token)'
    );
  }
  console.groupEnd();
};

// ─────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────
const LoadingScreen = ({ stage, timeoutHit }) => (
  <div style={css.loadWrap}>
    <div style={css.loadCard}>
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🛒</div>
      <div style={css.spinner} />
      <p style={{
        color:    "#6b7280",
        margin:   0,
        fontSize: "0.9rem",
      }}>
        {timeoutHit
          ? "Server is waking up, please wait…"
          : stage === "notifications"
            ? "Almost ready…"
            : "Loading your dashboard…"
        }
      </p>
      {timeoutHit && (
        <button
          onClick={sellerSignOut}
          style={{
            background:     "none",
            border:         "none",
            color:          "#9ca3af",
            cursor:         "pointer",
            fontSize:       "0.8rem",
            textDecoration: "underline",
            padding:        0,
            fontFamily:     "inherit",
          }}
        >
          ← Back to login
        </button>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// ERROR SCREEN
// ─────────────────────────────────────────────────────────────
const ErrorScreen = ({ error, code, raw, onRetry }) => {
  // Map known codes → friendly messages
  const MESSAGES = {
    NO_TOKEN:
      "No seller account found. Please sign in.",
    NOT_SELLER_ACCOUNT:
      "This account is not registered as a seller.\n"
      + "Please use your seller credentials.",
    ACCOUNT_SUSPENDED:
      "Your seller account has been suspended. Contact support.",
    NO_VENDOR:
      "No store found. Please complete seller setup.",
    VENDOR_NOT_ACTIVE:
      "Your store is pending approval. Check back soon.",
    TOKEN_EXPIRED:
      "Your session has expired. Please sign in again.",
    INVALID_TOKEN:
      "Invalid session. Please sign in again.",
    TIMEOUT:
      "Connection timed out. The server may be starting up.",
    NETWORK:
      "Could not reach the server. Check your connection.",
  };

  const isAuthErr = [
    "NO_TOKEN", "TOKEN_EXPIRED",
    "INVALID_TOKEN", "NOT_SELLER_ACCOUNT",
    "ACCOUNT_SUSPENDED",
  ].includes(code);

  const isOnboardingErr = [
    "NO_VENDOR", "VENDOR_NOT_ACTIVE",
  ].includes(code);

  const friendlyMsg = MESSAGES[code] ?? error ?? "Something went wrong.";

  return (
    <div style={css.loadWrap}>
      <div style={{ ...css.loadCard, maxWidth: "420px" }}>
        <span style={{ fontSize: "2.5rem" }}>
          {isAuthErr ? "🔐" : isOnboardingErr ? "🏪" : "⚠️"}
        </span>

        <h2 style={{
          color:     "#1f2937",
          margin:    "0.25rem 0 0.35rem",
          fontSize:  "1.1rem",
          fontWeight:800,
          textAlign: "center",
        }}>
          {isAuthErr        ? "Sign In Required"
           : isOnboardingErr ? "Store Not Ready"
           : "Dashboard Error"}
        </h2>

        <p style={{
          color:     "#6b7280",
          fontSize:  "0.875rem",
          textAlign: "center",
          margin:    "0 0 1rem",
          lineHeight:1.55,
          whiteSpace:"pre-line",
        }}>
          {friendlyMsg}
        </p>

        {/* Full debug info shown in dev only */}
        {process.env.NODE_ENV === "development" && (
          <div style={{
            background:   "#f3f4f6",
            borderRadius: "8px",
            padding:      "0.75rem",
            width:        "100%",
            marginBottom: "1rem",
            textAlign:    "left",
          }}>
            <p style={{
              fontFamily: "monospace",
              fontSize:   "0.72rem",
              color:      "#374151",
              margin:     0,
              whiteSpace: "pre-wrap",
              wordBreak:  "break-all",
            }}>
              {JSON.stringify({ code, error, raw }, null, 2)}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{
          display:       "flex",
          flexDirection: "column",
          gap:           "0.5rem",
          width:         "100%",
        }}>

          {/* Retry — not for auth errors */}
          {!isAuthErr && !isOnboardingErr && (
            <button onClick={onRetry} style={css.primaryBtn}>
              🔄 Try Again
            </button>
          )}

          {/* Go to onboarding */}
          {isOnboardingErr && (
            <button
              onClick={() => {
                window.location.href = "/become-seller";
              }}
              style={css.primaryBtn}
            >
              🏪 Go to Store Setup
            </button>
          )}

          {/* Sign out / back to login */}
          <button
            onClick={sellerSignOut}
            style={css.secondaryBtn}
          >
            ↩ {isAuthErr ? "Sign In to Seller" : "Sign Out"}
          </button>

        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { tab: tabParam } = useParams();

  const [activePage,  setActivePage]  = useState(
    tabFromParam(tabParam)
  );
  const [vendor,      setVendor]      = useState(null);

  // Loading has three stages:
  // "vendor"        → fetching /api/seller-onboarding/status
  // "notifications" → loading notifications (non-blocking)
  // false           → done
  const [loadStage,   setLoadStage]   = useState("vendor");
  const [loading,     setLoading]     = useState(true);

  const [error,       setError]       = useState(null);
  const [errorCode,   setErrorCode]   = useState(null);
  const [errorRaw,    setErrorRaw]    = useState(null);
  const [timeoutHit,  setTimeoutHit]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications,setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Inject CSS once ──────────────────────────────────────
  useEffect(() => {
    const id = "sd-global-css";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }, []);

  // ── Token diagnostic (dev only) ──────────────────────────
  useEffect(() => {
    runTokenDiagnostic();
  }, []);

  // ── Sync tab from URL param ──────────────────────────────
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  // ── Close sidebar on page change ─────────────────────────
  useEffect(() => {
    setSidebarOpen(false);
  }, [activePage]);

  // ── Load vendor ──────────────────────────────────────────
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();

    // ── No token ─────────────────────────────────────────
    if (!token) {
      setError("No seller account found.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadStage("vendor");
    setError(null);
    setErrorCode(null);
    setErrorRaw(null);
    setTimeoutHit(false);

    // Show slow-server message after 7s
    const slowTimer = setTimeout(() => setTimeoutHit(true), 7_000);

    try {
      console.log(
        "[SellerDashboard] calling /api/seller-onboarding/status",
        "token:", token.slice(0, 30) + "..."
      );

      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status"
      );

      console.log("[SellerDashboard] status response:", data);

      // ── vendor returned ───────────────────────────────
      if (data.vendor) {
        const { status } = data.vendor;

        if (["active", "approved"].includes(status)) {
          // ✅ All good
          setVendor(data.vendor);
        } else {
          // Vendor exists but not active yet
          setError(`Your store status is: ${status}`);
          setErrorCode("VENDOR_NOT_ACTIVE");
        }
      } else if (data.success === false) {
        // Server returned success:false with a code
        setError(data.message ?? "Unknown error");
        setErrorCode(data.code ?? "UNKNOWN");
      } else {
        // success:true but no vendor
        setError("No vendor found.");
        setErrorCode("NO_VENDOR");
      }

    } catch (err) {
      const httpStatus  = err.response?.status;
      const serverCode  = err.response?.data?.code;
      const serverMsg   = err.response?.data?.message;
      const networkCode = err.code; // ECONNABORTED, ERR_NETWORK etc.

      console.error("[SellerDashboard] loadVendor error:", {
        httpStatus,
        serverCode,
        serverMsg,
        networkCode,
        axiosMessage: err.message,
        responseData: err.response?.data,
      });

      setErrorRaw({
        httpStatus,
        serverCode,
        networkCode,
        axiosMessage: err.message,
      });

      // ── 401 Unauthorized ─────────────────────────────
      if (httpStatus === 401) {
        localStorage.removeItem(SELLER_TOKEN_KEY);
        setError("Session expired. Please sign in again.");
        setErrorCode(serverCode ?? "TOKEN_EXPIRED");
        return;
      }

      // ── 403 Forbidden ────────────────────────────────
      if (httpStatus === 403) {
        setError(serverMsg ?? "Access denied.");
        setErrorCode(serverCode ?? "FORBIDDEN");
        return;
      }

      // ── 404 Not found ────────────────────────────────
      if (httpStatus === 404) {
        setError(serverMsg ?? "No vendor found.");
        setErrorCode(serverCode ?? "NO_VENDOR");
        return;
      }

      // ── Network timeout ──────────────────────────────
      if (
        networkCode === "ECONNABORTED"
        || networkCode === "ERR_NETWORK"
        || !err.response
      ) {
        setError(
          "Connection timed out. "
          + "The server may be starting up — please retry."
        );
        setErrorCode("TIMEOUT");
        return;
      }

      // ── Known server code ────────────────────────────
      if (serverCode) {
        setError(serverMsg ?? serverCode);
        setErrorCode(serverCode);
        return;
      }

      // ── Fallback ──────────────────────────────────────
      setError(serverMsg ?? err.message ?? "Unexpected error.");
      setErrorCode("UNKNOWN");

    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadStage(false);
    }
  }, []);

  // ── Load notifications (non-blocking) ───────────────────
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
    } catch (err) {
      // Non-critical — notifications failing should
      // never break the dashboard
      console.warn(
        "[SellerDashboard] notifications failed:",
        err.message
      );
    }
  }, []);

  // ── Mark single notif read ───────────────────────────────
  const markNotifRead = useCallback(async (id) => {
    try {
      await sellerApi.patch(
        `/api/seller-dashboard/notifications/${id}/read`
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, []);

  // ── Mark all read ────────────────────────────────────────
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

  // ── Run on mount ─────────────────────────────────────────
  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  // ── Load notifications once vendor is confirmed ──────────
  useEffect(() => {
    if (!vendor) return;
    loadNotifications();
    const t = setInterval(loadNotifications, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications]);

  // ─────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────

  // 1. No token → redirect immediately (don't even show loading)
  const token = getSellerToken();
  if (!token && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  // 2. Loading
  if (loading) {
    return (
      <LoadingScreen
        stage={loadStage}
        timeoutHit={timeoutHit}
      />
    );
  }

  // 3. Vendor not active → back to onboarding
  if (
    errorCode === "VENDOR_NOT_ACTIVE"
    || errorCode === "NO_VENDOR"
  ) {
    return <Navigate to="/become-seller" replace />;
  }

  // 4. Error
  if (error || !vendor) {
    return (
      <ErrorScreen
        error={error}
        code={errorCode}
        raw={errorRaw}
        onRetry={() => {
          setError(null);
          setErrorCode(null);
          setErrorRaw(null);
          loadVendor();
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────
  // DASHBOARD RENDER
  // ─────────────────────────────────────────────────────────
  const navigate = (page) => {
    if (!VALID_TABS.includes(page)) return;
    setActivePage(page);
    window.history.replaceState(
      null, "", `/seller/dashboard/${page}`
    );
  };

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

        {/* Main */}
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

// ─────────────────────────────────────────────────────────────
// STYLES
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
    background:    "white",
    borderRadius:  "24px",
    padding:       "3rem 2.5rem",
    boxShadow:     "0 4px 32px rgba(0,0,0,0.08)",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "1.25rem",
    width:         "100%",
    maxWidth:      "360px",
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
  primaryBtn: {
    padding:      "0.85rem 2rem",
    background:   "#6366f1",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.9rem",
    width:        "100%",
    fontFamily:   "inherit",
    transition:   "opacity 0.15s",
  },
  secondaryBtn: {
    padding:      "0.85rem 2rem",
    background:   "#fef2f2",
    color:        "#ef4444",
    border:       "1px solid #fecaca",
    borderRadius: "12px",
    fontWeight:   600,
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