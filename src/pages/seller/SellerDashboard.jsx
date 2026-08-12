// pages/seller/SellerDashboard.jsx
/**
 * v4 — Token key aligned with sellerAuth.routes.js
 *
 * sellerAuth.routes.js stores JWT as:
 *   localStorage.setItem("sellerToken", data.token)
 *
 * This file now reads the same key: "sellerToken"
 * All other logic unchanged.
 */

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

/* ═════════════════════════════════════════════════════════════
   CONSTANTS
   ✅ FIX: "sellerToken" matches sellerAuth.routes.js SELLER_TOKEN_KEY
═════════════════════════════════════════════════════════════ */
export const SELLER_TOKEN_KEY = "sellerToken"; /* ✅ was "seller_token" */

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

/* ═════════════════════════════════════════════════════════════
   TOKEN HELPERS
═════════════════════════════════════════════════════════════ */
export const getSellerToken = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

export const clearSellerToken = () =>
  localStorage.removeItem(SELLER_TOKEN_KEY);

export const sellerSignOut = () => {
  clearSellerToken();
  window.location.href = "/become-seller";
};

/* ═════════════════════════════════════════════════════════════
   AXIOS INSTANCE
═════════════════════════════════════════════════════════════ */
const _http = axios.create({
  baseURL : import.meta.env.VITE_API_URL ?? "",
  timeout : 20_000,
  headers : { "Content-Type": "application/json" },
});

_http.interceptors.request.use((config) => {
  const token = getSellerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

_http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getSellerToken()) {
      clearSellerToken();
      window.location.href = "/become-seller";
    }
    return Promise.reject(err);
  }
);

export const sellerApi = {
  get    : (url, config)       => _http.get(url, config),
  post   : (url, data, config) => _http.post(url, data, config),
  patch  : (url, data, config) => _http.patch(url, data, config),
  put    : (url, data, config) => _http.put(url, data, config),
  delete : (url, config)       => _http.delete(url, config),
};

/* ═════════════════════════════════════════════════════════════
   DASHBOARD CONTEXT
═════════════════════════════════════════════════════════════ */
const DashboardContext = createContext(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be inside <SellerDashboard />");
  return ctx;
};

/* ═════════════════════════════════════════════════════════════
   ERROR MESSAGES
═════════════════════════════════════════════════════════════ */
const ERROR_MESSAGES = {
  NO_TOKEN         : "No seller account found. Please sign in.",
  NOT_SELLER_ACCOUNT:
    "This account is not registered as a seller. " +
    "Please use your seller credentials.",
  ACCOUNT_SUSPENDED:
    "Your seller account has been suspended. Contact support for help.",
  NO_VENDOR        : "No store found. Please complete seller setup.",
  VENDOR_NOT_ACTIVE: "Your store is pending approval. Check back soon.",
  TOKEN_EXPIRED    : "Your session has expired. Please sign in again.",
  INVALID_TOKEN    : "Invalid session. Please sign in again.",
  TIMEOUT          :
    "Connection timed out. The server may be starting up — please retry.",
  NETWORK          : "Could not reach the server. Check your connection.",
};

const AUTH_ERROR_CODES = new Set([
  "NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN",
  "NOT_SELLER_ACCOUNT", "ACCOUNT_SUSPENDED",
]);

const ONBOARDING_ERROR_CODES = new Set([
  "NO_VENDOR", "VENDOR_NOT_ACTIVE",
]);

/* ═════════════════════════════════════════════════════════════
   DEV DIAGNOSTIC
   ✅ Now checks BOTH key names and tells you which one has value
═════════════════════════════════════════════════════════════ */
const runTokenDiagnostic = () => {
  if (import.meta.env.MODE !== "development") return;

  console.group("🔍 [SellerDashboard] Token Diagnostic");

  /* Check the key this dashboard uses */
  const dashKey = SELLER_TOKEN_KEY; /* "sellerToken" */
  const val     = localStorage.getItem(dashKey);

  console.log(
    val
      ? `  ✅ "${dashKey}": ${val.slice(0, 40)}…`
      : `  ❌ "${dashKey}": NOT FOUND`
  );

  /* Check other possible keys for debugging */
  const otherKeys = [
    "seller_token", "token", "auth_token",
    "jwt", "access_token",
  ].filter((k) => k !== dashKey);

  otherKeys.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v) {
      console.warn(
        `  ⚠️  "${k}" has a value but dashboard reads "${dashKey}". ` +
        `This mismatch causes a blank page.`
      );
    }
  });

  if (!val) {
    console.error(
      `  💥 Dashboard will show blank — "${dashKey}" is empty.\n` +
      `  Your login must do:\n` +
      `    localStorage.setItem("${dashKey}", data.token)\n` +
      `  sellerAuth.routes.js returns: tokenKey = "${dashKey}"`
    );
  }

  console.groupEnd();
};

/* ═════════════════════════════════════════════════════════════
   LOADING SCREEN
═════════════════════════════════════════════════════════════ */
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
          ? "Server is waking up — please wait…"
          : stage === "notifications"
            ? "Almost ready…"
            : "Loading your dashboard…"}
      </p>
      {timeoutHit && (
        <button className="sd-ghost-btn" onClick={sellerSignOut}>
          ← Back to login
        </button>
      )}
    </div>
  </div>
);

/* ═════════════════════════════════════════════════════════════
   ERROR SCREEN
═════════════════════════════════════════════════════════════ */
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

        {import.meta.env.MODE === "development" && (
          <details className="sd-debug-panel">
            <summary className="sd-debug-panel__summary">🛠 Debug Info</summary>
            <pre className="sd-debug-panel__body">
              {JSON.stringify({
                code, error, raw,
                tokenKey  : SELLER_TOKEN_KEY,
                tokenFound: !!getSellerToken(),
                allKeys   : Object.keys(localStorage),
              }, null, 2)}
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

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════════════ */
export default function SellerDashboard() {
  const { tab: tabParam } = useParams();
  const routerNavigate    = useNavigate();

  /* Core state */
  const [activePage,  setActivePage]  = useState(tabFromParam(tabParam));
  const [vendor,      setVendor]      = useState(null);
  const [loadStage,   setLoadStage]   = useState("vendor");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [errorCode,   setErrorCode]   = useState(null);
  const [errorRaw,    setErrorRaw]    = useState(null);
  const [timeoutHit,  setTimeoutHit]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasToken,    setHasToken]    = useState(() => !!getSellerToken());

  /* Notification state */
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const abortRef       = useRef(null);
  const unreadCountRef = useRef(0);

  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);

  /* Dev diagnostic */
  useEffect(() => { runTokenDiagnostic(); }, []);

  /* Sync tab from URL */
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  /* Close sidebar on page change */
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  /* Navigate */
  const navigate = useCallback(
    (page, { replace = true } = {}) => {
      if (!VALID_TABS.includes(page)) return;
      setActivePage(page);
      routerNavigate(`/seller/dashboard/${page}`, { replace });
    },
    [routerNavigate]
  );

  /* ═══════════════════════════════════════════════════════════
     LOAD VENDOR
  ═══════════════════════════════════════════════════════════ */
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();
    if (!token) {
      setHasToken(false);
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

      if (import.meta.env.MODE === "development") {
        console.log("[SellerDashboard] onboarding status:", data);
      }

      if (data?.vendor) {
        const { status } = data.vendor;
        if (status === "active" || status === "approved") {
          setVendor(data.vendor);
          setHasToken(true);
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

      if (import.meta.env.MODE === "development") {
        console.error("[SellerDashboard] loadVendor error:", {
          httpStatus, serverCode, serverMsg, networkCode,
        });
      }

      setErrorRaw({ httpStatus, serverCode, networkCode });

      if (httpStatus === 401) {
        setHasToken(false);
        setErrorCode(serverCode ?? "TOKEN_EXPIRED");
        setError("Session expired. Please sign in again.");
      } else if (httpStatus === 403) {
        setErrorCode(serverCode ?? "FORBIDDEN");
        setError(serverMsg ?? "Access denied.");
      } else if (httpStatus === 404) {
        setErrorCode(serverCode ?? "NO_VENDOR");
        setError(serverMsg ?? "No vendor found.");
      } else if (
        networkCode === "ECONNABORTED" ||
        networkCode === "ERR_NETWORK"  ||
        !err.response
      ) {
        setErrorCode("TIMEOUT");
        setError(
          "Connection timed out. " +
          "The server may be starting up — please retry."
        );
      } else if (serverCode) {
        setErrorCode(serverCode);
        setError(serverMsg ?? serverCode);
      } else {
        setErrorCode("UNKNOWN");
        setError(serverMsg ?? err.message ?? "Unexpected error.");
      }

    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadStage(null);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     NOTIFICATIONS
  ═══════════════════════════════════════════════════════════ */
  const loadNotifications = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications",
        { params: { limit: 20, page: 1 } }
      );
      if (data?.success) {
        const list  = data.data?.notifications ?? [];
        const count = data.data?.unread_count  ?? 0;
        setNotifications(list);
        setUnreadCount(count);
        unreadCountRef.current = count;
      }
    } catch (err) {
      if (import.meta.env.MODE === "development") {
        console.warn("[SellerDashboard] notifications:", err.message);
      }
    }
  }, []);

  const pollUnreadCount = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications/unread-count"
      );
      if (data?.success) {
        const incoming = data.count ?? 0;
        setUnreadCount(incoming);
        unreadCountRef.current = incoming;
        if (incoming > unreadCountRef.current) loadNotifications();
      }
    } catch { /* silent */ }
  }, [loadNotifications]);

  const markNotifRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((c) => {
      const next = Math.max(0, c - 1);
      unreadCountRef.current = next;
      return next;
    });
    try {
      await sellerApi.patch(`/api/seller/notifications/${id}/read`);
    } catch {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: false, read_at: null } : n
        )
      );
      setUnreadCount((c) => {
        const next = c + 1;
        unreadCountRef.current = next;
        return next;
      });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;

    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: now }))
    );
    setUnreadCount(0);
    unreadCountRef.current = 0;

    try {
      await sellerApi.patch("/api/seller/notifications/read-all");
    } catch {
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  /* Mount */
  useEffect(() => {
    loadVendor();
    return () => { abortRef.current?.abort(); };
  }, [loadVendor]);

  /* Start polling once vendor confirmed */
  useEffect(() => {
    if (!vendor) return;
    loadNotifications();
    const t = setInterval(pollUnreadCount, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications, pollUnreadCount]);

  /* Page map */
  const pageMap = useMemo(() => ({
    overview  : <Overview  />,
    orders    : <Orders    />,
    products  : <Products  />,
    analytics : <Analytics />,
    payouts   : <Payouts   />,
    settings  : <Settings  />,
  }), []);

  /* Context value */
  const ctxValue = useMemo(() => ({
    vendor,
    setVendor,
    reloadVendor        : loadVendor,
    activePage,
    navigate,
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadNotifications : loadNotifications,
  }), [
    vendor, activePage, navigate,
    notifications, unreadCount,
    markNotifRead, markAllRead,
    loadVendor, loadNotifications,
  ]);

  /* ═══════════════════════════════════════════════════════════
     RENDER GUARDS
  ═══════════════════════════════════════════════════════════ */
  if (!hasToken && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  if (loading) {
    return <LoadingScreen stage={loadStage} timeoutHit={timeoutHit} />;
  }

  if (
    errorCode === "VENDOR_NOT_ACTIVE" ||
    errorCode === "NO_VENDOR"
  ) {
    return <Navigate to="/become-seller" replace />;
  }

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

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <DashboardContext.Provider value={ctxValue}>
      <div className="sd-root">

        {sidebarOpen && (
          <div
            className="sd-mobile-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside className="sd-sidebar-desktop" aria-label="Sidebar">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            onClose={() => {}}
          />
        </aside>

        {sidebarOpen && (
          <aside className="sd-sidebar-mobile" aria-label="Mobile sidebar">
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