// pages/seller/SellerDashboard.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

import Overview  from "./Overview";
import Orders    from "./Orders";
import Products  from "./Products";
import Analytics from "./Analytics";
import Payouts   from "./Payouts";
import Settings  from "./Settings";
import Sidebar   from "./components/Sidebar";
import TopBar    from "./components/TopBar";

import "./styles/SellerDashboard.css";

// ═════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════
export const SELLER_TOKEN_KEY = "seller_token";

export const VALID_TABS = [
  "overview",
  "orders",
  "products",
  "analytics",
  "payouts",
  "settings",
];

const tabFromParam = (p) =>
  VALID_TABS.includes(p) ? p : "overview";

// ═════════════════════════════════════════════════════════════
// TOKEN HELPERS
// ═════════════════════════════════════════════════════════════
export const getSellerToken = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

export const clearSellerToken = () =>
  localStorage.removeItem(SELLER_TOKEN_KEY);

export const sellerSignOut = () => {
  clearSellerToken();
  window.location.href = "/become-seller";
};

// ═════════════════════════════════════════════════════════════
// AXIOS INSTANCE
// Singleton — shared across all seller pages
// ═════════════════════════════════════════════════════════════
const _http = axios.create({
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request
_http.interceptors.request.use((config) => {
  const token = getSellerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear token + redirect
_http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearSellerToken();
      window.location.href = "/become-seller";
    }
    return Promise.reject(err);
  }
);

// Public API used by all seller sub-pages
export const sellerApi = {
  get:    (url, config)        => _http.get(url, config),
  post:   (url, data, config)  => _http.post(url, data, config),
  patch:  (url, data, config)  => _http.patch(url, data, config),
  put:    (url, data, config)  => _http.put(url, data, config),
  delete: (url, config)        => _http.delete(url, config),
};

// ═════════════════════════════════════════════════════════════
// DASHBOARD CONTEXT
// ═════════════════════════════════════════════════════════════
const DashboardContext = createContext(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useDashboard must be used inside <SellerDashboard />"
    );
  }
  return ctx;
};

// ═════════════════════════════════════════════════════════════
// ERROR CODE → MESSAGE MAP
// ═════════════════════════════════════════════════════════════
const ERROR_MESSAGES = {
  NO_TOKEN:
    "No seller account found. Please sign in.",
  NOT_SELLER_ACCOUNT:
    "This account is not registered as a seller.\n" +
    "Please use your seller credentials.",
  ACCOUNT_SUSPENDED:
    "Your seller account has been suspended.\n" +
    "Contact support for help.",
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

const AUTH_ERROR_CODES = new Set([
  "NO_TOKEN",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "NOT_SELLER_ACCOUNT",
  "ACCOUNT_SUSPENDED",
]);

const ONBOARDING_ERROR_CODES = new Set([
  "NO_VENDOR",
  "VENDOR_NOT_ACTIVE",
]);

// ═════════════════════════════════════════════════════════════
// TOKEN DIAGNOSTIC — dev only
// ═════════════════════════════════════════════════════════════
const runTokenDiagnostic = () => {
  if (process.env.NODE_ENV !== "development") return;

  const knownKeys = [
    "seller_token", "token", "auth_token",
    "jwt", "access_token", "sellerToken",
  ];

  console.group("🔍 [SellerDashboard] Token Diagnostic");
  knownKeys.forEach((k) => {
    const val = localStorage.getItem(k);
    console.log(
      val
        ? `  ✅ "${k}": ${val.slice(0, 40)}…`
        : `  ❌ "${k}": not found`
    );
  });
  if (!localStorage.getItem(SELLER_TOKEN_KEY)) {
    console.warn(
      "  ⚠️  seller_token MISSING.\n" +
      '  localStorage.setItem("seller_token", token)'
    );
  }
  console.groupEnd();
};

// ═════════════════════════════════════════════════════════════
// LOADING SCREEN
// ═════════════════════════════════════════════════════════════
const LoadingScreen = ({ stage, timeoutHit }) => (
  <div className="sd-center-wrap">
    <div className="sd-center-card">
      <span className="sd-center-card__emoji">🛒</span>
      <div
        className="sd-spinner"
        role="status"
        aria-label="Loading dashboard"
      />
      <p className="sd-center-card__msg">
        {timeoutHit
          ? "Server is waking up, please wait…"
          : stage === "notifications"
            ? "Almost ready…"
            : "Loading your dashboard…"}
      </p>
      {timeoutHit && (
        <button
          className="sd-ghost-btn"
          onClick={sellerSignOut}
        >
          ← Back to login
        </button>
      )}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════
// ERROR SCREEN
// ═════════════════════════════════════════════════════════════
const ErrorScreen = ({ error, code, raw, onRetry }) => {
  const isAuthErr       = AUTH_ERROR_CODES.has(code);
  const isOnboardingErr = ONBOARDING_ERROR_CODES.has(code);

  const friendlyMsg =
    ERROR_MESSAGES[code] ?? error ?? "Something went wrong.";

  const emoji = isAuthErr ? "🔐" : isOnboardingErr ? "🏪" : "⚠️";
  const title = isAuthErr
    ? "Sign In Required"
    : isOnboardingErr
      ? "Store Not Ready"
      : "Dashboard Error";

  return (
    <div className="sd-center-wrap">
      <div className="sd-center-card sd-center-card--wide">

        <span className="sd-center-card__emoji">{emoji}</span>
        <h2 className="sd-center-card__title">{title}</h2>
        <p className="sd-center-card__desc">{friendlyMsg}</p>

        {/* Dev debug panel */}
        {process.env.NODE_ENV === "development" && (
          <details className="sd-debug-panel">
            <summary className="sd-debug-panel__summary">
              🛠 Debug Info
            </summary>
            <pre className="sd-debug-panel__body">
              {JSON.stringify({ code, error, raw }, null, 2)}
            </pre>
          </details>
        )}

        <div className="sd-center-card__actions">
          {!isAuthErr && !isOnboardingErr && (
            <button className="sd-primary-btn" onClick={onRetry}>
              🔄 Try Again
            </button>
          )}
          {isOnboardingErr && (
            <button
              className="sd-primary-btn"
              onClick={() => { window.location.href = "/become-seller"; }}
            >
              🏪 Go to Store Setup
            </button>
          )}
          <button className="sd-danger-btn" onClick={sellerSignOut}>
            ↩ {isAuthErr ? "Sign In to Seller" : "Sign Out"}
          </button>
        </div>

      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function SellerDashboard() {
  const { tab: tabParam } = useParams();
  const routerNavigate   = useNavigate();

  // ── Core state ───────────────────────────────────────────
  const [activePage,  setActivePage]  = useState(tabFromParam(tabParam));
  const [vendor,      setVendor]      = useState(null);
  const [loadStage,   setLoadStage]   = useState("vendor");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [errorCode,   setErrorCode]   = useState(null);
  const [errorRaw,    setErrorRaw]    = useState(null);
  const [timeoutHit,  setTimeoutHit]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Notification state ───────────────────────────────────
  // Stored here so TopBar + context both share the same source
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // Abort ref — cancel in-flight requests on unmount
  const abortRef = useRef(null);

  // ── Diagnostic on mount ──────────────────────────────────
  useEffect(() => { runTokenDiagnostic(); }, []);

  // ── Sync tab from URL param ──────────────────────────────
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  // ── Close sidebar on page change ─────────────────────────
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  // ── Navigate — updates state + URL atomically ────────────
  const navigate = useCallback(
    (page) => {
      if (!VALID_TABS.includes(page)) return;
      setActivePage(page);
      routerNavigate(`/seller/dashboard/${page}`, { replace: true });
    },
    [routerNavigate]
  );

  // ═══════════════════════════════════════════════════════════
  // LOAD VENDOR
  // ═══════════════════════════════════════════════════════════
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();
    if (!token) {
      setError("No seller account found.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setLoadStage("vendor");
    setError(null);
    setErrorCode(null);
    setErrorRaw(null);
    setTimeoutHit(false);

    const slowTimer = setTimeout(() => setTimeoutHit(true), 7_000);

    try {
      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status",
        { signal: abortRef.current.signal }
      );

      if (process.env.NODE_ENV === "development") {
        console.log("[SellerDashboard] status:", data);
      }

      if (data?.vendor) {
        const { status } = data.vendor;
        if (status === "active" || status === "approved") {
          setVendor(data.vendor);
        } else {
          setError(`Your store status is: ${status}`);
          setErrorCode("VENDOR_NOT_ACTIVE");
        }
      } else if (data?.success === false) {
        setError(data.message ?? "Unknown error");
        setErrorCode(data.code   ?? "UNKNOWN");
      } else {
        setError("No vendor found.");
        setErrorCode("NO_VENDOR");
      }

    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError") return;

      const httpStatus  = err.response?.status;
      const serverCode  = err.response?.data?.code;
      const serverMsg   = err.response?.data?.message;
      const networkCode = err.code;

      if (process.env.NODE_ENV === "development") {
        console.error("[SellerDashboard] loadVendor error:", {
          httpStatus, serverCode, serverMsg, networkCode,
        });
      }

      setErrorRaw({ httpStatus, serverCode, networkCode });

      if (httpStatus === 401) {
        setError("Session expired. Please sign in again.");
        setErrorCode(serverCode ?? "TOKEN_EXPIRED");
      } else if (httpStatus === 403) {
        setError(serverMsg ?? "Access denied.");
        setErrorCode(serverCode ?? "FORBIDDEN");
      } else if (httpStatus === 404) {
        setError(serverMsg ?? "No vendor found.");
        setErrorCode(serverCode ?? "NO_VENDOR");
      } else if (
        networkCode === "ECONNABORTED" ||
        networkCode === "ERR_NETWORK"  ||
        !err.response
      ) {
        setError(
          "Connection timed out. " +
          "The server may be starting up — please retry."
        );
        setErrorCode("TIMEOUT");
      } else if (serverCode) {
        setError(serverMsg ?? serverCode);
        setErrorCode(serverCode);
      } else {
        setError(serverMsg ?? err.message ?? "Unexpected error.");
        setErrorCode("UNKNOWN");
      }

    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadStage(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // Uses the correct /api/seller/notifications endpoint
  // ═══════════════════════════════════════════════════════════

  // Full list load — called on mount + every 60s
  const loadNotifications = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications",
        { params: { limit: 20, page: 1 } }
      );
      if (data?.success) {
        const list = data.data?.notifications ?? [];
        setNotifications(list);
        setUnreadCount(data.data?.unread_count ?? 0);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SellerDashboard] notifications:", err.message);
      }
    }
  }, []);

  // Lightweight count poll — called every 60s after initial load
  const pollUnreadCount = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications/unread-count"
      );
      if (data?.success) {
        const incoming = data.count ?? 0;
        setUnreadCount(incoming);
        // New notifications arrived — reload full list
        if (incoming > unreadCount) {
          loadNotifications();
        }
      }
    } catch { /* non-critical */ }
  }, [unreadCount, loadNotifications]);

  // Mark single notification as read
  const markNotifRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await sellerApi.patch(
        `/api/seller/notifications/${id}/read`
      );
    } catch {
      // Rollback on error
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: false, read_at: null } : n
        )
      );
      setUnreadCount((c) => c + 1);
    }
  }, []);

  // Mark all as read — optimistic + single API call
  const markAllRead = useCallback(async () => {
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;

    // Optimistic
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: now }))
    );
    setUnreadCount(0);

    try {
      await sellerApi.patch(
        "/api/seller/notifications/read-all"
      );
    } catch {
      // Reload real state on failure
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  // ── Mount ────────────────────────────────────────────────
  useEffect(() => {
    loadVendor();
    return () => { abortRef.current?.abort(); };
  }, [loadVendor]);

  // ── Start notifications once vendor is confirmed ─────────
  useEffect(() => {
    if (!vendor) return;

    // Initial load
    loadNotifications();

    // Poll unread count every 60s (lightweight)
    const t = setInterval(pollUnreadCount, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications, pollUnreadCount]);

  // ═══════════════════════════════════════════════════════════
  // PAGE MAP — memoised so it never recreates on every render
  // ═══════════════════════════════════════════════════════════
  const pageMap = useMemo(() => ({
    overview:  <Overview  />,
    orders:    <Orders    />,
    products:  <Products  />,
    analytics: <Analytics />,
    payouts:   <Payouts   />,
    settings:  <Settings  />,
  }), []);

  // ═══════════════════════════════════════════════════════════
  // RENDER GUARDS
  // ═══════════════════════════════════════════════════════════

  // 1. No token + not loading → redirect immediately
  if (!getSellerToken() && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  // 2. Loading
  if (loading) {
    return (
      <LoadingScreen stage={loadStage} timeoutHit={timeoutHit} />
    );
  }

  // 3. Vendor not active / not found → onboarding
  if (
    errorCode === "VENDOR_NOT_ACTIVE" ||
    errorCode === "NO_VENDOR"
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

  // ═══════════════════════════════════════════════════════════
  // CONTEXT VALUE — memoised to prevent unnecessary re-renders
  // ═══════════════════════════════════════════════════════════
  const ctxValue = {
    // Vendor
    vendor,
    setVendor,
    reloadVendor: loadVendor,

    // Navigation
    activePage,
    navigate,

    // Notifications — full state exposed to context
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadNotifications: loadNotifications,
  };

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <DashboardContext.Provider value={ctxValue}>
      <div className="sd-root">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="sd-mobile-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Desktop sidebar */}
        <aside className="sd-sidebar-desktop" aria-label="Sidebar">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            onClose={() => {}}
          />
        </aside>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <aside
            className="sd-sidebar-mobile"
            aria-label="Mobile sidebar"
          >
            <Sidebar
              vendor={vendor}
              activePage={activePage}
              onNavigate={navigate}
              unreadCount={unreadCount}
              onClose={() => setSidebarOpen(false)}
              showClose
            />
          </aside>
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

          <main className="sd-page-wrap" id="sd-main-content">
            <div key={activePage} className="sd-page-anim">
              {pageMap[activePage] ?? pageMap.overview}
            </div>
          </main>
        </div>

      </div>
    </DashboardContext.Provider>
  );
}