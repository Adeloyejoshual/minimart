// pages/seller/SellerDashboard.jsx
// ═════════════════════════════════════════════════════════════
// Seller Dashboard main shell.
//
// v4 — Token key aligned + polling loop fixed + safety nets
// ─────────────────────────────────────────────────────────────
// Reads JWT from localStorage["sellerToken"] — same key that:
//   • sellerAuth.routes.js  writes on login
//   • useSellerFlow.js       reads on onboarding
//
// Provides <DashboardContext> to all sub-pages via useDashboard().
// ═════════════════════════════════════════════════════════════

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
   ✅ "sellerToken" matches sellerAuth.routes.js + useSellerFlow.js
═════════════════════════════════════════════════════════════ */
export const SELLER_TOKEN_KEY = "sellerToken";

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

/*
 * ✅ One-time migration — same as useSellerFlow.js
 *    Handles users who had tokens under the old key.
 */
(function migrateLegacyToken() {
  if (typeof window === "undefined") return;

  const NEW_KEY  = SELLER_TOKEN_KEY;
  const OLD_KEYS = ["seller_token", "token", "auth_token", "sellerAuthToken"];

  if (localStorage.getItem(NEW_KEY)) return;

  for (const oldKey of OLD_KEYS) {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal && oldVal.split(".").length === 3) {
      localStorage.setItem(NEW_KEY, oldVal);
      localStorage.removeItem(oldKey);
      console.log(
        `[SellerDashboard] 🔄 Migrated token: "${oldKey}" → "${NEW_KEY}"`
      );
      return;
    }
  }
})();

/* ═════════════════════════════════════════════════════════════
   AXIOS INSTANCE
═════════════════════════════════════════════════════════════ */
const _http = axios.create({
  /* Reads from Vite env — set VITE_API_URL in .env if needed */
  baseURL : import.meta.env.VITE_API_URL ?? "",
  timeout : 20_000,
  headers : { "Content-Type": "application/json" },
});

/* Attach token on every request */
_http.interceptors.request.use((config) => {
  const token = getSellerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* Handle 401 globally — only redirect if we actually had a token */
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

/* Shared API — used by all seller sub-pages */
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
  if (!ctx) {
    throw new Error(
      "useDashboard must be used inside <SellerDashboard />"
    );
  }
  return ctx;
};

/* ═════════════════════════════════════════════════════════════
   ERROR CODE → USER MESSAGE
═════════════════════════════════════════════════════════════ */
const ERROR_MESSAGES = {
  NO_TOKEN           : "No seller account found. Please sign in.",
  NOT_SELLER_ACCOUNT :
    "This account is not registered as a seller. " +
    "Please use your seller credentials.",
  ACCOUNT_SUSPENDED  :
    "Your seller account has been suspended. Contact support for help.",
  NO_VENDOR          : "No store found. Please complete seller setup.",
  VENDOR_NOT_ACTIVE  : "Your store is pending approval. Check back soon.",
  TOKEN_EXPIRED      : "Your session has expired. Please sign in again.",
  INVALID_TOKEN      : "Invalid session. Please sign in again.",
  TIMEOUT            :
    "Connection timed out. The server may be starting up — please retry.",
  NETWORK            : "Could not reach the server. Check your connection.",
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

/* ═════════════════════════════════════════════════════════════
   DEV DIAGNOSTIC
═════════════════════════════════════════════════════════════ */
const runTokenDiagnostic = () => {
  if (import.meta.env.MODE !== "development") return;

  console.group("🔍 [SellerDashboard] Token Diagnostic");

  const val = localStorage.getItem(SELLER_TOKEN_KEY);
  console.log(
    val
      ? `  ✅ "${SELLER_TOKEN_KEY}": ${val.slice(0, 40)}…`
      : `  ❌ "${SELLER_TOKEN_KEY}": NOT FOUND`
  );

  /* Warn about mismatched keys */
  const otherKeys = ["seller_token", "token", "auth_token", "jwt"];
  otherKeys.forEach((k) => {
    if (k !== SELLER_TOKEN_KEY && localStorage.getItem(k)) {
      console.warn(
        `  ⚠️  "${k}" also has a value. Dashboard reads "${SELLER_TOKEN_KEY}" — ` +
        `run the migration or clear old keys.`
      );
    }
  });

  if (!val) {
    console.error(
      `  💥 Dashboard will redirect to /become-seller — no token found.`
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

  const friendlyMsg = ERROR_MESSAGES[code] ?? error ?? "Something went wrong.";

  const emoji = isAuthErr       ? "🔐"
              : isOnboardingErr ? "🏪"
              :                   "⚠️";

  const title = isAuthErr       ? "Sign In Required"
              : isOnboardingErr ? "Store Not Ready"
              :                   "Dashboard Error";

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
                tokenKey   : SELLER_TOKEN_KEY,
                tokenFound : !!getSellerToken(),
                allKeys    : Object.keys(localStorage),
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

  /* ── Core state ──────────────────────────────────────────── */
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

  /* ── Notification state ─────────────────────────────────── */
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  /* Refs */
  const abortRef       = useRef(null);
  const unreadCountRef = useRef(0);

  /* Keep ref in sync with state (used by polling) */
  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);

  /* Dev diagnostic on mount */
  useEffect(() => { runTokenDiagnostic(); }, []);

  /* Sync tab from URL */
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  /* Close sidebar on page change */
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  /* ═══════════════════════════════════════════════════════════
     NAVIGATE — updates state + URL atomically
     ✅ replace:true only on tab switch (preserves back button)
  ═══════════════════════════════════════════════════════════ */
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

    /* "Server is waking up" hint after 7s */
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
      /* Ignore abort errors */
      if (axios.isCancel(err) || err.name === "CanceledError") return;

      const httpStatusCode = err.response?.status;
      const serverCode     = err.response?.data?.code;
      const serverMsg      = err.response?.data?.message;
      const networkCode    = err.code;

      if (import.meta.env.MODE === "development") {
        console.error("[SellerDashboard] loadVendor error:", {
          httpStatus : httpStatusCode,
          serverCode,
          serverMsg,
          networkCode,
        });
      }

      setErrorRaw({
        httpStatus : httpStatusCode,
        serverCode,
        networkCode,
      });

      if (httpStatusCode === 401) {
        setHasToken(false);
        setErrorCode(serverCode ?? "TOKEN_EXPIRED");
        setError("Session expired. Please sign in again.");

      } else if (httpStatusCode === 403) {
        setErrorCode(serverCode ?? "FORBIDDEN");
        setError(serverMsg ?? "Access denied.");

      } else if (httpStatusCode === 404) {
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
  }, []); /* stable — no deps */

  /* ═══════════════════════════════════════════════════════════
     NOTIFICATIONS
     ✅ All callbacks are stable (empty deps) so polling
        interval doesn't re-subscribe every 60 s.
  ═══════════════════════════════════════════════════════════ */

  /* Full list load */
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
        console.warn("[SellerDashboard] notifications load:", err.message);
      }
    }
  }, []);

  /* Lightweight count poll — uses ref to avoid stale closure */
  const pollUnreadCount = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications/unread-count"
      );
      if (data?.success) {
        const incoming = data.count ?? 0;
        const prev     = unreadCountRef.current;

        setUnreadCount(incoming);
        unreadCountRef.current = incoming;

        /* New notifications arrived — reload full list */
        if (incoming > prev) loadNotifications();
      }
    } catch { /* silent */ }
  }, [loadNotifications]);

  /* Mark single read — optimistic */
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
      /* Rollback on failure */
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

  /* Mark all read */
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
      loadNotifications(); /* reload real state */
    }
  }, [notifications, loadNotifications]);

  /* Mount */
  useEffect(() => {
    loadVendor();
    return () => { abortRef.current?.abort(); };
  }, [loadVendor]);

  /* Start notifications polling once vendor confirmed */
  useEffect(() => {
    if (!vendor) return;

    loadNotifications();

    const t = setInterval(pollUnreadCount, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications, pollUnreadCount]);

  /* ═══════════════════════════════════════════════════════════
     PAGE MAP — stable, never recreated
  ═══════════════════════════════════════════════════════════ */
  const pageMap = useMemo(() => ({
    overview  : <Overview  />,
    orders    : <Orders    />,
    products  : <Products  />,
    analytics : <Analytics />,
    payouts   : <Payouts   />,
    settings  : <Settings  />,
  }), []);

  /* ═══════════════════════════════════════════════════════════
     CONTEXT VALUE
     ✅ Memoised so consumers don't re-render on unrelated updates
  ═══════════════════════════════════════════════════════════ */
  const ctxValue = useMemo(() => ({
    /* Vendor */
    vendor,
    setVendor,
    reloadVendor        : loadVendor,

    /* Navigation */
    activePage,
    navigate,

    /* Notifications */
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadNotifications : loadNotifications,
  }), [
    vendor,
    activePage,
    navigate,
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    loadVendor,
    loadNotifications,
  ]);

  /* ═══════════════════════════════════════════════════════════
     RENDER GUARDS
  ═══════════════════════════════════════════════════════════ */

  /* 1. No token — redirect */
  if (!hasToken && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 2. Loading */
  if (loading) {
    return <LoadingScreen stage={loadStage} timeoutHit={timeoutHit} />;
  }

  /* 3. Vendor not set up → onboarding */
  if (
    errorCode === "VENDOR_NOT_ACTIVE" ||
    errorCode === "NO_VENDOR"
  ) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 4. All other errors */
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
     DASHBOARD RENDER
  ═══════════════════════════════════════════════════════════ */
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

          <main className="sd-page-wrap" id="sd-main-content">
            {/*
              key={activePage} unmounts + remounts the child on tab
              switch — clean slate + fade-in animation.
            */}
            <div key={activePage} className="sd-page-anim">
              {pageMap[activePage] ?? pageMap.overview}
            </div>
          </main>
        </div>

      </div>
    </DashboardContext.Provider>
  );
}